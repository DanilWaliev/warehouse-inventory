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

  function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  }

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
        loadTMCtable();
        break;
      case "recipe":
        loadRecipesTable();
        break;
      case "order":
        loadOrdersTable();
        break;
    }
  }

  // Получение ТМЦ исходя из типа
  async function loadTMCbyType(type) {
    const res = await fetch("/api/tmc?type=" + type);
    
    return res.json();
  }

  // ------------------------+
  // Скрипты для раздела ТМЦ |
  // ------------------------+

  async function loadTMCtable() {
    const tbody = document.getElementById("table-tmc-body");
    tbody.innerHTML = "";
    const res = await fetch("/api/tmc")
    if (!res.ok) {
      if (res.status === 404) {
        const tr = document.createElement("tr");
        tr.innerHTML=`<tr><td colspan="5" class="text-muted">Нет ТМЦ</td></tr>`;
        tbody.appendChild(tr);
      } else {
        showToast("Ошибка при загрузке ТМЦ")
      }
    } else {
      const data = await res.json() 
      data.forEach(item => {
        // Переводим тип ТМЦ на русский:
        switch (item.Type) {
          case "raw":
            item.Type = "Сырье";
            break;
          case "semi":
            item.Type = "Полуфабрикат";
            break;
          case "product":
            item.Type = "Продукт";
            break;
        }
        const tr = document.createElement("tr");
        tr.innerHTML = `
        <td>${item.Name}</td>
        <td>${item.Weight}</td>
        <td>${item.Type}</td>
        <td>${item.Note}</td>
        <td>
          <button class="btn-delete">Удалить</button>
          <button class="btn-edit">Изменить</button>
        </td>
        `;
        tr.querySelector(".btn-delete").addEventListener("click", () => deleteTMC(item.ID));
        tr.querySelector(".btn-edit").addEventListener("click", () => editTMC(item.ID));
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
    const res = await fetch("/api/tmc", {
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
      form.reset();
      closeModal() // Закрываем модалку
      loadTMCtable(); // Подгружаем обновленный список ТМЦ
      showToast("ТМЦ успешно  создан", "success");
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
    if (!(await showConfirm("Вы действительно хотите удалить ТМЦ?", "Удалить ТМЦ"))) return;

    const res = await fetch(`/api/tmc?id=${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      loadTMCtable();
      showToast("ТМЦ удалён", "success");
      return;
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

// Редактирование ТМЦ
async function editTMC(id) {
  // Загрузить данные по ТМЦ
  const res = await fetch(`/api/tmc?id=${id}`);

  if (!res.ok) {
    showToast("Ошибка загрузки ТМЦ");
    return;
  }
  let item = await res.json();
  item = item[0]

  // Открыть модалку и показать форму ТМЦ
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  modalTitle.textContent = "Изменить ТМЦ";
  Object.keys(forms).forEach(k => forms[k].classList.toggle('hidden', k !== 'tmc'));
  document.body.style.overflow = 'hidden';

  // Заполнить поля
  const form = forms.tmc;
  form.elements["name"].value = item.Name;
  form.elements["weight"].value = item.Weight;
  form.elements["type"].value = item.Type;
  form.elements["note"].value = item.Note || "";

  // Временный обработчик для обновления
  form.onsubmit = async function (e) {
    e.preventDefault();

    const fd = new FormData(form);
    const name = fd.get("name");
    const weight = fd.get("weight");
    const type = fd.get("type");
    const note = fd.get("note");

    // Валидация данных
    if (name.length > 255 ||
      note.length > 45 ||
      weight <= 0
    ) {
      showToast("Некорректные данные");
      return;
    }

    const updRes = await fetch("/api/tmc", {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ id, name, weight, type, note }),
    });

    if (updRes.ok) {
      form.reset();
      closeModal();
      loadTMCtable();
      showToast("ТМЦ обновлён", "success");
    } else {
      switch (updRes.status) { // <- используй updRes тут, а не res
        case 401:
          showToast("Нет доступа");
          break;
        case 400:
          showToast("Некорректные данные");
          break;
        case 409:
          showToast("Такой ТМЦ уже существует");
          break;
        case 500:
          showToast("Ошибка на стороне сервера");
          break;
        default:
          showToast("Ошибка при обновлении ТМЦ");
      }
    }

    // вернуть обработчик создания как было раньше
    form.onsubmit = createTMC;
  };
}
  
  // ------------------------------+
// Скрипты для раздела Рецептуры |
// ------------------------------+

// Загрузка таблицы рецептур
async function loadRecipesTable() {
  const tbody = document.getElementById("table-recipe-body");
  tbody.innerHTML = "";
  const res = await fetch("/api/recipe");
  if (!res.ok) {
    if (res.status === 404) {
      const tr = document.createElement("tr");
        tr.innerHTML=`<tr><td colspan="5" class="text-muted">Нет рецептур</td></tr>`;
        tbody.appendChild(tr);
    } else {
      showToast("Ошибка загрузки рецептур");
    }
  } else {
    const data = await res.json();
    data.forEach(recipe => {
      // Перевод типа результата на русский
      let resultType = recipe.Result.Type;
      switch (resultType) {
        case "raw": resultType = "Сырье"; break;
        case "semi": resultType = "Полуфабрикат"; break;
        case "product": resultType = "Продукт"; break;
      }

      // Формируем список ингредиентов
      const ingredientsHTML = recipe.Items.map(item => {
        let t = item.Ingredient.Type;
        switch (t) {
          case "raw": t = "Сырье"; break;
          case "semi": t = "Полуфабрикат"; break;
          case "product": t = "Продукт"; break;
        }
        return `${item.Ingredient.Name} (${t}) × ${item.Quantity}`;
      }).join("<br>");

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${recipe.Result.Name}</td>
        <td>${resultType}</td>
        <td>${ingredientsHTML}</td>
        <td>
          <button class="btn-delete">Удалить</button>
          <button class="btn-edit">Изменить</button>
        </td>
      `;

      tr.querySelector(".btn-delete").addEventListener("click", () => deleteRecipe(recipe.Result.ID));
      tr.querySelector(".btn-edit").addEventListener("click", () => editRecipe(recipe.Result.ID));

      tbody.appendChild(tr);
    });
  }

  
}


// Подгрузка результирующих ТМЦ (semi + product) в селект результата
async function loadResultTMCSelect() {
  const res = await fetch("/api/tmc?type=semi&type=product");
  if (!res.ok) {
    showToast("Ошибка загрузки списка ТМЦ");
    return;
  }
  const list = await res.json();
  const select = document.getElementById("result-tmc");
  select.innerHTML = "";

  list.forEach(tmc => {
    const option = document.createElement("option");
    option.value = tmc.ID;
    option.textContent = tmc.Name;
    select.appendChild(option);
  });
}

// Отправление запроса на создание Рецептуры
async function createRecipe(e) {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);

  const resultId = formData.get("result-tmc-id");

  // Собираем ингредиенты
  const ingredients = [];
  const rows = document.querySelectorAll("#ingredients-list .ingredient-row");
  rows.forEach(row => {
    const compId = row.querySelector("select[name='ingredient-id']").value;
    const qty = row.querySelector("input[name='ingredient-qty']").value;
    if (compId && qty > 0) {
      ingredients.push({
        componentId: parseInt(compId, 10),
        quantity: parseInt(qty, 10)
      });
    }
  });

  // Валидация
  if (!resultId) {
    showToast("Выберите результирующий компонент");
    return;
  }
  if (ingredients.length === 0) {
    showToast("Добавьте хотя бы один ингредиент");
    return;
  }

  // Отправляем JSON на сервер
  const res = await fetch("/api/recipe", {
    method: "POST",
    body: JSON.stringify({
      resultId: parseInt(resultId, 10),
      items: ingredients
    }),
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (res.ok) {
    form.reset();
    document.getElementById("ingredients-list").innerHTML = ""; // очистить список
    closeModal();
    loadRecipesTable();
    showToast("Рецептура успешно создана", "success");
  } else {
    switch (res.status) {
      case 401: showToast("Нет доступа"); break;
      case 400: showToast("Некорректные данные"); break;
      case 409: showToast("Такая рецептура уже существует"); break;
      case 500: showToast("Ошибка на стороне сервера"); break;
      default:  showToast("Ошибка при создании рецептуры");
    }
  }
}

// Кнопка "Добавить ингредиент"
document.getElementById("add-ingredient").addEventListener("click", () => {
  const container = document.getElementById("ingredients-list");
  addIngredientRow(null, 1, container);
});

async function deleteRecipe(id) {
  if (!(await showConfirm("Вы действительно хотите удалить рецептуру?", "УДалить рецептуру"))) return;

  const res = await fetch(`/api/recipe?id=${id}`, {
    method: "DELETE",
  });

  if (res.ok) {
    loadRecipesTable();
    showToast("Рецептура удалена", "success");
    return;
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

// Редактирование рецепта
async function editRecipe(id) {
  // Загружаем рецепт
  const res = await fetch(`/api/recipe?id=${id}`);
  if (!res.ok) {
    showToast("Ошибка загрузки рецептуры");
    return;
  }
  let recipe = await res.json();
  recipe = recipe[0]; // предполагаем массив из одного рецепта

  // Открыть модалку
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  modalTitle.textContent = "Изменить рецептуру";
  Object.keys(forms).forEach(k => forms[k].classList.toggle("hidden", k !== "recipe"));
  document.body.style.overflow = "hidden";

  // Заполняем форму
  const form = forms.recipe;
  const resultSelect = form.querySelector("#result-tmc");
  const ingredientsList = form.querySelector("#ingredients-list");

  // Подгрузим варианты для result (semi и product)
  const tmcRes = await fetch("/api/tmc?type=semi&type=product");
  const tmcOptions = await tmcRes.json();
  resultSelect.innerHTML = "";
  tmcOptions.forEach(opt => {
    const o = document.createElement("option");
    o.value = opt.ID;
    o.textContent = opt.Name;
    if (opt.ID === recipe.Result.ID) {
      o.selected = true;
    }
    resultSelect.appendChild(o);
  });

  // Очистим и заполним ингредиенты
  ingredientsList.innerHTML = "";
  for (const item of recipe.Items) {
    await addIngredientRow(item.Ingredient.ID, item.Quantity, ingredientsList);
  }

  // Подменяем onsubmit
  form.onsubmit = async function (e) {
    e.preventDefault();

    const resultId = id;
    const items = [];
    ingredientsList.querySelectorAll(".ingredient-row").forEach(row => {
      const componentId = row.querySelector(".ingredient-select").value;
      const quantity = row.querySelector(".ingredient-quantity").value;
      if (componentId && quantity > 0) {
        items.push({ componentId: Number(componentId), quantity: Number(quantity) });
      }
    });

    if (!resultId || items.length === 0) {
      showToast("Некорректные данные");
      return;
    }

    const updRes = await fetch("/api/recipe", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resultId: Number(resultId),
        items: items
      }),
    });

    if (updRes.ok) {
      form.reset();
      closeModal();
      loadRecipesTable();
      showToast("Рецептура обновлена", "success");
    } else {
      switch (updRes.status) {
        case 401:
          showToast("Нет доступа");
          break;
        case 400:
          showToast("Некорректные данные");
          break;
        case 409:
          showToast("Такая рецептура уже существует");
          break;
        case 500:
          showToast("Ошибка на стороне сервера");
          break;
        default:
          showToast("Ошибка при обновлении рецептуры");
      }
    }
  };
}

  // хелпер для добавления строки ингредиента
  async function addIngredientRow(selectedId = null, quantity = "", container) {
    // грузим все ТМЦ для селекта
    const res = await fetch("/api/tmc?type=semi&type=raw");
    const tmc = await res.json();

    const row = document.createElement("div");
    row.classList.add("ingredient-row", "flex", "gap-2", "mb-2");

    const select = document.createElement("select");
    select.classList.add("ingredient-select", "flex-1");
    select.name = "ingredient-id"

    tmc.forEach(opt => {
      const o = document.createElement("option");
      o.value = opt.ID;
      o.textContent = opt.Name;
      if (opt.ID === selectedId) {
        o.selected = true;
      }
      select.appendChild(o);
    });

    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.value = quantity;
    input.classList.add("ingredient-quantity", "w-24");
    input.name = "ingredient-qty"

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "×";
    delBtn.classList.add("btn", "btn-danger");
    delBtn.addEventListener("click", () => row.remove());

    row.appendChild(select);
    row.appendChild(input);
    row.appendChild(delBtn);

    container.appendChild(row);
  }


    // Загружаем список возможных "результатов" при открытии модалки рецептуры
    function openRecipeModal() {
      loadResultTMCSelect();
      const container = document.getElementById("ingredients-list")
      container.innerHTML = ""
      addIngredientRow(null, 1, container); // чтобы хотя бы одна строка была
    }


  // ---------------------------+
  // Скрипты для раздела Заказы |
  // ---------------------------+

  // Загрузка таблицы заказов
  async function loadOrdersTable() {
    const tbody = document.getElementById("table-order-body");
    tbody.innerHTML = "";

    const res = await fetch("/api/order");
    if (!res.ok) {
      if (res.status === 404) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="6" class="text-muted">Нет заказов</td>`;
        tbody.appendChild(tr);
      } else {
        showToast("Ошибка загрузки заказов");
      }
      return;
    }

    const data = await res.json();
    data.forEach(order => {
      const tr = document.createElement("tr");

      // список рецептур и их количества
      const recipesHTML = (order.Items || []).map(it => {
        return `${escapeHtml(it.Recipe.Result.Name)} × ${escapeHtml(String(it.Quantity))}`;
      }).join("<br>");

      // статус
      const statusHtml = order.ClosedAt
        ? `<span class="status-badge status-finished">Завершен</span>`
        : `<span class="status-badge status-created">Создан</span>`;

      const openDate = formatDate(order.CreatedAt);
      const finishDate = formatDate(order.ClosedAt);

      tr.innerHTML = `
        <td>${escapeHtml(String(order.ID))}</td>
        <td>${recipesHTML}</td>
        <td>${statusHtml}</td>
        <td>${openDate}</td>
        <td>${finishDate}</td>
      `;

      // actions
      const actionsTd = document.createElement("td");

      // кнопка "Готов" только если заказ ещё не завершён
      if (!order.FinishDate) {
        const btnReady = document.createElement("button");
        btnReady.textContent = "Готов";
        btnReady.className = "btn btn-primary";
        btnReady.addEventListener("click", async () => {
          const res = await fetch("/api/order", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: order.ID }),
          });

          if (res.ok) {
            showToast("Заказ закрыт", "success");
            loadOrdersTable();
          } else {
            showToast("Ошибка при закрытии заказа");
          }
        });
        actionsTd.appendChild(btnReady);
      }

      // кнопка "Удалить"
      const btnDelete = document.createElement("button");
      btnDelete.textContent = "Удалить";
      btnDelete.className = "btn-delete";
      btnDelete.addEventListener("click", () => deleteOrder(order.ID));
      actionsTd.appendChild(btnDelete);

      tr.appendChild(actionsTd);
      tbody.appendChild(tr);
    });
  }

  // Создание заказа
  async function createOrder(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);

    // Собираем рецептуры и количество
    const items = [];
    const rows = document.querySelectorAll("#order-items-list .order-item-row");
    rows.forEach(row => {
      const recipeId = row.querySelector("select[name='recipe-id']").value;
      const qty = row.querySelector("input[name='recipe-qty']").value;
      if (recipeId && qty > 0) {
        items.push({
          recipeId: parseInt(recipeId, 10),
          quantity: parseInt(qty, 10)
        });
      }
    });

    if (items.length === 0) {
      showToast("Добавьте хотя бы одну рецептуру");
      return;
    }

    const res = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });

    if (res.ok) {
      form.reset();
      document.getElementById("order-items-list").innerHTML = "";
      closeModal();
      loadOrdersTable();
      showToast("Заказ успешно создан", "success");
    } else {
      switch (res.status) {
        case 401: showToast("Нет доступа"); break;
        case 400: showToast("Некорректные данные"); break;
        case 500: showToast("Ошибка на стороне сервера"); break;
        default:  showToast("Ошибка при создании заказа");
      }
    }
  }

  // Удаление заказа
  async function deleteOrder(id) {
    if (!(await showConfirm("Вы действительно хотите удалить заказ?", "Удалить заказ"))) return;

    const res = await fetch(`/api/order?id=${id}`, { method: "DELETE" });

    if (res.ok) {
      loadOrdersTable();
      showToast("Заказ удалён", "success");
    } else {
      switch (res.status) {
        case 401: showToast("Нет доступа"); break;
        case 500: showToast("Ошибка на стороне сервера"); break;
        default:  showToast("Ошибка при удалении заказа");
      }
    }
  }

  // Хелпер для добавления строки в список рецептур при создании заказа
  async function addOrderItemRow(selectedId = null, quantity = "", container) {
    // загружаем рецептуры
    const res = await fetch("/api/recipe");
    const recipes = await res.json();

    const row = document.createElement("div");
    row.classList.add("order-item-row", "flex", "gap-2", "mb-2");

    const select = document.createElement("select");
    select.classList.add("flex-1");
    select.name = "recipe-id";

    recipes.forEach(r => {
      const o = document.createElement("option");
      o.value = r.Result.ID;
      o.textContent = r.Result.Name;
      if (r.Result.ID === selectedId) o.selected = true;
      select.appendChild(o);
    });

    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.value = quantity;
    input.classList.add("w-24");
    input.name = "recipe-qty";

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "×";
    delBtn.classList.add("btn", "btn-danger");
    delBtn.addEventListener("click", () => row.remove());

    row.appendChild(select);
    row.appendChild(input);
    row.appendChild(delBtn);

    container.appendChild(row);
  }

  document.getElementById("add-order-item").addEventListener("click", () => {
    const container = document.getElementById("order-items-list");
    addOrderItemRow(null, 1, container);
  });


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

      if (active == "recipe") {
        openRecipeModal()
      }

      if (active == "order") {
        const container = document.getElementById("order-items-list");
        container.innerHTML = "";
        addOrderItemRow(null, 1, container); // хотя бы одна строка
      }

  }

  forms.tmc.onsubmit = createTMC;
  forms.recipe.onsubmit = createRecipe;
  forms.order.onsubmit = createOrder;

  function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';

    // Сброс форм (без клонирования)
    try { forms.tmc.reset(); } catch (e) {}
    try { forms.recipe.reset(); } catch (e) {}
    try { forms.order.reset(); } catch (e) {}

    // Гарантированно восстановить стандартный обработчик сабмита
    forms.tmc.onsubmit = createTMC;
    forms.recipe.onsubmit = createRecipe;
    forms.order.onsubmit = createOrder;

  }

  // функция для форматирования даты
  function formatDate(dateStr) {
    if (!dateStr) return "-"; // если null или пустая
    const d = new Date(dateStr);
    return d.toLocaleDateString("ru-RU", { 
      year: "numeric", month: "2-digit", day: "2-digit" 
    }) + " " + d.toLocaleTimeString("ru-RU", {
      hour: "2-digit", minute: "2-digit"
    });
  }



  addBtn.addEventListener('click', openModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-cancel-2').addEventListener('click', closeModal);
  document.getElementById('modal-cancel-3').addEventListener('click', closeModal);

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