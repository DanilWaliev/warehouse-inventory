// warehouses.js — раздел "Склады" (справочник)
export function initWarehouses({ showToast, showConfirm, modal }) {
  const panelRight = document.querySelector('#control-panel .flex');
  const modalTitle = document.getElementById('modal-title');
  const form = document.getElementById('form-warehouse-admin');
  const tbody = document.getElementById('table-warehouses-body');

  let addBtn = null;
  let editingId = null;

  // Кнопка "Добавить" в топбаре только для этой вкладки
  function ensureAddBtn() {
    if (addBtn || !panelRight) return;
    addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary';
    addBtn.textContent = 'Добавить';
    addBtn.addEventListener('click', openCreateModal);
    panelRight.appendChild(addBtn);
  }
  function showControls() { ensureAddBtn(); addBtn?.classList.remove('hidden'); }
  function hideControls() { addBtn?.classList.add('hidden'); }

  // API
  async function list() {
    const r = await fetch('/api/storage?type=warehouse&inventory=false');
    if (!r.ok) throw new Error('list');
    return await r.json(); // [{ID,Name,Location,Notes?...}]
  }
  async function create(payload) {
    const r = await fetch('/api/storage', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ type:'warehouse', ...payload })
    });
    if (!r.ok) throw new Error('create');
  }
  async function update(id, payload) {
    const r = await fetch(`/api/storage?id=${id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ type:'warehouse', ...payload })
    });
    if (!r.ok) throw new Error('update');
  }
  async function remove(id) {
    const r = await fetch(`/api/storage?id=${id}`, { method:'DELETE' });
    if (!r.ok) throw new Error('delete');
  }
  async function getOne(id) {
    const r = await fetch(`/api/storage?id=${id}`);
    if (!r.ok) throw new Error('get');
    const d = await r.json();
    return Array.isArray(d) ? d[0] : d;
  }

  // Таблица
  async function load() {
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      const data = await list();
      if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted">Складов нет</td></tr>`;
        return;
      }
      data.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${s.ID}</td>
          <td>${s.Name || ''}</td>
          <td>${s.Location || ''}</td>
          <td>${s.Notes || ''}</td>
          <td>
            <button class="btn-edit" data-id="${s.ID}">Изменить</button>
            <button class="btn-delete" data-id="${s.ID}">Удалить</button>
          </td>
        `;
        tr.querySelector('.btn-edit').addEventListener('click', () => openEditModal(s.ID));
        tr.querySelector('.btn-delete').addEventListener('click', async () => {
          if (!(await showConfirm('Удалить склад?', 'Подтверждение'))) return;
          try { await remove(s.ID); await load(); showToast('Склад удалён','success'); }
          catch { showToast('Ошибка удаления склада'); }
        });
        tbody.appendChild(tr);
      });
    } catch {
      showToast('Ошибка загрузки складов');
    }
  }

  // Модалка
  function showOnly(formEl) {
    document.querySelectorAll('.modal-form').forEach(f => f.classList.add('hidden'));
    formEl.classList.remove('hidden');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    form.reset();
    form.dataset.mode = 'create';
    form.removeAttribute('data-id');
    editingId = null;
  }

  function openCreateModal() {
    editingId = null;
    form.dataset.mode = 'create';
    form.removeAttribute('data-id');
    modalTitle.textContent = 'Создать склад';
    form.reset();
    showOnly(form);
  }

  async function openEditModal(id) {
    try {
      const s = await getOne(id);
      editingId = id;
      form.dataset.mode = 'edit';
      form.dataset.id = String(id);
      modalTitle.textContent = 'Изменить склад';
      form.reset();
      form.elements['name'].value = s.Name || '';
      form.elements['location'].value = s.Location || '';
      form.elements['notes'].value = s.Notes || '';
      showOnly(form);
    } catch {
      showToast('Ошибка загрузки склада');
    }
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const location = String(fd.get('location') || '').trim();
    const notes = String(fd.get('notes') || '');

    if (!name || !location) { showToast('Заполните название и локацию'); return; }

    try {
      if (editingId) {
        await update(editingId, { name, location, notes });
        showToast('Склад обновлён','success');
      } else {
        await create({ name, location, notes });
        showToast('Склад создан','success');
      }
      closeModal();
      await load();
    } catch {
      showToast('Ошибка сохранения склада');
    }
  });

  document.getElementById('modal-cancel-warehouse-admin')?.addEventListener('click', closeModal);

  return { showControls, hideControls, load };
}
