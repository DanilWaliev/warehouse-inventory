// static/js/pages/movement/orders.js
export function initOrders({ showToast, showConfirm }) {
  // ===== DOM =====
  const table = document.getElementById('table-move');
  const tbody = table ? document.getElementById('table-move-body') : null;

  // Модалка создания заказа
  const modalCreate = document.getElementById('modal-move-create');
  const selFrom     = document.getElementById('move-from');
  const selTo       = document.getElementById('move-to');
  const selTransit  = document.getElementById('move-transit');

  const routeInfo = {
    name:     document.getElementById('move-route-name'),
    eta:      document.getElementById('move-route-eta'),
    capacity: document.getElementById('move-route-capacity'),
  };

  const items = {
    body:   document.getElementById('move-items-body'),
    empty:  document.getElementById('move-items-empty'),
    addBtn: document.getElementById('move-add-item'),
  };

  const notesEl   = document.getElementById('move-notes');
  const submitBtn = document.getElementById('move-submit');

  // Модалка ПРОСМОТРА заказа
  const modalView     = document.getElementById('modal-move-view');
  const viewBody      = document.getElementById('move-view-body');
  const viewBtnClose  = document.getElementById('move-view-close');

  // ===== кэш справочников =====
  let cache = {
    warehouses: [],   // + productionsite
    routes:     [],   // все маршруты
    components: [],   // ТМЦ: {ID,Name,Weight,...}
  };

  // ===== toast helpers =====
  function toastByStatus(res, fallback) {
    switch (res.status) {
      case 409: showToast?.("Конфликт"); break;
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
  async function fetchOrderById(id) {
    const res = await fetch(`/api/move?id=${id}`);
    return parseOrToast(res, "Ошибка загрузки заказа");
  }
  async function deleteOrder(id) {
    const res = await fetch(`/api/move?id=${id}`, { method: 'DELETE' });
    return parseOrToast(res, "Ошибка при удалении заказа");
  }

  async function fetchWarehousesAndProduction() {
    // подтягиваем оба типа и объединяем
    const [whRes, psRes] = await Promise.allSettled([
      fetch('/api/storage?type=warehouse&inventory=false'),
      fetch('/api/storage?type=productionsite&inventory=false'),
    ]);
    let wh = [];
    if (whRes.status === 'fulfilled') wh = await parseListGET(whRes.value, "Ошибка загрузки складов");
    let ps = [];
    if (psRes.status === 'fulfilled') ps = await parseListGET(psRes.value, "Ошибка загрузки производств");
    return [...(Array.isArray(wh)?wh:[]), ...(Array.isArray(ps)?ps:[])];
  }
  async function fetchRoutes() {
    const res = await fetch('/api/route');
    return parseListGET(res, "Ошибка загрузки маршрутов");
  }
  async function fetchComponents() {
    const res = await fetch('/api/tmc');
    return parseListGET(res, "Ошибка загрузки ТМЦ");
  }

  // создать заказ (возможны партии)
  async function createOrder(payload) {
    const res = await fetch('/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseOrToast(res, "Ошибка при создании заказа");
  }

  // сменить статус ПАРТИИ (подтверждено)
  async function updateBatchStatus(orderId, batchId, status) {
    const url = `/api/move?orderId=${encodeURIComponent(orderId)}&batchId=${encodeURIComponent(batchId)}&status=${encodeURIComponent(status)}`;
    const res = await fetch(url, { method: 'PUT' });
    return parseOrToast(res, "Не удалось поменять статус партии");
  }

  // ===== helpers =====
  function fmtDate(d) {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return '—';
      return dt.toLocaleString('ru-RU');
    } catch { return '—'; }
  }
  function addHours(dateISO, hours) {
    if (!dateISO || !Number.isFinite(hours)) return null;
    const t = new Date(dateISO);
    if (Number.isNaN(t.getTime())) return null;
    t.setHours(t.getHours() + hours);
    return t.toISOString();
  }
  function calcEAD(order) {
    // если есть дата фактической отгрузки — считаем EAD = ASd + Edh
    const asd = order.Asd || order.ActualShipmentDate;
    const edh = order.Route?.Edh ?? order.Edh ?? null;
    if (asd && Number.isFinite(edh)) {
      const iso = addHours(asd, edh);
      return iso ? fmtDate(iso) : '—';
    }
    return '—';
  }
  function humanStatus(s) {
    switch (s) {
      case 'created': return 'Создан';
      case 'running': return 'Отправлен';
      case 'done':    return 'Завершён';
      default:        return s || '—';
    }
  }
  function statusClass(s) {
    switch (s) {
      case 'created': return 'status-badge status-created';
      case 'running': return 'status-badge status-dispatched';
      case 'done':    return 'status-badge status-finished';
      default:        return 'status-badge';
    }
  }
  function getBatchesCount(o) {
    if (typeof o.BatchesCount === 'number') return o.BatchesCount;
    if (Array.isArray(o.Batches)) return o.Batches.length;
    return 0;
  }
  function byId(map, id) { return map.get(id) || null; }

  function fillWarehouseSelect(sel, list) {
    if (!sel) return;
    if (!Array.isArray(list) || list.length === 0) {
      sel.innerHTML = `<option value="">Нет доступных складов</option>`;
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    sel.innerHTML = list.map(w =>
      `<option value="${w.ID}">${w.Name}${w.Location ? ' — ' + w.Location : ''}</option>`
    ).join('');
  }

  function fillComponentsSelect(sel, list) {
    if (!sel) return;
    if (!Array.isArray(list) || list.length === 0) {
      sel.innerHTML = `<option value="">— нет ТМЦ —</option>`;
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    sel.innerHTML = list.map(c => `<option value="${c.ID}">${c.Name}</option>`).join('');
  }

  // маршруты для пары (from,to)
  function findRoutesBetween(fromId, toId) {
    const f = Number(fromId), t = Number(toId);
    if (!Array.isArray(cache.routes)) return [];
    return cache.routes.filter(r =>
      (r.From?.ID ?? r.FromID) === f && (r.To?.ID ?? r.ToID) === t
    );
  }

  function setTransitSelectForPair(fromId, toId) {
    if (!selTransit) return { route: null, capacity: null };
    const candidates = findRoutesBetween(fromId, toId);
    if (!candidates.length) {
      selTransit.innerHTML = `<option value="">Нет маршрутов</option>`;
      selTransit.disabled = true;
      routeInfo.name.textContent = '—';
      routeInfo.eta.textContent  = '—';
      routeInfo.capacity.textContent = '—';
      return { route: null, capacity: null };
    }
    selTransit.disabled = false;
    // сгруппируем по транзитному складу
    selTransit.innerHTML = candidates.map(r => {
      const t = r.Transit?.ID;
      const label = r.Transit?.Name || 'Транзитный склад';
      return `<option value="${t}">${label}</option>`;
    }).join('');

    // выберем первую опцию и отрисуем инфо
    const chosenTransitId = Number(selTransit.value);
    const chosenRoute = candidates.find(r => (r.Transit?.ID ?? 0) === chosenTransitId) || candidates[0];
    selTransit.value = String(chosenRoute.Transit?.ID ?? '');

    // обновим инфо
    routeInfo.name.textContent     = `${chosenRoute.From?.Name ?? ''} → ${chosenRoute.To?.Name ?? ''}`;
    routeInfo.eta.textContent      = Number.isFinite(chosenRoute.Edh) ? `${chosenRoute.Edh} ч` : '—';
    routeInfo.capacity.textContent = chosenRoute.Transit?.Capacity != null
      ? `${chosenRoute.Transit.Capacity} кг`
      : '—';

    return { route: chosenRoute, capacity: chosenRoute.Transit?.Capacity ?? null };
  }

  // ===== строки позиций в создании =====
  function toggleItemsEmpty() {
    if (!items.body || !items.empty) return;
    const hasRows = items.body.querySelector('tr') != null;
    items.empty.style.display = hasRows ? 'none' : '';
  }
  function addItemRow() {
    if (!items.body) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><select class="move-item-component" required></select></td>
      <td><input type="number" class="move-item-qty" min="1" step="1" value="1" required></td>
      <td><button type="button" class="btn btn-danger btn-remove">Удалить</button></td>
    `;
    items.body.appendChild(tr);
    const sel = tr.querySelector('.move-item-component');
    fillComponentsSelect(sel, cache.components);
    tr.querySelector('.btn-remove')?.addEventListener('click', () => {
      tr.remove();
      toggleItemsEmpty();
      renderOrderWeightInCreate();
    });
    tr.querySelector('.move-item-qty')?.addEventListener('input', renderOrderWeightInCreate);
    sel?.addEventListener('change', renderOrderWeightInCreate);
    toggleItemsEmpty();
    renderOrderWeightInCreate();
  }
  function collectItems() {
    if (!items.body) return [];
    const rows = [...items.body.querySelectorAll('tr')];
    const out = [];
    for (const r of rows) {
      const selC = r.querySelector('.move-item-component');
      const qtyEl= r.querySelector('.move-item-qty');
      const cid  = parseInt(selC?.value || '0', 10);
      const qty  = parseInt(qtyEl?.value || '0', 10);
      if (cid > 0 && Number.isFinite(qty) && qty > 0) {
        out.push({ componentId: cid, quantity: qty });
      }
    }
    return out;
  }

  // ===== вес заказа при создании + автопэкинг =====
  function weightOfItem(compId, qty) {
    const comp = cache.components.find(c => c.ID === compId);
    const w = comp?.Weight ?? 0;
    return (Number(w) || 0) * (Number(qty) || 0);
  }
  function totalWeight(items) {
    return items.reduce((s, it) => s + weightOfItem(it.componentId, it.quantity), 0);
  }

  // авторазбиение по capacity (кг): учитывает одинаковые позиции — режет по нескольким партиям
  function autoPack(items, capacity) {
    if (!capacity || capacity <= 0) return [{ items }];

    const out = [];
    let current = [];
    let curWeight = 0;

    // скопируем массив с учётом разбиения поштучно
    const expanded = [];
    for (const it of items) {
      const unitW = weightOfItem(it.componentId, 1);
      let left = it.quantity;
      // если позиция слишком тяжёлая даже поштучно — всё равно поместим её в отдельную партию
      if (unitW > capacity) {
        expanded.push({ componentId: it.componentId, quantity: it.quantity, _unitW: unitW });
        continue;
      }
      while (left > 0) {
        expanded.push({ componentId: it.componentId, quantity: 1, _unitW: unitW });
        left--;
      }
    }

    // теперь собираем партии
    for (const piece of expanded) {
      if (curWeight + piece._unitW > capacity && current.length) {
        // закрываем текущую партию
        out.push(compactSame(current));
        current = [];
        curWeight = 0;
      }
      current.push(piece);
      curWeight += piece._unitW;
    }
    if (current.length) out.push(compactSame(current));

    // и те, что тяжелее capacity сами по себе — в отдельные партии (как целые количества)
    for (const it of items) {
      const unitW = weightOfItem(it.componentId, 1);
      if (unitW > capacity) {
        out.push([{ componentId: it.componentId, quantity: it.quantity }]);
      }
    }

    // нормализуем формат: [{items:[{componentId,quantity}]}]
    return out.map(arr => ({ items: arr }));
  }

  function compactSame(pieces) {
    // склеиваем одинаковые componentId (pieces — поштучные/разбитые)
    const map = new Map();
    for (const p of pieces) {
      const prev = map.get(p.componentId) || 0;
      map.set(p.componentId, prev + (p.quantity || 1));
    }
    return [...map.entries()].map(([componentId, quantity]) => ({ componentId, quantity }));
  }

  // Отрисовка «Суммарный вес» при создании
  function renderOrderWeightInCreate() {
    const list = collectItems();
    const w = totalWeight(list);
    let pill = document.getElementById('move-order-weight-pill');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'move-order-weight-pill';
      pill.className = 'chip chip--neutral';
      // вставим к info-блоку
      const info = document.getElementById('move-route-info');
      info?.appendChild(pill);
    }
    pill.textContent = `${(Math.round(w*100)/100)} кг`;
  }

  // ====== рендер таблицы ======
  function renderEmpty() {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9" class="text-muted">Нет заказов</td></tr>`;
  }

  function renderList(list) {
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) { renderEmpty(); return; }

    for (const o of list) {
      const id           = o.ID ?? o.Id ?? '—';
      const routeID      = o.Route?.ID ?? o.RouteId ?? '—';
      const transitID    = o.Route?.Transit?.ID ?? '—';
      const batchesCount = getBatchesCount(o);
      const createdAt    = fmtDate(o.CreatedAt);
      const closedAt     = (o.Status === 'done') ? fmtDate(o.Aad || o.ClosedAt) : '—';
      const statusText   = humanStatus(o.Status);
      const eadText      = calcEAD(o);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="width:12ch;">${id}</td>
        <td style="width:12ch;">${routeID}</td>
        <td style="width:12ch;">${transitID}</td>
        <td style="width:12ch;">${batchesCount}</td>
        <td style="width:22ch;"><span class="${statusClass(o.Status)}">${statusText}</span></td>
        <td>${createdAt}</td>
        <td>${eadText}</td>
        <td>
          <button class="btn btn-compact js-open" data-id="${id}">Открыть</button>
          <button class="btn btn-danger btn-compact js-del" data-id="${id}">Удалить</button>
        </td>
      `;
      tr.querySelector('.js-del')?.addEventListener('click', async () => {
        if (!(await showConfirm?.('Удалить заказ перемещения?', 'Подтверждение'))) return;
        const ok = await deleteOrder(id);
        if (!ok) return;
        await load();
        showToast?.('Заказ удалён', 'success');
      });
      tr.querySelector('.js-open')?.addEventListener('click', () => openView(id));
      tbody.appendChild(tr);
    }
  }

  // ====== Модалка ПРОСМОТРА ======
  async function openView(orderId) {
    // тянем один заказ
    const data = await fetchOrderById(orderId);
    if (!data) return;
    const order = Array.isArray(data) ? data[0] : data;

    // заголовок + инфо
    const headHtml = `
      <div class="mb-4">
        <div class="kv-row">
          <div class="kv"><span class="label">Заказ</span> <span class="chip">${order.ID}</span></div>
          <div class="kv"><span class="label">Маршрут</span> <span class="chip">
            ${order.Route?.From?.Name ?? ''} → ${order.Route?.To?.Name ?? ''}
          </span></div>
          <div class="kv"><span class="label">Транзит</span> <span class="chip">${
            order.Route?.Transit?.Name ?? '—'
          }</span></div>
          <div class="kv"><span class="label">Время</span> <span class="chip">${
            Number.isFinite(order.Route?.Edh) ? `${order.Route.Edh} ч` : '—'
          }</span></div>
          <div class="kv"><span class="label">EAD</span> <span class="chip">${calcEAD(order)}</span></div>
          <div class="kv"><span class="label">Статус</span> <span class="badge ${badgeClass(order.Status)}">
            ${humanStatus(order.Status)}
          </span></div>
        </div>
      </div>
    `;

    // партии (каждая с таблицей)
    const batches = Array.isArray(order.Batches) ? order.Batches : [];
    const batchCards = batches.map((b, idx) => renderBatchCard(order, b, idx + 1)).join('');

    viewBody.innerHTML = headHtml + batchCards;
    showModalView();

    // безопасное автофокусирование наверх
    try { viewBody.scrollTop = 0; } catch(_) {}
  }

  function badgeClass(s) {
    switch (s) {
      case 'created': return 'badge--created';
      case 'running': return 'badge--running';
      case 'done':    return 'badge--done';
      default:        return '';
    }
  }

  function batchWeight(b) {
    if (!Array.isArray(b.Items)) return 0;
    return b.Items.reduce((sum, it) => {
      const w = it?.Component?.Weight ?? 0;
      const q = it?.Quantity ?? 0;
      return sum + (Number(w)||0) * (Number(q)||0);
    }, 0);
  }

  function renderBatchCard(order, batch, ordinal) {
    const w = batchWeight(batch);
    const status = batch.Status || 'created';
    const statusBadge = `<span class="badge ${badgeClass(status)}">${humanStatus(status)}</span>`;

    const canSend    = status === 'created';
    const canReceive = status === 'running';

    // элементы партии
    const rows = (batch.Items || []).map(it => `
      <tr>
        <td>${it?.Component?.Name ?? ''}</td>
        <td>${it?.Quantity ?? ''}</td>
        <td>${it?.Component?.Weight ?? ''}</td>
        <td>${ ((Number(it?.Quantity)||0)*(Number(it?.Component?.Weight)||0)).toFixed(2) }</td>
      </tr>
    `).join('');

    return `
      <div class="card mb-4">
        <div class="flex items-center justify-between mb-row">
          <div class="kv-row">
            <div class="kv"><span class="label">Партия</span> <span class="chip">${ordinal}</span></div>
            <div class="kv"><span class="label">Вес</span> <span class="chip">${(Math.round(w*100)/100)} кг</span></div>
            <div class="kv"><span class="label">Статус</span> ${statusBadge}</div>
          </div>
          <div class="btn-group">
            ${canSend ? `<button class="btn btn-primary btn-compact js-batch-send" data-oid="${order.ID}" data-bid="${batch.ID}">Отправить</button>` : ''}
            ${canReceive ? `<button class="btn btn-primary btn-compact js-batch-receive" data-oid="${order.ID}" data-bid="${batch.ID}">Принять</button>` : ''}
          </div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>ТМЦ</th><th>Кол-во</th><th>Вес ед.</th><th>Вес позиции</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="4" class="text-muted">Нет позиций</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // делегирование кликов (важно при большом числе партий)
  viewBody?.addEventListener('click', async (e) => {
    const sendBtn = e.target.closest('.js-batch-send');
    const recvBtn = e.target.closest('.js-batch-receive');
    if (!sendBtn && !recvBtn) return;

    const orderId = Number((sendBtn||recvBtn).dataset.oid);
    const batchId = Number((sendBtn||recvBtn).dataset.bid);
    const nextStatus = !!sendBtn ? 'running' : 'done';

    // подтверждение
    const text = nextStatus === 'running' ? 'Отправить партию?' : 'Принять партию?';
    if (!(await showConfirm?.(text, 'Подтверждение'))) return;

    const ok = await updateBatchStatus(orderId, batchId, nextStatus);
    if (!ok) return;

    // подтянем свежий заказ и перерисуем (обновится EAD, статусы и кнопки)
    const data = await fetchOrderById(orderId);
    const order = Array.isArray(data) ? data[0] : data;
    const batches = Array.isArray(order?.Batches) ? order.Batches : [];

    // обновить шапку (EAD/статус заказа — от сервера)
    const head = viewBody.querySelector('.mb-4');
    if (head) {
      head.querySelectorAll('.chip, .badge'); // noop; просто перерисуем весь блок
      const freshHead = `
        <div class="kv-row">
          <div class="kv"><span class="label">Заказ</span> <span class="chip">${order.ID}</span></div>
          <div class="kv"><span class="label">Маршрут</span> <span class="chip">
            ${order.Route?.From?.Name ?? ''} → ${order.Route?.To?.Name ?? ''}
          </span></div>
          <div class="kv"><span class="label">Транзит</span> <span class="chip">${
            order.Route?.Transit?.Name ?? '—'
          }</span></div>
          <div class="kv"><span class="label">Время</span> <span class="chip">${
            Number.isFinite(order.Route?.Edh) ? `${order.Route.Edh} ч` : '—'
          }</span></div>
          <div class="kv"><span class="label">EAD</span> <span class="chip">${calcEAD(order)}</span></div>
          <div class="kv"><span class="label">Статус</span> <span class="badge ${badgeClass(order.Status)}">
            ${humanStatus(order.Status)}
          </span></div>
        </div>
      `;
      head.innerHTML = freshHead;
    }

    // перерисовать партии
    const cardsHTML = batches.map((b, idx) => renderBatchCard(order, b, idx + 1)).join('');
    // очистим кроме head (первый div.mb-4) — остальное заменим
    const blocks = [...viewBody.children];
    if (blocks.length > 1) {
      for (let i=1;i<blocks.length;i++) blocks[i].remove();
    }
    const frag = document.createElement('div');
    frag.innerHTML = cardsHTML;
    viewBody.appendChild(frag);

    // и таблицу перечитаем, чтобы бейджи/ead обновились
    await load();
  });

  function showModalView() {
    if (!modalView) return;
    modalView.classList.remove('hidden');
    modalView.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function hideModalView() {
    if (!modalView) return;
    modalView.classList.add('hidden');
    modalView.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  viewBtnClose?.addEventListener('click', hideModalView);

  // ====== Открытие СОЗДАНИЯ заказа ======
  async function openCreate() {
    // подгружаем справочники (лениво)
    if (!cache.warehouses.length) cache.warehouses = await fetchWarehousesAndProduction();
    if (!cache.routes.length)     cache.routes     = await fetchRoutes();
    if (!cache.components.length) cache.components = await fetchComponents();

    fillWarehouseSelect(selFrom, cache.warehouses);
    fillWarehouseSelect(selTo,   cache.warehouses);

    // сброс позиций
    items.body.innerHTML = '';
    toggleItemsEmpty();
    addItemRow();

    // сброс заметок и инфо
    notesEl.value = '';
    routeInfo.name.textContent = '—';
    routeInfo.eta.textContent  = '—';
    routeInfo.capacity.textContent = '—';
    selTransit.innerHTML = `<option value="">Нет маршрутов</option>`;
    selTransit.disabled = true;

    // обработчики смены складов → пересчитать кандидатов маршрутов/транзитов
    function onPairChange() {
      const f = parseInt(selFrom?.value || '0', 10);
      const t = parseInt(selTo?.value   || '0', 10);
      if (!f || !t || f === t) {
        selTransit.innerHTML = `<option value="">Нет маршрутов</option>`;
        selTransit.disabled = true;
        routeInfo.name.textContent = '—';
        routeInfo.eta.textContent  = '—';
        routeInfo.capacity.textContent = '—';
        return;
      }
      setTransitSelectForPair(f, t);
    }
    selFrom?.addEventListener('change', onPairChange);
    selTo?.addEventListener('change', onPairChange);

    // смена транзита из списка кандидатов — просто обновляем инфо по route
    selTransit?.addEventListener('change', () => {
      const f = parseInt(selFrom?.value || '0', 10);
      const t = parseInt(selTo?.value   || '0', 10);
      const list = findRoutesBetween(f, t);
      const chosen = list.find(r => (r.Transit?.ID ?? -1) === Number(selTransit.value));
      if (!chosen) return;
      routeInfo.name.textContent     = `${chosen.From?.Name ?? ''} → ${chosen.To?.Name ?? ''}`;
      routeInfo.eta.textContent      = Number.isFinite(chosen.Edh) ? `${chosen.Edh} ч` : '—';
      routeInfo.capacity.textContent = chosen.Transit?.Capacity != null
        ? `${chosen.Transit.Capacity} кг`
        : '—';
    });

    // кнопка “+ позиция”
    items.addBtn?.addEventListener('click', addItemRow, { once: false });

    // показать модалку
    modalCreate?.classList.remove('hidden');
    modalCreate?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  // ====== SUBMIT СОЗДАНИЯ (с автоделением на партии при нехватке capacity) ======
  submitBtn?.addEventListener('click', async () => {
    const fromId = parseInt(selFrom?.value || '0', 10);
    const toId   = parseInt(selTo?.value   || '0', 10);
    if (!fromId || !toId) { showToast?.('Выберите отправителя и получателя'); return; }
    if (fromId === toId)  { showToast?.('Отправитель и получатель не могут совпадать'); return; }

    const itemsPayload = collectItems();
    if (itemsPayload.length === 0) { showToast?.('Добавьте хотя бы одну позицию'); return; }

    // найдём все маршруты и выбранный транзит
    const list = findRoutesBetween(fromId, toId);
    if (!list.length) { showToast?.('Нет маршрутов между выбранными складами'); return; }
    const chosen = list.find(r => (r.Transit?.ID ?? -1) === Number(selTransit?.value));
    if (!chosen) { showToast?.('Выберите транзитный склад'); return; }

    const capacity = Number(chosen.Transit?.Capacity ?? 0);
    const sumW = totalWeight(itemsPayload);

    let payload = {
      fromId,
      toId,
      routeId:   chosen.ID ?? chosen.Route_ID,
      transitId: chosen.Transit?.ID,
      notes:     String(notesEl?.value || '').trim(),
      // по умолчанию — одна партия, позже может замениться
      batches:   [{ items: itemsPayload }]
    };

    if (capacity > 0 && sumW > capacity) {
      // предложим разбить
      const needBatches = Math.ceil(sumW / capacity);
      const ok = await showConfirm?.(
        `Заказ не помещается в транзитный склад.\nСуммарный вес: ${sumW.toFixed(2)} кг, вместимость: ${capacity} кг.\n` +
        `Разбить автоматически на ${needBatches} партии(й)?`,
        'Разбить на партии'
      );
      if (!ok) {
        // закрываем модалку без создания
        closeCreateModal();
        return;
      }
      const packs = autoPack(itemsPayload, capacity);
      payload.batches = packs.map(p => ({ items: p.items }));
    }

    const ok = await createOrder(payload);
    if (!ok) return;
    closeCreateModal();
    await load();
    showToast?.('Заказ создан', 'success');
  });

  function closeCreateModal() {
    if (!modalCreate) return;
    modalCreate.classList.add('hidden');
    modalCreate.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // ====== LOAD таблицы ======
  async function load() {
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const list = await fetchOrders(); // [] при 404
      renderList(list);
    } catch {
      renderEmpty();
    }
  }

  return { load, openCreate };
}
