// /static/js/pages/inventory/warehouse.js
export function initWarehouse({ showToast }) {
  const panel = document.querySelector('#control-panel .flex');
  const tableBody = document.getElementById('table-stock-warehouse-body');

  let wrap = null;        // контейнер наших контролов
  let sel = null;         // select склада
  let btnBuy = null;      // Покупка
  let btnSell = null;     // Продажа
  let btnAddWh = null;    // Добавить склад

  async function loadWarehouses(preselect) {
    try {
      const res = await fetch('/api/storage?type=warehouse&inventory=false');
      if (!res.ok) throw new Error();
      const data = await res.json(); // [{ID,Name,Location,Type,...}]
      sel.innerHTML = data.map(s => `<option value="${s.ID}">${s.Name}</option>`).join('');
      if (preselect) sel.value = String(preselect);
      if (!sel.value && data[0]) sel.value = String(data[0].ID);
    } catch (e) {
      showToast?.('Не удалось загрузить склады');
    }
  }

  async function load() {
    // при необходимости тут можно подгружать таблицу для выбранного склада
    // эндпоинт не задан — оставляю пустым
    if (tableBody) tableBody.innerHTML = '';
  }

  function onBuy() {
    if (!window.openDoc) { showToast?.('Модалка документов не подключена'); return; }
    if (!sel.value) { showToast?.('Выберите склад'); return; }
    window.openDoc('purchase', { storageId: sel.value }, () => load());
  }

  function onSell() {
    if (!window.openDoc) { showToast?.('Модалка документов не подключена'); return; }
    if (!sel.value) { showToast?.('Выберите склад'); return; }
    window.openDoc('sale', { storageId: sel.value }, () => load());
  }

  function onAddWarehouse() {
    // если есть документ создания склада — откроем его
    if (window.openDoc) {
      window.openDoc('create-warehouse', {}, async () => {
        await loadWarehouses();
        await load();
      });
    } else {
      showToast?.('Нет обработчика создания склада');
    }
  }

  function showControls() {
    if (!panel || wrap) return;

    wrap = document.createElement('div');
    wrap.className = 'flex gap-2 items-center';
    wrap.id = 'warehouse-controls';

    sel = document.createElement('select');
    sel.id = 'warehouse-select';
    sel.className = 'w-full';
    sel.addEventListener('change', load);

    btnAddWh = document.createElement('button');
    btnAddWh.className = 'btn';
    btnAddWh.textContent = 'Добавить склад';
    btnAddWh.addEventListener('click', onAddWarehouse);

    btnBuy = document.createElement('button');
    btnBuy.className = 'btn btn-primary';
    btnBuy.textContent = 'Покупка';
    btnBuy.addEventListener('click', onBuy);

    btnSell = document.createElement('button');
    btnSell.className = 'btn';
    btnSell.textContent = 'Продажа';
    btnSell.addEventListener('click', onSell);

    // порядок: select | Добавить склад | Покупка | Продажа
    wrap.appendChild(sel);
    wrap.appendChild(btnAddWh);
    wrap.appendChild(btnBuy);
    wrap.appendChild(btnSell);

    panel.appendChild(wrap);

    // загрузка списков
    loadWarehouses().then(load);
  }

  function hideControls() {
    if (!wrap) return;
    sel?.removeEventListener('change', load);
    btnAddWh?.removeEventListener('click', onAddWarehouse);
    btnBuy?.removeEventListener('click', onBuy);
    btnSell?.removeEventListener('click', onSell);
    wrap.remove();
    wrap = sel = btnBuy = btnSell = btnAddWh = null;
  }

  return { showControls, hideControls, load };
}
