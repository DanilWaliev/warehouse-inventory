// static/js/pages/movement/transits.js
export function initTransits({ showToast, showConfirm }) {
  const table = document.getElementById('table-transits');
  const tbody = table ? table.querySelector('tbody') : null;

  const modal = document.getElementById('modal-transit-create');
  const form  = document.getElementById('form-transit-create');
  const title = document.getElementById('modal-transit-title');
  const btnClose = document.getElementById('modal-transit-cancel');

  let editingId = null;

  // ===== тост-хелпер для не-404 =====
  function toastByStatus(res, fallback) {
    switch (res.status) {
      case 409: showToast?.("Транзитный склад уже существует"); break;
      case 400: showToast?.("Некорректные данные"); break;
      default:  showToast?.(fallback);
    }
  }

  // ===== list GET: 404 -> пусто без тоста =====
  async function parseListGET(res, fallback) {
    if (res.status === 404) return []; // нет данных — спокойно
    if (!res.ok) {
      toastByStatus(res, fallback);
      return [];
    }
    const ct = res.headers.get('Content-Type') || '';
    return ct.includes('application/json') ? await res.json() : [];
  }

  // ===== generic (не список): ошибки -> тосты =====
  async function parseOrToast(res, fallback) {
    if (!res.ok) {
      toastByStatus(res, fallback);
      return null;
    }
    const ct = res.headers.get('Content-Type') || '';
    return ct.includes('application/json') ? await res.json() : true;
  }

  // ===== API =====
  async function fetchList() {
    const res = await fetch('/api/storage?type=transitstorage&inventory=false');
    return parseListGET(res, "Ошибка загрузки транзитных складов");
  }

  async function fetchOne(id) {
    const res = await fetch(`/api/storage?id=${id}&inventory=false`);
    return parseOrToast(res, "Ошибка загрузки транзитного склада");
  }

  async function createTransit(payload) {
    const res = await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'transitstorage', ...payload }),
    });
    return parseOrToast(res, "Ошибка при сохранении транзитного склада");
  }

  async function updateTransit(id, payload) {
    const res = await fetch('/api/storage', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'transit', ...payload }),
    });
    return parseOrToast(res, "Ошибка при сохранении транзитного склада");
  }

  async function deleteTransit(id) {
    const res = await fetch(`/api/storage?id=${id}`, { method: 'DELETE' });
    return parseOrToast(res, "Ошибка при удалении транзитного склада");
  }

  // ===== UI =====
  function renderEmpty() {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="text-muted">Нет транзитных складов</td></tr>`;
  }

  function renderList(list) {
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(list) || list.length === 0) {
      renderEmpty();
      return;
    }

    for (const t of list) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-id">${t.ID ?? ''}</td>
        <td>${t.Name ?? ''}</td>
        <td>${t.TransportType ?? ''}</td>
        <td>${t.Capacity ?? ''}</td>
        <td>${t.Location ?? ''}</td>
        <td>${t.Note ?? ''}</td>
        <td>
          <button class="btn-edit" data-id="${t.ID}">Изм.</button>
          <button class="btn-delete" data-id="${t.ID}">Удалить</button>
        </td>
      `;
      tr.querySelector('.btn-edit')?.addEventListener('click', () => openEdit(t.ID));
      tr.querySelector('.btn-delete')?.addEventListener('click', async () => {
        if (!(await showConfirm?.('Удалить транзитный склад?', 'Подтверждение'))) return;
        const ok = await deleteTransit(t.ID);
        if (!ok) return; // ошибка уже показана
        await load();
        showToast?.('Транзитный склад удалён', 'success');
      });
      tbody.appendChild(tr);
    }
  }

  async function load() {
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const data = await fetchList(); // [] при 404 без тоста
      renderList(data);
    } catch {
      renderEmpty(); // сетевой фейл — молча покажем пусто
    }
  }

  function showModal() {
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    form?.reset();
    editingId = null;
  }

  function openCreate() {
    editingId = null;
    if (title) title.textContent = 'Создать транзитный склад';
    form?.reset();
    showModal();
  }

  async function openEdit(id) {
    try {
      const t = await fetchOne(id);
      if (!t) return; // ошибка уже показана
      editingId = id;
      if (title) title.textContent = 'Изменить транзитный склад';

      // заполнение формы
      if (form) {
        form.reset();
        form.elements['name'].value        = t.Name || '';
        form.elements['capacity_kg'].value = t.CapacityKg ?? t.Capacity ?? '';
        if (form.elements['location']) form.elements['location'].value = t.Location ?? '';
        if (form.elements['note'])     form.elements['note'].value     = t.Note ?? '';
      }
      showModal();
    } catch {
      showToast?.('Ошибка загрузки транзитного склада');
    }
  }

  // ===== submit =====
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name       = String(fd.get('name') || '').trim();
    const transportType       = String(fd.get('type') || '').trim();
    const capacity = parseFloat(String(fd.get('capacity') || '0'));
    const location   = String(fd.get('location') || '').trim();
    const note       = String(fd.get('note') || '').trim();

    if (!name || !Number.isFinite(capacity) || capacity <= 0) {
      showToast?.('Заполните название и корректную вместимость (кг)');
      return;
    }

    if (editingId) {
      const ok = await updateTransit(editingId, { name, transportType, capacity, location, note });
      if (!ok) return; // ошибка уже показана
      showToast?.('Транзитный склад обновлён', 'success');
    } else {
      const ok = await createTransit({ name, transportType, capacity, location, note });
      if (!ok) return; // ошибка уже показана
      showToast?.('Транзитный склад создан', 'success');
    }

    closeModal();
    await load();
  });

  btnClose?.addEventListener('click', closeModal);

  return { load, openCreate, openEdit, closeModal };
}
