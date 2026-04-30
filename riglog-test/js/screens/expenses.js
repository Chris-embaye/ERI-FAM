import { getExpenses, addExpense, deleteExpense, updateExpense, fmtMoney, fmtDate, today } from '../store.js';
import { openModal, closeModal, confirmSheet, toast } from '../modal.js';
import { resizeImage, scanReceipt } from '../receipt-scanner.js';

let _filter = 'month';

const CATEGORIES = ['Fuel', 'Repair', 'Toll', 'Lodging', 'Food', 'Parking', 'Scale', 'Insurance', 'Other'];
const CAT_ICONS  = {
  Fuel: '⛽', Repair: '🔧', Toll: '🛣️', Lodging: '🏨',
  Food: '🍔', Parking: '🅿️', Scale: '⚖️', Insurance: '🛡️', Other: '📋',
};

// ── Scan results card ─────────────────────────────────────────────────────────

function renderExpenseScanResults(r) {
  if (!r._found) return `
    <p class="text-xs" style="color:rgba(148,163,184,0.5)">
      Couldn't read the receipt clearly — fill the fields below manually.
    </p>`;
  const fmtDate2 = v => new Date(v + 'T12:00').toLocaleDateString('en-US', { month:'short', day:'numeric' });
  const rows = [
    { label: 'Merchant',  display: r.merchant },
    { label: 'Category',  display: r.category ? `${CAT_ICONS[r.category] || ''} ${r.category}` : null },
    { label: 'Amount',    display: r.amount != null ? '$' + r.amount.toFixed(2) : null },
    { label: 'Date',      display: r.date   != null ? fmtDate2(r.date)          : null },
  ];
  return `
    <p class="text-xs font-bold mb-2" style="color:#4ade80">
      ✓ ${r._found} field${r._found !== 1 ? 's' : ''} filled from receipt
    </p>
    <div>
      ${rows.map(row => `
        <div class="flex justify-between text-xs py-1.5" style="border-bottom:1px solid rgba(255,255,255,0.06)">
          <span style="color:rgba(148,163,184,0.7)">${row.label}</span>
          <span style="font-weight:${row.display ? 700 : 400};color:${row.display ? '#4ade80' : 'rgba(100,116,139,0.5)'}">
            ${row.display || '—'}
          </span>
        </div>
      `).join('')}
    </div>`;
}

// ── Form HTML ─────────────────────────────────────────────────────────────────

function expenseForm(existing = null) {
  const e = existing || {};
  return `
    <div class="p-5">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-xl font-black">${existing ? 'Edit Expense' : 'Add Expense'}</h2>
        <button onclick="closeModal()" class="text-gray-400 text-2xl leading-none">&times;</button>
      </div>
      <form id="expense-form" class="space-y-4">

        <!-- Receipt scanner -->
        <div>
          <label class="text-xs text-gray-400 block mb-1.5">Receipt</label>
          <div id="receipt-preview-wrap" class="${existing?.receiptPhoto ? '' : 'hidden'} mb-2 relative rounded-xl overflow-hidden"
               style="background:#0d1117">
            <img id="receipt-preview" src="${existing?.receiptPhoto || ''}"
                 class="w-full" style="max-height:210px;object-fit:contain" alt="Receipt">
            <button type="button" id="receipt-clear"
              class="absolute top-2 right-2 bg-black/80 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-base leading-none">&times;</button>
            <div id="scan-overlay" class="hidden absolute inset-0 flex flex-col items-center justify-center"
                 style="background:rgba(0,0,0,0.82)">
              <div class="text-3xl animate-pulse">📡</div>
              <p class="text-sm font-bold mt-2" style="color:#67e8f9">Scanning receipt…</p>
              <p class="text-xs mt-1" style="color:rgba(103,232,249,0.5)">This takes a few seconds</p>
            </div>
          </div>
          <label id="receipt-capture-label" class="receipt-cap-label" for="receipt-file-input">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Scan Receipt
          </label>
          <input type="file" id="receipt-file-input" accept="image/*" class="hidden">
          <input type="hidden" id="receipt-photo-data" name="receiptPhoto" value="${existing?.receiptPhoto || ''}">
          <div id="scan-results" class="hidden mt-2 rounded-xl p-3"
               style="background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.2)"></div>
        </div>

        <div>
          <label class="text-xs text-gray-400 block mb-1">Category</label>
          <select name="category" id="expense-category" class="form-input" required>
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

// ── Scanner wiring ────────────────────────────────────────────────────────────

function wireReceiptScanner(el) {
  const fileInput   = el.querySelector('#receipt-file-input');
  const previewWrap = el.querySelector('#receipt-preview-wrap');
  const previewImg  = el.querySelector('#receipt-preview');
  const photoData   = el.querySelector('#receipt-photo-data');
  const overlay     = el.querySelector('#scan-overlay');
  const results     = el.querySelector('#scan-results');
  const scanLabel   = el.querySelector('#receipt-capture-label');
  const clearBtn    = el.querySelector('#receipt-clear');
  const amountEl    = el.querySelector('#expense-amount');
  const dateEl      = el.querySelector('#expense-date');
  const catEl       = el.querySelector('#expense-category');
  const descEl      = el.querySelector('[name="description"]');

  const RETAKE_SVG = `
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg> Retake Photo`;
  const SCAN_SVG = `
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg> Scan Receipt`;

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const base64 = await resizeImage(file);
    photoData.value = base64;
    previewImg.src  = base64;
    previewWrap.classList.remove('hidden');
    scanLabel.innerHTML = RETAKE_SVG;
    overlay.classList.remove('hidden');
    results.classList.add('hidden');

    const r = await scanReceipt(base64, 'expense');
    overlay.classList.add('hidden');

    // Auto-fill detected fields — don't overwrite if user already typed
    if (r.amount   && !amountEl.value) amountEl.value = r.amount.toFixed(2);
    if (r.date)                         dateEl.value   = r.date;
    if (r.category && catEl)            catEl.value    = r.category;
    if (r.merchant && descEl && !descEl.value) descEl.value = r.merchant;

    results.innerHTML = renderExpenseScanResults(r);
    results.classList.remove('hidden');
  });

  clearBtn?.addEventListener('click', () => {
    photoData.value = '';
    previewImg.src  = '';
    previewWrap.classList.add('hidden');
    fileInput.value = '';
    results.classList.add('hidden');
    scanLabel.innerHTML = SCAN_SVG;
  });
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

  const expenses     = _filter === 'month' ? monthExp
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
          <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 flex justify-between items-start" data-id="${e.id}">
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

  function mount(container) {
    container.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => { _filter = btn.dataset.filter; window.refresh(); });
    });

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
        wireReceiptScanner(el);
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
          wireReceiptScanner(el);
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
