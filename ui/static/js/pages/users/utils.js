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
  const d = new Date(dateStr);
  const options = {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "Europe/Moscow",
    hour12: false
  };
  return d.toLocaleString("ru-RU", options) + " МСК";
}

// Кэш, чтобы не дёргать import повторно
let _toastFn = null;
let _confirmFn = null;

export async function resolveToastConfirm() {
  if (_toastFn && _confirmFn) return { showToast: _toastFn, showConfirm: _confirmFn };

  try {
    // utils.js находится в /inventory/, поэтому поднимаемся на уровень выше:
    const toastMod   = await import("../../toast.js");
    const confirmMod = await import("../../confirm.js");

    const showToast   = toastMod.showToast   || toastMod.default;
    const showConfirm = confirmMod.showConfirm || confirmMod.default;

    _toastFn = typeof showToast === "function"
      ? showToast
      : (msg, type) => { alert((type ? type + ": " : "") + String(msg)); };

    _confirmFn = typeof showConfirm === "function"
      ? showConfirm
      : async (message) => confirm(String(message));

  } catch {
    // Фолбэки, если модули недоступны
    _toastFn = (msg, type) => { alert((type ? type + ": " : "") + String(msg)); };
    _confirmFn = async (message) => confirm(String(message));
  }

  return { showToast: _toastFn, showConfirm: _confirmFn };
}

export function updateHeaderOffset() {
  const headerEl = document.querySelector('header') || document.querySelector('div.header') || null;
  const h = headerEl ? headerEl.getBoundingClientRect().height : 0;
  document.documentElement.style.setProperty('--header-offset', h + 'px');
}
