// static/js/pages/movement/orders.js
// Управление заказами перемещения с поддержкой ПАРТИЙ
// - список заказов с раскрытием партий
// - модалка создания заказа: партии + позиции с расчётом веса

export function initOrders({ showToast, showConfirm }) {
  // ==== API endpoints (как в прошлой версии) ====
  const API_ORDERS   = '/api/move';                                  // GET list / POST create / DELETE ?id=
  const API_STORAGES = '/api/storage?type=warehouse&inventory=false'; // GET склады
  const API_ROUTES   = '/api/route';                                  // GET маршруты
  const API_TMC      = '/api/tmc';                                    // GET ТМЦ (должны содержать Weight)

  // ===== DOM (таблица заказов) =====
  const table = document.getElementById('table-move');
  const tbody = table ? document.getElementById('table-move-body') : null;

  // ===== DOM (модалка создания заказа) =====
  const modal       = document.getElementById('modal-move-create');
  const selFrom     = document.getElementById('move-from');
  const selTo       = document.getElementById('move-to');
  const notesEl     = document.getElementById('move-notes');

  // Блок информации о маршруте
  const routeInfo = {
    id:       document.getElementById('move-route-id'),
    name:     document.getElementById('move-route-name'),
    tr:       document.getElementById('move-route-transit'),
    eta:      document.getElementById('move-route-eta'),
    capacity: document.getElementById('move-route-capacity'),
  };

  // ===== Кэш справочников =====
  const cache = {
    warehouses: [],   // [{ID,Name,Location,...}]
    routes:     [],   // [{ID, From:{ID,Name}, To:{ID,Name}, Transit:{ID,Name,Capacity}, Edh}]
    components: [],   // [{ID,Name,Weight,...}]
    compById:   new Map(), // ID -> component
  };

  // ======================= Helpers (fetch) =======================
  function toastByStatus(res, fallback) {
    switch (res.status) {
      case 409: showToast?.("Конфликт данных"); break;
      case 400: showToast?.("Некорректные данные"); break;
      default:  showToast?.(fallback || "Ошибка запроса");
    }
  }

  async function parseListGET(res, fallback) {
    if (res.status === 404) return [];             // пусто без тоста
    if (!res.ok) { toastByStatus(res, fallback); return []; }
    const ct = res.headers.get('Content-Type') || '';
    return ct.includes('application/json') ? await res.json() : [];
  }

  async function parseOrToast(res, fallback) {
    if (!res.ok) { toastByStatus(res, fallback); return null; }
    const ct = res.headers.get('Content-Type') || '';
    return ct.includes('application/json') ? await res.json() : true;
  }

  async function fetchOrders() {
    const res = await fetch(API_ORDERS);
    return parseListGET(res, "Ошибка загрузки заказов");
  }

  async function deleteOrder(id) {
    const res = await fetch(`${API_ORDERS}?id=${id}`, { method: 'DELETE' });
    return parseOrToast(res, "Ошибка при удалении заказа");
  }

  async function fetchWarehouses() {
    const res = await fetch(API_STORAGES);
    return parseListGET(res, "Ошибка загрузки складов");
  }

  async function fetchRoutes() {
    const res = await fetch(API_ROUTES);
    return parseListGET(res, "Ошибка загрузки маршрутов");
  }

  async function fetchComponents() {
    const res = await fetch(API_TMC);
    return parseListGET(res, "Ошибка загрузки ТМЦ");
  }

  async function createOrder(payload) {
    // payload: { fromId, toId, routeId, transitId, notes, batches: [{items:[{componentId,quantity}]}] }
    const res = await fetch(API_ORDERS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseOrToast(res, "Ошибка при создании заказа");
  }

  // ======================= Helpers (UI/format) =======================
  function fmtDate(val) {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d)) return String(val);
      return d.toLocaleString('ru-RU');
    } catch { return String(val); }
  }
  function monoID(id) { return `<span class="text-mono">#${id}</span>`; }
  function statusBadge(status) {
    switch (status) {
      case 'done':    return `<span class="status-badge status-finished">Завершён</span>`;
      case 'running': return `<span class="status-badge status-created">Отправлен</span>`;
      case 'created':
      default:        return `<span class="status-badge status-created">Создан</span>`;
    }
  }

  function getStatus(o) {
    if (o.Status) return o.Status; // ожидаем 'created'|'running'|'done'
    // запасной путь:
    if (o.ActualArrivalDate)  return 'done';
    if (o.ActualShipmentDate) return 'running';
    return 'created';
  }

  function getBatchesCount(o) {
    if (typeof o.BatchesCount === 'number') return o.BatchesCount;
    if (Array.isArray(o.Batches)) return o.Batches.length;
    return 0;
  }

  function getRouteID(o)   { return o.Route?.ID ?? o.RouteID   ?? o.RouteId   ?? null; }
  function getTransit(o)   { return o.Route?.Transit || null; }

  // ======================= Рендер списка заказов =======================
  function renderBatchesDetailsRow(order) {
    const colSpan = 8;
    const batches = Array.isArray(order.Batches) ? order.Batches : [];

    if (!batches.length) {
      return `
        <tr class="order-details-row hidden" data-details-for="${order.ID}">
          <td colspan="${colSpan}" class="text-muted">Нет партий</td>
        </tr>`;
    }

    // Посчитать вес позиции и партии
    const batchCards = batches.map((b, idx) => {
      const items = Array.isArray(b.Items) ? b.Items : [];
      let totalWeight = 0;

      const itemsHTML = items.length
        ? `
          <table class="table" style="margin-top:6px;">
            <thead>
              <tr>
                <th>ТМЦ</th>
                <th style="width:10ch;">Кол-во</th>
                <th style="width:12ch;">Вес/ед.</th>
                <th style="width:12ch;">Итого</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(it => {
                const name = it.Component?.Name ?? '—';
                const qty  = Number(it.Quantity ?? 0);
                const w    = Number(it.Component?.Weight ?? 0);
                const sum  = Math.round(qty * w * 100) / 100;
                totalWeight += sum;
                return `
                  <tr>
                    <td>${name}</td>
                    <td>${qty}</td>
                    <td>${w}</td>
                    <td><strong>${sum}</strong></td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>`
        : `<div class="text-muted">Нет позиций</div>`;

      const totalHTML = `<div class="mt-2"><strong>Вес партии:</strong> ${Math.round(totalWeight * 100) / 100}</div>`;

      return `
        <div class="batch-card" style="border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div><strong>Партия ${idx + 1}</strong></div>
            <div>${statusBadge(b.Status)}</div>
          </div>
          ${itemsHTML}
          ${totalHTML}
        </div>`;
    }).join('<div style="height:8px;"></div>');

    return `
      <tr class="order-details-row hidden" data-details-for="${order.ID}">
        <td colspan="${colSpan}">
          <div class="batches-wrap" style="display:grid;grid-template-columns:1fr;gap:8px;">
            ${batchCards}
          </div>
        </td>
      </tr>`;
  }

  function renderList(list) {
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(list) || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-muted">Нет заказов</td></tr>`;
      return;
    }

    for (const o of list) {
      const id           = o.ID ?? o.Id ?? '—';
      const routeID      = getRouteID(o);
      const transit      = getTransit(o);
      const batchesCount = getBatchesCount(o);
      const statusText   = getStatus(o);

      let transitCell = '—';
      if (transit?.ID) {
        const cap = transit.Capacity;
        transitCell = cap != null && cap !== ''
          ? `${monoID(transit.ID)}&nbsp;<span class="text-muted">(вмест.: ${cap})</span>`
          : `${monoID(transit.ID)}`;
      }

      const tr = document.createElement('tr');
      tr.className = 'order-row';
      tr.setAttribute('data-id', id);
      tr.innerHTML = `
        <td style="width:12ch;">${monoID(id)}</td>
        <td style="width:12ch;">${routeID ? monoID(routeID) : '—'}</td>
        <td style="width:12ch;">${transitCell}</td>
        <td style="width:12ch;">${batchesCount}</td>
        <td style="width:22ch;">${statusBadge(statusText)}</td>
        <td>${fmtDate(o.CreatedAt)}</td>
        <td>${fmtDate(o.ClosedAt ?? o.ActualArrivalDate)}</td>
        <td>
          <button class="btn btn-secondary btn-toggle" data-id="${id}">Партии</button>
          <button class="btn btn-danger btn-delete" data-id="${id}">Удалить</button>
        </td>
      `;
      tbody.appendChild(tr);

      // строка деталей
      const rowHTML = renderBatchesDetailsRow(o);
      const tmp = document.createElement('tbody');
      tmp.innerHTML = rowHTML;
      tbody.appendChild(tmp.firstElementChild);
    }
  }

  // раскрытие партий
  function toggleDetails(orderId, forceOpen) {
    const row = tbody?.querySelector(`tr.order-details-row[data-details-for="${orderId}"]`);
    if (!row) return;
    const isHidden = row.classList.contains('hidden');
    const open = (forceOpen === undefined) ? isHidden : !!forceOpen;
    row.classList.toggle('hidden', !open);
  }

  tbody?.addEventListener('click', async (e) => {
    const del = e.target.closest('.btn-delete');
    if (del) {
      const id = del.getAttribute('data-id');
      if (!(await showConfirm?.('Удалить заказ перемещения?', 'Подтверждение'))) return;
      const ok = await deleteOrder(id);
      if (!ok) return;
      await load();
      showToast?.('Заказ удалён', 'success');
      return;
    }
    const tog = e.target.closest('.btn-toggle');
    if (tog) {
      toggleDetails(tog.getAttribute('data-id'));
      return;
    }
    const tr = e.target.closest('tr.order-row');
    if (tr && !e.target.closest('td:last-child')) {
      toggleDetails(tr.getAttribute('data-id'));
    }
  });

  // ======================= Маршруты (подбор) =======================
  function findRoute(fromId, toId) {
    if (!Array.isArray(cache.routes)) return null;
    const f = Number(fromId), t = Number(toId);
    return cache.routes.find(r =>
      (r.From?.ID ?? r.FromID) === f && (r.To?.ID ?? r.ToID) === t
    ) || null;
  }

  function setRouteInfoUI(route) {
    if (!route) {
      routeInfo.id.value       = '';
      routeInfo.name.textContent     = '—';
      routeInfo.tr.textContent       = '—';
      routeInfo.eta.textContent      = '—';
      routeInfo.capacity.textContent = '—';
      return;
    }
    const rid   = route.ID ?? route.Route_ID ?? '';
    const name  = route.Name ?? `${route.From?.Name ?? `#${route.From?.ID ?? ''}`} → ${route.To?.Name ?? `#${route.To?.ID ?? ''}`}`;
    const tr    = route.Transit?.Name ?? (route.Transit?.ID ? `#${route.Transit.ID}` : '—');
    const eta   = (route.Edh != null) ? `${route.Edh} ч` : '—';
    const cap   = (route.Transit?.Capacity != null) ? `${route.Transit.Capacity} кг` : '—';

    routeInfo.id.value           = String(rid);
    routeInfo.name.textContent   = name;
    routeInfo.tr.textContent     = tr;
    routeInfo.eta.textContent    = eta;
    routeInfo.capacity.textContent = cap;
  }

  // ======================= МОДАЛКА: партии =======================
  // Вёрстка модалки у тебя: мы заменяем «Позиции» на контейнер партий:
  // <div id="batches-wrap"></div> и кнопка «+ Партия»
  let batchesWrap = document.getElementById('batches-wrap');
  let addBatchBtn = document.getElementById('move-add-batch');
  let submitBtn   = document.getElementById('move-submit');

  // Если контейнеров ещё нет в шаблоне — создадим динамически вместо старого блока "Позиции"
  (function ensureBatchesArea() {
    if (!batchesWrap) {
      const card = document.querySelector('#move-items-table')?.closest('.card') || null;
      if (card) {
        // Перестраиваем карточку под партии
        card.innerHTML = `
          <h4 class="mb-4" style="display:flex;align-items:center;justify-content:space-between;">
            Партии
            <button type="button" class="btn btn-primary mb-4" id="move-add-batch" title="Добавить партию">＋ Партия</button>
          </h4>
          <div id="batches-wrap" class="batches-wrap" style="display:grid;gap:12px;"></div>
        `;
        batchesWrap = card.querySelector('#batches-wrap');
        addBatchBtn = card.querySelector('#move-add-batch');
      }
    }
  })();

  // Внутри партии — отдельная таблица позиций
  function componentOptionsHTML() {
    if (!Array.isArray(cache.components) || cache.components.length === 0) {
      return `<option value="">— нет ТМЦ —</option>`;
    }
    return cache.components.map(c => `<option value="${c.ID}">${c.Name}</option>`).join('');
  }

  function makeBatchDOM(batchIndex) {
    const el = document.createElement('div');
    el.className = 'batch-card';
    el.style.cssText = 'border:1px solid #e5e7eb;border-radius:8px;padding:12px;';

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div><strong>Партия <span class="batch-num">${batchIndex + 1}</span></strong></div>
        <div style="display:flex;gap:8px;align-items:center;">
          <div class="text-muted">Вес партии: <strong class="batch-weight">0</strong></div>
          <button type="button" class="btn btn-danger btn-batch-del" title="Удалить партию">×</button>
        </div>
      </div>
      <div class="table-wrap" style="margin-top:8px;">
        <table class="table batch-items-table">
          <thead>
            <tr>
              <th>ТМЦ</th>
              <th style="width:10ch;">Кол-во</th>
              <th style="width:12ch;">Вес/ед.</th>
              <th style="width:12ch;">Итого</th>
              <th style="width:10ch;">Действия</th>
            </tr>
          </thead>
          <tbody class="batch-items-body">
          </tbody>
        </table>
      </div>
      <div class="mt-2">
        <button type="button" class="btn btn-primary btn-item-add">+ Позиция</button>
      </div>
    `;
    return el;
  }

  function addBatch() {
    if (!batchesWrap) return;
    const index = batchesWrap.querySelectorAll('.batch-card').length;
    const card = makeBatchDOM(index);
    batchesWrap.appendChild(card);
    // первая строка
    addItemRowToBatch(card);
    wireBatchCard(card);
    renumberBatches();
  }

  function renumberBatches() {
    batchesWrap?.querySelectorAll('.batch-card').forEach((card, idx) => {
      const numEl = card.querySelector('.batch-num');
      if (numEl) numEl.textContent = String(idx + 1);
    });
  }

  function addItemRowToBatch(card) {
    const body = card.querySelector('.batch-items-body');
    if (!body) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><select class="bi-component" required>${componentOptionsHTML()}</select></td>
      <td><input type="number" class="bi-qty" min="1" step="1" value="1" required></td>
      <td class="bi-unit">0</td>
      <td class="bi-total"><strong>0</strong></td>
      <td><button type="button" class="btn btn-danger bi-del">×</button></td>
    `;
    body.appendChild(tr);
    // начальный перерасчёт
    recalcRow(tr);
    recalcBatch(card);
  }

  function recalcRow(tr) {
    const sel = tr.querySelector('.bi-component');
    const qtyEl = tr.querySelector('.bi-qty');
    const unitEl = tr.querySelector('.bi-unit');
    const totalEl = tr.querySelector('.bi-total > strong');

    const compId = parseInt(sel?.value || '0', 10);
    const qty = parseInt(qtyEl?.value || '0', 10);
    const comp = cache.compById.get(compId);
    const w = comp ? Number(comp.Weight || 0) : 0;
    const sum = Math.round(qty * w * 100) / 100;

    if (unitEl) unitEl.textContent = String(w);
    if (totalEl) totalEl.textContent = String(sum);
  }

  function recalcBatch(card) {
    const totals = [...card.querySelectorAll('.bi-total > strong')]
      .map(el => Number(el.textContent || 0));
    const s = totals.reduce((a,b)=>a+b,0);
    const weightEl = card.querySelector('.batch-weight');
    if (weightEl) weightEl.textContent = String(Math.round(s * 100) / 100);
  }

  function wireBatchCard(card) {
    // добавить позицию
    card.querySelector('.btn-item-add')?.addEventListener('click', () => {
      addItemRowToBatch(card);
    });

    // удалить партию
    card.querySelector('.btn-batch-del')?.addEventListener('click', () => {
      card.remove();
      renumberBatches();
    });

    // делегирование по строкам
    const tbody = card.querySelector('.batch-items-body');
    tbody?.addEventListener('change', (e) => {
      if (e.target.matches('.bi-component') || e.target.matches('.bi-qty')) {
        const tr = e.target.closest('tr');
        recalcRow(tr);
        recalcBatch(card);
      }
    });
    tbody?.addEventListener('input', (e) => {
      if (e.target.matches('.bi-qty')) {
        const tr = e.target.closest('tr');
        recalcRow(tr);
        recalcBatch(card);
      }
    });
    tbody?.addEventListener('click', (e) => {
      const del = e.target.closest('.bi-del');
      if (del) {
        const tr = del.closest('tr');
        tr?.remove();
        recalcBatch(card);
      }
    });
  }

  // ======================= OPEN CREATE (публичный) =======================
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

  function onWarehousesChangeRoute() {
    const f = parseInt(selFrom?.value || '0', 10);
    const t = parseInt(selTo?.value   || '0', 10);
    if (!f || !t || f === t) { setRouteInfoUI(null); return; }
    const route = findRoute(f, t);
    setRouteInfoUI(route || null);
  }

  async function openCreate() {
    // 1) Ленивая загрузка справочников
    if (!cache.warehouses.length) cache.warehouses = await fetchWarehouses();
    if (!cache.routes.length)     cache.routes     = await fetchRoutes();
    if (!cache.components.length) {
      cache.components = await fetchComponents();
      cache.compById.clear();
      for (const c of cache.components) cache.compById.set(c.ID, c);
    }

    // 2) Селекты складов
    fillWarehouseSelect(selFrom, cache.warehouses);
    fillWarehouseSelect(selTo,   cache.warehouses);

    // 3) Сброс маршрута и заметок
    notesEl && (notesEl.value = '');
    setRouteInfoUI(null);

    // 4) Очистить партии и создать одну по умолчанию
    if (batchesWrap) {
      batchesWrap.innerHTML = '';
      addBatch();
    }

    // 5) Подписки (не дублируем: перед этим снимем)
    selFrom?.removeEventListener('change', onWarehousesChangeRoute);
    selTo?.removeEventListener('change', onWarehousesChangeRoute);
    selFrom?.addEventListener('change', onWarehousesChangeRoute);
    selTo?.addEventListener('change', onWarehousesChangeRoute);

    addBatchBtn?.removeEventListener('click', addBatch);
    addBatchBtn?.addEventListener('click', addBatch);

    // 6) Показать модалку
    showModal();
  }

  // ======================= SUBMIT (создание заказа) =======================
  submitBtn?.addEventListener('click', async () => {
    const fromId = parseInt(selFrom?.value || '0', 10);
    const toId   = parseInt(selTo?.value   || '0', 10);
    if (!fromId || !toId) { showToast?.('Выберите склады отправителя и получателя'); return; }
    if (fromId === toId)  { showToast?.('Отправитель и получатель не могут совпадать'); return; }

    const route = findRoute(fromId, toId);
    if (!route) { showToast?.('Маршрут между выбранными складами не найден'); return; }

    // Собираем партии -> позиции
    const batchCards = [...(batchesWrap?.querySelectorAll('.batch-card') || [])];
    if (batchCards.length === 0) { showToast?.('Добавьте хотя бы одну партию'); return; }

    const batches = [];
    for (const card of batchCards) {
      const rows = [...card.querySelectorAll('.batch-items-body tr')];
      if (rows.length === 0) { showToast?.('В партии должна быть хотя бы одна позиция'); return; }

      const items = [];
      for (const tr of rows) {
        const sel = tr.querySelector('.bi-component');
        const qtyEl = tr.querySelector('.bi-qty');
        const cid = parseInt(sel?.value || '0', 10);
        const qty = parseInt(qtyEl?.value || '0', 10);
        if (cid <= 0 || !Number.isFinite(qty) || qty <= 0) {
          showToast?.('Заполните корректно позиции партий'); return;
        }
        items.push({ componentId: cid, quantity: qty });
      }
      batches.push({ items });
    }

    const payload = {
      fromId,
      toId,
      routeId:   route.ID ?? route.Route_ID,
      transitId: route.Transit?.ID ?? route.TransitID,
      notes:     String(notesEl?.value || '').trim(),
      batches,   // [{items:[{componentId,quantity}]}]
    };

    const ok = await createOrder(payload);
    if (!ok) return;
    hideModal();
    await load();
    showToast?.('Заказ создан', 'success');
  });

  // ======================= Публичный API =======================
  async function load() {
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const list = await fetchOrders(); // [] при 404
      renderList(list);
    } catch {
      tbody.innerHTML = `<tr><td colspan="8" class="text-muted">Нет заказов</td></tr>`;
    }
  }

  return { load, openCreate };
}
