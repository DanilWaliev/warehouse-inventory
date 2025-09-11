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

    // Загрузить данные в таблицу
    switch (tab) {
      case "tmc":
        loadAllTMC();
        break;
      case "recipe":
        //loadAllRecipe();
        break;
      case "order":
        //loadAllOrder();
        break;
    }
  }

  // Загрузка всех ТМЦ в таблицу
  async function loadAllTMC() {
    const res = await fetch("/api/tmc"); 
    const data = await res.json();
    const tbody = document.getElementById("table-tmc-body");
    tbody.innerHTML = "";

    if (!data || data.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML=`<tr><td colspan="5" class="text-muted">Нет ТМЦ</td></tr>`;
      tbody.appendChild(tr);
    } else {
      data.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
      <td>${item.Name}</td>
      <td>${item.Weight}</td>
      <td>${item.Type}</td>
      <td>${item.Note}</td>
      <td>
        <button class="btn-delete">Удалить</button>
      </td>
      `;

      tr.querySelector(".btn-delete").addEventListener("click", () => deleteTMC(item.ID));

      tbody.appendChild(tr)
    });
    }
  }

  // Отправление запроса на создание ТМЦ
  async function createTMC(e) {
    // Отмена перезагрузки
    e.preventDefault(); 

    const form = e.target;
    const formData = new FormData(form);

    // Получаем данные с формы
    const name = formData.get("name");
    const weight = formData.get("weight");
    const type = formData.get("type");
    const note = formData.get("note");

    // Валидация данных
    if (name.length > 255 ||
      note.length > 45 ||
      weight <= 0
    ) {
      showToast("Некорректные данные");
      return;
    }

    // Отправляем данные в JSON для создания ТМЦ
    const res = await fetch("/api/tmc/create", {
      method: "POST",
      body: JSON.stringify({
        name: name,
        weight: weight,
        type: type,
        note: note,
      }),
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (res.ok) {
      form.reset(); // Очистка формы
      closeModal() // Закрываем модалку
      loadAllTMC(); // Подгружаем обновленный список ТМЦ
      showToast("ТМЦ создан успешно", "success");
      return;
    } else {
      switch (res.status) {
        case 401:
          showToast("Нет доступа");
          return;
        case 400:
          showToast("Некорректные данные");
          return;
        case 409:
          showToast("Такой ТМЦ уже существует");
          return;
        case 500:
          showToast("Ошибка на стороне сервера");
          return;
        default:
          showToast("Ошибка при создании ТМЦ");
          return;
      }
    }
  }

  // Удаление ТМЦ и загрузка обновленного списка ТМЦ
  async function deleteTMC(id) {
    const res = await fetch(`/api/tmc/delete`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({id: id})
    });

    if (res.ok) {
      loadAllTMC();
      return
    } else {
      switch (res.status) {
        case 401:
          showToast("Нет доступа");
          return;
        case 500:
          showToast("Ошибка на стороне сервера");
          return;
        default:
          showToast("Ошибка при удалении ТМЦ");
          return;
      }
    }
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
    // блокируем скролл страницы
    document.body.style.overflow = 'hidden';
  }

  forms.tmc.addEventListener("submit", createTMC);

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

  // Подстройка отступа для sidebar, чтобы он не перекрывал хедер
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