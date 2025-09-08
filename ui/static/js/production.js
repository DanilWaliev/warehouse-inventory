(function() {
  // Элементы
  const sidebar = document.querySelector('.sidebar');
  const tabs = document.querySelectorAll('.sidebar li');
  const sectionTitle = document.getElementById('section-title');
  const addBtn = document.getElementById('addBtn');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const forms = {
    tmc: document.getElementById('form-tmc'),
    recipe: document.getElementById('form-recipe'),
    order: document.getElementById('form-order')
  };
  const tables = {
    tmc: document.getElementById('table-tmc'),
    recipe: document.getElementById('table-recipe'),
    order: document.getElementById('table-order')
  };

  let active = 'tmc';

  // Установка active-tab
  function setActive(tab) {
    active = tab;
    tabs.forEach(li => li.classList.toggle('active', li.dataset.tab === tab));
    sectionTitle.textContent = tab === 'tmc' ? 'ТМЦ' : tab === 'recipe' ? 'Рецептуры' : 'Заказы';
    // Показать нужную таблицу
    Object.keys(tables).forEach(k => tables[k].classList.toggle('hidden', k !== tab));
  }

  // Навешивание кликов на меню
  tabs.forEach(li => li.addEventListener('click', e => {
    setActive(li.dataset.tab);
  }));

  // Модал: открыть и показать форму по active вкладке
  function openModal() {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
    modalTitle.textContent = active === 'tmc' ? 'Добавить ТМЦ' : active === 'recipe' ? 'Создать рецептуру' : 'Создать заказ';

    // скрываем все формы, показываем только нужную
    Object.keys(forms).forEach(k => forms[k].classList.toggle('hidden', k !== active));
    // блокируем скролл страницы (необязательно)
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }

  addBtn.addEventListener('click', openModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-cancel-2').addEventListener('click', closeModal);
  document.getElementById('modal-cancel-3').addEventListener('click', closeModal);

  // Добавление ингредиента в форму рецептуры
  let ingIndex = 1;
  const addIngBtn = document.getElementById('add-ingredient');
  addIngBtn && addIngBtn.addEventListener('click', () => {
    const container = document.getElementById('recipe-ingredients');
    const div = document.createElement('div');
    div.className = 'mb-2 flex gap-2';
    div.innerHTML = container.firstElementChild.innerHTML.replace(/\[0\]/g, '[' + ingIndex + ']').replace(/ingredients\[0\]/g,'ingredients['+ingIndex+']');
    container.appendChild(div);
    ingIndex++;
  });

  // --- Подстройка отступа для sidebar, чтобы он не перекрывал хедер
  function updateHeaderOffset() {
    const headerEl = document.querySelector('header') || document.querySelector('div.header') || null;
    const h = headerEl ? headerEl.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty('--header-offset', h + 'px');
  }
  window.addEventListener('resize', updateHeaderOffset);
  window.addEventListener('load', updateHeaderOffset);
  updateHeaderOffset();

  // Инициализация
  setActive(active);

})();