// static/js/pages/users/main.js
// type="module"

import { updateHeaderOffset } from "./utils.js";
import { showToast } from "../../toast.js";
import { showConfirm } from "../../confirm.js";

(async function bootstrap() {
  const sectionTitle = document.getElementById("section-title");
  const tabs = document.querySelectorAll("#user-tabs .tab-button");
  const panels = document.querySelectorAll(".tab-panel");
  const activeList = document.getElementById("active-users-list");
  const inactiveList = document.getElementById("inactive-users-list");
  const userCardTemplate = document.getElementById("user-card-template");

  if (!sectionTitle || !tabs.length || !panels.length || !activeList || !inactiveList || !userCardTemplate) {
    console.error("users/main.js: не найдены базовые элементы. Проверь разметку.");
    return;
  }

  // текущая вкладка
  let activeTab = "active-users";

  const cache = {
    "active-users": null,
    "inactive-users": null,
  };

  const listByTab = {
    "active-users": activeList,
    "inactive-users": inactiveList,
  };

  // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

  function formatCreatedAt(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);

    try {
      return new Intl.DateTimeFormat("ru-RU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return d.toLocaleString("ru-RU");
    }
  }

  function clearList(listElem) {
    while (listElem.firstChild) {
      listElem.removeChild(listElem.firstChild);
    }
  }

  function renderEmptyState(listElem, text) {
    clearList(listElem);
    const p = document.createElement("p");
    p.className = "text-muted";
    p.textContent = text;
    listElem.appendChild(p);
  }

  function normalizeId(user) {
    // Подстрой под свои поля ID, если нужно
    return (
      user.ID ||
      user.Id ||
      user.UserID ||
      user.UserId ||
      user.Email || // крайний запасной вариант
      null
    );
  }

  // ===== РЕНДЕР СПИСКА ПОЛЬЗОВАТЕЛЕЙ =====

  function renderUsers(tabKey, users) {
    const listElem = listByTab[tabKey];
    if (!listElem) return;

    clearList(listElem);

    if (!Array.isArray(users) || users.length === 0) {
      renderEmptyState(
        listElem,
        tabKey === "active-users" ? "Нет активных пользователей" : "Нет неактивных пользователей",
      );
      return;
    }

    const isActiveTab = tabKey === "active-users";

    users.forEach((user) => {
      const clone = /** @type {HTMLElement} */ (
        userCardTemplate.content.firstElementChild.cloneNode(true)
      );

      const id = normalizeId(user);
      if (id != null) {
        clone.dataset.userId = String(id);
      }

      const fullNameEl = clone.querySelector(".user-fullname");
      const roleEl = clone.querySelector(".user-role");
      const phoneEl = clone.querySelector(".user-phone");
      const emailEl = clone.querySelector(".user-email");
      const createdEl = clone.querySelector(".user-created-at");
      const footer = clone.querySelector(".user-card-footer");

      if (fullNameEl) fullNameEl.textContent = user.FullName || "";
      if (roleEl) roleEl.textContent = user.Role || "";
      if (phoneEl) phoneEl.textContent = user.Phone || "";
      if (emailEl) emailEl.textContent = user.Email || "";
      if (createdEl) createdEl.textContent = formatCreatedAt(user.CreatedAt);

      if (footer) {
        // Чистим футер, чтобы управлять кнопками сами
        footer.innerHTML = "";

        // Кнопка смены статуса
        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "btn btn-primary user-toggle-status";
        toggleBtn.textContent = isActiveTab ? "Заморозить" : "Активировать";
        toggleBtn.dataset.action = isActiveTab ? "freeze" : "activate";

        toggleBtn.addEventListener("click", () => {
          handleToggleStatus({
            user,
            currentTab: tabKey,
          });
        });

        footer.appendChild(toggleBtn);

        // На замороженных добавляем ещё кнопку "Удалить"
        if (!isActiveTab) {
          const deleteBtn = document.createElement("button");
          deleteBtn.type = "button";
          deleteBtn.className = "btn btn-danger user-delete";
          deleteBtn.textContent = "Удалить";
          deleteBtn.style.marginLeft = "0.5rem";

          deleteBtn.addEventListener("click", () => {
            handleDeleteUser({ user });
          });

          footer.appendChild(deleteBtn);
        }
      }

      listElem.appendChild(clone);
    });
  }

  // ===== ЗАГРУЗКА ДАННЫХ ДЛЯ ВКЛАДКИ =====

  async function loadTab(tabKey, { force = false } = {}) {
    if (!force && Array.isArray(cache[tabKey])) {
      renderUsers(tabKey, cache[tabKey]);
      return;
    }

    const listElem = listByTab[tabKey];
    if (!listElem) return;

    renderEmptyState(listElem, "Загрузка...");

    try {
      const statusParam = tabKey === "active-users" ? "active" : "inactive";
      const res = await fetch(`/api/user?status=${encodeURIComponent(statusParam)}`);

      if (!res.ok) {
        if (res.status != 404) {
          renderEmptyState(listElem, "Ошибка загрузки пользователей");
          showToast("Ошибка загрузки пользователей");
        } else {
          renderEmptyState(listElem, "Нет пользователей");
        }
        
        return;
      }

      const data = await res.json();
      if (!Array.isArray(data)) {
        renderEmptyState(listElem, "Некорректный ответ сервера");
        showToast("Некорректный ответ сервера");
        return;
      }

      cache[tabKey] = data;
      renderUsers(tabKey, data);
    } catch (err) {
      console.error(err);
      renderEmptyState(listElem, "Ошибка сети при загрузке");
      showToast("Ошибка сети при загрузке пользователей");
    }
  }

  // ===== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК =====

  function setActiveTab(tabKey) {
    activeTab = tabKey;

    tabs.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabKey);
    });

    panels.forEach((panel) => {
      const key = panel.getAttribute("data-tab-panel");
      panel.classList.toggle("hidden", key !== tabKey);
    });

    sectionTitle.textContent =
      tabKey === "active-users" ? "Активные пользователи" : "Неактивные пользователи";

    loadTab(tabKey);
  }

  // ===== СМЕНА СТАТУСА ПОЛЬЗОВАТЕЛЯ =====

  async function handleToggleStatus({ user, currentTab }) {
    const id = normalizeId(user);
    if (!id) {
      console.error("users/main.js: не удалось определить ID пользователя", user);
      showToast("Не удалось определить пользователя");
      return;
    }

    const isActivate = currentTab === "inactive-users";
    const action = isActivate ? "active" : "inactive";

    const confirmText = isActivate
      ? `Активировать пользователя «${user.FullName || ""}»?`
      : `Заморозить пользователя «${user.FullName || ""}»?`;

    const confirmTitle = isActivate ? "Активировать пользователя" : "Заморозить пользователя";

    const confirmed = await showConfirm(confirmText, confirmTitle);
    if (!confirmed) return;

    try {
      // Эндпоинт смены статуса:
      // подстрой под свой API, если нужно
      const res = await fetch(`/api/user?id=${encodeURIComponent(id)}&status=${action}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        showToast("Не удалось изменить статус пользователя");
        return;
      }

      showToast(
        isActivate ? "Пользователь активирован" : "Пользователь заморожен",
        "success",
      );

      // Обновляем обе вкладки
      await Promise.all([
        loadTab("active-users", { force: true }),
        loadTab("inactive-users", { force: true }),
      ]);
    } catch (err) {
      console.error(err);
      showToast("Ошибка сети при смене статуса пользователя");
    }
  }

  // ===== УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ (ТОЛЬКО ДЛЯ ЗАМОРОЖЕННЫХ) =====

  async function handleDeleteUser({ user }) {
    const id = normalizeId(user);
    if (!id) {
      console.error("users/main.js: не удалось определить ID пользователя для удаления", user);
      showToast("Не удалось определить пользователя");
      return;
    }

    const confirmed = await showConfirm(
      `Удалить пользователя «${user.FullName || ""}» без возможности восстановления?`,
      "Удалить пользователя",
    );
    if (!confirmed) return;

    try {
      // Эндпоинт удаления.
      // Если у тебя стиль как у TMC (`/api/user?id=...`), замени на свой вариант.
      const res = await fetch(`/api/user/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        showToast("Не удалось удалить пользователя");
        return;
      }

      showToast("Пользователь удалён", "success");

      // Обновляем обе вкладки
      await Promise.all([
        loadTab("active-users", { force: true }),
        loadTab("inactive-users", { force: true }),
      ]);
    } catch (err) {
      console.error(err);
      showToast("Ошибка сети при удалении пользователя");
    }
  }

  // ===== СЛУШАТЕЛИ =====

  tabs.forEach((btn) => {
    const tabKey = btn.dataset.tab;
    if (!tabKey) return;

    btn.addEventListener("click", () => {
      if (tabKey === activeTab) return;
      setActiveTab(tabKey);
    });
  });

  window.addEventListener("resize", updateHeaderOffset);
  window.addEventListener("load", updateHeaderOffset);
  updateHeaderOffset();

  // старт
  setActiveTab(activeTab);
})();
