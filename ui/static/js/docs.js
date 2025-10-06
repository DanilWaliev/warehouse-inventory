// /static/js/docs.js
import { showToast } from "./toast.js";

/* =========================
   РЕЕСТР ТИПОВ ДОКУМЕНТОВ
   ========================= */
const DOCS = {
  purchase: {
    title: "Покупка",
    kind: "buy", // POST /api/document?type=buy
    fields: [
      { name: "storageId",   label: "Склад",      type: "select",  source: "storages",   required: true },
      { name: "componentId", label: "ТМЦ",        type: "select",  source: "components", required: true },
      { name: "quantity",    label: "Количество", type: "number",  min: 1, step: 1, value: 1, required: true },
      { name: "notes",       label: "Заметки",    type: "textarea" }
    ]
  },
  sale: {
    title: "Продажа",
    kind: "sale", // POST /api/document?type=sale
    fields: [
      { name: "storageId",   label: "Склад",      type: "select",  source: "storages",  required: true },
      { name: "componentId", label: "ТМЦ",        type: "select",  source: "inventory", required: true }, // только из инвентаря выбранного склада
      { name: "quantity",    label: "Количество", type: "number",  min: 1, step: 1, value: 1, required: true },
      { name: "notes",       label: "Заметки",    type: "textarea" }
    ]
  },

  // Примеры на будущее:
  // transfer: {
  //   title: "Перемещение",
  //   kind: "transfer",
  //   fields: [
  //     { name: "fromStorageId", label: "Со склада", type: "select", source: "storages", required: true },
  //     { name: "toStorageId",   label: "На склад",  type: "select", source: "storages", required: true },
  //     { name: "componentId",   label: "ТМЦ",       type: "select", source: "inventoryFrom", required: true },
  //     { name: "quantity",      label: "Количество", type: "number", min: 1, step: 1, value: 1, required: true },
  //     { name: "notes",         label: "Заметки",    type: "textarea" }
  //   ]
  // },
  // production: {
  //   title: "Производство",
  //   kind: "production",
  //   fields: [
  //     { name: "storageId", label: "Склад/цех", type: "select", source: "storages", required: true },
  //     { name: "recipeId",  label: "Рецептура", type: "select", source: "recipes", required: true },
  //     { name: "quantity",  label: "Количество", type: "number", min: 1, step: 1, value: 1, required: true },
  //     { name: "notes",     label: "Заметки", type: "textarea" }
  //   ]
  // },
};

/* =========================
   МОДАЛКА ДОКУМЕНТА
   ========================= */
let docModal, docForm, docTitle, docMeta, docNotes, docSubmit, docCancel;

function ensureDocModal() {
  if (docModal) return;
  const html = `
    <div id="doc-modal" class="modal hidden" aria-hidden="true" role="dialog" aria-modal="true">
      <div class="modal-content" role="document">
        <h3 id="doc-title" class="mb-4">Документ</h3>
        <div id="doc-meta" class="mb-4 text-muted" style="display:flex;gap:12px;flex-wrap:wrap;"></div>
        <form id="doc-form"></form>
        <div class="flex justify-end" style="gap:8px">
          <button type="button" class="btn" id="doc-cancel">Отмена</button>
          <button type="submit" class="btn btn-primary" form="doc-form" id="doc-submit">Провести</button>
        </div>
      </div>
    </div>`;
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  docModal  = wrap.firstElementChild;
  document.body.appendChild(docModal);
  docForm   = docModal.querySelector("#doc-form");
  docTitle  = docModal.querySelector("#doc-title");
  docMeta   = docModal.querySelector("#doc-meta");
  docSubmit = docModal.querySelector("#doc-submit");
  docCancel = docModal.querySelector("#doc-cancel");
  docCancel.addEventListener("click", closeDoc);
  window.addEventListener("keydown", e => {
    if (!docModal.classList.contains("hidden") && e.key === "Escape") closeDoc();
  });
}
function openDocModal() {
  docModal.classList.remove("hidden");
  docModal.setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";
}
function closeDoc() {
  if (!docModal) return;
  docModal.classList.add("hidden");
  docModal.setAttribute("aria-hidden","true");
  document.body.style.overflow = "";
  docForm?.reset();
}

/* =========================
   МОДАЛКА СПИСКА ДОКУМЕНТОВ
   ========================= */
