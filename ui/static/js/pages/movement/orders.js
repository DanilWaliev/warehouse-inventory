// static/js/pages/movement/orders.js
export function initOrders({ showToast, showConfirm }) {
  // ===== DOM =====
  const table = document.getElementById('table-move');
  const tbody = table ? document.getElementById('table-move-body') : null;

  // Модалка создания заказа
  const modal       = document.getElementById('modal-move-create');
  const selFrom     = document.getElementById('move-from');
  const selTo       = document.getElementById('move-to');
  const routeInfo   = {
    id:   document.getElementById('move-route-id'),
    name: document.getElementById('move-route-name'),
    tr:   document.getElementById('move-route-transit'),
    eta:  document.getElementById('move-route-eta'),
  };
  const items = {
    body:   document.getElementById('move-items-body'),
    empty:  document.getElementById('move-items-empty'),
    addBtn: document.getElementById('move-add-item'),
  };
  const notesEl     = document.getElementById('move-notes');
  const submitBtn   = document.getElementById('move-submit');

  // кэш для справочников
  let cache = {
    warehouses: [],   // [{ID,Name,Location,...}]
    routes:     [],   // [{ID,From:{ID},To:{ID},Transit:{ID,Name}, ETAHours}]
    components: []    // [{ID,Name}]
  };

  // ===== toast helpers =====
  function toastByStatus(res, fallback) {
    switch (res.status) {
      case 409: showToast?.("Конфликт: заказ уже существует"); break;
      case 400: showToast?.("Некорректные данные"); break;
      default:  showToast?.(fallback || "Ошибка запроса");
    }
  }

  // списки: 404 → пусто, без тоста
  async function parseListGET(res, fallback) {
    if (res.status === 404) return [];
    if (!res.ok) { toastByStatus(res, fallback); return []; }
    const ct = res.headers.get('Content-Type') || '';
    return ct.includes('application/json') ? await res.json() : [];
  }

  // не-списки: ошибки → тосты
  async function parseOrToast(res, fallback) {
    if (!res.ok) { toastByStatus(res, fallback); return null; }
    const ct = res.headers.get('Content-Type') || '';
    return ct.includes('application/json') ? await res.json() : true;
  }

  // ===== API =====
  async function fetchOrders() {
    const res = await fetch('/api/move');
    return parseListGET(res, "Ошибка загрузки заказов");
  }
  async function deleteOrder(id) {
    const res = await fetch(`/api/move?id=${id}`, { method: 'DELETE' });
    return parseOrToast(res, "Ошибка при удалении заказа");
  }

  async function fetchWarehouses() {
    const res = await fetch('/api/storage?type=warehouse&inventory=false');
    return parseListGET(res, "Ошибка загрузки складов");
  }
  async function fetchRoutes() {
    const res = await fetch('/api/route');
    return parseListGET(res, "Ошибка загрузки маршрутов");
  }
  async function fetchComponents() {
    const res = await fetch('/api/tmc');
    return parseListGET(res, "Ошибка загрузки ТМЦ");
  }

  async function createOrder(payload) {
    const res = await fetch('/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseOrToast(res, "Ошибка при создании заказа");
  }

  // ===== helpers =====
  function fmtDate(d) {
    if (!d) return '-';
    try {
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return String(d);
      return dt.toLocaleString('ru-RU');
    } catch { return String(d); }
  }
  function getStatus(o) {
    if (o.Status) {
      switch (o.Status) {
        case 'created': return 'Создан';
        case 'running': return 'Отправлен';
        case 'done':    return 'Завершён';
        default:        return o.Status;
      }
    }
    if (o.ActualArrivalDate)  return 'Завершён';
    if (o.ActualShipmentDate) return 'Отправлен';
    return 'Создан';
  }
  function getBatchesCount(o) {
    if (typeof o.BatchesCount === 'number') return o.BatchesCount;
    if (Array.isArray(o.Batches)) return o.Batches.length;
    return 0;
  }
  function getRouteID(o)   { return o.RouteID   ?? o.RouteId   ?? o.Route?.ID    ?? '—'; }
  function getTransitID(o) { return o.TransitID ?? o.TransitId ?? o.Route?.Transit?.ID ?? '—'; }

  function renderEmpty() {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" class="text-muted">Нет заказов</td></tr>`;
  }

  function renderList(list) {
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) { renderEmpty(); return; }

    for (const o of list) {
      const id           = o.ID ?? o.Id ?? '—';
      const routeID      = getRouteID(o);
      const transitID    = getTransitID(o);
      const batchesCount = getBatchesCount(o);
      const statusText   = getStatus(o);
      const createdAt    = fmtDate(o.CreatedAt);
      const closedAt     = fmtDate(o.ClosedAt ?? o.ActualArrivalDate);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="width:12ch;">#${id}</td>
        <td style="width:12ch;">${routeID}</td>
        <td style="width:12ch;">${transitID}</td>
        <td style="width:12ch;">${batchesCount}</td>
        <td style="width:22ch;">${statusText}</td>
        <td>${createdAt}</td>
        <td>${closedAt}</td>
        <td>
          <a class="btn" href="/move/${id}">Открыть</a>
          <button class="btn btn-danger btn-delete" data-id="${id}">Удалить</button>
        </td>
      `;
      tr.querySelector('.btn-delete')?.addEventListener('click', async () => {
        if (!(await showConfirm?.('Удалить заказ перемещения?', 'Подтверждение'))) return;
        const ok = await deleteOrder(id);
        if (!ok) return;
        await load();
        showToast?.('Заказ удалён', 'success');
      });
      tbody.appendChild(tr);
    }
  }

  // ===== подбор маршрута по паре (from,to) =====
  function findRoute(fromId, toId) {
    if (!Array.isArray(cache.routes)) return null;
    const f = Number(fromId), t = Number(toId);
    return cache.routes.find(r =>
      (r.From?.ID ?? r.FromID) === f && (r.To?.ID ?? r.ToID) === t
    ) || null;
  }
  function setRouteInfo(route) {
    if (!route) {
      routeInfo.id.value = '';
      routeInfo.name.textContent = '—';
      routeInfo.tr.textContent   = '—';
      routeInfo.eta.textContent  = '—';
      return;
    }
    const rid = route.ID ?? route.Route_ID ?? '';
    const tr  = route.Transit?.Name ?? (route.TransitID ? `#${route.TransitID}` : '—');
    const nm  = route.Name ?? `${route.From?.Name ?? `#${route.From?.ID ?? ''}`} → ${route.To?.Name ?? `#${route.To?.ID ?? ''}`}`;
    const eta = route.Edh + " ч." ?? route.EstimatedDurationHours ?? '—';
    routeInfo.id.value       = String(rid);
    routeInfo.name.textContent = nm;
    routeInfo.tr.textContent   = tr;
    routeInfo.eta.textContent  = String(eta);
  }

  // ===== заполнение селектов =====
  function fillWarehouseSelect(sel, list) {
    if (!sel) return;
    if (!Array.isArray(list) || list.length === 0) {
      sel.innerHTML = `<option value="">— нет складов —</option>`;
      return;
    }
    sel.innerHTML = list.map(w =>
      `<option value="${w.ID}">${w.Name}${w.Location ? ' — ' + w.Location : ''}</option>`
    ).join('');
  }
  function fillComponentsSelect(sel, list) {
    if (!sel) return;
    if (!Array.isArray(list) || list.length === 0) {
      sel.innerHTML = `<option value="">— нет ТМЦ —</option>`;
      return;
    }
    sel.innerHTML = list.map(c => `<option value="${c.ID}">${c.Name}</option>`).join('');
  }

  // ===== строки позиций =====
  function toggleItemsEmpty() {
    if (!items.body || !items.empty) return;
    const hasRows = items.body.querySelector('tr') != null;
    items.empty.style.display = hasRows ? 'none' : '';
  }
  function addItemRow() {
    if (!items.body) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <select class="move-item-component" required></select>
      </td>
      <td>
        <input type="number" class="move-item-qty" min="1" step="1" value="1" required>
      </td>
      <td>
        <button type="button" class="btn btn-danger btn-remove">Удалить</button>
      </td>
    `;
    items.body.appendChild(tr);
    // заполнить селект ТМЦ из кэша
    const sel = tr.querySelector('.move-item-component');
    fillComponentsSelect(sel, cache.components);
    // удалить строку
    tr.querySelector('.btn-remove')?.addEventListener('click', () => {
      tr.remove();
      toggleItemsEmpty();
    });
    toggleItemsEmpty();
  }
  function collectItems() {
    if (!items.body) return [];
    const rows = [...items.body.querySelectorAll('tr')];
    const out = [];
    for (const r of rows) {
      const sel = r.querySelector('.move-item-component');
      const qtyEl = r.querySelector('.move-item-qty');
      const cid = parseInt(sel?.value || '0', 10);
      const qty = parseInt(qtyEl?.value || '0', 10);
      if (cid > 0 && Number.isFinite(qty) && qty > 0) {
        out.push({ componentId: cid, quantity: qty });
      }
    }
    return out;
  }

  // ===== OPEN modal (публичный) =====
  async function openCreate() {
    // ленивые загрузки кэша
    if (!cache.warehouses.length) cache.warehouses = await fetchWarehouses();
    if (!cache.routes.length)     cache.routes     = await fetchRoutes();
    if (!cache.components.length) cache.components = await fetchComponents();

    // заполнить селекты складов
    fillWarehouseSelect(selFrom, cache.warehouses);
    fillWarehouseSelect(selTo,   cache.warehouses);

    // сброс позиций
    items.body.innerHTML = '';
    toggleItemsEmpty();

    // добавить первую строку
    addItemRow();

    // сброс заметок и маршрута
    notesEl.value = '';
    setRouteInfo(null);

    // поведение смены склады → пересчитать маршрут
    function onChangeRoute() {
      const f = parseInt(selFrom?.value || '0', 10);
      const t = parseInt(selTo?.value   || '0', 10);
      if (!f || !t || f === t) { setRouteInfo(null); return; }
      const route = findRoute(f, t);
      setRouteInfo(route || null);
    }
    selFrom?.removeEventListener('change', onChangeRoute); // на всякий
    selTo?.removeEventListener('change', onChangeRoute);
    selFrom?.addEventListener('change', onChangeRoute);
    selTo?.addEventListener('change', onChangeRoute);

    // кнопка “+ позиция”
    items.addBtn?.addEventListener('click', addItemRow, { once: false });

    // показать модалку
    showModal();
  }

  // ===== SUBMIT =====
  submitBtn?.addEventListener('click', async () => {
    const fromId = parseInt(selFrom?.value || '0', 10);
    const toId   = parseInt(selTo?.value   || '0', 10);

    if (!fromId || !toId) { showToast?.('Выберите склады отправителя и получателя'); return; }
    if (fromId === toId)  { showToast?.('Отправитель и получатель не могут совпадать'); return; }

    const route = findRoute(fromId, toId);
    if (!route) { showToast?.('Маршрут между выбранными складами не найден'); return; }

    const itemsPayload = collectItems();
    if (itemsPayload.length === 0) { showToast?.('Добавьте хотя бы одну позицию с количеством'); return; }

    const payload = {
      fromId,
      toId,
      routeId:   route.ID ?? route.Route_ID,
      transitId: route.Transit?.ID ?? route.TransitID,
      notes:     String(notesEl?.value || '').trim(),
      items:     itemsPayload
    };

    const ok = await createOrder(payload);
    if (!ok) return; // ошибка уже показана
    hideModal();
    await load();
    showToast?.('Заказ создан', 'success');
  });

  // ===== modal show/hide (локально, чтобы не зависеть от main.js) =====
  function showModal() {
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function hideModal() {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // ===== LOAD таблицы =====
  async function load() {
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const list = await fetchOrders(); // [] при 404
      renderList(list);
    } catch {
      renderEmpty(); // сетевой фейл — тихо
    }
  }

  return { load, openCreate };
}
