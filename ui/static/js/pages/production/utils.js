// utils.js
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatDate(dateStr) {
  if (!dateStr) return "-";
  // dateStr приходит в формате "2025-09-24T21:22:38Z" — это UTC.
  const d = new Date(dateStr);
  const options = {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "Europe/Moscow",
    hour12: false
  };
  return d.toLocaleString("ru-RU", options) + " МСК";
}

/**
 * Попытка получить функции showToast / showConfirm:
 * 1) если уже доступны как глобальные window.showToast/window.showConfirm — используем
 * 2) иначе пытаем динамически импортировать ../toast.js и ../confirm.js
 * 3) если всё не доступно — ставим простые fallback (alert/confirm)
 */
export async function resolveToastConfirm() {
  let showToast = window.showToast;
  let showConfirm = window.showConfirm;

  if (typeof showToast === "function" && typeof showConfirm === "function") {
    return { showToast, showConfirm };
  }

  // Попробуем динамически импортировать модули (они могут экспортировать именованные функции)
  try {
    const toastMod = await import('../toast.js');
    const confirmMod = await import('../confirm.js');
    showToast = toastMod.showToast || toastMod.default || window.showToast;
    showConfirm = confirmMod.showConfirm || confirmMod.default || window.showConfirm;
  } catch (err) {
    // импорт не удался — возможно файлы не ES-модули. Фолбэк ниже.
    // console.warn("Не удалось импортировать toast/confirm как модули", err);
  }

  if (typeof showToast !== "function") {
    showToast = (msg, type) => { alert((type ? type + ": " : "") + String(msg)); };
  }
  if (typeof showConfirm !== "function") {
    showConfirm = async (message, title) => confirm(String(message));
  }

  return { showToast, showConfirm };
}

export function updateHeaderOffset() {
  const headerEl = document.querySelector('header') || document.querySelector('div.header') || null;
  const h = headerEl ? headerEl.getBoundingClientRect().height : 0;
  document.documentElement.style.setProperty('--header-offset', h + 'px');
}
