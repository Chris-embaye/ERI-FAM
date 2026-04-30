import { getExpenses, addExpense, deleteExpense, updateExpense, fmtMoney, fmtDate, today } from '../store.js';
import { openModal, closeModal, confirmSheet, toast } from '../modal.js';

let _filter = 'month';

const CATEGORIES = ['Fuel', 'Repair', 'Toll', 'Lodging', 'Food', 'Parking', 'Scale', 'Insurance', 'Other'];

const CAT_ICONS = {
  Fuel: '⛽', Repair: '🔧', Toll: '🛣️', Lodging: '🏨',
  Food: '🍔', Parking: '🅿️', Scale: '⚖️', Insurance: '🛡️', Other: '📋',
};

// ── Receipt image helpers ─────────────────────────────────────────────────────

function resizeImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const maxW = 400;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.55));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Form builder ──────────────────────────────────────────────────────────────

function expenseForm(existing = null) {
  const e = existing || {};
  return `
    <div class="p-5">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-xl font-black">${existing ? 'Edit Expense' : 'Add Expense'}</h2>
        <button onclick="closeModal()" class="text-gray-400 text-2xl leading-none">&times;</button>
      </div>
      <form id="expense-form" class="space-y-4">

        <!-- Receipt camera capture -->
        <div>
          <label class="text-xs text-gray-400 block mb-1.5">Receipt Photo</label>
          ${existing?.receiptPhoto ? `
            <div id="receipt-preview-wrap" class="mb-2 relative">
              <img id="receipt-preview" src="${existing.receiptPhoto}" class="receipt-preview" alt="Receipt">
              <button type="button" id="receipt-clear" class="absolute top-2 right-2 bg-black/70 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-base leading-none">&times;</button>
            </div>
          ` : `
            <div id="receipt-preview-wrap" class="hidden mb-2 relative">
              <img id="receipt-preview" src="" class="receipt-preview" alt="Receipt">
              <button type="button" id="receipt-clear" class="absolute top-2 right-2 bg-black/70 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-base leading-none">&times;</button>
            </div>
          `}
          <label id="receipt-capture-label" class="receipt-cap-label" for="receipt-file-input">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Snap Receipt Photo
          </label>
          <input type="file" id="receipt-file-input" accept="image/*" capture="environment" class="hidden">
          <input type="hidden" id="receipt-photo-data" name="receiptPhoto" value="${existing?.receiptPhoto || ''}">
        </div>

        <div>
          <label class="text-xs text-gray-400 block mb-1">Category</label>
          <select name="category" class="form-input" required>
            ${CATEGORIES.map(c => `<option value="${c}" ${e.category === c ? 'selected' : ''}>${CAT_ICONS[c]} ${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Amount ($)</label>
          <input type="number" id="expense-amount" name="amount" step="0.01" min="0" placeholder="0.00"
            class="form-input" value="${e.amount || ''}" required>
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Description</label>
          <input type="text" name="description" placeholder="e.g. Petro truck stop, I-95"
            class="form-input" value="${e.description || ''}">
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Date</label>
          <input type="date" id="expense-date" name="date" class="form-input" value="${e.date || today()}" required>
        </div>
        <button type="submit" class="btn-primary mt-2">${existing ? 'Save Changes' : 'Add Expense'}</button>
        <button type="button" onclick="closeModal()" class="btn-ghost">Cancel</button>
      </form>
    </div>`;
}

// ── Main render ───────────────────────────────────────────────────────────────

export function renderExpenses() {
  const allExpenses = getExpenses();

  const now            = new Date();
  const thisMonth      = now.toISOString().slice(0, 7);
  const thisMonthStart = thisMonth + '-01';
  const lastMonthDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStart = lastMonthDate.toISOString().slice(0, 7) + '-01';
  const lastMonthEnd   = thisMonthStart;

  const monthExp   = allExpenses.filter(e => e.date?.startsWith(thisMonth));
  const monthTotal = monthExp.reduce((s, e) => s + Number(e.amount || 0), 0);

  const expenses = _filter === 'month' ? monthExp
    : _filter === 'last'  ? allExpenses.filter(e => e.date >= lastMonthStart && e.date < lastMonthEnd)
    : allExpenses;

  const displayTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const html = `
    <div class="flex flex-col h-full bg-black text-white">
      <div class="px-4 pt-5 pb-4 border-b border-gray-800 flex justify-between items-center shrink-0">
        <div>
          <h1 class="text-2xl font-black">Expenses</h1>
          <p class="text-xs text-gray-500">This month: ${fmtMoney(monthTotal, 2)}</p>
        </div>
        <button id="add-expense-btn" class="bg-orange-600 text-black rounded-full p-2.5">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <!-- Filter pills -->
      <div class="flex gap-2 px-4 pt-3 pb-2 shrink-0">
        <button class="filter-pill ${_filter === 'month' ? 'active' : ''}" data-filter="month">This Month</button>
        <button class="filter-pill ${_filter === 'last'  ? 'active' : ''}" data-filter="last">Last Month</button>
        <button class="filter-pill ${_filter === 'all'   ? 'active' : ''}" data-filter="all">All Time</button>
        ${_filter !== 'month' && displayTotal > 0 ? `<span class="ml-auto text-xs font-black text-orange-500 self-center">${fmtMoney(displayTotal, 2)}</span>` : ''}
      </div>

      <div class="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5">
        ${expenses.length === 0 ? `
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <div class="text-5xl mb-4">💸</div>
            <p class="text-gray-400">${allExpenses.length === 0 ? 'No expenses yet.' : 'No expenses this period.'}</p>
            <p class="text-gray-600 text-sm mt-1">${allExpenses.length === 0 ? 'Tap + to log your first one.' : 'Switch to All Time or add a new expense.'}</p>
          </div>
        ` : expenses.map(e => `
          <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 flex justify-between items-start"
               data-id="${e.id}">
            <div class="flex items-start gap-3 min-w-0">
              <span class="text-2xl mt-0.5">${CAT_ICONS[e.category] || '📋'}</span>
              <div class="min-w-0">
                <p class="font-bold text-sm">${e.category}</p>
                ${e.description ? `<p class="text-xs text-gray-400 truncate">${e.description}</p>` : ''}
                <p class="text-xs text-gray-600 mt-0.5">${fmtDate(e.date)}</p>
              </div>
            </div>
            <div class="flex items-start gap-2 shrink-0 ml-2">
              ${e.receiptPhoto ? `<img src="${e.receiptPhoto}" class="receipt-thumb" alt="Receipt" onclick="window._viewReceipt('${e.id}')">` : ''}
              <span class="font-black text-base">${fmtMoney(e.amount, 2)}</span>
              <div class="flex flex-col gap-1">
                <button class="edit-expense-btn text-gray-500 hover:text-white p-1" data-id="${e.id}">
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="del-expense-btn text-gray-600 hover:text-red-500 p-1" data-id="${e.id}">
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                </button>
              </div>
            </div>
          </div>
        `).join('')}
        <div style="height:8px"></div>
      </div>
    </div>`;

  function wireReceiptCapture(el) {
    const fileInput    = el.querySelector('#receipt-file-input');
    const previewWrap  = el.querySelector('#receipt-preview-wrap');
    const previewImg   = el.querySelector('#receipt-preview');
    const photoData    = el.querySelector('#receipt-photo-data');
    const captureLabel = el.querySelector('#receipt-capture-label');

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      const base64 = await resizeImage(file);
      photoData.value = base64;
      previewImg.src  = base64;
      previewWrap.classList.remove('hidden');
      captureLabel.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        Retake Photo`;
    });

    el.querySelector('#receipt-clear').addEventListener('click', () => {
      photoData.value = '';
      previewImg.src  = '';
      previewWrap.classList.add('hidden');
      fileInput.value = '';
      captureLabel.innerHTML = `
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        Snap Receipt Photo`;
    });
  }

  function mount(container) {
    container.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        _filter = btn.dataset.filter;
        window.refresh();
      });
    });

    // View full receipt
    window._viewReceipt = (id) => {
      const exp = getExpenses().find(e => e.id === id);
      if (!exp?.receiptPhoto) return;
      openModal(`
        <div class="p-4">
          <div class="flex justify-between items-center mb-3">
            <p class="font-black">Receipt — ${exp.category}</p>
            <button onclick="closeModal()" class="text-gray-400 text-2xl leading-none">&times;</button>
          </div>
          <img src="${exp.receiptPhoto}" class="w-full rounded-xl" alt="Receipt">
          <p class="text-xs text-gray-500 mt-2 text-center">${fmtDate(exp.date)} · ${fmtMoney(exp.amount, 2)}</p>
        </div>`, () => {});
    };

    container.querySelector('#add-expense-btn').addEventListener('click', () => {
      openModal(expenseForm(), el => {
        wireReceiptCapture(el);
        el.querySelector('#expense-form').addEventListener('submit', ev => {
          ev.preventDefault();
          const fd = new FormData(ev.target);
          addExpense({
            category:     fd.get('category'),
            amount:       parseFloat(fd.get('amount')),
            description:  fd.get('description').trim(),
            date:         fd.get('date'),
            receiptPhoto: fd.get('receiptPhoto') || null,
          });
          closeModal();
          toast('Expense added ✓');
          window.refresh();
        });
      });
    });

    container.querySelectorAll('.del-expense-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        confirmSheet('Delete this expense?', 'This cannot be undone.', 'Delete', () => {
          deleteExpense(btn.dataset.id);
          toast('Expense deleted', 'info');
          window.refresh();
        });
      });
    });

    container.querySelectorAll('.edit-expense-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const existing = getExpenses().find(e => e.id === btn.dataset.id);
        if (!existing) return;
        openModal(expenseForm(existing), el => {
          wireReceiptCapture(el);
          el.querySelector('#expense-form').addEventListener('submit', ev => {
            ev.preventDefault();
            const fd = new FormData(ev.target);
            updateExpense(existing.id, {
              category:     fd.get('category'),
              amount:       parseFloat(fd.get('amount')),
              description:  fd.get('description').trim(),
              date:         fd.get('date'),
              receiptPhoto: fd.get('receiptPhoto') || null,
            });
            closeModal();
            toast('Expense updated ✓');
            window.refresh();
          });
        });
      });
    });
  }

  return { html, mount };
}
