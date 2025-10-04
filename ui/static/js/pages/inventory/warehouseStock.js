// /static/js/pages/inventory/warehouse.js

import { openDoc } from "../../docs.js"

export function initWarehouseStock({ showToast }) {
  const panel = document.querySelector('#control-panel .flex');
  const tableBody = document.getElementById('table-stock-warehouse-body');

  let wrap = null;        // контейнер наших контролов
  let sel = null;         // select склада
  let btnBuy = null;      // Покупка
  let btnSell = null;     // Продажа

  async function loadWarehouses(preselect) {
    try {
      const res = await fetch('/api/storage?type=warehouse&inventory=false');
      if (!res.ok) throw new Error();
      const data = await res.json(); // [{ID,Name,Location,Type,...}]
      sel.innerHTML = data.map(s => `<option value="${s.ID}">${s.Name} - ${s.Location}</option>`).join('');
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
    if (!openDoc) { showToast?.('Модалка документов не подключена'); return; }
    if (!sel.value) { showToast?.('Выберите склад'); return; }
    openDoc('purchase', { storageId: sel.value }, () => load());
  }

  function onSell() {
    if (!openDoc) { showToast?.('Модалка документов не подключена'); return; }
    if (!sel.value) { showToast?.('Выберите склад'); return; }
    openDoc('sale', { storageId: sel.value }, () => load());
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
    wrap.appendChild(btnBuy);
    wrap.appendChild(btnSell);

    panel.appendChild(wrap);

    // загрузка списков
    loadWarehouses().then(load);
  }

  function hideControls() {
    if (!wrap) return;
    sel?.removeEventListener('change', load);
    btnBuy?.removeEventListener('click', onBuy);
    btnSell?.removeEventListener('click', onSell);
    wrap.remove();
    wrap = sel = btnBuy = btnSell = btnAddWh = null;
  }

  return { showControls, hideControls, load };
}
