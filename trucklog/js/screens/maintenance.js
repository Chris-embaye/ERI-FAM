import {
  getMaintenanceLogs, addMaintenanceLog, deleteMaintenanceLog, updateMaintenanceLog,
  getSettings, saveSettings, fmtMoney, fmtDate, today,
} from '../store.js';
import { openModal, closeModal, confirmSheet, toast } from '../modal.js';

const SERVICES = [
  { key: 'oil',      label: 'Oil Change',            interval: 25000,  icon: '🛢',  color: '#f59e0b' },
  { key: 'pm',       label: 'PM (Preventive Maint.)', interval: 30000, icon: '🔧',  color: '#0891b2' },
  { key: 'tires',    label: 'Tires',                  interval: 50000, icon: '⚫',  color: '#6366f1' },
  { key: 'brakes',   label: 'Brakes',                 interval: 60000, icon: '🔴',  color: '#ef4444' },
  { key: 'airfilt',  label: 'Air Filter',              interval: 50000, icon: '💨',  color: '#10b981' },
  { key: 'fuelfilt', label: 'Fuel Filter',             interval: 30000, icon: '⛽',  color: '#22d3ee' },
  { key: 'trans',    label: 'Transmission',            interval:100000, icon: '⚙️', color: '#8b5cf6' },
  { key: 'coolant',  label: 'Coolant Flush',           interval:100000, icon: '🧊',  color: '#06b6d4' },
  { key: 'dot',      label: 'DOT Inspection',          interval: null,  icon: '📋',  color: '#f97316' },
  { key: 'other',    label: 'Other',                   interval: null,  icon: '🔩',  color: '#94a3b8' },
];

function svc(key) { return SERVICES.find(s => s.key === key) || SERVICES.at(-1); }

function dueInfo(log, currentOdo) {
  const s = svc(log.serviceType);
  const interval = log.customInterval || s.interval;
  if (!interval || !log.odometer || !currentOdo) return null;
  const doneAt = Number(log.odometer);
  const nextAt = doneAt + interval;
  const remaining = nextAt - currentOdo;
  return { nextAt, remaining };
}

function serviceForm(existing = null) {
  const m = existing || {};
  const s = getSettings();
  return `
    <div class="p-5">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-xl font-black">${existing ? 'Edit Service' : 'Log Service'}</h2>
        <button onclick="closeModal()" class="text-gray-400 text-2xl leading-none">&times;</button>
      </div>
      <form id="maint-form" class="space-y-4">

        <div>
          <label class="text-xs text-gray-400 block mb-1">Service Type</label>
          <select name="serviceType" class="form-input" required>
            ${SERVICES.map(sv => `<option value="${sv.key}"${(m.serviceType || 'oil') === sv.key ? ' selected' : ''}>${sv.icon} ${sv.label}</option>`).join('')}
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-400 block mb-1">Date</label>
            <input type="date" name="date" class="form-input" value="${m.date || today()}" required>
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">Odometer (mi)</label>
            <input type="number" name="odometer" class="form-input" placeholder="${s.currentOdometer || '450000'}"
              value="${m.odometer || ''}" step="1" min="0">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-400 block mb-1">Cost ($)</label>
            <input type="number" name="cost" class="form-input" placeholder="0.00"
              value="${m.cost || ''}" step="0.01" min="0">
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">Next Due In (mi)</label>
            <input type="number" name="customInterval" class="form-input" placeholder="auto"
              value="${m.customInterval || ''}" step="500" min="0">
          </div>
        </div>

        <div>
          <label class="text-xs text-gray-400 block mb-1">Shop / Vendor</label>
          <input type="text" name="shop" class="form-input" placeholder="e.g. Petro truck stop, Loves"
            value="${m.shop || ''}">
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Notes</label>
          <textarea name="notes" rows="2" class="form-input resize-none" placeholder="Parts replaced, warranty info…">${m.notes || ''}</textarea>
        </div>

        <button type="submit" class="btn-primary">${existing ? 'Save Changes' : 'Log Service'}</button>
        <button type="button" onclick="closeModal()" class="btn-ghost">Cancel</button>
      </form>
    </div>`;
}

