// /static/js/pages/inventory/productionStock.js
import { openDocList } from "../../docs.js";

export function initProductionStock({ showToast }) {
  const tableBody = document.getElementById('table-stock-production-body');

  // топбар, чтобы прилепить кнопку "Документы"
  const controlPanel = document.getElementById("control-panel");
  const panelRight   = controlPanel?.querySelector(".flex");

  let btnDocs = null;

  async function load() {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    try {
      const res = await fetch('/api/storage?id=1&inventory=true');
      if (res.status === 404) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-muted">Нет запасов</td></tr>`;
        return;
      }
      if (!res.ok) throw new Error('inventory load failed');

      const payload = await res.json();
      const inventory = Array.isArray(payload)
        ? (payload[0]?.Inventory || [])
        : (payload?.Inventory || []);

      if (!inventory.length) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-muted">Нет запасов</td></tr>`;
        return;
      }

      // Колонки: ТМЦ | Количество | Вес (кг) | Заказ | Действия
      for (const it of inventory) {
        const tr = document.createElement('tr');

        const tdName   = document.createElement('td');
        tdName.textContent = it?.Component?.Name ?? '';

        const tdQty    = document.createElement('td');
        tdQty.textContent = String(it?.Quantity ?? '');

        const tdWeight = document.createElement('td');
        tdWeight.textContent = String(it?.Component?.Weight ?? '');

        const tdOrder  = document.createElement('td');
        tdOrder.textContent = '-'; // данных по заказу нет

        const tdActs   = document.createElement('td');
        tdActs.textContent = ''; // действий пока нет

        tr.append(tdName, tdQty, tdWeight, tdOrder, tdActs);
        tableBody.appendChild(tr);
      }
    } catch (e) {
      console.error(e);
      showToast?.('Ошибка загрузки производственных запасов');
      tableBody.innerHTML = `<tr><td colspan="5" class="text-muted">Нет запасов</td></tr>`;
    }
  }

  function handleDocsClick() {
    // склад производства у тебя жёстко = 1
    openDocList({ storageId: 1 });
  }

  // Для совместимости с остальной архитектурой
  function showControls() {
    if (!controlPanel || !panelRight) return;

    if (!btnDocs) {
      btnDocs = document.createElement("button");
      btnDocs.className = "btn";
      btnDocs.textContent = "Документы";
      btnDocs.addEventListener("click", handleDocsClick);
      panelRight.appendChild(btnDocs);
    }

    load();
  }

  function hideControls() {
    if (btnDocs) {
      btnDocs.removeEventListener("click", handleDocsClick);
      btnDocs.remove();
      btnDocs = null;
    }
  }

  return { showControls, hideControls, load };
}
