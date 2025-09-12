function showConfirm(message, title = "Подтверждение") {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    const titleEl = document.getElementById("confirm-title");
    const messageEl = document.getElementById("confirm-message");
    const btnOk = document.getElementById("confirm-ok");
    const btnCancel = document.getElementById("confirm-cancel");
    titleEl.textContent = title;
    messageEl.textContent = message;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    function cleanup(result) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      btnOk.removeEventListener("click", okHandler);
      btnCancel.removeEventListener("click", cancelHandler);
      resolve(result);
    }
    function okHandler() { cleanup(true); }
    function cancelHandler() { cleanup(false); }
    btnOk.addEventListener("click", okHandler);
    btnCancel.addEventListener("click", cancelHandler);
  });
}
// Глобальная функция
window.showConfirm = showConfirm;

