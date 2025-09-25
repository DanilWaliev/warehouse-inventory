// recipes.js
import { escapeHtml } from "./utils.js";

export async function initRecipes({ showToast, showConfirm, modal }) {
  const tbody = document.getElementById("table-recipe-body");
  const form = document.getElementById("form-recipe");
  const addIngredientBtn = document.getElementById("add-ingredient");
  const ingredientsContainer = document.getElementById("ingredients-list");
  const resultSelect = document.getElementById("result-tmc");

  if (!tbody || !form || !ingredientsContainer || !resultSelect) {
    console.warn("recipes.js: отсутствуют элементы формы/таблицы рецептов");
    return { load: () => {}, reset: () => {}, openModal: () => {} };
  }

  async function loadRecipesTable() {
    tbody.innerHTML = "";
    const res = await fetch("/api/recipe");
    if (!res.ok) {
      if (res.status === 404) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="5" class="text-muted">Нет рецептур</td>`;
        tbody.appendChild(tr);
      } else {
        showToast("Ошибка загрузки рецептур");
      }
      return;
    }
    const data = await res.json();
    data.forEach(recipe => {
      let resultType = recipe.Result.Type;
      switch (resultType) {
        case "raw": resultType = "Сырье"; break;
        case "semi": resultType = "Полуфабрикат"; break;
        case "product": resultType = "Продукт"; break;
      }
      const ingredientsHTML = recipe.Items.map(item => {
        let t = item.Ingredient.Type;
        switch (t) {
          case "raw": t = "Сырье"; break;
          case "semi": t = "Полуфабрикат"; break;
          case "product": t = "Продукт"; break;
        }
        return `${escapeHtml(item.Ingredient.Name)} (${escapeHtml(t)}) × ${escapeHtml(String(item.Quantity))}`;
      }).join("<br>");

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(recipe.Result.Name)}</td>
        <td>${escapeHtml(resultType)}</td>
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

  async function loadResultTMCSelect() {
    const res = await fetch("/api/tmc?type=semi&type=product");
    if (!res.ok) {
      showToast("Ошибка загрузки списка ТМЦ");
      return;
    }
    const list = await res.json();
    resultSelect.innerHTML = "";
    list.forEach(tmc => {
      const option = document.createElement("option");
      option.value = tmc.ID;
      option.textContent = tmc.Name;
      resultSelect.appendChild(option);
    });
  }

  async function addIngredientRow(selectedId = null, quantity = "", container = ingredientsContainer) {
    const res = await fetch("/api/tmc?type=semi&type=raw");
    if (!res.ok) {
      showToast("Ошибка загрузки ингредиентов");
      return;
    }
    const tmcList = await res.json();

    const row = document.createElement("div");
    row.classList.add("ingredient-row", "flex", "gap-2", "mb-2");

    const select = document.createElement("select");
    select.name = "ingredient-id";
    select.classList.add("ingredient-select", "flex-1");
    tmcList.forEach(opt => {
      const o = document.createElement("option");
      o.value = opt.ID;
      o.textContent = opt.Name;
      if (opt.ID === selectedId) o.selected = true;
      select.appendChild(o);
    });

    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.value = quantity || 1;
    input.name = "ingredient-qty";
    input.classList.add("ingredient-quantity", "w-24");

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

  async function createRecipe(e) {
    e.preventDefault();
    const fd = new FormData(form);
    const resultId = fd.get("result-tmc-id") || fd.get("result-tmc");
    const rows = document.querySelectorAll("#ingredients-list .ingredient-row");
    const items = [];
    rows.forEach(row => {
      const compIdEl = row.querySelector("select[name='ingredient-id']");
      const qtyEl = row.querySelector("input[name='ingredient-qty']");
      if (!compIdEl || !qtyEl) return;
      const compId = compIdEl.value;
      const qty = qtyEl.value;
      if (compId && Number(qty) > 0) {
        items.push({ componentId: Number(compId), quantity: Number(qty) });
      }
    });

    if (!resultId) { showToast("Выберите результат"); return; }
    if (items.length === 0) { showToast("Добавьте ингредиенты"); return; }

    const res = await fetch("/api/recipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultId: Number(resultId), items })
    });

    if (res.ok) {
      form.reset();
      ingredientsContainer.innerHTML = "";
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden','true');
      loadRecipesTable();
      showToast("Рецептура создана", "success");
    } else {
      showToast("Ошибка при создании рецептуры");
    }
  }

  async function deleteRecipe(id) {
    if (!(await showConfirm("Вы уверены, что хотите удалить рецептуру?"))) return;
    const res = await fetch(`/api/recipe?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      loadRecipesTable();
      showToast("Рецептура удалена", "success");
    } else {
      showToast("Ошибка при удалении рецептуры");
    }
  }

  async function editRecipe(id) {
    const res = await fetch(`/api/recipe?id=${id}`);
    if (!res.ok) { showToast("Ошибка загрузки рецептуры"); return; }
    let recipe = await res.json();
    recipe = recipe[0];

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');

    // загружаем варианты для результата
    await loadResultTMCSelect();
    // выбранный результат
    resultSelect.value = recipe.Result.ID;

    ingredientsContainer.innerHTML = "";
    for (const it of recipe.Items) {
      await addIngredientRow(it.Ingredient.ID, it.Quantity, ingredientsContainer);
    }

    // временное onsubmit
    form.onsubmit = async function (e) {
      e.preventDefault();
      const rows = document.querySelectorAll("#ingredients-list .ingredient-row");
      const items = [];
      rows.forEach(row => {
        const compId = row.querySelector("select[name='ingredient-id']").value;
        const qty = row.querySelector("input[name='ingredient-qty']").value;
        if (compId && qty > 0) items.push({ componentId: Number(compId), quantity: Number(qty) });
      });
      if (items.length === 0) { showToast("Добавьте ингредиенты"); return; }
      const updRes = await fetch("/api/recipe", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: id, items })
      });
      if (updRes.ok) {
        form.reset();
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden','true');
        loadRecipesTable();
        showToast("Рецептура обновлена", "success");
      } else {
        showToast("Ошибка при обновлении рецептуры");
      }
      form.onsubmit = createRecipe;
    };
  }

  // привязки
  form.onsubmit = createRecipe;
  addIngredientBtn.addEventListener('click', () => addIngredientRow(null, 1));

  function reset() {
    try { form.reset(); } catch (e) {}
    ingredientsContainer.innerHTML = "";
    form.onsubmit = createRecipe;
  }

  function openModal() {
    loadResultTMCSelect();
    ingredientsContainer.innerHTML = "";
    addIngredientRow(null, 1);
  }

  return { load: loadRecipesTable, reset, openModal };
}
