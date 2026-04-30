import { getPFuelLogs, addPFuelLog, deletePFuelLog, updatePFuelLog, getPSettings, fmtMoney, fmtDate, today } from '../store.js';
import { openModal, closeModal, confirmSheet, toast } from '../modal.js';

let _filter = 'month';

function fuelForm(existing = null) {
  const f = existing || {};
  return `
    <div class="p-5">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-xl font-black">${existing ? 'Edit Fill-Up' : 'Log Fill-Up'}</h2>
        <button onclick="closeModal()" class="text-gray-400 text-2xl leading-none">&times;</button>
      </div>
      <form id="p-fuel-form" class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-400 block mb-1">Gallons</label>
            <input type="number" name="gallons" id="pf-gallons" class="form-input" placeholder="12.5" step="0.01" min="0" value="${f.gallons || ''}" required>
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">Price / Gallon ($)</label>
            <input type="number" name="pricePerGallon" id="pf-ppg" class="form-input" placeholder="3.59" step="0.001" min="0" value="${f.pricePerGallon || ''}">
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Total Cost ($)</label>
          <input type="number" name="totalCost" id="pf-total" class="form-input" placeholder="auto-calculated" step="0.01" min="0" value="${f.totalCost || ''}">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-400 block mb-1">Miles Since Last Fill</label>
            <input type="number" name="miles" id="pf-miles" class="form-input" placeholder="320" step="1" min="0" value="${f.miles || ''}">
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">Odometer</label>
            <input type="number" name="odometer" class="form-input" placeholder="45200" step="1" min="0" value="${f.odometer || ''}">
          </div>
        </div>
        <div id="pf-mpg-preview" style="display:none;text-align:center;padding:10px;background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.25);border-radius:12px">
          <p style="font-size:0.72rem;color:rgba(148,163,184,0.7)">This fill-up</p>
          <p id="pf-mpg-val" style="font-size:1.5rem;font-weight:900;color:#c4b5fd">— MPG</p>
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Station</label>
          <input type="text" name="station" class="form-input" placeholder="e.g. Shell, Costco" value="${f.station || ''}">
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Date</label>
          <input type="date" name="date" class="form-input" value="${f.date || today()}" required>
        </div>
        <button type="submit" class="btn-primary" style="background:linear-gradient(135deg,#7c3aed,#6d28d9)">${existing ? 'Save Changes' : 'Save Fill-Up'}</button>
        <button type="button" onclick="closeModal()" class="btn-ghost">Cancel</button>
      </form>
    </div>`;
}

