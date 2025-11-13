  // main.js (точка входа для inventory, type="module")
  import { updateHeaderOffset } from "./utils.js";
  import { initTMC } from "./tmc.js";
  import { initWarehouseStock } from "./warehouseStock.js";
  import { showToast } from "../../toast.js"
  import { showConfirm } from "../../confirm.js";
  import { initWarehouses } from "./warehouses.js";
  import { initTransitStock } from "./transitStock.js";
  import { initProductionStock } from "./productionStock.js";


  (async function bootstrap() {
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
    const warehousesModule = await initWarehouses({ showToast, showConfirm, modal });
    const warehouseStockModule = await initWarehouseStock({ showToast });
    const transitStockModule = await initTransitStock({ showToast });
    const productionStockModule = await initProductionStock({ showToast });



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
        'stock-warehouse': 'Запасы на складе',
        'stock-transit': 'Запасы в пути',
        'stock-production': 'Запасы в производстве',
        recipe: 'Рецептуры',
        order: 'Заказы',
        warehouses: 'Склады',
      };
      sectionTitle.textContent = titles[tab] || 'Инвентаризация';

      const tables = {
        tmc: document.getElementById('table-tmc'),
        'stock-warehouse': document.getElementById('table-stock-warehouse'),
        'stock-transit': document.getElementById('table-stock-transit'),
        'stock-production': document.getElementById('table-stock-production'),
        'warehouses': document.getElementById('table-warehouses'),
      };
      Object.entries(tables).forEach(([key, table]) => {
        if (!table) return;
        table.classList.toggle('hidden', key !== tab);
      });

      if (warehouseStockModule) {
        if (tab === 'stock-warehouse') {
          if (typeof warehouseStockModule.showControls === 'function') warehouseStockModule.showControls();
          if (typeof warehouseStockModule.load === 'function') warehouseStockModule.load();
        } else if (typeof warehouseStockModule.hideControls === 'function') {
          warehouseStockModule.hideControls();
        }
      }

      if (warehousesModule) {
        if (tab === 'warehouses') {
          warehousesModule.showControls?.();
          warehousesModule.load?.();
        } else {
          warehousesModule.hideControls?.();
        }
      }

      if (transitStockModule) {
        if (tab === 'stock-transit') {
          transitStockModule.showControls?.();
          transitStockModule.load?.();
        } else {
          transitStockModule.hideControls?.();
        }
      }

      if (productionStockModule) {
        if (tab === 'stock-production') {
          productionStockModule.showControls?.();
          productionStockModule.load?.();
        } else {
          productionStockModule.hideControls?.();
        }
      }


      switch (tab) {
        case 'tmc':
          if (tmcModule && tmcModule.load) tmcModule.load();
          break;
        case 'stock-warehouse':
          // загрузка выполняется в warehouseModule.load()
          break;
      }
    }

    function openModal() {
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden','false');

      showModalForm(active);

      if (active === 'tmc' && tmcModule && tmcModule.openModal) tmcModule.openModal();

      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden','true');
      document.body.style.overflow = '';

      if (tmcModule && tmcModule.reset) tmcModule.reset();

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
