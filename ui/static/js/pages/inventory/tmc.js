// static/js/pages/production/tmc.js
import { escapeHtml } from "./utils.js";

/**
 * initTMC({ showToast, showConfirm, modal })
 * - showToast, showConfirm: функции из ваших toast.js / confirm.js
 * - modal: DOM-элемент модалки (передаётся из main.js)
 *
 * Возвращает { load, reset, openModal, openEdit }.
 */
export async function initTMC({ showToast, showConfirm, modal }) {
  const tbody = document.getElementById("table-tmc-body");
  const form = document.getElementById("form-tmc");
  const modalTitle = document.getElementById("modal-title");

  if (!tbody || !form || !modal || !modalTitle) {
    console.warn("tmc.js: отсутствуют DOM элементы (table-tmc-body / form-tmc / modal / modal-title).");
    return { load: () => {}, reset: () => {}, openModal: () => {}, openEdit: () => {} };
  }

  let editingId = null;

  async function load() {
    tbody.innerHTML = "";
    try {
      const res = await fetch("/api/tmc");
      if (!res.ok) {
        if (res.status === 404) {
          tbody.innerHTML = `<tr><td colspan="5" class="text-muted">Нет ТМЦ</td></tr>`;
          return;
        }
        throw new Error("fetch error");
      }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted">Нет ТМЦ</td></tr>`;
        return;
      }

      data.forEach(item => {
        const typeRu = item.Type === "raw" ? "Сырье" : item.Type === "semi" ? "Полуфабрикат" : "Продукт";
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(item.ID)}</td>
          <td>${escapeHtml(item.Name)}</td>
          <td>${escapeHtml(String(item.Weight))}</td>
          <td>${escapeHtml(typeRu)}</td>
          <td>${escapeHtml(item.Note || "")}</td>
          <td>
            <button class="btn-edit" data-id="${item.ID}">Изменить</button>
            <button class="btn-delete" data-id="${item.ID}">Удалить</button>
          </td>
        `;
        // edit
        tr.querySelector(".btn-edit").addEventListener("click", () => openEdit(item.ID));
        // delete
        tr.querySelector(".btn-delete").addEventListener("click", () => deleteItem(item.ID));
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
      showToast("Ошибка при загрузке ТМЦ");
    }
  }

  // открыть модалку в режиме создания
  function openModal() {
    editingId = null;
    form.dataset.mode = "create";
    form.removeAttribute("data-id");
    modalTitle.textContent = "Добавить ТМЦ";
    form.reset();
    // показать форму ТМЦ и сам оверлей
    document.querySelectorAll(".modal-form").forEach(f => f.classList.add("hidden"));
    form.classList.remove("hidden");
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  // открыть модалку редактирования: загрузка item по id -> показываем форму
  async function openEdit(id) {
    try {
      const res = await fetch(`/api/tmc?id=${id}`);
      if (!res.ok) {
        showToast("Ошибка загрузки ТМЦ");
        return;
      }
      let payload = await res.json();
      // если сервер возвращает массив: берем первый элемент
      if (Array.isArray(payload) && payload.length > 0) payload = payload[0];

      editingId = id;
      form.dataset.mode = "edit";
      form.dataset.id = String(id);

      // показываем форму и модалку
      document.querySelectorAll(".modal-form").forEach(f => f.classList.add("hidden"));
      form.classList.remove("hidden");
      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
      modalTitle.textContent = "Изменить ТМЦ";
      document.body.style.overflow = "hidden";

      // заполняем поля
      form.elements["name"].value = payload.Name || "";
      form.elements["weight"].value = payload.Weight || "";
      form.elements["type"].value = payload.Type || "raw";
      form.elements["note"].value = payload.Note || "";
    } catch (err) {
      console.error(err);
      showToast("Ошибка при загрузке данных для редактирования");
    }
  }

  // сброс формы (вызывается при закрытии централизованно)
  function reset() {
    try { form.reset(); } catch (e) {}
    editingId = null;
    form.dataset.mode = "create";
    form.removeAttribute("data-id");
    // при сбросе прячем форму — main.js также может это делать
    form.classList.add("hidden");
  }

  // create or update on submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const name = (fd.get("name") || "").toString().trim();
    const weight = parseFloat(fd.get("weight") || "0");
    const type = (fd.get("type") || "").toString();
    const note = (fd.get("note") || "").toString();

    if (!name || name.length > 255 || Number.isNaN(weight) || weight <= 0) {
      showToast("Некорректные данные");
      return;
    }

    const bodyCreate = { name, weight, type, note };

    try {
      let res;
      if (editingId) {
        // UPDATE
        res = await fetch("/api/tmc", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, name, weight, type, note })
        });
      } else {
        // CREATE
        res = await fetch("/api/tmc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyCreate)
        });
      }

      if (!res.ok) {
        // можно детализировать по статусу
        showToast("Ошибка при сохранении ТМЦ");
        return;
      }

      // закрыть модалку и перезагрузить таблицу
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      reset();
      await load();
      showToast(editingId ? "ТМЦ обновлён" : "ТМЦ создан", "success");
    } catch (err) {
      console.error(err);
      showToast("Ошибка при сохранении ТМЦ");
    }
  });

  async function deleteItem(id) {
    if (!(await showConfirm("Вы действительно хотите удалить ТМЦ?", "Удалить ТМЦ"))) return;
    try {
      const res = await fetch(`/api/tmc?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        showToast("Ошибка при удалении ТМЦ");
        return;
      }
      await load();
      showToast("ТМЦ удалён", "success");
    } catch (err) {
      console.error(err);
      showToast("Ошибка при удалении ТМЦ");
    }
  }

  // возвращаем публичный API модуля
  return {
    load,
    reset,
    openModal,
    openEdit, // можно вызвать извне, если нужно
  };
}
