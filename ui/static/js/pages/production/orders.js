// orders.js
import { escapeHtml, formatDate } from "./utils.js";

export async function initOrders({ showToast, showConfirm, modal }) {
  const tbody = document.getElementById("table-order-body");
  const form = document.getElementById("form-order");
  const addOrderItemBtn = document.getElementById("add-order-item");
  const orderItemsList = document.getElementById("order-items-list");

  if (!tbody || !form || !orderItemsList) {
    console.warn("orders.js: отсутствуют элементы формы/таблицы заказов");
    return { load: () => {}, reset: () => {}, openModal: () => {} };
  }

  async function loadOrdersTable() {
    tbody.innerHTML = "";
    const res = await fetch("/api/order");
    if (!res.ok) {
      if (res.status === 404) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-muted">Нет заказов</td></tr>`;
      } else {
        showToast("Ошибка загрузки заказов");
      }
      return;
    }
    const data = await res.json();
    data.forEach(order => {
      const tr = document.createElement("tr");

      const recipesHTML = (order.Items || []).map(it => {
        // сервер должен отдавать полную структуру рецепта внутри Items: Recipe.Result.Name
        return `${escapeHtml(it.Recipe.Result.Name)} × ${escapeHtml(String(it.Quantity))}`;
      }).join("<br>");

      const statusHtml = order.ClosedAt
        ? `<span class="status-badge status-finished">Завершен</span>`
        : `<span class="status-badge status-created">Создан</span>`;

      const openDate = order.CreatedAt ? formatDate(order.CreatedAt) : "-";
      const finishDate = order.ClosedAt ? formatDate(order.ClosedAt) : "-";

      tr.innerHTML = `
        <td>${escapeHtml(String(order.ID))}</td>
        <td>${recipesHTML}</td>
        <td>${statusHtml}</td>
        <td>${openDate}</td>
        <td>${finishDate}</td>
      `;

      const actionsTd = document.createElement("td");

      // кнопка "Готов" — пометить заказ завершённым (сервер установит дату)
      if (!order.ClosedAt) {
        const btnReady = document.createElement("button");
        btnReady.type = "button";
        btnReady.className = "btn-edit";
        btnReady.textContent = "Готов";
        btnReady.addEventListener("click", async () => {
          if (!(await showConfirm("Установить заказ как готовый?"))) return;
          const putRes = await fetch("/api/order", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: order.ID })
          });
          if (putRes.ok) {
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
      btnDelete.type = "button";
      btnDelete.className = "btn-delete";
      btnDelete.textContent = "Удалить";
      btnDelete.addEventListener("click", () => deleteOrder(order.ID));
      actionsTd.appendChild(btnDelete);

      tr.appendChild(actionsTd);
      tbody.appendChild(tr);
    });
  }

  async function createOrder(e) {
    e.preventDefault();
    const rows = document.querySelectorAll("#order-items-list .order-item-row");
    const items = [];
    rows.forEach(row => {
      const select = row.querySelector("select[name='recipe-id']");
      const qty = row.querySelector("input[name='recipe-qty']");
      if (!select || !qty) return;
      if (select.value && Number(qty.value) > 0) {
        items.push({ recipeId: Number(select.value), quantity: Number(qty.value) });
      }
    });

    if (items.length === 0) { showToast("Добавьте хотя бы одну рецептуру"); return; }

    const res = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });

    if (res.ok) {
      form.reset();
      orderItemsList.innerHTML = "";
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden','true');
      loadOrdersTable();
      showToast("Заказ успешно создан", "success");
    } else {
      showToast("Ошибка при создании заказа");
    }
  }

  async function deleteOrder(id) {
    if (!(await showConfirm("Вы действительно хотите удалить заказ?", "Удалить заказ"))) return;
    const res = await fetch(`/api/order?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      loadOrdersTable();
      showToast("Заказ удалён", "success");
    } else {
      showToast("Ошибка при удалении заказа");
    }
  }

  // добавление строки в форму создания заказа
  async function addOrderItemRow(selectedId = null, quantity = 1, container = orderItemsList) {
    const res = await fetch("/api/recipe");
    if (!res.ok) { showToast("Ошибка загрузки рецептур"); return; }
    const recipes = await res.json();

    const row = document.createElement("div");
    row.classList.add("order-item-row", "flex", "gap-2", "mb-2");

    const select = document.createElement("select");
    select.name = "recipe-id";
    select.classList.add("flex-1");
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
    input.name = "recipe-qty";
    input.classList.add("w-24");

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

  // привязки
  form.onsubmit = createOrder;
  if (addOrderItemBtn) addOrderItemBtn.addEventListener('click', () => addOrderItemRow(null, 1));

  function reset() {
    try { form.reset(); } catch (e) {}
    orderItemsList.innerHTML = "";
  }

  function openModal() {
    orderItemsList.innerHTML = "";
    addOrderItemRow(null, 1);
  }

  return { load: loadOrdersTable, reset, openModal };
}
