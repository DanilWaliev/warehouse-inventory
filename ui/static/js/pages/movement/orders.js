// static/js/pages/movement/orders.js
export function initOrders({ showToast, showConfirm }) {
  // ===== DOM =====
  const table = document.getElementById('table-move');
  const tbody = table ? document.getElementById('table-move-body') : null;

  // Создание заказа
  const modalCreate = document.getElementById('modal-move-create');
  const selFrom     = document.getElementById('move-from');
  const selTo       = document.getElementById('move-to');
  const selTransit  = document.getElementById('move-transit');

  const routeInfo = {
    id:       document.getElementById('move-route-id'),
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

  // Просмотр заказа
  const modalView      = document.getElementById('modal-move-view');
  const modalViewBody  = document.getElementById('move-view-body');
  const modalViewClose = document.getElementById('move-view-close');

  // “Итого вес”
  let totalWeightEl = null;

  // ===== Кэш =====
  const cache = {
    warehouses: [],
    routes:     [],
    components: [],
    componentsIndex: new Map(), // id -> component (для веса)
  };

  // ===== Сетевые хелперы =====
  function once(fn){ let called=false; return (...a)=>{ if(called) return; called=true; fn(...a); }; }
  const toastOnce = {
    ord: once((m)=>showToast?.(m||'Ошибка загрузки заказов')),
    wh:  once((m)=>showToast?.(m||'Ошибка загрузки складов')),
    rts: once((m)=>showToast?.(m||'Ошибка загрузки маршрутов')),
    tmc: once((m)=>showToast?.(m||'Ошибка загрузки ТМЦ')),
  };

  async function getJSON(url, { toastKey, fallbackMsg, timeoutMs = 8000 } = {}) {
    const ac = new AbortController();
    const t  = setTimeout(()=>ac.abort('timeout'), timeoutMs);
    try {
      const res = await fetch(url, { signal: ac.signal });
      if (res.status === 404) return [];
      if (!res.ok) { toastKey && toastOnce[toastKey]?.(fallbackMsg); return []; }
      const ct = res.headers.get('Content-Type') || '';
      return ct.includes('application/json') ? await res.json() : [];
    } catch {
      toastKey && toastOnce[toastKey]?.(fallbackMsg);
      return [];
    } finally { clearTimeout(t); }
  }

  async function sendJSON(url, options = {}, fallbackMsg) {
    const ac = new AbortController();
    const t  = setTimeout(()=>ac.abort('timeout'), 8000);
    try {
      const res = await fetch(url, { signal: ac.signal, ...options });
      if (!res.ok) {
        switch (res.status) {
          case 409: showToast?.('Конфликт данных'); break;
          case 400: showToast?.('Некорректные данные'); break;
          default:  showToast?.(fallbackMsg || 'Ошибка запроса');
        }
        return null;
      }
      const ct = res.headers.get('Content-Type') || '';
      return ct.includes('application/json') ? await res.json() : true;
    } catch {
      showToast?.(fallbackMsg || 'Сетевой сбой');
      return null;
    } finally { clearTimeout(t); }
  }

  // ===== API =====
  const fetchOrders     = () => getJSON('/api/move', { toastKey:'ord', fallbackMsg:'Ошибка загрузки заказов' });
  const fetchWarehouses = () => getJSON('/api/storage?type=warehouse&inventory=false', { toastKey:'wh',  fallbackMsg:'Ошибка загрузки складов' });
  const fetchRoutes     = () => getJSON('/api/route', { toastKey:'rts', fallbackMsg:'Ошибка загрузки маршрутов' });
  const fetchComponents = () => getJSON('/api/tmc', { toastKey:'tmc', fallbackMsg:'Ошибка загрузки ТМЦ' });

  const deleteOrder = (id) =>
    sendJSON(`/api/move?id=${encodeURIComponent(id)}`, { method:'DELETE' }, 'Ошибка при удалении заказа');

  const setOrderStatus = (id, status) =>
    sendJSON(`/api/move?id=${encodeURIComponent(id)}&status=${encodeURIComponent(status)}`, { method:'PUT' }, 'Ошибка смены статуса');

  const createOrderWithBatches = (payload) =>
    sendJSON('/api/move', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) }, 'Ошибка при создании заказа');

  // ===== Утилиты =====
  const fmtDateSafe = (d)=>{
    if (!d) return '-';
    if (typeof d === 'string' && /^0+1-0*1-0*1/.test(d)) return '-';
    const dt = new Date(d); return Number.isNaN(dt.getTime()) ? '-' : dt.toLocaleString('ru-RU');
  };
  const statusText = (s)=>{
    switch (s) { case 'created': return 'Создан'; case 'running': return 'Отправлен'; case 'done': return 'Завершён'; default: return s||'—'; }
  };

  const weightOf = (componentId)=>{
    const c = cache.componentsIndex.get(componentId);
    return c ? Number(c.Weight)||0 : 0;
  };
  const calcItemWeight = (componentId, qty)=> weightOf(componentId)*(Number(qty)||0);

  function collectItems() {
    const out = [];
    for (const r of items.body.querySelectorAll('tr')) {
      const sel  = r.querySelector('.move-item-component');
      const qtyE = r.querySelector('.move-item-qty');
      const cid  = parseInt(sel?.value || '0', 10);
      const qty  = parseInt(qtyE?.value || '0', 10);
      if (cid > 0 && Number.isFinite(qty) && qty > 0) out.push({ componentId: cid, quantity: qty });
    }
    return out;
  }
  const calcTotalWeight = (list)=> list.reduce((s,it)=> s + calcItemWeight(it.componentId,it.quantity), 0);

  // ===== Таблица заказов =====
  const firstActionForOrder = (o)=>{
    if (o.Batches?.some(b=>b.Status==='created')) return 'send';
    if (o.Batches?.some(b=>b.Status==='running')) return 'receive';
    return null;
  };
  const actionButtonHTML = (kind, id)=>{
    if (kind==='send')   return `<button class="btn btn-primary btn-send" data-id="${id}">Отправить</button>`;
    if (kind==='receive')return `<button class="btn btn-primary btn-recv" data-id="${id}">Принять</button>`;
    return '';
  };
  const onSendOrder    = async (id)=>{ const ok = await setOrderStatus(id,'running'); if (ok){ await load(); showToast?.('Партия отправлена','success'); } };
  const onReceiveOrder = async (id)=>{ const ok = await setOrderStatus(id,'done');    if (ok){ await load(); showToast?.('Партия принята','success'); } };

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
      const routeID      = o.Route?.ID ?? o.RouteID ?? '—';
      const transitID    = o.Route?.Transit?.ID ?? o.TransitID ?? '—';
      const batchesCount = Array.isArray(o.Batches) ? o.Batches.length : (o.BatchesCount ?? 0);
      const status       = statusText(o.Status);
      const createdAt    = fmtDateSafe(o.CreatedAt);
      const closedAt     = fmtDateSafe(o.Aad ?? o.ClosedAt);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="width:12ch;">#${id}</td>
        <td style="width:12ch;">${routeID}</td>
        <td style="width:12ch;">${transitID}</td>
        <td style="width:12ch;">${batchesCount}</td>
        <td style="width:22ch;">${status}</td>
        <td>${createdAt}</td>
        <td>${closedAt}</td>
        <td class="nowrap">
          <button class="btn btn-secondary btn-view" data-id="${id}">Открыть</button>
          ${actionButtonHTML(firstActionForOrder(o), id)}
          <button class="btn btn-danger btn-del" data-id="${id}">Удалить</button>
        </td>
      `;

      tr.querySelector('.btn-view') ?.addEventListener('click', () => openView(o));
      tr.querySelector('.btn-del')  ?.addEventListener('click', async () => {
        if (!(await showConfirm?.('Удалить заказ перемещения?', 'Подтверждение'))) return;
        const ok = await deleteOrder(id); if (!ok) return;
        await load(); showToast?.('Заказ удалён','success');
      });
      tr.querySelector('.btn-send') ?.addEventListener('click', () => onSendOrder(id));
      tr.querySelector('.btn-recv') ?.addEventListener('click', () => onReceiveOrder(id));

      tbody.appendChild(tr);
    }
  }

  // ===== Просмотр заказа =====
  const badgeClass = (st)=> st==='done'?'status-finished':(st==='created'?'status-created':'');
  function openView(order) {
    if (!modalView || !modalViewBody) return;
    const rid  = order.Route?.ID ?? '—';
    const trID = order.Route?.Transit?.ID ?? '—';
    const edh  = order.Route?.Edh != null ? `${order.Route.Edh} ч` : '—';
    const createdAt = fmtDateSafe(order.CreatedAt);
    const ead = fmtDateSafe(order.Ead);
    const asd = fmtDateSafe(order.Asd ?? order.ActualShipmentDate);
    const aad = fmtDateSafe(order.Aad ?? order.ClosedAt);

    const batchesHTML = (order.Batches ?? []).map((b, idx) => {
      const rows = (b.Items || []).map(it => {
        const cid   = it.Component?.ID ?? it.Component_ID;
        const cname = it.Component?.Name ?? '';
        const pcw   = weightOf(cid);
        const w     = pcw * (Number(it.Quantity)||0);
        return `
          <tr>
            <td>${cname}</td>
            <td>${it.Quantity}</td>
            <td>${pcw.toFixed(3)}</td>
            <td>${w.toFixed(3)}</td>
          </tr>
        `;
      }).join('');
      const bw = (b.Items || []).reduce((s, it)=> s + weightOf(it.Component?.ID ?? it.Component_ID)*(Number(it.Quantity)||0), 0);
      return `
        <div class="card" style="margin-bottom:1rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
            <h4 style="margin:0;">Партия ${idx+1}</h4>
            <div class="status-badge ${badgeClass(b.Status)}">${statusText(b.Status)}</div>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>ТМЦ</th>
                  <th style="width:12ch;">Кол-во</th>
                  <th style="width:12ch;">Вес 1 шт, кг</th>
                  <th style="width:14ch;">Вес, кг</th>
                </tr>
              </thead>
              <tbody>${rows || `<tr><td colspan="4" class="text-muted">Нет позиций</td></tr>`}</tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="text-align:right;font-weight:600;">Вес партии:</td>
                  <td style="font-weight:600;">${bw.toFixed(3)} кг</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      `;
    }).join('');

    modalViewBody.innerHTML = `
      <div class="card" style="margin-bottom:1rem;">
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;">
          <div><strong>ID заказа:</strong> #${order.ID ?? '—'}</div>
          <div><strong>Статус:</strong> ${statusText(order.Status)}</div>
          <div><strong>ID маршрута:</strong> ${rid}</div>
          <div><strong>ID транзита:</strong> ${trID}</div>
          <div><strong>EDH:</strong> ${edh}</div>
          <div><strong>Создан:</strong> ${createdAt}</div>
          <div><strong>Ожидается:</strong> ${ead}</div>
          <div><strong>Отправлен:</strong> ${asd}</div>
          <div><strong>Получен:</strong> ${aad}</div>
          <div><strong>Заметки:</strong> ${order.Notes ?? '—'}</div>
        </div>
      </div>
      ${batchesHTML || `<div class="text-muted">Партии отсутствуют</div>`}
    `;
    modalView.classList.remove('hidden');
    modalView.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
  }
  function closeView() {
    if (!modalView) return;
    modalView.classList.add('hidden');
    modalView.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }
  modalViewClose?.addEventListener('click', closeView);
  modalView?.addEventListener('click', (e) => {
    const content = modalView.querySelector('.modal-content');
    if (e.target === modalView && !content.contains(e.target)) closeView();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalView && !modalView.classList.contains('hidden')) closeView();
  });

  // ===== Селекты и маршрут =====
  function fillWarehouseSelect(sel, list) {
    if (!sel) return;
    if (!Array.isArray(list) || list.length === 0) {
      sel.innerHTML = `<option value="">Нет складов</option>`;
      return;
    }
    sel.innerHTML = list.map(w => `<option value="${w.ID}">${w.Name}${w.Location ? ' — ' + w.Location : ''}</option>`).join('');
  }
  function fillComponentsSelect(sel, list) {
    if (!sel) return;
    if (!Array.isArray(list) || list.length === 0) {
      sel.innerHTML = `<option value="">Нет ТМЦ</option>`;
      return;
    }
    sel.innerHTML = list.map(c => `<option value="${c.ID}">${c.Name}</option>`).join('');
  }
  function findRoutesBetween(fromId, toId) {
    const f = Number(fromId), t = Number(toId);
    return (cache.routes || []).filter(r => (r.From?.ID ?? r.FromID) === f && (r.To?.ID ?? r.ToID) === t);
  }
  function disableTransitSelect(placeholderText) {
    selTransit.disabled = true;
    selTransit.innerHTML = `<option selected>${placeholderText}</option>`;
    selTransit.style.color = '#9ca3af';
    setRouteInfo(null);
  }
  function enableTransitSelect() {
    selTransit.disabled = false;
    selTransit.style.color = '';
  }
  function rebuildTransitForPair() {
    const f = parseInt(selFrom?.value || '0', 10);
    const t = parseInt(selTo?.value   || '0', 10);
    if (!f || !t || f === t) { disableTransitSelect('Выберите склады'); return; }
    const routes = findRoutesBetween(f, t);
    if (!routes.length) { disableTransitSelect('Маршрутов нет'); return; }
    enableTransitSelect();
    selTransit.innerHTML = routes.map(r => {
      const rid = r.ID ?? r.Route_ID;
      const trName = r.Transit?.Name || 'Транзитный склад';
      return `<option value="${rid}">${trName}</option>`;
    }).join('');
    updateRouteInfoFromSelect();
    recalcTotalWeight();
  }
  function updateRouteInfoFromSelect() {
    const rid = parseInt(selTransit?.value || '0', 10);
    const route = (cache.routes || []).find(r => (r.ID ?? r.Route_ID) === rid) || null;
    setRouteInfo(route);
  }
  function setRouteInfo(route) {
    if (!route) {
      routeInfo.id.value         = '';
      routeInfo.name.textContent = '';
      routeInfo.eta.textContent  = '';
      routeInfo.capacity.textContent = '';
      return;
    }
    const nm  = `${route.From?.Name ?? ''} → ${route.To?.Name ?? ''}`.trim();
    const edh = route.Edh != null ? `${route.Edh} ч` : '';
    const cap = route.Transit?.Capacity != null ? `${route.Transit.Capacity} кг` : '';
    routeInfo.id.value         = String(route.ID ?? route.Route_ID ?? '');
    routeInfo.name.textContent = nm;
    routeInfo.eta.textContent  = edh;
    routeInfo.capacity.textContent = cap;
  }

  // ===== Позиции + Итого вес =====
  function ensureTotalWeightEl() {
    if (totalWeightEl) return totalWeightEl;
    const wrap = document.getElementById('move-items-table')?.closest('.card');
    const el = document.createElement('div');
    el.id = 'move-total-weight';
    el.className = 'mt-2';
    el.style.fontWeight = '600';
    el.style.textAlign  = 'right';
    el.textContent = 'Итого вес: 0 кг';
    wrap?.appendChild(el);
    totalWeightEl = el;
    return el;
  }
  function recalcTotalWeight() {
    const sum = calcTotalWeight(collectItems());
    ensureTotalWeightEl().textContent = `Итого вес: ${sum.toFixed(3)} кг`;
  }
  function attachRowListeners(tr) {
    tr.querySelector('.move-item-component')?.addEventListener('change', recalcTotalWeight);
    tr.querySelector('.move-item-qty')?.addEventListener('input', recalcTotalWeight);
  }
  function toggleItemsEmpty() {
    if (!items.body || !items.empty) return;
    const has = items.body.querySelector('tr') != null;
    items.empty.style.display = has ? 'none' : '';
  }
  function addItemRow() {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><select class="move-item-component" required></select></td>
      <td><input type="number" class="move-item-qty" min="1" step="1" value="1" required></td>
      <td><button type="button" class="btn btn-danger btn-remove">Удалить</button></td>
    `;
    items.body.appendChild(tr);
    fillComponentsSelect(tr.querySelector('.move-item-component'), cache.components);
    tr.querySelector('.btn-remove')?.addEventListener('click', () => { tr.remove(); toggleItemsEmpty(); recalcTotalWeight(); });
    attachRowListeners(tr);
    toggleItemsEmpty();
    recalcTotalWeight();
  }

  // ===== Авто-разбиение на партии (без выбора пользователем) =====
