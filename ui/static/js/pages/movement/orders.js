// static/js/pages/movement/orders.js
export function initOrders({ showToast, showConfirm }) {
  // ===== DOM =====
  const table = document.getElementById('table-move');
  const tbody = table ? document.getElementById('table-move-body') : null;

  // Модалка создания заказа
  const modalCreate = document.getElementById('modal-move-create');
  const selFrom     = document.getElementById('move-from');
  const selTo       = document.getElementById('move-to');
  const selRoute    = document.getElementById('move-route-select'); // <== НОВЫЙ селект маршрутов (см. ниже, что добавить в HTML)
  const notesEl     = document.getElementById('move-notes');
  const submitBtn   = document.getElementById('move-submit');

  // Панель инфо по выбранному маршруту
  const routeInfo = {
    id:       document.getElementById('move-route-id'),
    name:     document.getElementById('move-route-name'),
    tr:       document.getElementById('move-route-transit'),
    eta:      document.getElementById('move-route-eta'),
    capacity: document.getElementById('move-route-capacity'),
  };

  // Контролы позиций (на этапе создания партиЙ не видно — только позиции заказа)
  const items = {
    body:   document.getElementById('move-items-body'),
    empty:  document.getElementById('move-items-empty'),
    addBtn: document.getElementById('move-add-item'),
  };

  // Модалка просмотра заказа
  const modalView  = document.getElementById('modal-move-view'); // <== НОВАЯ модалка (см. ниже, что добавить в HTML)
  const viewBody   = document.getElementById('move-view-body');
  const viewClose  = document.getElementById('move-view-close');

  // ===== Кэш справочников =====
  let cache = {
    warehouses: [],   // [{ID,Name,Location,...}]
    routes:     [],   // [{ID,From:{ID,Name},To:{ID,Name},Transit:{ID,Name,Capacity}, Edh}]
    components: [],   // [{ID,Name,Weight}]
    compById:   new Map(), // ID -> компонент
  };

  // ===== TOAST helpers =====
  function toastByStatus(res, fallback) {
    switch (res.status) {
      case 409: showToast?.("Конфликт данных"); break;
      case 400: showToast?.("Некорректные данные"); break;
      default:  showToast?.(fallback || "Ошибка запроса");
    }
  }
  // Списки: 404 → пусто
  async function parseListGET(res, fallback) {
    if (res.status === 404) return [];
    if (!res.ok) { toastByStatus(res, fallback); return []; }
    const ct = res.headers.get('Content-Type') || '';
    return ct.includes('application/json') ? await res.json() : [];
  }
  // Прочие: тост на ошибки
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
  async function fetchOrderOne(id) {
    const res = await fetch(`/api/move?id=${id}`);
    return parseOrToast(res, "Не удалось загрузить заказ");
  }
  async function deleteOrder(id) {
    const res = await fetch(`/api/move?id=${id}`, { method: 'DELETE' });
    return parseOrToast(res, "Ошибка при удалении заказа");
  }
  // смена статуса (created -> running -> done)
  async function updateOrderStatus(id, status) {
    const res = await fetch(`/api/move?id=${encodeURIComponent(id)}&status=${encodeURIComponent(status)}`, {
      method: 'PUT'
    });
    return parseOrToast(res, "Ошибка смены статуса");
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

  // Комбинированное создание заказа с партиями
  async function createOrderWithBatches(payload) {
    // payload: { routeId, notes, batches: [ { items:[{componentId,quantity}] } ] }
    const res = await fetch('/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseOrToast(res, "Ошибка при создании заказа");
  }

  // ===== Форматирование/утилиты =====
  function fmtDate(d) {
    if (!d) return '-';
    try {
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return String(d);
      // 01.02.2025, 10:20:30
      return dt.toLocaleString('ru-RU');
    } catch { return String(d); }
  }
  function getStatus(o) {
    switch (o.Status) {
      case 'created': return 'Создан';
      case 'running': return 'Отправлен';
      case 'done':    return 'Завершён';
      default:        return o.Status || 'Создан';
    }
  }
  function batchesCount(o) {
    if (typeof o.BatchesCount === 'number') return o.BatchesCount;
    if (Array.isArray(o.Batches)) return o.Batches.length;
    return 0;
  }
  function routeIdOf(o)   { return o.Route?.ID ?? o.RouteID ?? o.RouteId ?? '—'; }
  function transitIdOf(o) { return o.Route?.Transit?.ID ?? o.TransitID ?? o.TransitId ?? '—'; }

  // Вес позиции = Weight * qty
  function itemWeight(componentId, qty) {
    const comp = cache.compById.get(Number(componentId));
    const w = comp?.Weight ?? 0;
    return w * qty;
  }

  // ===== Рендер таблицы заказов =====
  function renderEmpty() {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" class="text-muted">Нет заказов</td></tr>`;
  }

  function renderList(list) {
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) { renderEmpty(); return; }

    for (const o of list) {
      const id        = o.ID ?? o.Id ?? '—';
      const rID       = routeIdOf(o);
      const tID       = transitIdOf(o);
      const bCount    = batchesCount(o);
      const statusTxt = getStatus(o);
      const createdAt = fmtDate(o.CreatedAt);
      const closedAt  = fmtDate(o.ClosedAt ?? o.Aad ?? null);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="width:12ch;">#${id}</td>
        <td style="width:12ch;">${rID}</td>
        <td style="width:12ch;">${tID}</td>
        <td style="width:12ch;">${bCount}</td>
        <td style="width:22ch;">${statusTxt}</td>
        <td>${createdAt}</td>
        <td>${closedAt}</td>
        <td>
          <button class="btn btn-secondary btn-view" data-id="${id}">Просмотр</button>
          ${statusBtnHtml(o)}
          <button class="btn btn-danger btn-delete" data-id="${id}">Удалить</button>
        </td>
      `;

      // Просмотр
      tr.querySelector('.btn-view')?.addEventListener('click', () => openView(id));

      // Отправить/Принять
      const btnSend = tr.querySelector('.btn-send');
      const btnRecv = tr.querySelector('.btn-receive');
      if (btnSend) {
        btnSend.addEventListener('click', async () => {
          if (!(await showConfirm?.('Отправить заказ?', 'Подтверждение'))) return;
          const ok = await updateOrderStatus(id, 'running');
          if (!ok) return;
          await load();
          showToast?.('Заказ отправлен', 'success');
        });
      }
      if (btnRecv) {
        btnRecv.addEventListener('click', async () => {
          if (!(await showConfirm?.('Принять заказ?', 'Подтверждение'))) return;
          const ok = await updateOrderStatus(id, 'done');
          if (!ok) return;
          await load();
          showToast?.('Заказ принят', 'success');
        });
      }

      // Удаление
      tr.querySelector('.btn-delete')?.addEventListener('click', async () => {
        if (!(await showConfirm?.('Удалить заказ?', 'Подтверждение'))) return;
        const ok = await deleteOrder(id);
        if (!ok) return;
        await load();
        showToast?.('Заказ удалён', 'success');
      });

      tbody.appendChild(tr);
    }
  }

  function statusBtnHtml(order) {
    switch (order.Status) {
      case 'created':
        return `<button class="btn btn-primary btn-send" data-id="${order.ID}">Отправить</button>`;
      case 'running':
        return `<button class="btn btn-primary btn-receive" data-id="${order.ID}">Принять</button>`;
      case 'done':
      default:
        return ``;
    }
  }

  // ===== Получение маршрутов по паре (from, to) и заполнение селекта =====
  function findRoutesByPair(fromId, toId) {
    const f = Number(fromId), t = Number(toId);
    return (cache.routes || []).filter(r =>
      (r.From?.ID ?? r.FromID) === f && (r.To?.ID ?? r.ToID) === t
    );
  }
  function setRouteInfoByObj(route) {
    if (!route) {
      routeInfo.id.value       = '';
      routeInfo.name.textContent     = '—';
      routeInfo.tr.textContent       = '—';
      routeInfo.eta.textContent      = '—';
      routeInfo.capacity.textContent = '—';
      return;
    }
    const nm  = route.Name ?? `${route.From?.Name ?? `#${route.From?.ID ?? ''}`} → ${route.To?.Name ?? `#${route.To?.ID ?? ''}`}`;
    const eta = (route.Edh ?? route.ETAHours ?? route.etaHours ?? '—') + (route.Edh || route.ETAHours ? ' ч' : '');
    const cap = route.Transit?.Capacity != null ? `${route.Transit.Capacity} кг` : '—';

    routeInfo.id.value            = String(route.ID ?? route.Route_ID ?? '');
    routeInfo.name.textContent    = nm;
    routeInfo.tr.textContent      = route.Transit?.Name ?? (route.Transit?.ID ? `#${route.Transit.ID}` : '—');
    routeInfo.eta.textContent     = String(eta);
    routeInfo.capacity.textContent= cap;
  }
  function fillWarehouseSelect(sel, list) {
    if (!sel) return;
    if (!Array.isArray(list) || !list.length) {
      sel.innerHTML = `<option value="">— нет складов —</option>`;
      return;
    }
    sel.innerHTML = list.map(w =>
      `<option value="${w.ID}">${w.Name}${w.Location ? ' — ' + w.Location : ''}</option>`
    ).join('');
  }
  function fillComponentsSelect(sel, list) {
    if (!sel) return;
    if (!Array.isArray(list) || !list.length) {
      sel.innerHTML = `<option value="">— нет ТМЦ —</option>`;
      return;
    }
    sel.innerHTML = list.map(c => `<option value="${c.ID}">${c.Name}</option>`).join('');
  }
  function fillRoutesSelect(sel, routes) {
    if (!sel) return;
    if (!Array.isArray(routes) || !routes.length) {
      sel.innerHTML = `<option value="">— маршрут не найден —</option>`;
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    sel.innerHTML = routes.map(r => {
      const tr = r.Transit?.Name ? `${r.Transit.Name}` : (r.Transit?.ID ? `#${r.Transit.ID}` : '—');
      const eta = r.Edh ?? r.ETAHours ?? '-';
      const cap = r.Transit?.Capacity != null ? r.Transit.Capacity : '—';
      const label = `${tr} · ${eta} ч · ${cap} кг`;
      return `<option value="${r.ID}">${label}</option>`;
    }).join('');
  }
  function routeById(rid) {
    const id = Number(rid);
    return (cache.routes || []).find(r => (r.ID ?? r.Route_ID) === id) || null;
  }

  // ===== Позиции (создание) =====
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
    const sel = tr.querySelector('.move-item-component');
    fillComponentsSelect(sel, cache.components);
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

  // ===== Автосплит на партии по capacity (вес) =====
  function totalWeightOfItems(itemsArr) {
    return itemsArr.reduce((sum, it) => sum + itemWeight(it.componentId, it.quantity), 0);
  }

  // Разбиваем greedy: идём по позициям, наполняя текущую партию до capacity, переносим остатки в следующую
  function splitIntoBatches(itemsArr, capacity) {
    const batches = [];
    let cur = []; // items текущей партии
    let curW = 0;

    // клонируем, чтобы не портить исходные
    const queue = itemsArr.map(it => ({ componentId: it.componentId, quantity: it.quantity }));

    while (queue.length) {
      const it = queue.shift();
      const comp = cache.compById.get(it.componentId);
      const wPerOne = comp?.Weight ?? 0;
      if (wPerOne <= 0) {
        // нулевой вес — не влияет на сплит, кидаем всё в текущую
        cur.push({ componentId: it.componentId, quantity: it.quantity });
        continue;
      }

      let remainQty = it.quantity;
      while (remainQty > 0) {
        const canPutByWeight = Math.floor((capacity - curW) / wPerOne);
        if (canPutByWeight <= 0) {
          // текущая партия полна — открываем новую
          if (cur.length) batches.push({ items: cur });
          cur = [];
          curW = 0;
          continue;
        }

        const put = Math.min(remainQty, canPutByWeight);
        cur.push({ componentId: it.componentId, quantity: put });
        curW += put * wPerOne;
        remainQty -= put;

        if (remainQty > 0 && curW + wPerOne > capacity) {
          // новая партия
          batches.push({ items: cur });
          cur = [];
          curW = 0;
        }
      }
    }
    if (cur.length) batches.push({ items: cur });
    return batches;
  }

  // ===== Открытие модалки создания заказа =====
  async function openCreate() {
    // lazy-load справочники
    if (!cache.warehouses.length) cache.warehouses = await fetchWarehouses();
    if (!cache.routes.length)     cache.routes     = await fetchRoutes();
    if (!cache.components.length) cache.components = await fetchComponents();

    // индекс компонентов по ID
    cache.compById = new Map(cache.components.map(c => [Number(c.ID), c]));

    // заполнить склады
    fillWarehouseSelect(selFrom, cache.warehouses);
    fillWarehouseSelect(selTo,   cache.warehouses);

    // очистить селект маршрутов
    if (selRoute) {
      selRoute.innerHTML = `<option value="">— выберите склады —</option>`;
      selRoute.disabled = true;
    }

    // сброс позиций и добавление первой строки
    items.body.innerHTML = '';
    addItemRow();

    // сброс заметок и инфо
    notesEl.value = '';
    setRouteInfoByObj(null);

    // обработчики выбора from/to → фильтрация маршрутов
    function onChangeEndpoints() {
      const f = parseInt(selFrom?.value || '0', 10);
      const t = parseInt(selTo?.value   || '0', 10);
      if (!f || !t || f === t) {
        if (selRoute) {
          selRoute.innerHTML = `<option value="">— маршрут не найден —</option>`;
          selRoute.disabled = true;
        }
        setRouteInfoByObj(null);
        return;
      }
      const routes = findRoutesByPair(f, t);
      fillRoutesSelect(selRoute, routes);
      if (routes.length) {
        // выбрать первый по умолчанию
        selRoute.value = String(routes[0].ID);
        setRouteInfoByObj(routes[0]);
      } else {
        setRouteInfoByObj(null);
      }
    }
    selFrom?.addEventListener('change', onChangeEndpoints, { once: true });
    selTo?.addEventListener('change', onChangeEndpoints,   { once: true });

    // изменение выбранного маршрута
    selRoute?.addEventListener('change', () => {
      const r = routeById(selRoute.value);
      setRouteInfoByObj(r || null);
    });

    // кнопка “+ позиция”
    items.addBtn?.addEventListener('click', addItemRow);

    showModal(modalCreate);
  }

  // ===== Сабмит создания: автосплит + POST =====
  submitBtn?.addEventListener('click', async () => {
    const fromId = parseInt(selFrom?.value || '0', 10);
    const toId   = parseInt(selTo?.value   || '0', 10);
    if (!fromId || !toId) { showToast?.('Выберите склады отправителя и получателя'); return; }
    if (fromId === toId)  { showToast?.('Отправитель и получатель не могут совпадать'); return; }

    const routeId = parseInt((selRoute?.value || '0'), 10);
    const route   = routeById(routeId);
    if (!routeId || !route) { showToast?.('Маршрут не выбран'); return; }

    const itemsPayload = collectItems();
    if (!itemsPayload.length) { showToast?.('Добавьте хотя бы одну позицию'); return; }

    // capacity из выбранного маршрута
    const capacity = Number(route.Transit?.Capacity ?? 0);
    const totalW   = totalWeightOfItems(itemsPayload);

    let batches;
    if (capacity > 0 && totalW > capacity) {
      const minCount = Math.ceil(totalW / capacity);
      const ok = await showConfirm?.(
        `Суммарный вес ${totalW.toFixed(2)} кг превышает вместимость транзита ${capacity} кг. ` +
        `Предлагаю разделить на ${minCount} парти${minCount===1?'ю':'и'}. Разделить?`,
        'Автосплит по вместимости'
      );
      if (!ok) return;
      batches = splitIntoBatches(itemsPayload, capacity);
    } else {
      // всё в одну партию
      batches = [{ items: itemsPayload }];
    }

    const payload = {
      routeId: routeId,
      notes: String(notesEl?.value || '').trim(),
      batches // [{items:[{componentId,quantity}]}...]
    };

    const ok = await createOrderWithBatches(payload);
    if (!ok) return;
    hideModal(modalCreate);
    await load();
    showToast?.('Заказ создан', 'success');
  });

  // ===== Просмотр заказа (модалка) =====
  async function openView(id) {
    const data = await fetchOrderOne(id);
    if (!data) return;

    // сервер может вернуть массив из одного элемента (как в примере)
    const order = Array.isArray(data) ? data[0] : data;

    // посчитаем веса: по позициям партии, по партии и по заказу
    const batches = Array.isArray(order.Batches) ? order.Batches : [];
    const rows = [];
    let orderWeight = 0;

    for (const b of batches) {
      let batchWeight = 0;
      const itemsRows = [];
      for (const it of (b.Items || [])) {
        const cid = it.Component?.ID ?? it.Component_ID ?? it.componentId;
        const qty = it.Quantity ?? 0;
        const w   = (it.Component?.Weight != null) ? it.Component.Weight : (cache.compById.get(Number(cid))?.Weight ?? 0);
        const iw  = w * qty;
        batchWeight += iw;
        itemsRows.push(`
          <tr>
            <td>${it.Component?.Name ?? `#${cid}`}</td>
            <td style="text-align:right">${w}</td>
            <td style="text-align:right">${qty}</td>
            <td style="text-align:right">${iw.toFixed(2)}</td>
          </tr>
        `);
      }
      orderWeight += batchWeight;
      rows.push(`
        <div class="card mb-3">
          <div class="flex justify-between items-center" style="padding:8px 12px;">
            <div><strong>Партия #${b.ID}</strong> — статус: ${getStatus({Status:b.Status})}</div>
            <div><strong>Вес партии:</strong> ${batchWeight.toFixed(2)} кг</div>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>ТМЦ</th>
                  <th style="width:12ch;text-align:right">Вес, кг</th>
                  <th style="width:12ch;text-align:right">Кол-во</th>
                  <th style="width:14ch;text-align:right">Итого, кг</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows.join('')}
              </tbody>
            </table>
          </div>
        </div>
      `);
    }

    // Шапка заказа
    const r = order.Route || {};
    const headHtml = `
      <div class="mb-3">
        <div><strong>ID заказа:</strong> #${order.ID}</div>
        <div><strong>Маршрут:</strong> ${r.From?.Name ?? `#${r.From?.ID ?? ''}`} → ${r.To?.Name ?? `#${r.To?.ID ?? ''}`}</div>
        <div><strong>Транзит:</strong> ${r.Transit?.Name ?? `#${r.Transit?.ID ?? ''}`}</div>
        <div><strong>Время (Edh):</strong> ${r.Edh ?? '-' } ч</div>
        <div><strong>Статус:</strong> ${getStatus(order)}</div>
        <div><strong>Создан:</strong> ${fmtDate(order.CreatedAt)}</div>
        <div><strong>Ожидаемое прибытие:</strong> ${fmtDate(order.Ead)}</div>
        <div><strong>Отправлен:</strong> ${fmtDate(order.Asd)}</div>
        <div><strong>Получен:</strong> ${fmtDate(order.Aad)}</div>
        <div><strong>Заметки:</strong> ${order.Notes ?? ''}</div>
        <div class="mt-2"><strong>Вес заказа:</strong> ${orderWeight.toFixed(2)} кг</div>
      </div>
    `;

    if (viewBody) {
      viewBody.innerHTML = headHtml + rows.join('');
    }
    showModal(modalView);
  }

  // ===== Окна =====
  function showModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('hidden');
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function hideModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('hidden');
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  viewClose?.addEventListener('click', () => hideModal(modalView));

  // ===== Загрузка таблицы =====
  async function load() {
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      // кэш компонентов нужен, чтобы корректно показать веса при просмотре (если сервер не прислал Weight)
      if (!cache.components.length) {
        cache.components = await fetchComponents();
        cache.compById = new Map(cache.components.map(c => [Number(c.ID), c]));
      }
      const list = await fetchOrders();
      renderList(list);
    } catch {
      renderEmpty();
    }
  }

  // публичные методы
  return { load, openCreate };
}
