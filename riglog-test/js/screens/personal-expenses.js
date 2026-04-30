import { getPExpenses, addPExpense, deletePExpense, updatePExpense, fmtMoney, fmtDate, today } from '../store.js';
import { openModal, closeModal, confirmSheet, toast } from '../modal.js';

let _filter = 'month';
const CATS = ['Insurance','Registration','Repair','Tires','Oil Change','Parking','Toll','Wash/Detail','Other'];
const CAT_ICONS = { Insurance:'🛡️', Registration:'📋', Repair:'🔧', Tires:'⚫', 'Oil Change':'🛢', Parking:'🅿️', Toll:'🛣️', 'Wash/Detail':'✨', Other:'📦' };

function expForm(existing=null) {
  const e = existing || {};
  return `
    <div class="p-5">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-xl font-black">${existing ? 'Edit Expense' : 'Add Expense'}</h2>
        <button onclick="closeModal()" class="text-gray-400 text-2xl leading-none">&times;</button>
      </div>
      <form id="p-exp-form" class="space-y-4">
        <div>
          <label class="text-xs text-gray-400 block mb-1">Category</label>
          <select name="category" class="form-input" required>
            ${CATS.map(c => `<option value="${c}"${e.category===c?' selected':''}>${CAT_ICONS[c]} ${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Amount ($)</label>
          <input type="number" name="amount" class="form-input" placeholder="0.00" step="0.01" min="0" value="${e.amount||''}" required>
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Description</label>
          <input type="text" name="description" class="form-input" placeholder="Optional details" value="${e.description||''}">
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Date</label>
          <input type="date" name="date" class="form-input" value="${e.date||today()}" required>
        </div>
        <button type="submit" class="btn-primary" style="background:linear-gradient(135deg,#7c3aed,#6d28d9)">${existing ? 'Save Changes' : 'Add Expense'}</button>
        <button type="button" onclick="closeModal()" class="btn-ghost">Cancel</button>
      </form>
    </div>`;
}

export function renderPersonalExpenses() {
  const all  = getPExpenses();
  const now  = new Date();
  const ms   = now.toISOString().slice(0,7) + '-01';
  const lms  = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,7) + '-01';

  const display = _filter === 'month' ? all.filter(e => e.date >= ms)
    : _filter === 'last' ? all.filter(e => e.date >= lms && e.date < ms)
    : all;

  const monthTotal   = all.filter(e => e.date >= ms).reduce((s,e) => s + Number(e.amount||0), 0);
  const displayTotal = display.reduce((s,e) => s + Number(e.amount||0), 0);

  const html = `
    <div class="flex flex-col h-full text-white" style="background:rgb(4,10,18)">
      <div style="padding:16px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;align-items:center" class="shrink-0">
        <div>
          <h1 class="text-2xl font-black">Expenses</h1>
          <p class="text-xs" style="color:rgba(100,116,139,0.8)">This month: ${fmtMoney(monthTotal,2)}</p>
        </div>
        <button id="add-p-exp-btn" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <div class="flex gap-2 px-4 pt-3 pb-2 shrink-0">
        <button class="filter-pill ${_filter==='month'?'active':''}" data-filter="month">This Month</button>
        <button class="filter-pill ${_filter==='last'?'active':''}" data-filter="last">Last Month</button>
        <button class="filter-pill ${_filter==='all'?'active':''}" data-filter="all">All Time</button>
        ${display.length>0&&_filter!=='month'?`<span style="margin-left:auto;font-size:0.75rem;font-weight:800;color:#c4b5fd;align-self:center">${fmtMoney(displayTotal,2)}</span>`:''}
      </div>
      <div class="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5">
        ${display.length===0 ? `
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <div class="text-5xl mb-4">💳</div>
            <p style="color:rgba(148,163,184,0.8)">${all.length===0 ? 'No expenses yet.' : 'No expenses this period.'}</p>
          </div>
        ` : display.map(e => `
          <div class="glass-card" style="padding:14px;margin-bottom:0" data-id="${e.id}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div style="display:flex;gap:10px;align-items:flex-start;min-width:0;flex:1">
                <span style="font-size:1.4rem;flex-shrink:0">${CAT_ICONS[e.category]||'📦'}</span>
                <div class="min-w-0">
                  <p style="font-weight:800;font-size:0.9rem;color:#e0f2fe">${e.category}</p>
                  <p style="font-size:0.72rem;color:rgba(100,116,139,0.8);margin-top:2px">${fmtDate(e.date)}${e.description?` · ${e.description}`:''}</p>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:8px">
                <span style="font-weight:900;color:#c4b5fd">${fmtMoney(e.amount,2)}</span>
                <button class="edit-p-exp" data-id="${e.id}" style="color:rgba(100,116,139,0.6);padding:4px">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="del-p-exp" data-id="${e.id}" style="color:rgba(100,116,139,0.5);padding:4px">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            </div>
          </div>`).join('')}
        <div style="height:8px"></div>
      </div>
    </div>`;

  function mount(container) {
    container.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => { _filter = btn.dataset.filter; window.refresh(); });
    });
    function openForm(existing=null) {
      openModal(expForm(existing), el => {
        el.querySelector('#p-exp-form').addEventListener('submit', ev => {
          ev.preventDefault();
          const fd = new FormData(ev.target);
          const data = { category: fd.get('category'), amount: parseFloat(fd.get('amount')), description: fd.get('description').trim(), date: fd.get('date') };
          if (existing) updatePExpense(existing.id, data); else addPExpense(data);
          closeModal(); toast(existing ? 'Updated ✓' : 'Added ✓'); window.refresh();
        });
      });
    }
    container.querySelector('#add-p-exp-btn').addEventListener('click', () => openForm());
    container.querySelectorAll('.edit-p-exp').forEach(btn => {
      btn.addEventListener('click', () => { const e = getPExpenses().find(e => e.id===btn.dataset.id); if(e) openForm(e); });
    });
    container.querySelectorAll('.del-p-exp').forEach(btn => {
      btn.addEventListener('click', () => { confirmSheet('Delete expense?','','Delete',() => { deletePExpense(btn.dataset.id); toast('Deleted','info'); window.refresh(); }); });
    });
  }
  return { html, mount };
}
