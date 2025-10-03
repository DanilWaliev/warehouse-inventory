// docs.js
const DOCS = {
  purchase: { title:'Покупка', tpl: () => `
    <div class="mb-3"><label>Склад</label><select name="storageId" id="doc-storage" required></select></div>
    <div class="mb-3"><label>ТМЦ</label><select name="componentId" id="doc-component" required></select></div>
    <div class="mb-3"><label>Количество</label><input name="quantity" type="number" min="1" step="1" value="1" required></div>
  `, submit: d => fetch('/api/documents/purchase',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}) },
  sale:     { title:'Продажа', tpl: () => `
    <div class="mb-3"><label>Склад</label><select name="storageId" id="doc-storage" required></select></div>
    <div class="mb-3"><label>ТМЦ</label><select name="componentId" id="doc-component" required></select></div>
    <div class="mb-3"><label>Количество</label><input name="quantity" type="number" min="1" step="1" value="1" required></div>
  `, submit: d => fetch('/api/documents/sale',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}) },
};

let modalEl, formEl, titleEl, btnCancel;

function ensureModal() {
  if (modalEl) return;
  const html = `
    <div id="doc-modal" class="modal hidden" aria-hidden="true" role="dialog" aria-modal="true">
      <div class="modal-content" role="document">
        <h3 id="doc-title" class="mb-4">Документ</h3>
        <form id="doc-form"></form>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="btn" id="doc-cancel">Отмена</button>
          <button type="submit" class="btn btn-primary" form="doc-form">Провести</button>
        </div>
      </div>
    </div>`;
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  modalEl = wrap.firstElementChild;
  document.body.appendChild(modalEl);
  formEl = modalEl.querySelector('#doc-form');
  titleEl = modalEl.querySelector('#doc-title');
  btnCancel = modalEl.querySelector('#doc-cancel');
  btnCancel.addEventListener('click', closeDoc);
  window.addEventListener('keydown', e => { if (!modalEl.classList.contains('hidden') && e.key === 'Escape') closeDoc(); });
}

async function fillStorages(sel, pre) {
  const res = await fetch('/api/storages'); if (!res.ok) return;
  const data = await res.json(); // ожидается [{ID,Name}]
  sel.innerHTML = data.map(s => `<option value="${s.ID}">${s.Name}</option>`).join('');
  if (pre) sel.value = pre;
}
async function fillComponents(sel, pre) {
  const res = await fetch('/api/tmc'); if (!res.ok) return;
  const data = await res.json(); // ожидается [{ID,Name}]
  sel.innerHTML = data.map(c => `<option value="${c.ID}">${c.Name}</option>`).join('');
  if (pre) sel.value = pre;
}

export function openDoc(type, preset = {}, onSuccess) {
  ensureModal();
  const def = DOCS[type]; if (!def) return console.error('Unknown doc type', type);

  titleEl.textContent = def.title;
  formEl.innerHTML = def.tpl(preset);

  const storSel = formEl.querySelector('#doc-storage');
  const compSel = formEl.querySelector('#doc-component');
  if (storSel) fillStorages(storSel, preset.storageId);
  if (compSel) fillComponents(compSel, preset.componentId);

  formEl.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(formEl);
    const data = Object.fromEntries(fd.entries());
    data.quantity = parseInt(data.quantity || '0', 10);
    if (!data.storageId || !data.componentId || data.quantity <= 0) return alert('Заполните поля');

    const r = await def.submit(data);
    if (!r.ok) return alert('Ошибка проведения');
    closeDoc();
    onSuccess && onSuccess();
    alert('Документ проведён');
  };

  modalEl.classList.remove('hidden');
  modalEl.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
}

function closeDoc() {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
  modalEl.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
  formEl?.reset();
  formEl.innerHTML = '';
}