let listModal, listBody, listClose;
function ensureListModal() {
  if (listModal) return;
  const html = `
    <div id="doc-list-modal" class="modal hidden" aria-hidden="true" role="dialog" aria-modal="true">
      <div class="modal-content" role="document">
        <h3 class="mb-4">Документы</h3>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>ID</th><th>Тип</th><th>Дата</th></tr></thead>
            <tbody id="doc-list-body"></tbody>
          </table>
        </div>
        <div class="flex justify-end mt-4">
          <button type="button" class="btn" id="doc-list-close">Закрыть</button>
        </div>
      </div>
    </div>`;
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  listModal = wrap.firstElementChild;
  document.body.appendChild(listModal);
  listBody  = listModal.querySelector("#doc-list-body");
  listClose = listModal.querySelector("#doc-list-close");
  listClose.addEventListener("click", () => {
    listModal.classList.add("hidden");
    listModal.setAttribute("aria-hidden","true");
    document.body.style.overflow = "";
  });
}
function openListModal() {
  listModal.classList.remove("hidden");
  listModal.setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";
}
function closeListModal() {
  if (!listModal) return;
  listModal.classList.add("hidden");
  listModal.setAttribute("aria-hidden","true");
  document.body.style.overflow = "";
}

/* =========================
   ДАННЫЕ ДЛЯ СЕЛЕКТОВ
   ========================= */
async function fetchStorages(type) {
  const r = await fetch(`/api/storage?type=${type}&inventory=false`);
  if (!r.ok) return [];
  return await r.json(); // [{ID,Name,Location}]
}
async function fetchComponents() {
  const r = await fetch("/api/tmc");
  if (!r.ok) return [];
  return await r.json(); // [{ID,Name}]
}
async function fetchInventory(storageId) {
  const r = await fetch(`/api/storage?id=${encodeURIComponent(storageId)}&inventory=true`);
  if (!r.ok) return [];
  const payload = await r.json();
  const inv = Array.isArray(payload) ? (payload[0]?.Inventory || []) : (payload?.Inventory || []);
  return inv; // [{Component:{ID,Name,Weight}, Quantity}]
}
async function fetchRecipes() {
  const r = await fetch("/api/recipe");
  if (!r.ok) return [];
  return await r.json();
}

async function fillBySource(select, source, ctx = {}) {
  select.innerHTML = "";
  switch (source) {
    case "storages": {
      const data = await fetchStorages("warehouse");
      select.innerHTML = data.map(s =>
        `<option value="${s.ID}">${s.Name}${s.Location ? " — " + s.Location : ""}</option>`
      ).join("");
      break;
    }
    case "components": {
      const data = await fetchComponents();
      select.innerHTML = data.map(c => `<option value="${c.ID}">${c.Name}</option>`).join("");
      break;
    }
    case "inventory": {
      const inv = await fetchInventory(ctx.storageId);
      if (!inv.length) {
        select.innerHTML = `<option value="" disabled selected>Нет запасов</option>`;
        break;
      }
      select.innerHTML = inv.map(it => {
        const cid  = it?.Component?.ID ?? "";
        const name = it?.Component?.Name ?? "";
        const qty  = it?.Quantity ?? 0;
        return `<option value="${cid}">${name} — ${qty}</option>`;
      }).join("");
      break;
    }
    case "inventoryFrom": {
      const inv = await fetchInventory(ctx.fromStorageId);
      if (!inv.length) {
        select.innerHTML = `<option value="" disabled selected>Нет запасов</option>`;
        break;
      }
      select.innerHTML = inv.map(it => {
        const cid  = it?.Component?.ID ?? "";
        const name = it?.Component?.Name ?? "";
        const qty  = it?.Quantity ?? 0;
        return `<option value="${cid}">${name} — ${qty}</option>`;
      }).join("");
      break;
    }
    case "recipes": {
      const data = await fetchRecipes();
      select.innerHTML = data.map(r =>
        `<option value="${r.Result?.ID}">${r.Result?.Name || ("Рецепт " + (r.Result?.ID ?? ""))}</option>`
      ).join("");
      break;
    }
  }
}

/* =========================
   РЕНДЕР ПОЛЕЙ ПО СХЕМЕ
   ========================= */
