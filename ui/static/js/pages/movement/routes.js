// static/js/pages/movement/routes.js
export function initRoutes({ showToast, showConfirm }) {
  const tbody = document.getElementById('table-routes-body');
  const form  = document.getElementById('form-route-create');
  const modal = document.getElementById('modal-route-create');
  const title = document.getElementById('modal-route-title');
  const btnClose = document.getElementById('modal-route-cancel');

  let editingId = null;

  // ====== FETCH helpers с единым обработчиком ошибок ======
  async function parseOrToast(res, contextMsgDefault) {
    if (!res.ok) {
      switch (res.status) {
        case 409:
          showToast?.("Маршрут уже существует");
          break;
        case 400:
          showToast?.("Некорректные данные");
          break;
        default:
          showToast?.(contextMsgDefault || "Ошибка при обработке запроса");
      }
      return null;
    }
    // на успешный GET парсим json, на успешный мутационный запрос просто вернём true
    const ct = res.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) return await res.json();
    return true;
  }

  async function fetchList() {
    const res = await fetch('/api/route');
    return parseOrToast(res, "Ошибка загрузки маршрутов");
  }

  async function fetchStorages() {
    const res = await fetch('/api/storage?type=warehouse&inventory=false');
    return parseOrToast(res, "Ошибка загрузки складов");
  }

  async function fetchTransits() {
    const res = await fetch('/api/storage?type=transit&inventory=false');
    return parseOrToast(res, "Ошибка загрузки транзитных складов");
  }

  async function fetchOne(id) {
    const res = await fetch(`/api/route?id=${id}`);
    return parseOrToast(res, "Ошибка загрузки маршрута");
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
  // ====== /FETCH helpers ======

  async function load() {
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const data = await fetchList();
      if (!Array.isArray(data)) return; // ошибка уже показана
      if (data.length === 0) {
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
          if (!ok) return; // ошибка уже показана
          await load();
          showToast?.('Маршрут удалён', 'success');
        });
        tbody.appendChild(tr);
      });
    } catch {
      showToast?.('Ошибка загрузки маршрутов');
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
      if (!route) return; // ошибка уже показана
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
    // если какой-то из запросов вернул null — ошибки уже показаны
    const fromSel = form.elements['from_id'];
    const toSel   = form.elements['to_id'];
    const trSel   = form.elements['transit_id'];

    if (fromSel && Array.isArray(warehouses)) {
      fromSel.innerHTML = warehouses.map(w =>
        `<option value="${w.ID}">${w.Name}${w.Location ? ' — ' + w.Location : ''}</option>`
      ).join('');
    }
    if (toSel && Array.isArray(warehouses)) {
      toSel.innerHTML = warehouses.map(w =>
        `<option value="${w.ID}">${w.Name}${w.Location ? ' — ' + w.Location : ''}</option>`
      ).join('');
    }
    if (trSel && Array.isArray(transits)) {
      trSel.innerHTML = transits.map(t =>
        `<option value="${t.ID}">${t.Name}${t.Location ? ' — ' + t.Location : ''}</option>`
      ).join('');
    }
  }

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

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name   = String(fd.get('name') || '').trim();
    const fromId = parseInt(fd.get('from_id') || '0', 10);
    const toId   = parseInt(fd.get('to_id') || '0', 10);
    const trId   = parseInt(fd.get('transit_id') || '0', 10);
    const eta    = parseInt(fd.get('eta_hours') || '0', 10);

    if (!name || !fromId || !toId || !trId || !Number.isFinite(eta) || eta <= 0) {
      showToast?.('Заполните поля корректно');
      return;
    }

    if (editingId) {
      const ok = await updateRoute(editingId, {
        name, fromId, toId, transitId: trId, etaHours: eta,
      });
      if (!ok) return; // ошибка уже показана
      showToast?.('Маршрут обновлён', 'success');
    } else {
      const ok = await createRoute({
        name, fromId, toId, transitId: trId, etaHours: eta,
      });
      if (!ok) return; // ошибка уже показана
      showToast?.('Маршрут создан', 'success');
    }

    closeModal();
    await load();
  });

  btnClose?.addEventListener('click', closeModal);

  return { load, openCreate, openEdit, closeModal };
}
