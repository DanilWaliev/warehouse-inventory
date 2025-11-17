// /static/js/pages/inventory/transitStock.js
import { openDoc, openDocList } from "../../docs.js";

export function initTransitStock({ showToast }) {
  const controlPanel = document.getElementById("control-panel");
  // стараемся найти правую часть; если нет — создадим позже
  let panelRight = controlPanel?.querySelector('[data-panel="right"]')
                 || controlPanel?.querySelector('.flex:last-child')
                 || null;

  const sectionTitle = document.getElementById("section-title");
  const tableBody    = document.getElementById("table-stock-transit-body");

  let wrap = null;          // контейнер кнопок справа
  let sel = null;           // селект транзитного склада (рядом с title)
  let btnBuy = null;
  let btnSell = null;
  let btnDocs = null;
  let titleBlock = null;    // обёртка слева (h2 + select)
  let createdTitleBlock = false;

  // ===== API =====
  async function loadTransitStorages(preselect) {
    try {
      const res = await fetch("/api/storage?type=transitstorage&inventory=false");
      if (res.status === 404) {
        // нет транзитных — очистим селект и таблицу
        if (sel) sel.innerHTML = "";
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="4" class="text-muted">Нет запасов</td></tr>`;
        return;
      }
      if (!res.ok) throw new Error("transit storage list failed");

      const data = await res.json(); // ожидаем массив [{ID,Name,Location,...}]
      if (!sel) return;

      if (!Array.isArray(data) || data.length === 0) {
        sel.innerHTML = "";
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="4" class="text-muted">Нет запасов</td></tr>`;
        return;
      }

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
    if (!sel?.value) { tableBody.innerHTML = `<tr><td colspan="4" class="text-muted">Нет запасов</td></tr>`; return; }

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
      const storage = Array.isArray(payload) ? payload[0] : payload;
      const inventory = storage?.Inventory || [];

      if (!Array.isArray(inventory) || inventory.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-muted">Нет запасов</td></tr>`;
        return;
      }

      // Рисуем строки: ТМЦ | Количество | Вес (кг) | Действия
      for (const it of inventory) {
        const tr = document.createElement("tr");

        const name  = it?.Component?.Name ?? "";
        const qty   = it?.Quantity ?? "";
        const w     = it?.Component?.Weight ?? "";

        tr.innerHTML = `
          <td>${name}</td>
          <td>${qty}</td>
          <td>${w}</td>
          <td></td>
        `;
        tableBody.appendChild(tr);
      }
    } catch (e) {
      console.error(e);
      showToast?.("Ошибка загрузки запасов");
      tableBody.innerHTML = `<tr><td colspan="4" class="text-muted">Нет запасов</td></tr>`;
    }
  }

  // ===== Actions (Документы) =====
  function onBuy() {
    if (!sel?.value) { showToast?.("Выберите транзитный склад"); return; }
    // тип документа в проекте — 'buy'
    openDoc("buy", { storageId: sel.value }, () => load());
  }

  function onSell() {
    if (!sel?.value) { showToast?.("Выберите транзитный склад"); return; }
    // тип документа в проекте — 'sale'
    openDoc("sale", { storageId: sel.value }, () => load());
  }

  function onDocs() {
    if (!sel?.value) { showToast?.("Выберите транзитный склад"); return; }
    openDocList({ storageId: sel.value });
  }

  // ===== UI mount / unmount =====
  function showControls() {
    if (!controlPanel) return;

    // если правая панель не найдена — создадим минимальную
    if (!panelRight) {
      panelRight = document.createElement("div");
      panelRight.className = "flex items-center";
      panelRight.setAttribute('data-panel', 'right');
      controlPanel.appendChild(panelRight);
    }

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

      btnBuy = document.createElement("button");
      btnBuy.className = "btn";
      btnBuy.textContent = "Покупка";
      btnBuy.style.marginLeft = "var(--spacing-2)";
      btnBuy.addEventListener("click", onBuy);

      btnSell = document.createElement("button");
      btnSell.className = "btn";
      btnSell.textContent = "Продажа";
      btnSell.style.marginLeft = "var(--spacing-2)";
      btnSell.addEventListener("click", onSell);

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

    // первичная загрузка
    loadTransitStorages().then(load).catch(() => {});
  }

  function hideControls() {
    if (sel)  { sel.removeEventListener("change", load); sel.remove(); sel = null; }

    if (btnBuy)  { btnBuy.removeEventListener("click", onBuy); btnBuy.remove(); btnBuy = null; }
    if (btnSell) { btnSell.removeEventListener("click", onSell); btnSell.remove(); btnSell = null; }
    if (btnDocs) { btnDocs.removeEventListener("click", onDocs); btnDocs.remove(); btnDocs = null; }
    if (wrap)    { wrap.remove(); wrap = null; }

    if (createdTitleBlock && titleBlock) {
      // вернём заголовок на место
      controlPanel.insertBefore(sectionTitle, panelRight);
      titleBlock.remove();
      titleBlock = null;
      createdTitleBlock = false;
    }
  }

  return { showControls, hideControls, load };
}
