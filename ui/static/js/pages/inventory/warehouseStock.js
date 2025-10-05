// /static/js/pages/inventory/warehouseStock.js
import { openDoc } from "../../docs.js";

export function initWarehouseStock({ showToast }) {
  const controlPanel   = document.getElementById('control-panel');
  const panelRight     = controlPanel?.querySelector('.flex'); // правая зона топбара
  const sectionTitle   = document.getElementById('section-title');
  const tableBody      = document.getElementById('table-stock-warehouse-body');

  let wrap = null;          // контейнер под кнопки справа
  let sel = null;           // селект склада (рядом с title)
  let btnBuy = null;
  let btnSell = null;
  let titleBlock = null;    // обёртка слева (h2 + select) — создаём только для этой вкладки
  let createdTitleBlock = false;

  async function loadWarehouses(preselect) {
    try {
      const res = await fetch('/api/storage?type=warehouse&inventory=false'); // эндпоинт в единственном числе
      if (!res.ok) throw new Error('storage list failed');
      const data = await res.json(); // ожидается [{ID, Name, Location, ...}]
      if (!sel) return;

      sel.innerHTML = data.map(s =>
        `<option value="${s.ID}">${s.Name}${s.Location ? ' — ' + s.Location : ''}</option>`
      ).join('');

      if (preselect) sel.value = String(preselect);
      if (!sel.value && data[0]) sel.value = String(data[0].ID);
    } catch (e) {
      console.error(e);
      showToast?.('Не удалось загрузить склады');
    }
  }

  async function load() {
    if (!tableBody) return;
    if (!sel?.value) { tableBody.innerHTML = ''; return; }

    tableBody.innerHTML = '';

    try {
      const url = `/api/storage?id=${encodeURIComponent(sel.value)}&inventory=true`;
      const res = await fetch(url);

      if (res.status === 404) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-muted">Нет запасов</td></tr>`;
        return;
      }
      if (!res.ok) throw new Error('inventory load failed');

      const payload = await res.json();
      // ожидаем объект склада с полем Inventory ([]). На всякий — достанем аккуратно:
      const inventory = Array.isArray(payload)
        ? (payload[0]?.Inventory || [])
        : (payload?.Inventory || []);

      if (!inventory.length) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-muted">Нет запасов</td></tr>`;
        return;
      }

      // Рисуем строки: ТМЦ | Количество | Вес (кг) | Действия
      for (const it of inventory) {
        const tr = document.createElement('tr');

        const tdName = document.createElement('td');
        tdName.textContent = it?.Component?.Name ?? '';

        const tdQty = document.createElement('td');
        tdQty.textContent = String(it?.Quantity ?? '');

        const tdWeight = document.createElement('td');
        // показываем вес компонента (если нужен другой — скажи)
        tdWeight.textContent = String(it?.Component?.Weight ?? '');

        const tdActions = document.createElement('td');
        // пока без действий — оставим пустым
        tdActions.textContent = '';

        tr.append(tdName, tdQty, tdWeight, tdActions);
        tableBody.appendChild(tr);
      }
    } catch (e) {
      console.error(e);
      showToast?.('Ошибка загрузки запасов');
      tableBody.innerHTML = `<tr><td colspan="4" class="text-muted">Нет запасов</td></tr>`;
    }
  }

  function onBuy() {
    if (!sel?.value) { showToast?.('Выберите склад'); return; }
    openDoc('purchase', { storageId: sel.value }, () => load());
  }

  function onSell() {
    if (!sel?.value) { showToast?.('Выберите склад'); return; }
    openDoc('sale', { storageId: sel.value }, () => load());
  }

  function showControls() {
    if (!controlPanel || !panelRight) return;

    // --- слева: делаем блок с заголовком и селектом только для этой вкладки ---
    if (!titleBlock) {
      titleBlock = document.createElement('div');
      titleBlock.id = 'title-block';
      titleBlock.className = 'flex items-center';
      // вставляем перед правым блоком и переносим h2 внутрь
      controlPanel.insertBefore(titleBlock, panelRight);
      titleBlock.appendChild(sectionTitle);
      createdTitleBlock = true;
    }

    if (!sel) {
      sel = document.createElement('select');
      sel.id = 'warehouse-select';
      // фиксированные габариты и отступ от заголовка
      sel.style.width = '220px';
      sel.style.maxWidth = '100%';
      sel.style.marginLeft = 'var(--spacing-3)';
      sel.addEventListener('change', load);
      titleBlock.appendChild(sel);
    }

    // --- справа: кнопки ---
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'warehouse-controls';
      wrap.className = 'flex items-center';

      btnBuy = document.createElement('button');
      btnBuy.className = 'btn btn-primary';
      btnBuy.textContent = 'Покупка';
      btnBuy.style.marginRight = 'var(--spacing-2)';
      btnBuy.addEventListener('click', onBuy);

      btnSell = document.createElement('button');
      btnSell.className = 'btn';
      btnSell.textContent = 'Продажа';
      btnSell.addEventListener('click', onSell);

      wrap.appendChild(btnBuy);
      wrap.appendChild(btnSell);
      panelRight.appendChild(wrap);
    }

    // загрузить данные
    loadWarehouses().then(load).catch(() => {});
  }

  function hideControls() {
    // убираем селект только в этой вкладке
    if (sel) {
      sel.removeEventListener('change', load);
      sel.remove();
      sel = null;
    }
    // кнопки справа
    if (btnBuy)  { btnBuy.removeEventListener('click', onBuy); btnBuy = null; }
    if (btnSell) { btnSell.removeEventListener('click', onSell); btnSell = null; }
    if (wrap)    { wrap.remove(); wrap = null; }

    // возвращаем заголовок на место и удаляем обёртку, если создавали её здесь
    if (createdTitleBlock && titleBlock) {
      // вставляем h2 обратно перед правым блоком
      controlPanel.insertBefore(sectionTitle, panelRight);
      titleBlock.remove();
      titleBlock = null;
      createdTitleBlock = false;
    }
  }

  return { showControls, hideControls, load };
}
