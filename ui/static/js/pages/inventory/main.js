// main.js (точка входа для inventory, type="module")
import { resolveToastConfirm, updateHeaderOffset } from "./utils.js";
import { initTMC } from "./tmc.js";
import { initWarehouse } from "./warehouse.js";

(async function bootstrap() {
  const { showToast, showConfirm } = await resolveToastConfirm();

  // DOM: основные элементы
  const sidebar = document.querySelector('.sidebar');
  const tabs = document.querySelectorAll('.sidebar li');
  const sectionTitle = document.getElementById('section-title');
  const modal = document.getElementById('modal');

  // формы внутри модалки
  const forms = {
    tmc: document.getElementById('form-tmc'),
    transit: document.getElementById('form-stock-transit'),
    warehouse: document.getElementById('form-stock-warehouse'),
    production: document.getElementById('form-stock-production'),
  };

  if (!sidebar || !sectionTitle || !modal) {
    console.error("main.js: не найдены базовые элементы (sidebar/section-title/modal). Проверьте шаблон.");
    return;
  }

  // инициализация модулей
  const tmcModule = await initTMC({ showToast, showConfirm, modal });
  const warehouseModule = await initWarehouse({ showToast });

  let active = 'tmc';

  function hideAllModalForms() {
    Object.values(forms).forEach(f => {
      if (!f) return;
      f.classList.add('hidden');
    });
  }

  function showModalForm(name) {
    hideAllModalForms();
    const f = forms[name];
    if (f) f.classList.remove('hidden');
  }

  function setActive(tab) {
    active = tab;
    tabs.forEach(li => li.classList.toggle('active', li.dataset.tab === tab));

    const titles = {
      tmc: 'ТМЦ',
      'stock-warehouse': 'Запасы на складах',
      'stock-transit': 'Запасы в пути',
      'stock-production': 'Запасы в производстве',
      recipe: 'Рецептуры',
      order: 'Заказы',
    };
    sectionTitle.textContent = titles[tab] || 'Инвентаризация';

    const tables = {
      tmc: document.getElementById('table-tmc'),
      'stock-warehouse': document.getElementById('table-stock-warehouse'),
      'stock-transit': document.getElementById('table-stock-transit'),
      'stock-production': document.getElementById('table-stock-production'),
      // recipe: document.getElementById('table-recipe'),
      // order: document.getElementById('table-order'),
    };
    Object.entries(tables).forEach(([key, table]) => {
      if (!table) return;
      table.classList.toggle('hidden', key !== tab);
    });

    if (warehouseModule) {
      if (tab === 'stock-warehouse') {
        if (typeof warehouseModule.showControls === 'function') warehouseModule.showControls();
        if (typeof warehouseModule.load === 'function') warehouseModule.load();
      } else if (typeof warehouseModule.hideControls === 'function') {
        warehouseModule.hideControls();
      }
    }

    switch (tab) {
      case 'tmc':
        if (tmcModule && tmcModule.load) tmcModule.load();
        break;
      case 'stock-warehouse':
        // загрузка выполняется в warehouseModule.load()
        break;
      // case 'recipe': if (recipesModule && recipesModule.load) recipesModule.load(); break;
      // case 'order': if (ordersModule && ordersModule.load) ordersModule.load(); break;
    }
  }

  function openModal() {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');

    showModalForm(active);

    if (active === 'tmc' && tmcModule && tmcModule.openModal) tmcModule.openModal();
    // if (active === 'recipe' && recipesModule && recipesModule.openModal) recipesModule.openModal();
    // if (active === 'order' && ordersModule && ordersModule.openModal) ordersModule.openModal();

    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';

    if (tmcModule && tmcModule.reset) tmcModule.reset();
    // if (recipesModule && recipesModule.reset) recipesModule.reset();
    // if (ordersModule && ordersModule.reset) ordersModule.reset();

    hideAllModalForms();
  }

  tabs.forEach(li => li.addEventListener('click', () => setActive(li.dataset.tab)));

  document.querySelectorAll('#modal [id^="modal-cancel"]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  window.addEventListener('resize', updateHeaderOffset);
  window.addEventListener('load', updateHeaderOffset);
  updateHeaderOffset();

  hideAllModalForms();
  setActive(active);

})();
