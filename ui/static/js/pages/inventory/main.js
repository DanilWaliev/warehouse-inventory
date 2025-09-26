// main.js (точка входа для unventory, type="module")
import { resolveToastConfirm, updateHeaderOffset } from "./utils.js";
import { initTMC } from "./tmc.js";
// import { initRecipes } from "./recipes.js";
// import { initOrders } from "./orders.js";

(async function bootstrap() {
  const { showToast, showConfirm } = await resolveToastConfirm();

  // DOM: основные элементы
  const sidebar = document.querySelector('.sidebar');
  const tabs = document.querySelectorAll('.sidebar li');
  const sectionTitle = document.getElementById('section-title');
  const addBtn = document.getElementById('addBtn');
  const modal = document.getElementById('modal');

  // формы внутри модалки
  const forms = {
    tmc: document.getElementById('form-tmc'),
    transit: document.getElementById('form-stock-transit'),
    warehouse: document.getElementById('form-stock-warehouse'),
    production: document.getElementById('form-stock-production'),
  };

  // проверка
  if (!sidebar || !sectionTitle || !addBtn || !modal) {
    console.error("main.js: не найдены базовые элементы (sidebar/section-title/addBtn/modal). Проверьте шаблон.");
    return;
  }

  // инициализация модулей
  const tmcModule = await initTMC({ showToast, showConfirm, modal });
  // const recipesModule = await initRecipes({ showToast, showConfirm, modal });
  // const ordersModule = await initOrders({ showToast, showConfirm, modal });

  let active = 'tmc';

  // helper: скрыть все формы внутри модалки
  function hideAllModalForms() {
    Object.values(forms).forEach(f => {
      if (!f) return;
      f.classList.add('hidden');
    });
  }

  // helper: показать только нужную форму (tmc|recipe|order)
  function showModalForm(name) {
    hideAllModalForms();
    const f = forms[name];
    if (f) f.classList.remove('hidden');
  }

  // установка активной вкладки
  function setActive(tab) {
    active = tab;
    tabs.forEach(li => li.classList.toggle('active', li.dataset.tab === tab));
    sectionTitle.textContent = tab === 'tmc' ? 'ТМЦ' : tab === 'recipe' ? 'Рецептуры' : 'Заказы';

    // показываем/скрываем таблицы
    const tables = {
      tmc: document.getElementById('table-tmc'),
      // recipe: document.getElementById('table-recipe'),
      // order: document.getElementById('table-order')
    };
    Object.keys(tables).forEach(k => {
      if (!tables[k]) return;
      tables[k].classList.toggle('hidden', k !== tab);
    });

    // загрузка данных для вкладки
    switch (tab) {
      case 'tmc': if (tmcModule && tmcModule.load) tmcModule.load(); break;
      // case 'recipe': if (recipesModule && recipesModule.load) recipesModule.load(); break;
      // case 'order': if (ordersModule && ordersModule.load) ordersModule.load(); break;
    }
  }

  // открытие модалки (централизовано)
  function openModal() {
    // показываем overlay
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');

    // показываем только форму текущей вкладки
    showModalForm(active);

    // даём модулям подготовить данные (заполнить селекты)
    if (active === 'tmc' && tmcModule && tmcModule.openModal) tmcModule.openModal();
    // if (active === 'recipe' && recipesModule && recipesModule.openModal) recipesModule.openModal();
    // if (active === 'order' && ordersModule && ordersModule.openModal) ordersModule.openModal();

    // блокируем прокрутку страницы
    document.body.style.overflow = 'hidden';
  }

  // закрытие модалки (централизовано)
  function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';

    // пытаемся сбросить формы через модули
    if (tmcModule && tmcModule.reset) tmcModule.reset();
    // if (recipesModule && recipesModule.reset) recipesModule.reset();
    // if (ordersModule && ordersModule.reset) ordersModule.reset();

    // дополнительно скрываем все формы
    hideAllModalForms();
  }

  // меню
  tabs.forEach(li => li.addEventListener('click', () => setActive(li.dataset.tab)));

  // кнопка Добавить
  addBtn.addEventListener('click', openModal);

  // отмена в модалках (id=modal-cancel, modal-cancel-2, modal-cancel-3)
  document.querySelectorAll('#modal [id^="modal-cancel"]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  // header offset
  window.addEventListener('resize', updateHeaderOffset);
  window.addEventListener('load', updateHeaderOffset);
  updateHeaderOffset();

  // Инициализация стартовой вкладки
  // Также скрываем формы на старте, чтобы ничего не показывалось до открытия модалки
  hideAllModalForms();
  setActive(active);

})();
