import { escapeHtml } from "./utils.js";
import { openDoc } from "../../docs.js";

export async function initStorage({ showToast }) {
  const tbody = document.getElementById("table-stock-warehouse-body");
  const select = document.getElementById("storage-select");
  const purchaseBtn = document.getElementById("storage-purchase");
  const saleBtn = document.getElementById("storage-sale");
  const actionsWrap = document.getElementById("storage-actions");

  if (!tbody || !select || !purchaseBtn || !saleBtn) {
    console.warn("storage.js: required DOM nodes are missing");
    return {
      load: async () => {},
      reload: async () => {},
      showControls: () => {},
      hideControls: () => {},
    };
  }

  let storages = [];
  let currentId = null;
  let isLoaded = false;
  let isLoading = false;

  function normalizeId(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function findStorageById(id) {
    if (id === null) return null;
    return storages.find(st => Number(st.ID) === Number(id)) || null;
  }

  function formatNumber(value, fractionDigits = 2) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "-";
    return num.toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits,
    });
  }

  function populateSelect() {
    const prev = currentId;
    const options = storages.map(st => {
      const label = st.Location || st.Name || `Склад #${st.ID}`;
      return `<option value="${escapeHtml(String(st.ID))}">${escapeHtml(label)}</option>`;
    }).join("");

    select.innerHTML = `<option value="" disabled>Выберите склад</option>${options}`;

    if (!storages.length) {
      select.value = "";
      currentId = null;
      return;
    }

    const valid = findStorageById(prev);
    currentId = valid ? valid.ID : storages[0].ID;
    select.value = String(currentId);
  }

  function renderTable() {
    tbody.innerHTML = "";

    if (!storages.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Склады не найдены</td></tr>';
      select.disabled = true;
      purchaseBtn.disabled = true;
      saleBtn.disabled = true;
      return;
    }

    select.disabled = false;
    purchaseBtn.disabled = false;
    saleBtn.disabled = false;

    const storage = findStorageById(currentId);
    if (!storage) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Выберите склад из списка выше</td></tr>';
      return;
    }

    const items = Array.isArray(storage.Inventory) ? storage.Inventory : [];
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">На выбранном складе нет остатков</td></tr>';
      return;
    }

    const label = storage.Location || storage.Name || `Склад #${storage.ID}`;

    items.forEach(item => {
      const quantity = Number(item.Quantity ?? 0);
      const weightPerUnit = Number(item.Component?.Weight ?? 0);
      const totalWeight = quantity * weightPerUnit;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(label)}</td>
        <td>${escapeHtml(item.Component?.Name ?? "-")}</td>
        <td>${formatNumber(quantity, 3)}</td>
        <td>${formatNumber(totalWeight, 3)}</td>
        <td>-</td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function load(force = false) {
    if (isLoading) return;
    if (isLoaded && !force) {
      renderTable();
      return;
    }

    isLoading = true;
    try {
      const res = await fetch("/api/storage?inventory=true");
      if (!res.ok) {
        if (res.status === 404) {
          storages = [];
          populateSelect();
          renderTable();
          isLoaded = true;
          return;
        }
        throw new Error(`Request failed with status ${res.status}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error("Unexpected response format");
      }
      storages = data;
      populateSelect();
      renderTable();
      isLoaded = true;
    } catch (err) {
      console.error(err);
      storages = [];
      populateSelect();
      renderTable();
      if (typeof showToast === 'function') {
        showToast("Не удалось загрузить склады");
      }
    } finally {
      isLoading = false;
    }
  }

  function ensureSelection() {
    const id = normalizeId(select.value || currentId);
    if (id === null) {
      if (typeof showToast === 'function') {
        showToast("Сначала выберите склад");
      }
      return null;
    }
    currentId = id;
    select.value = String(id);
    return id;
  }

  select.addEventListener("change", () => {
    const id = normalizeId(select.value);
    currentId = id;
    renderTable();
  });

  purchaseBtn.addEventListener("click", () => {
    const id = ensureSelection();
    if (id === null) return;
    openDoc("purchase", { storageId: String(id) }, () => load(true));
  });

  saleBtn.addEventListener("click", () => {
    const id = ensureSelection();
    if (id === null) return;
    openDoc("sale", { storageId: String(id) }, () => load(true));
  });

  return {
    load,
    reload: () => load(true),
    showControls: () => {
      if (actionsWrap) actionsWrap.classList.remove("hidden");
    },
    hideControls: () => {
      if (actionsWrap) actionsWrap.classList.add("hidden");
    },
  };
}