function renderField(f) {
  const req = f.required ? "required" : "";
  const common = `name="${f.name}" id="fld-${f.name}" ${req}`;
  if (f.type === "select") {
    return `<div class="mb-3"><label>${f.label}</label><select ${common}></select></div>`;
  }
  if (f.type === "number") {
    const min  = f.min  != null ? `min="${f.min}"`   : "";
    const step = f.step != null ? `step="${f.step}"` : "";
    const val  = f.value!= null ? `value="${f.value}"` : "";
    return `<div class="mb-3"><label>${f.label}</label><input type="number" ${common} ${min} ${step} ${val}></div>`;
  }
  if (f.type === "textarea") {
    return `<div class="mb-3"><label>${f.label}</label><textarea ${common} class="w-full"></textarea></div>`;
  }
  return "";
}

/* =========================
   ОТКРЫТЬ ДОКУМЕНТ (СОЗДАНИЕ)
   ========================= */
export function openDoc(type, preset = {}, onSuccess) {
  ensureDocModal();
  const def = DOCS[type];
  if (!def) { showToast("Неизвестный тип документа"); return; }

  docTitle.textContent = def.title;
  const now = new Date();
  docMeta.innerHTML = `
    <div>Тип: <strong>${def.title}</strong></div>
    <div>Создал: <strong>Вы</strong></div>
    <div>Дата: <strong>${now.toLocaleString("ru-RU")}</strong></div>
  `;

  // собрать форму
  const inner = def.fields.map(renderField).join("");
  docForm.innerHTML = inner; // заметки уже в schema как textarea

  // включить редактирование
  Array.from(docForm.elements).forEach(el => el.disabled = false);
  docSubmit.classList.remove("hidden");

  // первичное наполнение селектов
  (async () => {
    // 1) независимые
    for (const f of def.fields) {
      if (f.type !== "select") continue;
      const el = docForm.querySelector(`#fld-${f.name}`);
      if (!el) continue;
      if (f.source === "storages" || f.source === "components" || f.source === "recipes") {
        await fillBySource(el, f.source, preset);
        if (preset[f.name]) el.value = String(preset[f.name]);
      }
    }
    // 2) зависящие (inventory / inventoryFrom)
    for (const f of def.fields) {
      if (f.type !== "select") continue;
      const el = docForm.querySelector(`#fld-${f.name}`);
      if (!el) continue;

      if (f.source === "inventory") {
        const storageId = (docForm.querySelector("#fld-storageId")?.value) || preset.storageId;
        await fillBySource(el, "inventory", { storageId });
        if (preset[f.name]) el.value = String(preset[f.name]);
      }
      if (f.source === "inventoryFrom") {
        const fromStorageId = (docForm.querySelector("#fld-fromStorageId")?.value) || preset.fromStorageId;
        await fillBySource(el, "inventoryFrom", { fromStorageId });
        if (preset[f.name]) el.value = String(preset[f.name]);
      }
    }

    // зависимость от смены склада
    const storageEl = docForm.querySelector("#fld-storageId");
    if (storageEl) {
      storageEl.onchange = async () => {
        for (const f of def.fields) {
          if (f.source === "inventory") {
            const target = docForm.querySelector(`#fld-${f.name}`);
            await fillBySource(target, "inventory", { storageId: storageEl.value });
          }
        }
      };
    }
    const fromEl = docForm.querySelector("#fld-fromStorageId");
    if (fromEl) {
      fromEl.onchange = async () => {
        for (const f of def.fields) {
          if (f.source === "inventoryFrom") {
            const target = docForm.querySelector(`#fld-${f.name}`);
            await fillBySource(target, "inventoryFrom", { fromStorageId: fromEl.value });
          }
        }
      };
    }
  })();

  // submit -> /api/document?type=buy|sale|...
  docForm.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(docForm);
    const data = Object.fromEntries(fd.entries());

    // числовые
    if ("quantity" in data) data.quantity = parseInt(data.quantity || "0", 10);

    // валидация по схеме
    for (const f of def.fields) {
      if (f.required && !String(data[f.name] ?? "").trim()) {
        showToast(`Заполните поле: ${f.label}`);
        return;
      }
    }
    if ("quantity" in data && (!Number.isFinite(data.quantity) || data.quantity <= 0)) {
      showToast("Некорректное количество");
      return;
    }

    try {
      const r = await fetch(`/api/document?type=${def.kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw 0;
      closeDoc();
      onSuccess && onSuccess();
      showToast("Документ проведён", "success");
    } catch {
      showToast("Ошибка проведения");
    }
  };

  openDocModal();
}

/* =========================
   ПРОСМОТР ДОКУМЕНТА
   ========================= */
export async function openDocView(id) {
  ensureDocModal();
  try {
    const res = await fetch(`/api/document?id=${id}`);
    if (!res.ok) throw 0;
    const doc = await res.json(); // {ID,Type,CreatedAt,CreatedBy,StorageID,Items:[{Component:{ID,Name},Quantity}],Notes,...}

    const def = DOCS[doc.Type] || { title: doc.Type, fields: [] };
    docTitle.textContent = def.title;

    docMeta.innerHTML = `
      <div>ID: <strong>${doc.ID}</strong></div>
      <div>Тип: <strong>${doc.Type}</strong></div>
      <div>Создал: <strong>${doc.CreatedBy ?? "-"}</strong></div>
      <div>Дата: <strong>${new Date(doc.CreatedAt).toLocaleString("ru-RU")}</strong></div>
    `;

    // собрать форму по схеме и заполнить
    const inner = (def.fields || []).map(renderField).join("");
    docForm.innerHTML = inner; // заметки — отдельным полем в схеме
    const item = Array.isArray(doc.Items) ? doc.Items[0] : null;

    // наполнение селектов
    for (const f of def.fields || []) {
      if (f.type !== "select") continue;
      const el = docForm.querySelector(`#fld-${f.name}`);
      if (!el) continue;

      if (f.source === "storages" || f.source === "components" || f.source === "recipes") {
        await fillBySource(el, f.source, {});
      }
      if (f.source === "inventory") {
        await fillBySource(el, "inventory", { storageId: doc.StorageID });
      }
      if (f.source === "inventoryFrom") {
        await fillBySource(el, "inventoryFrom", { fromStorageId: doc.FromStorageID });
      }
    }

    // значения
    for (const f of def.fields || []) {
      const el = docForm.querySelector(`#fld-${f.name}`);
      if (!el) continue;
      if (f.name === "storageId")      el.value = String(doc.StorageID ?? "");
      if (f.name === "fromStorageId")  el.value = String(doc.FromStorageID ?? "");
      if (f.name === "toStorageId")    el.value = String(doc.ToStorageID ?? "");
      if (f.name === "componentId")    el.value = String(item?.Component?.ID ?? "");
      if (f.name === "recipeId")       el.value = String(doc.RecipeID ?? "");
      if (f.name === "quantity")       el.value = String(item?.Quantity ?? doc.Quantity ?? 0);
      if (f.name === "notes")          el.value = String(doc.Notes ?? "");
    }

    // read-only
    Array.from(docForm.elements).forEach(el => el.disabled = true);
    docSubmit.classList.add("hidden");

    openDocModal();
  } catch {
    showToast("Не удалось загрузить документ");
  }
}

/* =========================
   СПИСОК ДОКУМЕНТОВ
   ========================= */
export async function openDocList({ storageId, type } = {}) {
  ensureListModal();
  listBody.innerHTML = "";

  const qs = new URLSearchParams();
  if (storageId) qs.set("storageId", storageId);
  if (type)      qs.set("type", type); // buy|sale|transfer|production
  const url = qs.toString() ? `/api/document?${qs}` : "/api/document";

  try {
    const res = await fetch(url);
    if (!res.ok) throw 0;
    const data = await res.json(); // [{ID,Type,CreatedAt}, ...]
    if (!Array.isArray(data) || data.length === 0) {
      listBody.innerHTML = `<tr><td colspan="3" class="text-muted">Нет документов</td></tr>`;
    } else {
      data.forEach(d => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${d.ID}</td>
          <td>${d.Type}</td>
          <td>${new Date(d.CreatedAt).toLocaleString("ru-RU")}</td>
        `;
        tr.style.cursor = "pointer";
        tr.addEventListener("click", async () => {
          closeListModal();
          await openDocView(d.ID);
        });
        listBody.appendChild(tr);
      });
    }
    openListModal();
  } catch {
    showToast("Не удалось загрузить список документов");
  }
}
