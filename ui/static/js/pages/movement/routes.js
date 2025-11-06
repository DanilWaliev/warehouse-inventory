// static/js/pages/movement/routes.js
export function initRoutes({ showToast, showConfirm }) {
  const tbody = document.getElementById('table-routes-body');
  const form  = document.getElementById('form-route-create');
  const modal = document.getElementById('modal-route-create');
  const title = document.getElementById('modal-route-title');
  const btnClose = document.getElementById('modal-route-cancel');

  let editingId = null;

  // ====== TOAST helper (единый текст для не-404 ошибок) ======
  function toastByStatus(res, fallback) {
    switch (res.status) {
      case 409:
        showToast?.("ТМЦ уже существует");
        break;
      case 400:
        showToast?.("Некорректные данные");
        break;
      default:
        showToast?.(fallback);
    }
  }

  // ====== LIST GET (Маршруты/Склады/Транзиты) ======
  async function parseListGET(res, fallbackToast) {
    if (res.status === 404) return []; // тихо: пусто без тоста
    if (!res.ok) {
      toastByStatus(res, fallbackToast);
      return [];
    }
    const ct = res.headers.get('Content-Type') || '';
    return ct.includes('application/json') ? await res.json() : [];
  }

  // ====== ONE GET / MUTATIONS ======
  async function parseOrToast(res, fallbackToast) {
    if (!res.ok) {
      // тут 404 тоже кидаем тост (для fetchOne/edit)
      toastByStatus(res, fallbackToast);
      return null;
    }
    const ct = res.headers.get('Content-Type') || '';
    return ct.includes('application/json') ? await res.json() : true;
  }

  // ====== API ======
  async function fetchList() {
    const res = await fetch('/api/route');
    return parseListGET(res, "Ошибка загрузки маршрутов");
  }

  async function fetchStorages() {
    const res = await fetch('/api/storage?type=warehouse&inventory=false');
    return parseListGET(res, "Ошибка загрузки складов");
  }

  async function fetchTransits() {
    const res = await fetch('/api/storage?type=transitstorage&inventory=false');
    return parseListGET(res, "Ошибка загрузки транзитных складов");
  }

  async function fetchOne(id) {
    const res = await fetch(`/api/route?id=${id}`);
    return parseOrToast(res, "Маршрут не найден");
  }

  async function createRoute(payload) {
    const res = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseOrToast(res, "Ошибка при сохранении маршрута");
  }

  async function updateRoute(id, payload) {
    const res = await fetch('/api/route', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    });
    return parseOrToast(res, "Ошибка при сохранении маршрута");
  }

  async function deleteRoute(id) {
    const res = await fetch(`/api/route?id=${id}`, { method: 'DELETE' });
    return parseOrToast(res, "Ошибка при удалении маршрута");
  }

  // ====== RENDER ======
  async function load() {
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const data = await fetchList(); // [] при 404 без тоста
      if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-muted">Нет маршрутов</td></tr>`;
        return;
      }
      data.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="col-id">${r.ID}</td>
          <td>${r.From?.Name || ''}</td>
          <td>${r.To?.Name || ''}</td>
          <td>${r.Transit?.Name || ''}</td>
          <td>${r.ETAHours ?? ''}</td>
          <td>
            <button class="btn-edit" data-id="${r.ID}">Изм.</button>
            <button class="btn-delete" data-id="${r.ID}">Удалить</button>
          </td>
        `;
        tr.querySelector('.btn-edit')?.addEventListener('click', () => openEdit(r.ID));
        tr.querySelector('.btn-delete')?.addEventListener('click', async () => {
          if (!(await showConfirm?.('Удалить маршрут?', 'Подтверждение'))) return;
          const ok = await deleteRoute(r.ID);
          if (!ok) return;
          await load();
          showToast?.('Маршрут удалён', 'success');
        });
        tbody.appendChild(tr);
      });
    } catch {
      // Сетевые фейлы — покажем «пусто» (без тоста для списка)
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted">Нет маршрутов</td></tr>`;
    }
  }

  function openCreate() {
    editingId = null;
    if (title) title.textContent = 'Создать маршрут';
    fillForm().then(() => {
      form?.reset();
      showModal();
    });
  }

  async function openEdit(id) {
    try {
      const [route] = await Promise.all([fetchOne(id), fillForm()]);
      if (!route) return; // тост уже показан при !ok
      editingId = id;
      if (title) title.textContent = 'Изменить маршрут';
      form.elements['name'].value        = route.Name || '';
      form.elements['from_id'].value     = route.From?.ID ?? '';
      form.elements['to_id'].value       = route.To?.ID ?? '';
      form.elements['transit_id'].value  = route.Transit?.ID ?? '';
      form.elements['eta_hours'].value   = route.ETAHours ?? '';
      showModal();
    } catch {
      showToast?.('Ошибка загрузки маршрута');
    }
  }

  async function fillForm() {
    if (!form) return;
    const [warehouses, transits] = await Promise.all([fetchStorages(), fetchTransits()]);
    const fromSel = form.elements['from_id'];
    const toSel   = form.elements['to_id'];
    const trSel   = form.elements['transit_id'];

    if (fromSel) {
      fromSel.innerHTML = (Array.isArray(warehouses) && warehouses.length)
        ? warehouses.map(w => `<option value="${w.ID}">${w.Name}${w.Location ? ' — ' + w.Location : ''}</option>`).join('')
        : `<option value="">— нет складов —</option>`;
    }
    if (toSel) {
      toSel.innerHTML = (Array.isArray(warehouses) && warehouses.length)
        ? warehouses.map(w => `<option value="${w.ID}">${w.Name}${w.Location ? ' — ' + w.Location : ''}</option>`).join('')
        : `<option value="">— нет складов —</option>`;
    }
    if (trSel) {
      trSel.innerHTML = (Array.isArray(transits) && transits.length)
        ? transits.map(t => `<option value="${t.ID}">${t.Name}${t.Location ? ' — ' + t.Location : ''}</option>`).join('')
        : `<option value="">— нет транзитных —</option>`;
    }
  }

  // ====== MODAL ======
  function showModal() {
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    form?.reset();
    editingId = null;
  }

  // ====== SUBMIT ======
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const fromId = parseInt(fd.get('from_id') || '0', 10);
    const toId   = parseInt(fd.get('to_id') || '0', 10);
    const trId   = parseInt(fd.get('transit_id') || '0', 10);
    const eta    = parseInt(fd.get('eta_hours') || '0', 10);

    if (!fromId || !toId || !trId || !Number.isFinite(eta) || eta <= 0) {
      showToast?.('Заполните поля корректно');
      return;
    }

    if (editingId) {
      const ok = await updateRoute(editingId, {fromId, toId, transitId: trId, etaHours: eta });
      if (!ok) return;
      showToast?.('Маршрут обновлён', 'success');
    } else {
      const ok = await createRoute({fromId, toId, transitId: trId, etaHours: eta });
      if (!ok) return;
      showToast?.('Маршрут создан', 'success');
    }

    closeModal();
    await load();
  });

  btnClose?.addEventListener('click', closeModal);

  return { load, openCreate, openEdit, closeModal };
}
