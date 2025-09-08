// Данный файл содержит скрипты для всплывающих "тостовых" сообщений

function showToast(message, type = "error") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    ${message}
    <button class="close-btn">&times;</button>
  `;

  container.appendChild(toast);

  // Закрытие по кнопке
  toast.querySelector(".close-btn").addEventListener("click", () => {
    toast.remove();
  });

  // Автоудаление через 5 сек
  setTimeout(() => toast.remove(), 5000);
}