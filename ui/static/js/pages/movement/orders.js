function renderOrders(orders) {
  const tbody = document.querySelector('#table-move tbody');
  tbody.innerHTML = '';

  if (!Array.isArray(orders) || orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-muted">Нет заказов</td></tr>`;
    return;
  }

  for (const o of orders) {
    const batchesCount = Array.isArray(o.Batches) ? o.Batches.length : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${o.ID}</td>
      <td>${o.Route?.Name ?? '—'}</td>
      <td>${
        Array.isArray(o.Items) && o.Items.length
          ? `<ul class="text-muted" style="list-style:none;padding:0;margin:0;">${
              o.Items.map(it => `<li>${it.Recipe?.Result?.Name ?? '—'} × ${it.Quantity}</li>`).join('')
            }</ul>`
          : '—'
      }</td>
      <td>${batchesCount}</td> <!-- НОВОЕ: кол-во партий -->
      <td>${
        o.ClosedAt ? 'Завершён'
        : o.DispatchSignedAt ? 'Отправлен'
        : 'Создан'
      }</td>
      <td>${o.CreatedAt ?? '-'}</td>
      <td>${o.ClosedAt ?? '-'}</td>
      <td>
        <a class="btn" href="/move/${o.ID}">Открыть</a>
      </td>
    `;
    tbody.appendChild(tr);
  }
}