// Возвращает { batches, n } или null, если существует единица товара тяжелее capacity
function autoPack(itemsPayload, capacityKg) {
  const EPS = 1e-9;

  // 1) проверка: если хотя бы ОДНА штука какого-то компонента тяжелее capacity — разложить невозможно
  for (const it of itemsPayload) {
    const uw = weightOf(it.componentId); // вес одной штуки
    if (uw - capacityKg > EPS && it.quantity > 0) {
      return null;
    }
  }

  // 2) считаем минимально возможное число партий по суммарному весу
  const total = calcTotalWeight(itemsPayload);
  const minBatches = capacityKg > 0 ? Math.max(1, Math.ceil(total / capacityKg)) : 1;

  // 3) строим партии, деля quantity по мере заполнения
  const batches = buildBatchesSplit(itemsPayload, capacityKg);
  return { batches, n: Math.max(minBatches, batches.length) };
}

// Деление quantity: greedy по “ведру” с остаточной вместимостью.
// Партия заполняется по максимуму; если не помещается — создаём новую партию.
// Позиции с нулевым весом (uw === 0) не занимают вместимость и целиком идут в текущую партию.
function buildBatchesSplit(itemsPayload, capacityKg) {
  const EPS = 1e-9;

  // текущая партия
  let current = { items: [], weight: 0 };
  let remain  = capacityKg;              // остаток по весу в текущей партии
  const out   = [];

  const pushBatch = () => {
    // не добавляем пустые партии
    if (current.items.length) out.push(current);
    current = { items: [], weight: 0 };
    remain  = capacityKg;
  };

  // идём в порядке как есть — при необходимости можно сортировать
  for (const src of itemsPayload) {
    let qtyLeft = Number(src.quantity) || 0;
    const cid   = src.componentId;
    const uw    = Number(weightOf(cid)) || 0; // вес 1 шт

    if (qtyLeft <= 0) continue;

    if (uw === 0) {
      // весь объём без веса — можно положить целиком в текущую партию
      current.items.push({ componentId: cid, quantity: qtyLeft });
      // вес не меняется
      continue;
    }

    // uw > 0 — делим по партиям
    while (qtyLeft > 0) {
      // если в текущей партии нет места — открываем новую
      if (remain <= EPS) {
        pushBatch();
      }

      // сколько штук помещается сейчас
      const fitNow = Math.floor((remain + EPS) / uw); // целых штук
      if (fitNow <= 0) {
        // несмотря на remain>EPS может не помещаться из-за численных эффектов — откроем новую
        pushBatch();
        continue;
      }

      const take = Math.min(qtyLeft, fitNow);
      current.items.push({ componentId: cid, quantity: take });
      current.weight += take * uw;
      remain         -= take * uw;
      qtyLeft        -= take;
    }
  }

  // дописываем последнюю партию
  pushBatch();

  return out;
}

  // упаковка в фиксированное N партий
  function splitFFD(itemsPayload, capacityKg, targetN) {
    const clones = itemsPayload.map(it => ({ ...it }));
    clones.sort((a,b) => calcItemWeight(b.componentId,b.quantity) - calcItemWeight(a.componentId,a.quantity));
    const batches = Array.from({ length: targetN }, () => ({ items: [], weight: 0 }));
    for (const it of clones) {
      const w = calcItemWeight(it.componentId, it.quantity);
      let placed = false;
      for (const b of batches) {
        if (b.weight + w <= capacityKg + 1e-9) {
          b.items.push(it);
          b.weight += w;
          placed = true;
          break;
        }
      }
      if (!placed) return null;
    }
    return batches.map(b => ({ items: b.items }));
  }

  // ===== Сабмит создания заказа =====
  submitBtn?.addEventListener('click', async () => {
    const fromId  = parseInt(selFrom?.value || '0', 10);
    const toId    = parseInt(selTo?.value   || '0', 10);
    const routeId = parseInt(routeInfo.id?.value || '0', 10);

    if (!fromId || !toId) { showToast?.('Выберите отправителя и получателя'); return; }
    if (fromId === toId)  { showToast?.('Отправитель и получатель не могут совпадать'); return; }
    if (!routeId)         { showToast?.('Маршрут не выбран'); return; }

    const itemsPayload = collectItems();
    if (itemsPayload.length === 0) { showToast?.('Добавьте хотя бы одну позицию'); return; }

    const route    = (cache.routes || []).find(r => (r.ID ?? r.Route_ID) === routeId) || null;
    const capacity = route?.Transit?.Capacity != null ? Number(route.Transit.Capacity) : 0;
    const total    = calcTotalWeight(itemsPayload);

    // Если нет известной вместимости либо всё влезает — одна партия
    if (!(capacity > 0) || total <= capacity + 1e-9) {
      const ok = await createOrderWithBatches({
        routeId,
        notes: String(notesEl?.value || '').trim(),
        batches: [{ items: itemsPayload.map(it => ({ componentId: it.componentId, quantity: it.quantity })) }],
      });
      if (!ok) return;
      hideCreate(); await load();
      showToast?.('Заказ создан','success');
      return;
    }

    // Есть ограничение и не влезает — режем сами на минимум партий
    const packed = autoPack(itemsPayload, capacity);
    if (!packed) {
      // единственный случай, когда сообщаем — когда физически невозможно разложить
      showToast?.('Есть позиция тяжелее вместимости выбранного транзита. Уменьшите количество или выберите другой маршрут.');
      return;
    }

    // Спросить только «Согласны разбить на N партий?» — Да/Нет
    const agree = await showConfirm?.(
      `Вес заказа ${total.toFixed(3)} кг больше вместимости транзитного склада ${capacity.toFixed(3)} кг.\n` +
      `Разбить заказ на ${packed.n} партий автоматически?`,
      'Разбить на партии'
    );
    if (!agree) { hideCreate(); return; }

    const ok = await createOrderWithBatches({
      routeId,
      notes: String(notesEl?.value || '').trim(),
      batches: packed.batches.map(b => ({ items: b.items.map(it => ({ componentId: it.componentId, quantity: it.quantity })) })),
    });
    if (!ok) return;
    hideCreate(); await load();
    showToast?.('Заказ создан (автоматически разбит на партии)','success');
  });

  // ===== Показ/закрытие модалки создания =====
  function showCreate() {
    modalCreate.classList.remove('hidden');
    modalCreate.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
  }
  function hideCreate() {
    modalCreate.classList.add('hidden');
    modalCreate.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }

  // ===== Публичный openCreate =====
  async function openCreate() {
    const [wh, rts, tmc] = await Promise.all([
      cache.warehouses.length ? Promise.resolve(cache.warehouses) : fetchWarehouses(),
      cache.routes.length     ? Promise.resolve(cache.routes)     : fetchRoutes(),
      cache.components.length ? Promise.resolve(cache.components) : fetchComponents(),
    ]);

    if (Array.isArray(wh))  cache.warehouses = wh;
    if (Array.isArray(rts)) cache.routes     = rts;
    if (Array.isArray(tmc)) cache.components = tmc;

    cache.componentsIndex.clear();
    for (const c of cache.components) cache.componentsIndex.set(c.ID, c);

    fillWarehouseSelect(selFrom, cache.warehouses);
    fillWarehouseSelect(selTo,   cache.warehouses);

    selFrom.onchange    = rebuildTransitForPair;
    selTo.onchange      = rebuildTransitForPair;
    selTransit.onchange = updateRouteInfoFromSelect;

    disableTransitSelect('Выберите склады');

    items.body.innerHTML = '';
    toggleItemsEmpty();
    addItemRow();

    notesEl.value = '';
    ensureTotalWeightEl();
    recalcTotalWeight();

    showCreate();
  }

  // ===== Загрузка таблицы =====
  async function load() {
    if (!tbody) return;
    tbody.innerHTML = '';

    // заранее подгружаем ТМЦ для веса
    if (!cache.components.length) {
      const tmc = await fetchComponents();
      if (Array.isArray(tmc)) {
        cache.components = tmc;
        cache.componentsIndex.clear();
        for (const c of cache.components) cache.componentsIndex.set(c.ID, c);
      }
    }

    try {
      const list = await fetchOrders();
      renderList(list);
    } catch { renderEmpty(); }
  }

  // Закрытия по фону/ESC
  modalCreate?.addEventListener('click', (e) => {
    const content = modalCreate.querySelector('.modal-content');
    if (e.target === modalCreate && !content.contains(e.target)) hideCreate();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalCreate.classList.contains('hidden')) hideCreate();
  });

  // Плюс позиция
  items.addBtn?.addEventListener('click', addItemRow);

  return { load, openCreate };
}