function collectForm(fd) {
  return {
    serviceType:    fd.get('serviceType'),
    date:           fd.get('date'),
    odometer:       parseFloat(fd.get('odometer')) || null,
    cost:           parseFloat(fd.get('cost'))     || 0,
    customInterval: parseFloat(fd.get('customInterval')) || null,
    shop:           fd.get('shop').trim(),
    notes:          fd.get('notes').trim(),
  };
}

export function renderMaintenance() {
  const logs     = getMaintenanceLogs();
  const settings = getSettings();
  const odo      = Number(settings.currentOdometer) || 0;

  // Build "last service" per type for alert cards
  const lastByType = {};
  logs.forEach(log => {
    if (!lastByType[log.serviceType]) lastByType[log.serviceType] = log;
  });

  // Alerts: services overdue or due within 3,000 miles
  const alerts = SERVICES
    .filter(s => s.interval && lastByType[s.key])
    .map(s => {
      const info = dueInfo(lastByType[s.key], odo);
      if (!info) return null;
      const { remaining } = info;
      if (remaining > 3000) return null;
      return { svc: s, log: lastByType[s.key], remaining };
    })
    .filter(Boolean)
    .sort((a, b) => a.remaining - b.remaining);

  const totalCostYTD = logs
    .filter(l => l.date >= `${new Date().getFullYear()}-01-01`)
    .reduce((s, l) => s + Number(l.cost || 0), 0);

  const html = `
    <div class="flex flex-col h-full text-white" style="background:rgb(4,10,18)">

      <!-- Header -->
      <div class="dash-header shrink-0">
        <div style="display:flex;align-items:center;gap:10px">
          <button onclick="navigate('more')" class="settings-back-btn">
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 style="font-size:1.3rem;font-weight:900;color:#e0f2fe">Maintenance</h1>
            <p style="font-size:0.7rem;color:rgba(100,116,139,0.8)">${logs.length} service records · YTD ${fmtMoney(totalCostYTD, 0)}</p>
          </div>
        </div>
        <button id="add-maint-btn" style="background:linear-gradient(135deg,#0ea5e9,#0891b2);color:#fff;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto" style="padding:12px 14px 80px">

        <!-- Odometer quick-set -->
        <div class="glass-card" style="padding:14px;margin-bottom:10px">
          <p style="font-size:0.58rem;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:rgba(8,145,178,0.85);margin-bottom:10px">Current Odometer</p>
          <div style="display:flex;gap:10px;align-items:center">
            <input id="odo-input" type="number" class="form-input" style="flex:1;font-size:1.1rem;font-weight:700;text-align:center"
              placeholder="e.g. 487500" value="${odo || ''}">
            <button id="odo-save-btn" class="settings-action-btn" style="white-space:nowrap;flex-shrink:0">Set</button>
          </div>
          ${odo ? `<p style="font-size:0.7rem;color:rgba(100,116,139,0.7);margin-top:6px;text-align:center">${odo.toLocaleString()} mi on record</p>` : ''}
        </div>

        <!-- Alerts -->
        ${alerts.length > 0 ? `
        <div style="margin-bottom:10px">
          <p style="font-size:0.58rem;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:rgba(239,68,68,0.85);margin-bottom:8px">⚠ Service Alerts</p>
          ${alerts.map(({ svc: sv, remaining }) => {
            const overdue = remaining <= 0;
            const bg   = overdue ? 'rgba(220,38,38,0.12)' : 'rgba(251,191,36,0.08)';
            const bdr  = overdue ? 'rgba(220,38,38,0.35)' : 'rgba(251,191,36,0.25)';
            const col  = overdue ? '#f87171' : '#fbbf24';
            return `
            <div style="background:${bg};border:1px solid ${bdr};border-radius:16px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px">
              <span style="font-size:1.4rem">${sv.icon}</span>
              <div style="flex:1">
                <p style="font-weight:800;font-size:0.88rem;color:#e0f2fe">${sv.label}</p>
                <p style="font-size:0.72rem;color:${col};font-weight:700;margin-top:2px">
                  ${overdue ? `Overdue by ${Math.abs(remaining).toLocaleString()} mi` : `Due in ${remaining.toLocaleString()} mi`}
                </p>
              </div>
              <button onclick="navigate('maintenance')" style="font-size:0.7rem;font-weight:700;color:${col};padding:4px 10px;border:1px solid ${bdr};border-radius:8px">Log</button>
            </div>`;
          }).join('')}
        </div>
        ` : ''}

        <!-- Service history -->
        ${logs.length === 0 ? `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 0;text-align:center">
            <div style="font-size:3.5rem;margin-bottom:12px">🔧</div>
            <p style="color:rgba(148,163,184,0.8);font-weight:600">No service records yet.</p>
            <p style="color:rgba(100,116,139,0.7);font-size:0.85rem;margin-top:4px">Tap + to log your first maintenance entry.</p>
          </div>
        ` : `
          <p style="font-size:0.58rem;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:rgba(100,116,139,0.7);margin-bottom:8px">Service History</p>
          ${logs.map(log => {
            const sv   = svc(log.serviceType);
            const info = dueInfo(log, odo);
            return `
            <div class="glass-card" style="padding:14px;margin-bottom:8px" data-id="${log.id}">
              <div style="display:flex;align-items:flex-start;gap:12px">
                <div style="background:${sv.color}22;border:1px solid ${sv.color}44;border-radius:12px;padding:9px;flex-shrink:0;font-size:1.25rem">${sv.icon}</div>
                <div style="flex:1;min-width:0">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <p style="font-weight:800;font-size:0.9rem;color:#e0f2fe">${sv.label}</p>
                    ${log.cost > 0 ? `<span style="font-weight:800;font-size:0.9rem;color:#f87171">${fmtMoney(log.cost, 0)}</span>` : ''}
                  </div>
                  <p style="font-size:0.72rem;color:rgba(100,116,139,0.8);margin-top:2px">
                    ${fmtDate(log.date)}${log.odometer ? ` · ${Number(log.odometer).toLocaleString()} mi` : ''}${log.shop ? ` · ${log.shop}` : ''}
                  </p>
                  ${info ? `<p style="font-size:0.7rem;margin-top:4px;font-weight:700;color:${info.remaining <= 0 ? '#f87171' : info.remaining <= 3000 ? '#fbbf24' : 'rgba(100,116,139,0.7)'}">
                    Next due: ${Number(info.nextAt).toLocaleString()} mi${info.remaining > 0 ? ` (${info.remaining.toLocaleString()} to go)` : ' — OVERDUE'}
                  </p>` : ''}
                  ${log.notes ? `<p style="font-size:0.7rem;color:rgba(100,116,139,0.6);margin-top:4px;font-style:italic">${log.notes}</p>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
                  <button class="edit-maint-btn" data-id="${log.id}" style="color:rgba(100,116,139,0.7);padding:4px">
                    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="del-maint-btn" data-id="${log.id}" style="color:rgba(100,116,139,0.5);padding:4px">
                    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                  </button>
                </div>
              </div>
            </div>`;
          }).join('')}
        `}
      </div>
    </div>`;

  function mount(container) {
    container.querySelector('#odo-save-btn').addEventListener('click', () => {
      const val = parseFloat(container.querySelector('#odo-input').value) || 0;
      saveSettings({ currentOdometer: val });
      toast('Odometer updated ✓');
      window.refresh();
    });

    function openForm(existing = null) {
      openModal(serviceForm(existing), el => {
        el.querySelector('#maint-form').addEventListener('submit', ev => {
          ev.preventDefault();
          const fd   = new FormData(ev.target);
          const data = collectForm(fd);
          if (existing) updateMaintenanceLog(existing.id, data);
          else           addMaintenanceLog(data);
          closeModal();
          toast(existing ? 'Service updated ✓' : 'Service logged ✓');
          window.refresh();
        });
      });
    }

    container.querySelector('#add-maint-btn').addEventListener('click', () => openForm());

    container.querySelectorAll('.edit-maint-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const log = getMaintenanceLogs().find(m => m.id === btn.dataset.id);
        if (log) openForm(log);
      });
    });

    container.querySelectorAll('.del-maint-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        confirmSheet('Delete this service record?', 'Cannot be undone.', 'Delete', () => {
          deleteMaintenanceLog(btn.dataset.id);
          toast('Record deleted', 'info');
          window.refresh();
        });
      });
    });
  }

  return { html, mount };
}
