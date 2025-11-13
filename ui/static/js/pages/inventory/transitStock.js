// /static/js/pages/inventory/transitStock.js
import { openDoc, openDocList } from "../../docs.js";

export function initTransitStock({ showToast }) {
  const controlPanel = document.getElementById("control-panel");
  const panelRight   = controlPanel?.querySelector(".flex"); // правая зона топбара
  const sectionTitle = document.getElementById("section-title");
  const tableBody    = document.getElementById("table-stock-transit-body"); // tbody в таблице "Запасы в пути"

  let wrap = null;          // контейнер кнопок справа
  let sel = null;           // селект транзитного склада (рядом с title)
  let btnBuy = null;
  let btnSell = null;
  let btnDocs = null;
  let titleBlock = null;    // обёртка слева (h2 + select)
  let createdTitleBlock = false;

  async function loadTransitStorages(preselect) {
    try {
      const res = await fetch("/api/storage?type=transitstorage&inventory=false");
      if (!res.ok) throw new Error("transit storage list failed");
      const data = await res.json(); // [{ID,Name,Location,...}]
      if (!sel) return;

      sel.innerHTML = data
        .map(s => `<option value="${s.ID}">${s.Name}${s.Location ? " — " + s.Location : ""}</option>`)
        .join("");

      if (preselect) sel.value = String(preselect);
      if (!sel.value && data[0]) sel.value = String(data[0].ID);
    } catch (e) {
      console.error(e);
      showToast?.("Не удалось загрузить транзитные склады");
    }
  }

  async function load() {
    if (!tableBody) return;
    if (!sel?.value) { tableBody.innerHTML = ""; return; }

    tableBody.innerHTML = "";

    try {
      const url = `/api/storage?id=${encodeURIComponent(sel.value)}&inventory=true`;
      const res = await fetch(url);

      if (res.status === 404) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-muted">Нет запасов</td></tr>`;
        return;
      }
      if (!res.ok) throw new Error("transit inventory load failed");

      const payload = await res.json();
      const inventory = Array.isArray(payload)
        ? (payload[0]?.Inventory || [])
        : (payload?.Inventory || []);

      if (!inventory.length) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-muted">Нет запасов</td></tr>`;
        return;
      }

      // Рисуем строки: ТМЦ | Количество | Вес (кг) | Действия
      for (const it of inventory) {
        const tr = document.createElement("tr");

        const tdName   = document.createElement("td");
        tdName.textContent = it?.Component?.Name ?? "";

        const tdQty    = document.createElement("td");
        tdQty.textContent = String(it?.Quantity ?? "");

        const tdWeight = document.createElement("td");
        tdWeight.textContent = String(it?.Component?.Weight ?? "");

        const tdAct    = document.createElement("td");
        tdAct.textContent = "";

        tr.append(tdName, tdQty, tdWeight, tdAct);
        tableBody.appendChild(tr);
      }
    } catch (e) {
      console.error(e);
      showToast?.("Ошибка загрузки запасов");
      tableBody.innerHTML = `<tr><td colspan="4" class="text-muted">Нет запасов</td></tr>`;
    }
  }

  function onBuy() {
    if (!sel?.value) { showToast?.("Выберите транзитный склад"); return; }
    openDoc("purchase", { storageId: sel.value }, () => load());
  }

  function onSell() {
    if (!sel?.value) { showToast?.("Выберите транзитный склад"); return; }
    openDoc("sale", { storageId: sel.value }, () => load());
  }

  function onDocs() {
    if (!sel?.value) { showToast?.("Выберите транзитный склад"); return; }
    openDocList({ storageId: sel.value });
  }

  function showControls() {
    if (!controlPanel || !panelRight) return;

    // слева — заголовок + селект
    if (!titleBlock) {
      titleBlock = document.createElement("div");
      titleBlock.id = "title-block-transit";
      titleBlock.className = "flex items-center";
      controlPanel.insertBefore(titleBlock, panelRight);
      titleBlock.appendChild(sectionTitle);
      createdTitleBlock = true;
    }

    if (!sel) {
      sel = document.createElement("select");
      sel.id = "transit-select";
      sel.style.width = "220px";
      sel.style.maxWidth = "100%";
      sel.style.marginLeft = "var(--spacing-3)";
      sel.addEventListener("change", load);
      titleBlock.appendChild(sel);
    }

    // справа — кнопки
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "transit-controls";
      wrap.className = "flex items-center";

      btnDocs = document.createElement("button");
      btnDocs.className = "btn";
      btnDocs.textContent = "Документы";
      btnDocs.style.marginLeft = "var(--spacing-2)";
      btnDocs.addEventListener("click", onDocs);

      wrap.appendChild(btnBuy);
      wrap.appendChild(btnSell);
      wrap.appendChild(btnDocs);
      panelRight.appendChild(wrap);
    }

    // данные
    loadTransitStorages().then(load).catch(() => {});
  }

  function hideControls() {
    if (sel)  { sel.removeEventListener("change", load); sel.remove(); sel = null; }
    if (btnDocs) { btnDocs.removeEventListener("click", onDocs); btnDocs.remove(); btnDocs = null; }
    if (wrap)    { wrap.remove(); wrap = null; }

    if (createdTitleBlock && titleBlock) {
      controlPanel.insertBefore(sectionTitle, panelRight);
      titleBlock.remove();
      titleBlock = null;
      createdTitleBlock = false;
    }
  }

  return { showControls, hideControls, load };
}
