import { getMaintenanceLogs, addMaintenanceLog, deleteMaintenanceLog, updateMaintenanceLog, fmtDate, fmtMoney, today, getTrips } from '../store.js';
import { openModal, closeModal, confirmSheet, toast } from '../modal.js';

const MAINT_TYPES = [
  'Oil Change', 'Tire Rotation / Replacement', 'DOT Inspection', 'Brake Service',
  'Air Filter', 'Coolant Flush', 'Transmission Service', 'Registration / Permits',
  'Trailer Service', 'Wheel Alignment', 'Clutch / Driveshaft', 'Other',
];

const DEFAULT_INTERVALS = {
  'Oil Change': 15000,
  'Tire Rotation / Replacement': 25000,
  'DOT Inspection': 100000,
  'Brake Service': 50000,
  'Air Filter': 30000,
  'Coolant Flush': 60000,
  'Transmission Service': 50000,
};

function estimateOdometer() {
  return getTrips().reduce((s, t) => s + Number(t.miles || 0), 0);
}

function maintForm(existing = null) {
  const m = existing || {};
  return `
    <div class="p-5">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-xl font-black">${existing ? 'Edit Service' : 'Log Service'}</h2>
        <button onclick="closeModal()" class="text-gray-400 text-2xl leading-none">&times;</button>
      </div>
      <form id="maint-form" class="space-y-4">
        <div>
          <label class="text-xs text-gray-400 block mb-1">Service Type</label>
          <select name="type" class="form-input" id="maint-type-sel">
            ${MAINT_TYPES.map(t => `<option value="${t}"${m.type === t ? ' selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-400 block mb-1">Odometer (miles)</label>
            <input type="number" name="odometer" step="1" min="0" placeholder="125000"
              class="form-input" value="${m.odometer || ''}">
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">Cost ($)</label>
            <input type="number" name="cost" step="0.01" min="0" placeholder="0.00"
              class="form-input" value="${m.cost || ''}">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-400 block mb-1">Date</label>
            <input type="date" name="date" class="form-input" value="${m.date || today()}">
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">Next Due (odometer miles)</label>
            <input type="number" id="maint-next-due" name="nextDueMiles" step="500" min="0" placeholder="Auto-fill"
              class="form-input" value="${m.nextDueMiles || ''}">
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Notes</label>
          <textarea name="notes" rows="2" class="form-input resize-none"
            placeholder="Shop name, parts replaced…">${m.notes || ''}</textarea>
        </div>
        <button type="submit" class="btn-primary">${existing ? 'Save Changes' : 'Log Service'}</button>
        <button type="button" onclick="closeModal()" class="btn-ghost">Cancel</button>
      </form>
    </div>`;
}

export function renderMaintenance() {
  const logs   = getMaintenanceLogs();
  const estOdo = estimateOdometer();

  const upcoming = logs
    .filter(l => l.nextDueMiles && estOdo > 0)
    .map(l => ({ ...l, milesLeft: Number(l.nextDueMiles) - estOdo }))
    .filter(l => l.milesLeft < 5000)
    .sort((a, b) => a.milesLeft - b.milesLeft);

  const ytdMaintCost = logs
    .filter(l => l.date >= `${new Date().getFullYear()}-01-01` && l.cost)
    .reduce((s, l) => s + Number(l.cost), 0);

  const html = `
    <div class="flex flex-col h-full bg-black text-white">
      <div class="px-4 pt-5 pb-4 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <button onclick="navigate('more')" class="text-gray-400">
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 class="text-2xl font-black">Maintenance</h1>
            <p class="text-xs text-gray-500">${estOdo > 0 ? `Est. ${estOdo.toLocaleString()} mi total` : 'Log trips to track odometer'}${ytdMaintCost > 0 ? ` · ${fmtMoney(ytdMaintCost)} YTD` : ''}</p>
          </div>
        </div>
        <button id="add-maint-btn" class="bg-orange-600 text-black rounded-full p-2.5">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">

        ${upcoming.length > 0 ? `
        <div>
          <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Upcoming / Overdue</p>
          <div class="space-y-2">
            ${upcoming.map(l => {
              const overdue = l.milesLeft <= 0;
              const urgent  = l.milesLeft < 1000 && l.milesLeft > 0;
              const cls     = overdue ? 'border-red-600 bg-red-600/10' : urgent ? 'border-orange-500 bg-orange-600/10' : 'border-yellow-600/50 bg-yellow-600/5';
              const badge   = overdue
                ? `<span class="text-xs font-black text-red-400">OVERDUE ${Math.abs(l.milesLeft).toLocaleString()} mi</span>`
                : `<span class="text-xs font-bold text-yellow-400">${l.milesLeft.toLocaleString()} mi left</span>`;
              return `
              <div class="border rounded-xl p-3 ${cls}">
                <div class="flex justify-between items-center">
                  <span class="font-black text-sm">${l.type}</span>
                  ${badge}
                </div>
                <p class="text-xs text-gray-500 mt-0.5">Due at ${Number(l.nextDueMiles).toLocaleString()} mi · Last: ${fmtDate(l.date)}</p>
              </div>`;
            }).join('')}
          </div>
        </div>
        ` : ''}

        ${logs.length === 0 ? `
        <div class="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <div class="text-5xl">🔧</div>
          <p class="font-black text-lg">No service logs yet</p>
          <p class="text-gray-500 text-sm px-8">Track oil changes, DOT inspections, tires, and more. Set next-due mileage for automatic reminders.</p>
        </div>
        ` : `
        <div>
          <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">Service History</p>
          <div class="space-y-2">
            ${logs.map(l => `
            <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div class="flex justify-between items-start">
                <div class="min-w-0 flex-1">
                  <p class="font-black text-sm">${l.type}</p>
                  <p class="text-xs text-gray-500 mt-0.5">
                    ${fmtDate(l.date)}${l.odometer ? ` · ${Number(l.odometer).toLocaleString()} mi` : ''}${l.cost ? ` · ${fmtMoney(l.cost, 2)}` : ''}
                  </p>
                  ${l.notes ? `<p class="text-xs text-gray-600 mt-1 italic">${l.notes}</p>` : ''}
                  ${l.nextDueMiles ? `<p class="text-xs text-gray-600 mt-1">Next due: ${Number(l.nextDueMiles).toLocaleString()} mi</p>` : ''}
                </div>
                <div class="flex items-center gap-2 shrink-0 ml-2">
                  <button class="edit-maint-btn text-gray-500 p-1" data-id="${l.id}">
                    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="del-maint-btn text-gray-600 hover:text-red-500 p-1" data-id="${l.id}">
                    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                  </button>
                </div>
              </div>
            </div>`).join('')}
          </div>
        </div>
        `}

        <div style="height:8px"></div>
      </div>
    </div>`;

  function mount(container) {
    function openForm(existing = null) {
      openModal(maintForm(existing), el => {
        // Auto-fill next due when type changes (only for new logs)
        if (!existing) {
          el.querySelector('#maint-type-sel')?.addEventListener('change', e => {
            const interval = DEFAULT_INTERVALS[e.target.value];
            const odoEl   = el.querySelector('[name=odometer]');
            const nextEl  = el.querySelector('#maint-next-due');
            if (interval && !nextEl.value) {
              const odo = parseInt(odoEl.value) || estOdo;
              if (odo) nextEl.value = odo + interval;
            }
          });
          // Auto-fill on odometer change too
          el.querySelector('[name=odometer]')?.addEventListener('blur', e => {
            const odo      = parseInt(e.target.value);
            const typeEl   = el.querySelector('#maint-type-sel');
            const nextEl   = el.querySelector('#maint-next-due');
            const interval = DEFAULT_INTERVALS[typeEl?.value];
            if (odo && interval && !nextEl.value) nextEl.value = odo + interval;
          });
        }

        el.querySelector('#maint-form').addEventListener('submit', ev => {
          ev.preventDefault();
          const fd = new FormData(ev.target);
          const data = {
            type:         fd.get('type'),
            date:         fd.get('date'),
            odometer:     fd.get('odometer')     ? parseInt(fd.get('odometer'))     : null,
            cost:         fd.get('cost')         ? parseFloat(fd.get('cost'))       : null,
            nextDueMiles: fd.get('nextDueMiles') ? parseInt(fd.get('nextDueMiles')) : null,
            notes:        fd.get('notes').trim(),
          };
          if (existing) {
            updateMaintenanceLog(existing.id, data);
            toast('Service updated ✓');
          } else {
            addMaintenanceLog(data);
            toast('Service logged ✓');
          }
          closeModal();
          window.refresh();
        });
      });
    }

    container.querySelector('#add-maint-btn')?.addEventListener('click', () => openForm());

    container.querySelectorAll('.edit-maint-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const log = getMaintenanceLogs().find(l => l.id === btn.dataset.id);
        if (log) openForm(log);
      });
    });

    container.querySelectorAll('.del-maint-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        confirmSheet('Delete this service record?', 'This cannot be undone.', 'Delete', () => {
          deleteMaintenanceLog(btn.dataset.id);
          toast('Record deleted', 'info');
          window.refresh();
        });
      });
    });
  }

  return { html, mount };
}
