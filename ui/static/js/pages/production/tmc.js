// tmc.js
import { escapeHtml } from "./utils.js";

export async function initTMC({ showToast, showConfirm, modal }) {
  const tbody = document.getElementById("table-tmc-body");
  const form = document.getElementById("form-tmc");

  if (!tbody || !form) {
    console.warn("tmc.js: отсутствуют #table-tmc-body или #form-tmc");
    return { load: () => {} , reset: () => {} , openModal: () => {} };
  }

  async function loadTMCtable() {
    tbody.innerHTML = "";
    const res = await fetch("/api/tmc");
    if (!res.ok) {
      if (res.status === 404) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="5" class="text-muted">Нет ТМЦ</td>`;
        tbody.appendChild(tr);
      } else {
        showToast("Ошибка при загрузке ТМЦ");
      }
      return;
    }
    const data = await res.json();
    data.forEach(item => {
      let typeRu = item.Type;
      switch (item.Type) {
        case "raw": typeRu = "Сырье"; break;
        case "semi": typeRu = "Полуфабрикат"; break;
        case "product": typeRu = "Продукт"; break;
      }
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(item.Name)}</td>
        <td>${escapeHtml(String(item.Weight))}</td>
        <td>${escapeHtml(typeRu)}</td>
        <td>${escapeHtml(item.Note || "")}</td>
        <td>
          <button class="btn-delete">Удалить</button>
          <button class="btn-edit">Изменить</button>
        </td>
      `;
      tr.querySelector(".btn-delete").addEventListener("click", () => deleteTMC(item.ID));
      tr.querySelector(".btn-edit").addEventListener("click", () => editTMC(item.ID));
      tbody.appendChild(tr);
    });
  }

  async function createTMC(e) {
    e.preventDefault();
    const fd = new FormData(form);
    const name = fd.get("name");
    const weight = fd.get("weight");
    const type = fd.get("type");
    const note = fd.get("note") || "";

    if (!name || name.length > 255 || note.length > 200 || Number(weight) <= 0) {
      showToast("Некорректные данные");
      return;
    }

    const res = await fetch("/api/tmc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, weight, type, note })
    });

    if (res.ok) {
      form.reset();
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden','true');
      loadTMCtable();
      showToast("ТМЦ успешно создан", "success");
    } else {
      showToast("Ошибка при создании ТМЦ");
    }
  }

  async function deleteTMC(id) {
    if (!(await showConfirm("Вы действительно хотите удалить ТМЦ?", "Удалить ТМЦ"))) return;
    const res = await fetch(`/api/tmc?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      loadTMCtable();
      showToast("ТМЦ удалён", "success");
    } else {
      showToast("Ошибка при удалении ТМЦ");
    }
  }

  async function editTMC(id) {
    const res = await fetch(`/api/tmc?id=${id}`);
    if (!res.ok) {
      showToast("Ошибка загрузки ТМЦ");
      return;
    }
    let item = await res.json();
    item = item[0];
    // показать форму ТМЦ
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
    Object.keys(document.forms).forEach(() => {}); // noop
    // заполняем поля
    form.elements["name"].value = item.Name;
    form.elements["weight"].value = item.Weight;
    form.elements["type"].value = item.Type;
    form.elements["note"].value = item.Note || "";

    // временная подмена обработчика
    form.onsubmit = async function (e) {
      e.preventDefault();
      const fd = new FormData(form);
      const name = fd.get("name");
      const weight = fd.get("weight");
      const type = fd.get("type");
      const note = fd.get("note") || "";

      const updRes = await fetch("/api/tmc", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, weight, type, note })
      });
      if (updRes.ok) {
        form.reset();
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden','true');
        loadTMCtable();
        showToast("ТМЦ обновлён", "success");
      } else {
        showToast("Ошибка при обновлении ТМЦ");
      }
      // восстановим дефолтный обработчик
      form.onsubmit = createTMC;
    };
  }

  // привязки
  form.onsubmit = createTMC;

  function reset() {
    try { form.reset(); } catch (e) {}
    form.onsubmit = createTMC;
  }

  function openModal() {
    // показываем тмц форму
    Object.keys(document.forms).forEach(() => {});
    form.onsubmit = createTMC;
    // modal handled by main
  }

  // сразу загрузим данные, если нужно
  return { load: loadTMCtable, reset, openModal };
}
