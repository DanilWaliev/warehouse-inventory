// ui/static/js/pages/movement/main.js
// Точка входа страницы "Перемещения" (type="module")

import { updateHeaderOffset } from "../inventory/utils.js";
import { showToast } from "../../toast.js";
import { showConfirm } from "../../confirm.js";

import { initRoutes } from "./routes.js";
import { initOrders } from "./orders.js";
import { initTransits } from "./transits.js";

(function bootstrap() {
  // ===== DOM =====
  const sectionTitle = document.getElementById("section-title");

  // Модалки со страницы
  const modals = {
    "move-create":    document.getElementById("modal-move-create"),
    "route-create":   document.getElementById("modal-route-create"),
    "transit-create": document.getElementById("modal-transit-create"),
  };

  // ===== Инициализация модулей таблиц =====
  // routes.js управляет своей модалкой и таблицей (#table-routes-body, #form-route-create, #modal-route-create)
  const routes = initRoutes({ showToast, showConfirm });
  const orders = initOrders({ showToast, showConfirm });
  const transits = initTransits({ showToast, showConfirm });

  // ===== Хелперы общих модалок (оставляем на будущее) =====
  function openModal(modalEl) {
    if (!modalEl) return;
    try { document.activeElement?.blur?.(); } catch (_) {}
    modalEl.classList.remove("hidden");
    modalEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const firstFocusable = modalEl.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    firstFocusable?.focus?.();
  }
  function closeModal(modalEl) {
    if (!modalEl) return;
    try { document.activeElement?.blur?.(); } catch (_) {}
    modalEl.classList.add("hidden");
    modalEl.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  function getModalByKey(key) { return modals[key] || null; }

  // ===== Делегирование кликов =====
  document.addEventListener("click", (e) => {
    // Открытие
    const openBtn = e.target.closest("[data-open-modal]");
    if (openBtn) {
      const key = openBtn.getAttribute("data-open-modal");

      // Для маршрутов — используем модуль, чтобы он подгрузил селекты и т.п.
      if (key === "route-create") {
        e.preventDefault();
        routes.openCreate(); // сам покажет модалку и наполнит форму
        return;
      }

      // Остальные (пока без модулей) — откроем «как есть»
      const modal = getModalByKey(key);
      if (modal) {
        // перед открытием можно сделать reset
        if (key === "move-create")  resetMoveCreate(modal);
        if (key === "transit-create") resetTransitCreate(modal);
        openModal(modal);
      }
      return;
    }

    // Закрытие
    const closeBtn = e.target.closest("[data-close-modal]");
    if (closeBtn) {
      const parentModal = closeBtn.closest(".modal");
      closeModal(parentModal);
      return;
    }
  });

  // Закрытие по клику на фон
  Object.values(modals).forEach((modalEl) => {
    if (!modalEl) return;
    modalEl.addEventListener("click", (e) => {
      const content = modalEl.querySelector(".modal-content");
      if (e.target === modalEl && !content.contains(e.target)) {
        closeModal(modalEl);
      }
    });
  });

  // Закрытие по Escape
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const opened = Object.values(modals).find(m => m && !m.classList.contains("hidden"));
    if (opened) closeModal(opened);
  });

  // ===== Первичная загрузка таблиц =====
  // Список маршрутов грузит модуль routes
  routes.load();
  orders.load();
  transits.load();

  // ===== Хуки пред-открытия (для немодульных форм) =====
  function resetMoveCreate(modalEl) {
    const form = modalEl.querySelector("form");
    form?.reset?.();
    const itemsList = modalEl.querySelector("#move-items-list");
    if (itemsList) {
      itemsList.innerHTML = `
        <div class="move-item-row">
          <select name="recipe_id">
            <option value="">— Выберите рецептуру —</option>
          </select>
          <input type="number" name="quantity" min="1" value="1">
        </div>
      `;
    }
  }
  function resetTransitCreate(modalEl) {
    modalEl.querySelector("form")?.reset?.();
  }

  // ===== Сервис: подстройка отступа под header =====
  window.addEventListener("resize", updateHeaderOffset);
  window.addEventListener("load", updateHeaderOffset);
  updateHeaderOffset();
})();
