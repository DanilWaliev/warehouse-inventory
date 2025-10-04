// /static/js/pages/inventory/warehouse.js

import { openDoc } from "../../docs.js"

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

function onAddWarehouse() {
  const modal = document.getElementById('modal');
  const form = document.getElementById('form-warehouse-create');
  const modalTitle = document.getElementById('modal-title');

  // спрятать все остальные формы
  document.querySelectorAll('.modal-form').forEach(f => f.classList.add('hidden'));
  form.classList.remove('hidden');

  modalTitle.textContent = "Создать склад";
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // reset формы
  form.reset();

  // обработчик сохранения
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      type: "warehouse",
      name: fd.get("name").toString(),
      location: fd.get("location").toString(),
      notes: fd.get("notes").toString(),
    };

    try {
      const res = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return showToast("Ошибка при создании склада");

      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      await loadWarehouses();
      await load();
    } catch (err) {
      showToast("Ошибка при создании склада")
      console.log(err)
    }
  };

  document.getElementById('modal-cancel-warehouse').onclick = () => {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    form.reset();
  };
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
