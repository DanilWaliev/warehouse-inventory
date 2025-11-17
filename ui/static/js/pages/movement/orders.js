// static/js/pages/movement/orders.js
export function initOrders({ showToast, showConfirm }) {
  // ===== DOM =====
  const table = document.getElementById('table-move');
  const tbody = table ? document.getElementById('table-move-body') : null;

  // Модалка создания заказа
  const modal       = document.getElementById('modal-move-create');
  const selFrom     = document.getElementById('move-from');
  const selTo       = document.getElementById('move-to');
  const selTransit  = document.getElementById('move-transit');
  const routeInfo   = {
    id:   document.getElementById('move-route-id'),
    name: document.getElementById('move-route-name'),
    eta:  document.getElementById('move-route-eta'),
    capacity: document.getElementById('move-route-capacity'),
  };
  const items = {
    body:   document.getElementById('move-items-body'),
    empty:  document.getElementById('move-items-empty'),
    addBtn: document.getElementById('move-add-item'),
  };
  const notesEl     = document.getElementById('move-notes');
  const submitBtn   = document.getElementById('move-submit');

  // Модалка просмотра заказа
  const modalView     = document.getElementById('modal-move-view');
  const modalViewBody = document.getElementById('move-view-body');
  const modalViewClose= document.getElementById('move-view-close');

  // Элемент для показа суммарного веса
  let totalWeightEl = null;

  // Кэш
  let cache = {
    warehouses: [],
    routes:     [],
    components: []
  };

  // ===== helpers: тосты/парсеры =====
  function toastByStatus(res, fallback) {
    switch (res.status) {
      case 409: showToast?.("Конфликт данных"); break;
      case 400: showToast?.("Некорректные данные"); break;
      default:  showToast?.(fallback || "Ошибка запроса");
    }
  }
  async function parseListGET(res, fallback) {
    if (res.status === 404) return [];
    if (!res.ok) { toastByStatus(res, fallback); return []; }
    const ct = res.headers.get('Content-Type') || '';
    return ct.includes('application/json') ? await res.json() : [];
  }
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
  async function fetchOrderById(orderId) {
    const res = await fetch(`/api/move?id=${orderId}`);
    const data = await parseOrToast(res, "Ошибка загрузки заказа");
    if (!data) return null;
    return Array.isArray(data) ? data[0] : data;
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

  async function createOrderWithBatches(payload) {
    const res = await fetch('/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseOrToast(res, "Ошибка при создании заказа");
  }

  async function updateBatchStatus(orderId, batchId, newStatus) {
    const url = `/api/move?orderId=${encodeURIComponent(orderId)}&batchId=${encodeURIComponent(batchId)}&status=${encodeURIComponent(newStatus)}`;
    const res = await fetch(url, { method: 'PUT' });
    return parseOrToast(res, "Не удалось обновить статус партии");
  }

  // ===== форматирование =====
  function fmtDate(d) {
    if (!d) return '-';
    try {
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return String(d);
      if (dt.getFullYear() <= 1971) return '-';
      return dt.toLocaleString('ru-RU');
    } catch { return String(d); }
  }
  function getStatus(o) {
    switch (o.Status) {
      case 'created': return 'Создан';
      case 'running': return 'Отправлен';
      case 'done':    return 'Завершён';
      default:        return o.Status || '—';
    }
  }
  function getBatchesCount(o) {
    if (typeof o.BatchesCount === 'number') return o.BatchesCount;
    if (Array.isArray(o.Batches)) return o.Batches.length;
    return 0;
  }
  function getRouteID(o)   { return o.Route?.ID ?? o.RouteID ?? o.RouteId ?? '—'; }
  function getTransitID(o) { return o.Route?.Transit?.ID ?? o.TransitID ?? o.TransitId ?? '—'; }

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
      const closedAt     = fmtDate(o.ClosedAt ?? o.Aad);

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
          <a class="btn btn-small" data-action="view" data-id="${id}">Открыть</a>
          <button class="btn btn-danger btn-small" data-action="delete" data-id="${id}">Удалить</button>
        </td>
      `;

      tr.querySelector('[data-action="view"]')?.addEventListener('click', async () => {
        const ord = await fetchOrderById(id);
        if (!ord) return;
        openViewModal(ord);
      });

      tr.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
        if (!(await showConfirm?.('Удалить заказ перемещения?', 'Подтверждение'))) return;
        const ok = await deleteOrder(id);
        if (!ok) return;
        await load();
        showToast?.('Заказ удалён', 'success');
      });

      tbody.appendChild(tr);
    }
  }

  // ===== маршруты / транзит =====
  function candidateRoutes(fromId, toId) {
    if (!Array.isArray(cache.routes)) return [];
    const f = Number(fromId), t = Number(toId);
    return cache.routes.filter(r =>
      (r.From?.ID ?? r.FromID) === f && (r.To?.ID ?? r.ToID) === t
    );
  }

  function fillTransitSelect(options) {
    if (!selTransit) return;

    if (!Array.isArray(options) || options.length === 0) {
      selTransit.innerHTML = `<option>Маршрут не найден</option>`;
      selTransit.disabled = true;
      selTransit.classList.add('is-disabled');
      routeInfo.id.value = '';
      routeInfo.name.textContent = '—';
      routeInfo.eta.textContent  = '—';
      routeInfo.capacity.textContent = '—';
      return;
    }

    selTransit.innerHTML = options.map(r => {
      const trName = r.Transit?.Name || 'Транзитный склад';
      return `<option value="${r.ID}">${trName}</option>`;
    }).join('');

    selTransit.disabled = false;
    selTransit.classList.remove('is-disabled');

    const pickedRoute = options[0];
    if (pickedRoute) applyPickedRoute(pickedRoute);
  }

  function applyPickedRoute(route) {
    if (!route) {
      routeInfo.id.value = '';
      routeInfo.name.textContent = '—';
      routeInfo.eta.textContent  = '—';
      routeInfo.capacity.textContent = '—';
      return;
    }
    routeInfo.id.value = String(route.ID ?? route.Route_ID ?? '');
    const fromN = route.From?.Name || `#${route.From?.ID ?? ''}`;
    const toN   = route.To?.Name   || `#${route.To?.ID ?? ''}`;
    routeInfo.name.textContent = `${fromN} → ${toN}`;
    routeInfo.eta.textContent  = route.Edh ? `${route.Edh} ч` : '—';
    const cap = route.Transit?.Capacity ?? null;
    routeInfo.capacity.textContent = (cap != null) ? `${cap} кг` : '—';
  }

  function onChangeFromTo() {
    const f = parseInt(selFrom?.value || '0', 10);
    const t = parseInt(selTo?.value   || '0', 10);
    if (!f || !t || f === t) {
      fillTransitSelect([]);
      return;
    }
    const routes = candidateRoutes(f, t);
    fillTransitSelect(routes);
  }

  selTransit?.addEventListener('change', () => {
    const rid = parseInt(selTransit.value || '0', 10);
    const r = (Array.isArray(cache.routes) ? cache.routes.find(x => (x.ID ?? x.Route_ID) === rid) : null);
    applyPickedRoute(r || null);
  });

  // ===== компоненты / вес =====
  function weightOfComponent(componentOrId) {
    if (componentOrId && typeof componentOrId === 'object' && typeof componentOrId.Weight === 'number') {
      return componentOrId.Weight || 0;
    }
    const cid = Number(componentOrId);
    const c = Array.isArray(cache.components) ? cache.components.find(x => x.ID === cid) : null;
    return c ? (c.Weight || 0) : 0;
  }

  function computeTotalWeightFromRows() {
    if (!items.body) return 0;
    let sum = 0;
    const rows = items.body.querySelectorAll('tr');
    rows.forEach(r => {
      const sel = r.querySelector('.move-item-component');
      const qtyEl = r.querySelector('.move-item-qty');
      const cid = parseInt(sel?.value || '0', 10);
      const qty = parseInt(qtyEl?.value || '0', 10);
      if (cid > 0 && qty > 0) sum += weightOfComponent(cid) * qty;
    });
    return sum;
  }

  function ensureTotalWeightEl() {
    if (totalWeightEl) return;
    const routeInfoWrap = document.getElementById('move-route-info');
    if (!routeInfoWrap) return;
    totalWeightEl = document.createElement('div');
    totalWeightEl.innerHTML = `<strong>Вес заказа:</strong> <span id="move-total-weight">0</span>`;
    routeInfoWrap.appendChild(totalWeightEl);
  }

  function updateTotalWeightUi() {
    ensureTotalWeightEl();
    const span = document.getElementById('move-total-weight');
    if (span) span.textContent = String(computeTotalWeightFromRows());
  }

  // ===== селекты справочников =====
  function fillWarehouseSelect(sel, list) {
    if (!sel) return;
    if (!Array.isArray(list) || list.length === 0) {
      sel.innerHTML = `<option value="">Нет складов</option>`;
      return;
    }
    sel.innerHTML = list.map(w =>
      `<option value="${w.ID}">${w.Name}${w.Location ? ' — ' + w.Location : ''}</option>`
    ).join('');
  }
  function fillComponentsSelect(sel, list) {
    if (!sel) return;
    if (!Array.isArray(list) || list.length === 0) {
      sel.innerHTML = `<option value="">Нет ТМЦ</option>`;
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
        <button type="button" class="btn btn-danger btn-small btn-remove">Удалить</button>
      </td>
    `;
    items.body.appendChild(tr);

    const sel = tr.querySelector('.move-item-component');
    const qty = tr.querySelector('.move-item-qty');

    fillComponentsSelect(sel, cache.components);

    sel?.addEventListener('change', updateTotalWeightUi);
    qty?.addEventListener('input', updateTotalWeightUi);

    tr.querySelector('.btn-remove')?.addEventListener('click', () => {
      tr.remove();
      toggleItemsEmpty();
      updateTotalWeightUi();
    });

    toggleItemsEmpty();
    updateTotalWeightUi();
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

  // ===== авто-упаковка по партиям =====
  function packIntoBatches(itemsFlat, maxWeight, batchesCount) {
    const batches = Array.from({ length: batchesCount }, () => ({ items: [], weight: 0 }));

    function pushToBatch(bi, cid, qty, unitW) {
      if (qty <= 0) return;
      const b = batches[bi];
      const ex = b.items.find(x => x.componentId === cid);
      if (ex) ex.quantity += qty;
      else b.items.push({ componentId: cid, quantity: qty });
      b.weight += unitW * qty;
    }

    for (const it of itemsFlat) {
      const cid = it.componentId;
      let qLeft = it.quantity;
      const w = weightOfComponent(cid);

      if (w <= 0) {
        let bi = 0;
        while (qLeft > 0) {
          const take = qLeft;
          pushToBatch(bi, cid, take, 0);
          qLeft -= take;
          bi = (bi + 1) % batches.length;
        }
        continue;
      }

      let bi = 0;
      while (qLeft > 0) {
        const room = Math.max(0, Math.floor((maxWeight - batches[bi].weight) / w));
        if (room > 0) {
          const take = Math.min(room, qLeft);
          pushToBatch(bi, cid, take, w);
          qLeft -= take;
        }
        if (qLeft > 0) {
          bi = (bi + 1) % batches.length;
          if (batches.every(b => (maxWeight - b.weight) < w)) {
            return [];
          }
        }
      }
    }

    return batches.map(b => ({ items: b.items }));
  }

  // ===== модалка разбиения на партии =====
  let splitModal = null;
  function ensureSplitModal() {
    if (splitModal) return splitModal;
    splitModal = document.createElement('div');
    splitModal.className = 'modal hidden';
    splitModal.setAttribute('aria-hidden', 'true');
    splitModal.innerHTML = `
      <div class="modal-content" style="max-width:520px">
        <h3 class="mb-4">Разбить заказ на партии</h3>
        <div class="mb-3">
          <div class="text-muted">Вес заказа превышает вместимость транзитного склада.</div>
          <div class="mt-1">Предлагаемое количество партий: <strong id="split-suggest"></strong></div>
        </div>
        <div class="mb-4" style="display:flex;align-items:center;gap:.75rem;">
          <label for="split-count">Количество партий</label>
          <input id="split-count" type="number" min="1" step="1" value="1" style="width:10ch">
        </div>
        <div class="flex justify-end" style="gap:8px;">
          <button type="button" class="btn" id="split-cancel">Отмена</button>
          <button type="button" class="btn btn-primary" id="split-apply">Продолжить</button>
        </div>
      </div>
    `;
    document.body.appendChild(splitModal);

    splitModal.addEventListener('click', (e) => {
      const content = splitModal.querySelector('.modal-content');
      if (e.target === splitModal && !content.contains(e.target)) hideSplitModal();
    });

    splitModal.querySelector('#split-cancel')?.addEventListener('click', hideSplitModal);
    return splitModal;
  }
  function showSplitModal(suggestCount, onApply) {
    const m = ensureSplitModal();
    m.classList.remove('hidden');
    m.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const sug = m.querySelector('#split-suggest');
    const inp = m.querySelector('#split-count');
    if (sug) sug.textContent = String(suggestCount);
    if (inp) inp.value = String(suggestCount);
    const applyBtn = m.querySelector('#split-apply');
    applyBtn.onclick = () => {
      const n = parseInt(inp.value || '0', 10);
      if (!Number.isFinite(n) || n < 1) return;
      onApply?.(n);
    };
  }
  function hideSplitModal() {
    if (!splitModal) return;
    splitModal.classList.add('hidden');
    splitModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // ===== OPEN modal (создание) =====
  async function openCreate() {
    if (!cache.warehouses.length) cache.warehouses = await fetchWarehouses();
    if (!cache.routes.length)     cache.routes     = await fetchRoutes();
    if (!cache.components.length) cache.components = await fetchComponents();

    fillWarehouseSelect(selFrom, cache.warehouses);
    fillWarehouseSelect(selTo,   cache.warehouses);

    routeInfo.id.value = '';
    routeInfo.name.textContent = '—';
    routeInfo.eta.textContent  = '—';
    routeInfo.capacity.textContent = '—';
    fillTransitSelect([]);

    items.body.innerHTML = '';
    toggleItemsEmpty();
    addItemRow();
    notesEl.value = '';
    updateTotalWeightUi();

    selFrom?.removeEventListener('change', onChangeFromTo);
    selTo?.removeEventListener('change', onChangeFromTo);
    selFrom?.addEventListener('change', onChangeFromTo);
    selTo?.addEventListener('change', onChangeFromTo);

    showCreateModal();
  }
  function showCreateModal() {
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function hideCreateModal() {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // ===== SUBMIT (создание) =====
  submitBtn?.addEventListener('click', async () => {
    const fromId = parseInt(selFrom?.value || '0', 10);
    const toId   = parseInt(selTo?.value   || '0', 10);

    if (!fromId || !toId) { showToast?.('Выберите склады отправителя и получателя'); return; }
    if (fromId === toId)  { showToast?.('Отправитель и получатель не могут совпадать'); return; }

    const routes = candidateRoutes(fromId, toId);
    if (routes.length === 0) { showToast?.('Маршрут между выбранными складами не найден'); return; }

    let pickedRoute = null;
    if (!selTransit.disabled) {
      const rid = parseInt(selTransit.value || '0', 10);
      pickedRoute = routes.find(r => (r.ID ?? r.Route_ID) === rid) || routes[0];
    } else {
      pickedRoute = routes[0];
    }
    if (!pickedRoute) { showToast?.('Маршрут не выбран'); return; }

    const itemsPayload = collectItems();
    if (itemsPayload.length === 0) { showToast?.('Добавьте хотя бы одну позицию с количеством'); return; }

    const capacity = pickedRoute.Transit?.Capacity ?? null;
    const totalWeight = computeTotalWeightFromRows();

    const basePayload = {
      routeId:   pickedRoute.ID ?? pickedRoute.Route_ID,
      transitId: pickedRoute.Transit?.ID ?? pickedRoute.TransitID,
      notes:     String(notesEl?.value || '').trim(),
    };

    const singleBatches = [{ items: itemsPayload }];

    if (capacity == null || capacity <= 0 || totalWeight <= capacity) {
      const ok = await createOrderWithBatches({ ...basePayload, batches: singleBatches });
      if (!ok) return;
      hideCreateModal();
      await load();
      showToast?.('Заказ создан', 'success');
      return;
    }

    const suggested = Math.ceil(totalWeight / capacity);
    showSplitModal(suggested, async (userCount) => {
      const packed = packIntoBatches(itemsPayload, capacity, userCount);
      if (!Array.isArray(packed) || packed.length === 0) {
        showToast?.('Не удалось упаковать заказ в заданное число партий');
        return;
      }
      hideSplitModal();
      const ok = await createOrderWithBatches({ ...basePayload, batches: packed });
      if (!ok) return;
      hideCreateModal();
      await load();
      showToast?.('Заказ создан (разбит на партии)', 'success');
    });
  });

  // ===== Модалка ПРОСМОТРА заказа =====
  function showViewModal() {
    if (!modalView) return;
    modalView.classList.remove('hidden');
    modalView.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
  }
  function hideViewModal() {
    if (!modalView) return;
    modalView.classList.add('hidden');
    modalView.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }
  modalViewClose?.addEventListener('click', hideViewModal);

  function statusBadge(status) {
    // используем имеющиеся классы: status-badge, status-created, status-finished
    const mapText = { created: 'Создана', running: 'В пути', done: 'Завершена' };
    const cls = (status === 'done') ? 'status-finished' : 'status-created';
    return `<span class="status-badge ${cls}">${mapText[status] ?? status}</span>`;
    // (если нужен отдельный стиль для running — добавь .status-running в CSS)
  }

  function renderOrderView(order) {
    const id    = order.ID;
    const route = order.Route || {};
    const tr    = route.Transit || {};
    const fromN = route.From?.Name || `#${route.From?.ID ?? ''}`;
    const toN   = route.To?.Name   || `#${route.To?.ID ?? ''}`;
    const trN   = tr.Name || `#${tr.ID ?? ''}`;
    const eta   = (route.Edh ?? '') ? `${route.Edh} ч` : '—';

    const batches = Array.isArray(order.Batches) ? order.Batches : [];

    const batchWeights = batches.map(b => {
      let w = 0;
      (b.Items||[]).forEach(it => { w += (weightOfComponent(it.Component) * (it.Quantity||0)); });
      return w;
    });
    const totalWeight = batchWeights.reduce((a,b)=>a+b,0);

    const batchesHTML = batches.map((b, idx) => {
      const bWeight = batchWeights[idx] || 0;
      const rows = (b.Items||[]).map(it => {
        const cw = weightOfComponent(it.Component);
        const qty= it.Quantity || 0;
        const rowWeight = cw*qty;
        return `
          <tr>
            <td>${it.Component?.Name ?? `#${it.Component?.ID ?? ''}`}</td>
            <td>${qty}</td>
            <td>${cw}</td>
            <td>${rowWeight}</td>
          </tr>
        `;
      }).join('');

      // только кнопки, без селекта:
      // created -> button "Отправить" (running)
      // running -> button "Принять"  (done)
      // done    -> без кнопки
      let actionBtn = '';
      if (b.Status === 'created') {
        actionBtn = `<button class="btn btn-primary btn-small" data-action="next-status" data-next="running">Отправить</button>`;
      } else if (b.Status === 'running') {
        actionBtn = `<button class="btn btn-primary btn-small" data-action="next-status" data-next="done">Принять</button>`;
      }

      return `
        <div class="card mb-3" data-batch-id="${b.ID}">
          <div class="flex justify-between items-center mb-2">
            <div class="flex items-center gap-3">
              <strong>Партия #${b.ID}</strong>
              ${statusBadge(b.Status)}
              ${actionBtn}
            </div>
            <div><strong>Вес партии:</strong> ${bWeight}</div>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>ТМЦ</th>
                  <th style="width:10ch;">Кол-во</th>
                  <th style="width:12ch;">Вес ед.</th>
                  <th style="width:12ch;">Вес, итого</th>
                </tr>
              </thead>
              <tbody>
                ${rows || `<tr><td colspan="4" class="text-muted">Нет позиций</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    modalViewBody.innerHTML = `
      <div class="mb-3">
        <div><strong>Заказ #${id}</strong></div>
        <div class="text-muted">${fromN} → ${toN} (транзит: ${trN}, ETA: ${eta})</div>
        <div class="mt-1"><strong>Вес заказа:</strong> ${totalWeight}</div>
      </div>
      ${batchesHTML || `<div class="text-muted">Нет партий</div>`}
    `;

    // делегирование действий по партиям — только кнопки
    modalViewBody.querySelectorAll('.card[data-batch-id]').forEach(card => {
      const batchId = parseInt(card.getAttribute('data-batch-id'),10);
      card.querySelector('[data-action="next-status"]')?.addEventListener('click', async (e) => {
        const newStatus = e.currentTarget.getAttribute('data-next');
        const ok = await updateBatchStatus(order.ID, batchId, newStatus);
        if (!ok) return;
        showToast?.('Статус партии обновлён', 'success');
        const fresh = await fetchOrderById(order.ID);
        if (fresh) {
          renderOrderView(fresh);
          await load();
        }
      });
    });
  }

  async function openViewModal(order) {
    if (!cache.components.length) {
      try { cache.components = await fetchComponents(); } catch {}
    }
    renderOrderView(order);
    showViewModal();
  }

  // ===== LOAD =====
  async function load() {
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const list = await fetchOrders();
      renderList(list);
    } catch {
      renderEmpty();
    }
  }

  // ===== экспорт =====
  return { load, openCreate };
}

/* Подсказка по стилям:
.is-disabled { opacity:.6; pointer-events:none; background:#f3f4f6; }
*/
