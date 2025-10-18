// static/js/pages/movement/orders.js
export function initOrders({ showToast, showConfirm }) {
  const table = document.getElementById('table-move');
  const tbody = table ? table.querySelector('tbody') : null;

  // ====== тост-хелпер (для не-404 ошибок) ======
  function toastByStatus(res, fallback) {
    switch (res.status) {
      case 409:
        showToast?.("Заказ уже существует");
        break;
      case 400:
        showToast?.("Некорректные данные");
        break;
      default:
        showToast?.(fallback);
    }
  }

  // ====== LIST GET: 404 -> пусто без тоста ======
  async function parseListGET(res, fallbackToast) {
    if (res.status === 404) return []; // просто пусто
    if (!res.ok) {
      toastByStatus(res, fallbackToast);
      return [];
    }
    const ct = res.headers.get('Content-Type') || '';
    return ct.includes('application/json') ? await res.json() : [];
  }

  async function fetchOrders() {
    const res = await fetch('/api/move'); // эндпоинт списка заказов перемещения
    return parseListGET(res, "Ошибка загрузки заказов");
  }

  function renderEmpty() {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" class="text-muted">Нет заказов</td></tr>`;
  }

  function renderList(list) {
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(list) || list.length === 0) {
      renderEmpty();
      return;
    }

    for (const o of list) {
      const batchesCount = Array.isArray(o.Batches) ? o.Batches.length : 0;
      const statusText = o.ClosedAt
        ? 'Завершён'
        : o.DispatchSignedAt
        ? 'Отправлен'
        : 'Создан';

      const itemsHtml = Array.isArray(o.Items) && o.Items.length
        ? `<ul class="text-muted" style="list-style:none;padding:0;margin:0;">
             ${o.Items
               .map(it => `<li>${(it?.Recipe?.Result?.Name ?? '—')} × ${it?.Quantity ?? ''}</li>`)
               .join('')}
           </ul>`
        : '—';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-id">#${o.ID ?? ''}</td>
        <td>${o.Route?.Name ?? '—'}</td>
        <td>${itemsHtml}</td>
        <td>${batchesCount}</td>
        <td>${statusText}</td>
        <td>${o.CreatedAt ?? '-'}</td>
        <td>${o.ClosedAt ?? '-'}</td>
        <td>
          <a class="btn" href="/move/${o.ID}">Открыть</a>
        </td>
      `;
      tbody.appendChild(tr);
    }
  }

  async function load() {
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const data = await fetchOrders(); // [] при 404 без тоста
      renderList(data);
    } catch {
      // сетевой фейл — покажем пусто (без тоста для списка)
      renderEmpty();
    }
  }

  return { load };
}