export function renderPersonalFuel() {
  const allLogs = getPFuelLogs();
  const s       = getPSettings();
  const now     = new Date();
  const ms      = now.toISOString().slice(0,7) + '-01';
  const lms     = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,7) + '-01';

  const display = _filter === 'month' ? allLogs.filter(f => f.date >= ms)
    : _filter === 'last' ? allLogs.filter(f => f.date >= lms && f.date < ms)
    : allLogs;

  const totalCost = display.reduce((s, f) => s + Number(f.totalCost || 0), 0);
  const totalGal  = display.reduce((s, f) => s + Number(f.gallons || 0), 0);

  // All-time avg MPG
  const withMiles = allLogs.filter(f => f.miles && f.gallons);
  const avgMPG    = withMiles.length > 0
    ? (withMiles.reduce((s, f) => s + Number(f.miles)/Number(f.gallons), 0) / withMiles.length).toFixed(1)
    : null;

  const html = `
    <div class="flex flex-col h-full text-white" style="background:rgb(4,10,18)">
      <div style="padding:16px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;align-items:center" class="shrink-0">
        <div>
          <h1 class="text-2xl font-black">Fuel</h1>
          <p class="text-xs" style="color:rgba(100,116,139,0.8)">Avg MPG: ${avgMPG || '—'} · target ${s.targetMPG || 30}</p>
        </div>
        <button id="add-p-fuel-btn" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <div class="flex gap-2 px-4 pt-3 pb-2 shrink-0">
        <button class="filter-pill ${_filter==='month'?'active':''}" data-filter="month" style="--pill-active-bg:linear-gradient(135deg,#7c3aed,#6d28d9)">This Month</button>
        <button class="filter-pill ${_filter==='last'?'active':''}" data-filter="last">Last Month</button>
        <button class="filter-pill ${_filter==='all'?'active':''}" data-filter="all">All Time</button>
        ${display.length > 0 ? `<span style="margin-left:auto;font-size:0.75rem;font-weight:800;color:#c4b5fd;align-self:center">${fmtMoney(totalCost,2)} · ${totalGal.toFixed(1)} gal</span>` : ''}
      </div>
      <div class="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5">
        ${display.length === 0 ? `
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <div class="text-5xl mb-4">⛽</div>
            <p style="color:rgba(148,163,184,0.8)">${allLogs.length===0 ? 'No fill-ups yet. Tap + to start tracking.' : 'No fill-ups this period.'}</p>
          </div>
        ` : display.map(f => {
          const mpg = (f.miles && f.gallons) ? (Number(f.miles)/Number(f.gallons)).toFixed(1) : null;
          const mpgColor = mpg ? (parseFloat(mpg) >= (s.targetMPG||30) ? '#4ade80' : parseFloat(mpg) >= (s.targetMPG||30)*0.85 ? '#fbbf24' : '#f87171') : 'rgba(148,163,184,0.7)';
          return `
          <div class="glass-card" style="padding:14px;margin-bottom:0" data-id="${f.id}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
                  <span style="font-size:1.3rem">⛽</span>
                  <span style="font-weight:800;font-size:0.95rem;color:#e0f2fe">${Number(f.gallons||0).toFixed(3)} gal</span>
                  ${mpg ? `<span style="font-size:0.75rem;font-weight:800;padding:2px 7px;border-radius:8px;background:rgba(124,58,237,0.15);color:${mpgColor}">${mpg} MPG</span>` : ''}
                </div>
                <p style="font-size:0.72rem;color:rgba(100,116,139,0.8)">${fmtDate(f.date)}${f.station ? ` · ${f.station}` : ''}${f.pricePerGallon ? ` · $${Number(f.pricePerGallon).toFixed(3)}/gal` : ''}${f.miles ? ` · ${Number(f.miles).toLocaleString()} mi` : ''}</p>
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:8px">
                <span style="font-weight:900;color:#c4b5fd">${fmtMoney(f.totalCost,2)}</span>
                <button class="edit-p-fuel" data-id="${f.id}" style="color:rgba(100,116,139,0.6);padding:4px">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="del-p-fuel" data-id="${f.id}" style="color:rgba(100,116,139,0.5);padding:4px">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            </div>
          </div>`;
        }).join('')}
        <div style="height:8px"></div>
      </div>
    </div>`;

  function mount(container) {
    container.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => { _filter = btn.dataset.filter; window.refresh(); });
    });
    function wireCalc(el) {
      const galEl   = el.querySelector('#pf-gallons');
      const ppgEl   = el.querySelector('#pf-ppg');
      const totEl   = el.querySelector('#pf-total');
      const milesEl = el.querySelector('#pf-miles');
      const preview = el.querySelector('#pf-mpg-preview');
      const mpgVal  = el.querySelector('#pf-mpg-val');
      function recalc() {
        const g = parseFloat(galEl.value) || 0;
        const p = parseFloat(ppgEl.value) || 0;
        if (g && p && !totEl.value) totEl.value = (g * p).toFixed(2);
        const m = parseFloat(milesEl.value) || 0;
        if (g && m) { preview.style.display='block'; mpgVal.textContent = (m/g).toFixed(1) + ' MPG'; }
        else { preview.style.display='none'; }
      }
      [galEl, ppgEl, milesEl].forEach(el => el?.addEventListener('input', recalc));
      totEl?.addEventListener('input', () => {
        const g = parseFloat(galEl.value), tot = parseFloat(totEl.value);
        if (g && tot && !ppgEl.value) ppgEl.value = (tot/g).toFixed(3);
      });
    }
    function openForm(existing=null) {
      openModal(fuelForm(existing), el => {
        wireCalc(el);
        el.querySelector('#p-fuel-form').addEventListener('submit', ev => {
          ev.preventDefault();
          const fd = new FormData(ev.target);
          const data = {
            gallons: parseFloat(fd.get('gallons')) || 0,
            pricePerGallon: parseFloat(fd.get('pricePerGallon')) || null,
            totalCost: parseFloat(fd.get('totalCost')) || 0,
            miles: parseFloat(fd.get('miles')) || null,
            odometer: parseFloat(fd.get('odometer')) || null,
            station: fd.get('station').trim(),
            date: fd.get('date'),
          };
          if (existing) updatePFuelLog(existing.id, data); else addPFuelLog(data);
          closeModal(); toast(existing ? 'Fill-up updated ✓' : 'Fill-up saved ✓'); window.refresh();
        });
      });
    }
    container.querySelector('#add-p-fuel-btn').addEventListener('click', () => openForm());
    container.querySelectorAll('.edit-p-fuel').forEach(btn => {
      btn.addEventListener('click', () => { const f = getPFuelLogs().find(f => f.id===btn.dataset.id); if(f) openForm(f); });
    });
    container.querySelectorAll('.del-p-fuel').forEach(btn => {
      btn.addEventListener('click', () => { confirmSheet('Delete fill-up?','','Delete',() => { deletePFuelLog(btn.dataset.id); toast('Deleted','info'); window.refresh(); }); });
    });
  }
  return { html, mount };
}
