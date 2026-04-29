import { getExpenses, addExpense, deleteExpense, updateExpense, fmtMoney, fmtDate, today } from '../store.js';
import { openModal, closeModal } from '../modal.js';

const CATEGORIES = ['Fuel', 'Repair', 'Toll', 'Lodging', 'Food', 'Parking', 'Scale', 'Insurance', 'Other'];

const CAT_ICONS = {
  Fuel: '⛽', Repair: '🔧', Toll: '🛣️', Lodging: '🏨',
  Food: '🍔', Parking: '🅿️', Scale: '⚖️', Insurance: '🛡️', Other: '📋'
};

function expenseForm(existing = null) {
  const e = existing || {};
  return `
    <div class="p-5">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-xl font-black">${existing ? 'Edit Expense' : 'Add Expense'}</h2>
        <button onclick="closeModal()" class="text-gray-400 text-2xl leading-none">&times;</button>
      </div>
      <form id="expense-form" class="space-y-4">
        <div>
          <label class="text-xs text-gray-400 block mb-1">Category</label>
          <select name="category" class="form-input" required>
            ${CATEGORIES.map(c => `<option value="${c}" ${e.category === c ? 'selected' : ''}>${CAT_ICONS[c]} ${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Amount ($)</label>
          <input type="number" name="amount" step="0.01" min="0" placeholder="0.00"
            class="form-input" value="${e.amount || ''}" required>
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Description</label>
          <input type="text" name="description" placeholder="e.g. Petro truck stop, I-95"
            class="form-input" value="${e.description || ''}">
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Date</label>
          <input type="date" name="date" class="form-input" value="${e.date || today()}" required>
        </div>
        <button type="submit" class="btn-primary mt-2">${existing ? 'Save Changes' : 'Add Expense'}</button>
        <button type="button" onclick="closeModal()" class="btn-ghost">Cancel</button>
      </form>
    </div>`;
}

export function renderExpenses() {
  const expenses = getExpenses();

  // Group totals by category this month
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthExp  = expenses.filter(e => e.date && e.date.startsWith(thisMonth));
  const monthTotal = monthExp.reduce((s, e) => s + Number(e.amount || 0), 0);

  // This week total
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const weekTotal = expenses
    .filter(e => e.date >= weekAgo)
    .reduce((s, e) => s + Number(e.amount || 0), 0);

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

      <!-- Week total banner -->
      ${weekTotal > 0 ? `
      <div class="mx-4 mt-4 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex justify-between items-center">
        <span class="text-sm text-gray-400">This Week</span>
        <span class="font-black text-orange-600">${fmtMoney(weekTotal, 2)}</span>
      </div>` : ''}

      <div class="flex-1 overflow-y-auto p-4 space-y-2.5">
        ${expenses.length === 0 ? `
          <div class="flex flex-col items-center justify-center py-20 text-center">
            <div class="text-5xl mb-4">💸</div>
            <p class="text-gray-400">No expenses yet.</p>
            <p class="text-gray-600 text-sm mt-1">Tap + to log your first one.</p>
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
            <div class="flex items-start gap-3 shrink-0 ml-2">
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
    container.querySelector('#add-expense-btn').addEventListener('click', () => {
      openModal(expenseForm(), el => {
        el.querySelector('#expense-form').addEventListener('submit', ev => {
          ev.preventDefault();
          const fd = new FormData(ev.target);
          addExpense({
            category: fd.get('category'),
            amount: parseFloat(fd.get('amount')),
            description: fd.get('description').trim(),
            date: fd.get('date'),
          });
          closeModal();
          window.refresh();
        });
      });
    });

    container.querySelectorAll('.del-expense-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Delete this expense?')) {
          deleteExpense(btn.dataset.id);
          window.refresh();
        }
      });
    });

    container.querySelectorAll('.edit-expense-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const existing = getExpenses().find(e => e.id === btn.dataset.id);
        if (!existing) return;
        openModal(expenseForm(existing), el => {
          el.querySelector('#expense-form').addEventListener('submit', ev => {
            ev.preventDefault();
            const fd = new FormData(ev.target);
            updateExpense(existing.id, {
              category: fd.get('category'),
              amount: parseFloat(fd.get('amount')),
              description: fd.get('description').trim(),
              date: fd.get('date'),
            });
            closeModal();
            window.refresh();
          });
        });
      });
    });
  }

  return { html, mount };
}
