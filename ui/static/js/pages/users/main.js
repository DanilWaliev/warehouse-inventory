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

  // текущая вкладка: "active-users" | "inactive-users"
  let activeTab = "active-users";

  // проста́я кеш-структура (если захочешь, можно будет отключить кеширование)
  const cache = {
    "active-users": null,
    "inactive-users": null,
  };

  const listByTab = {
    "active-users": activeList,
    "inactive-users": inactiveList,
  };

  // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

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
    // TODO: если ID у пользователя называется по-другому — поменяй здесь.
    return (
      user.ID ||
      user.Id ||
      user.UserID ||
      user.UserId ||
      user.Email || // крайний вариант — email
      null
    );
  }

  // отрисовка списка пользователей во вкладке
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
      const toggleBtn = /** @type {HTMLButtonElement | null} */ (
        clone.querySelector(".user-toggle-status")
      );

      if (fullNameEl) fullNameEl.textContent = user.Fullname || "";
      if (roleEl) roleEl.textContent = user.Role || "";
      if (phoneEl) phoneEl.textContent = user.Phone || "";
      if (emailEl) emailEl.textContent = user.Email || "";
      if (createdEl) createdEl.textContent = formatCreatedAt(user.CreatedAt);

      if (toggleBtn) {
        const isActiveTab = tabKey === "active-users";
        toggleBtn.textContent = isActiveTab ? "Заморозить" : "Активировать";
        toggleBtn.dataset.action = isActiveTab ? "freeze" : "activate";

        toggleBtn.addEventListener("click", () => {
          handleToggleStatus({
            user,
            currentTab: tabKey,
            cardElem: clone,
          });
        });
      }

      listElem.appendChild(clone);
    });
  }

  // загрузка пользователей для вкладки
  async function loadTab(tabKey, { force = false } = {}) {
    // есть валидный кеш и не просили обновить — используем его
    if (!force && Array.isArray(cache[tabKey])) {
      renderUsers(tabKey, cache[tabKey]);
      return;
    }

    const listElem = listByTab[tabKey];
    if (!listElem) return;

    renderEmptyState(listElem, "Загрузка...");

    try {
      // TODO: подставь реальные URL и параметры фильтра под свой API
      // Пример: /api/users?status=active | /api/users?status=inactive
      const statusParam = tabKey === "active-users" ? "active" : "inactive";
      const res = await fetch(`/api/users?status=${encodeURIComponent(statusParam)}`);

      if (!res.ok) {
        renderEmptyState(listElem, "Ошибка загрузки пользователей");
        showToast("Ошибка загрузки пользователей");
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

  // переключение вкладки
  function setActiveTab(tabKey) {
    activeTab = tabKey;

    tabs.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabKey);
    });

    panels.forEach((panel) => {
      const key = panel.getAttribute("data-tab-panel");
      panel.classList.toggle("hidden", key !== tabKey);
    });

    if (sectionTitle) {
      sectionTitle.textContent =
        tabKey === "active-users" ? "Активные пользователи" : "Неактивные пользователи";
    }

    loadTab(tabKey);
  }

  // обработчик активации / заморозки
  async function handleToggleStatus({ user, currentTab }) {
    const id = normalizeId(user);
    if (!id) {
      console.error("users/main.js: не удалось определить ID пользователя", user);
      showToast("Не удалось определить пользователя");
      return;
    }

    const isActivate = currentTab === "inactive-users";
    const action = isActivate ? "activate" : "freeze";

    const confirmText = isActivate
      ? `Активировать пользователя «${user.Fullname || ""}»?`
      : `Заморозить пользователя «${user.Fullname || ""}»?`;

    const confirmTitle = isActivate ? "Активировать пользователя" : "Заморозить пользователя";

    const confirmed = await showConfirm(confirmText, confirmTitle);
    if (!confirmed) return;

    try {
      // TODO: подставь реальные URL/метод под свой API
      // Пример: PUT /api/users/{id}/activate | /api/users/{id}/freeze
      const res = await fetch(`/api/users/${encodeURIComponent(id)}/${action}`, {
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

      // После смены статуса перезагружаем обе вкладки, чтобы данные были актуальны
      await Promise.all([
        loadTab("active-users", { force: true }),
        loadTab("inactive-users", { force: true }),
      ]);
    } catch (err) {
      console.error(err);
      showToast("Ошибка сети при смене статуса пользователя");
    }
  }

  // --- СЛУШАТЕЛИ ---

  tabs.forEach((btn) => {
    const tabKey = btn.dataset.tab;
    if (!tabKey) return;

    btn.addEventListener("click", () => {
      if (tabKey === activeTab) return;
      setActiveTab(tabKey);
    });
  });

  // позиционирование хедера, как в примере с inventory
  window.addEventListener("resize", updateHeaderOffset);
  window.addEventListener("load", updateHeaderOffset);
  updateHeaderOffset();

  // --- СТАРТ ---
  setActiveTab(activeTab);
})();
