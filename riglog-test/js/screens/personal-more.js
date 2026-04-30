import {
  getPSettings, savePSettings, getPMaintenanceLogs,
  addPMaintenanceLog, deletePMaintenanceLog, updatePMaintenanceLog,
  clearAppMode, fmtMoney, fmtDate, today,
} from '../store.js';
import { openModal, closeModal, confirmSheet, toast } from '../modal.js';
import { ACCENT_PRESETS, BG_PRESETS, applyTheme, loadTheme, saveTheme } from '../theme.js';

const CAR_SERVICES = [
  { key: 'oil',     label: 'Oil Change',       interval: 5000,  icon: '🛢',  color: '#f59e0b' },
  { key: 'tires',   label: 'Tire Rotation',    interval: 7500,  icon: '⚫',  color: '#6366f1' },
  { key: 'brakes',  label: 'Brakes',           interval: 20000, icon: '🔴',  color: '#ef4444' },
  { key: 'airfilt', label: 'Air Filter',        interval: 15000, icon: '💨',  color: '#10b981' },
  { key: 'trans',   label: 'Transmission Fluid',interval: 30000, icon: '⚙️', color: '#8b5cf6' },
  { key: 'coolant', label: 'Coolant Flush',     interval: 30000, icon: '🧊',  color: '#06b6d4' },
  { key: 'battery', label: 'Battery',           interval: null,  icon: '🔋',  color: '#eab308' },
  { key: 'other',   label: 'Other',             interval: null,  icon: '🔩',  color: '#94a3b8' },
];

function svc(key) { return CAR_SERVICES.find(s => s.key === key) || CAR_SERVICES.at(-1); }

function maintForm(existing=null, currentOdo=0) {
  const m = existing || {};
  return `
    <div class="p-5">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-xl font-black">${existing ? 'Edit Service' : 'Log Service'}</h2>
        <button onclick="closeModal()" class="text-gray-400 text-2xl leading-none">&times;</button>
      </div>
      <form id="p-maint-form" class="space-y-4">
        <div>
          <label class="text-xs text-gray-400 block mb-1">Service</label>
          <select name="serviceType" class="form-input" required>
            ${CAR_SERVICES.map(sv => `<option value="${sv.key}"${(m.serviceType||'oil')===sv.key?' selected':''}>${sv.icon} ${sv.label}</option>`).join('')}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-400 block mb-1">Date</label>
            <input type="date" name="date" class="form-input" value="${m.date||today()}" required>
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">Odometer (mi)</label>
            <input type="number" name="odometer" class="form-input" placeholder="${currentOdo||'45000'}" value="${m.odometer||''}" step="1" min="0">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-400 block mb-1">Cost ($)</label>
            <input type="number" name="cost" class="form-input" placeholder="0.00" value="${m.cost||''}" step="0.01" min="0">
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">Next Due In (mi)</label>
            <input type="number" name="customInterval" class="form-input" placeholder="auto" value="${m.customInterval||''}" step="500" min="0">
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Shop</label>
          <input type="text" name="shop" class="form-input" placeholder="e.g. Jiffy Lube, Dealer" value="${m.shop||''}">
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Notes</label>
          <textarea name="notes" rows="2" class="form-input resize-none" placeholder="Parts, warranty…">${m.notes||''}</textarea>
        </div>
        <button type="submit" class="btn-primary" style="background:linear-gradient(135deg,#7c3aed,#6d28d9)">${existing ? 'Save Changes' : 'Log Service'}</button>
        <button type="button" onclick="closeModal()" class="btn-ghost">Cancel</button>
      </form>
    </div>`;
}

function chevron() {
  return `<svg width="16" height="16" fill="none" stroke="rgba(100,116,139,0.7)" viewBox="0 0 24 24" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
}

export function renderPersonalMore() {
  const s     = getPSettings();
  const theme = loadTheme();
  const maint = getPMaintenanceLogs();
  const odo   = Number(s.currentOdometer) || 0;

  const lastByType = {};
  maint.forEach(m => { if (!lastByType[m.serviceType]) lastByType[m.serviceType] = m; });

  const alerts = CAR_SERVICES.filter(sv => sv.interval && lastByType[sv.key]).map(sv => {
    const log = lastByType[sv.key];
    const interval = log.customInterval || sv.interval;
    if (!log.odometer || !odo) return null;
    const remaining = Number(log.odometer) + interval - odo;
    if (remaining > 2000) return null;
    return { sv, log, remaining };
  }).filter(Boolean).sort((a,b) => a.remaining-b.remaining);

  const html = `
    <div class="flex flex-col h-full text-white" style="background:rgb(4,10,18)">
      <div class="dash-header shrink-0" style="background:linear-gradient(180deg,rgba(124,58,237,0.09) 0%,transparent 100%)">
        <div>
          <h1 style="font-size:1.4rem;font-weight:900;color:#e0f2fe">More</h1>
          <p style="font-size:0.7rem;color:rgba(100,116,139,0.8)">Vehicle settings &amp; maintenance</p>
        </div>
        <button id="add-p-maint-btn" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto" style="padding:14px 14px 80px">

        <!-- Vehicle settings -->
        <div class="glass-card" style="padding:16px;margin-bottom:10px">
          <p style="font-size:0.58rem;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:rgba(124,58,237,0.85);margin-bottom:12px">My Vehicle</p>
          <form id="p-settings-form">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
              <div class="settings-field" style="margin:0">
                <label class="settings-label">Nickname</label>
                <input type="text" name="vehicleNickname" class="form-input" value="${s.vehicleNickname||''}" placeholder="My Car">
              </div>
              <div class="settings-field" style="margin:0">
                <label class="settings-label">Year</label>
                <input type="number" name="vehicleYear" class="form-input" value="${s.vehicleYear||''}" placeholder="2020">
              </div>
              <div class="settings-field" style="margin:0">
                <label class="settings-label">Make</label>
                <input type="text" name="vehicleMake" class="form-input" value="${s.vehicleMake||''}" placeholder="Toyota">
              </div>
              <div class="settings-field" style="margin:0">
                <label class="settings-label">Model</label>
                <input type="text" name="vehicleModel" class="form-input" value="${s.vehicleModel||''}" placeholder="Camry">
              </div>
              <div class="settings-field" style="margin:0">
                <label class="settings-label">Target MPG</label>
                <input type="number" name="targetMPG" class="form-input" step="0.5" value="${s.targetMPG||30}" placeholder="30">
              </div>
              <div class="settings-field" style="margin:0">
                <label class="settings-label">Odometer (mi)</label>
                <input type="number" name="currentOdometer" class="form-input" step="1" value="${s.currentOdometer||''}" placeholder="45000">
              </div>
            </div>
            <button type="submit" class="save-btn-full" style="padding:11px;margin-top:4px">Save Vehicle Info</button>
          </form>
        </div>

        <!-- Alerts -->
        ${alerts.length > 0 ? `
        <p style="font-size:0.58rem;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:rgba(239,68,68,0.85);margin-bottom:8px">⚠ Service Alerts</p>
        ${alerts.map(({sv, remaining}) => {
          const over = remaining <= 0;
          return `
          <div style="background:${over?'rgba(220,38,38,0.12)':'rgba(251,191,36,0.08)'};border:1px solid ${over?'rgba(220,38,38,0.3)':'rgba(251,191,36,0.22)'};border-radius:14px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
            <span style="font-size:1.3rem">${sv.icon}</span>
            <div style="flex:1">
              <p style="font-weight:800;font-size:0.88rem;color:#e0f2fe">${sv.label}</p>
              <p style="font-size:0.72rem;font-weight:700;color:${over?'#f87171':'#fbbf24'};margin-top:2px">
                ${over ? `Overdue by ${Math.abs(remaining).toLocaleString()} mi` : `Due in ${remaining.toLocaleString()} mi`}
              </p>
            </div>
          </div>`;
        }).join('')}
        ` : ''}

        <!-- Maintenance history -->
        <p style="font-size:0.58rem;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:rgba(100,116,139,0.7);margin-bottom:8px;margin-top:${alerts.length?'4px':'0'}">Service History</p>
        ${maint.length === 0 ? `
          <div style="text-align:center;padding:32px 0">
            <div style="font-size:3rem;margin-bottom:10px">🔧</div>
            <p style="color:rgba(148,163,184,0.8);font-size:0.88rem">No service records yet.<br>Tap + to log your first one.</p>
          </div>
        ` : maint.map(log => {
          const sv  = svc(log.serviceType);
          const iv  = log.customInterval || sv.interval;
          const rem = iv && log.odometer && odo ? (Number(log.odometer) + iv - odo) : null;
          return `
          <div class="glass-card" style="padding:14px;margin-bottom:8px" data-id="${log.id}">
            <div style="display:flex;align-items:flex-start;gap:10px">
              <div style="background:${sv.color}22;border:1px solid ${sv.color}44;border-radius:10px;padding:8px;font-size:1.15rem;flex-shrink:0">${sv.icon}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;justify-content:space-between">
                  <p style="font-weight:800;font-size:0.88rem;color:#e0f2fe">${sv.label}</p>
                  ${log.cost>0?`<span style="font-weight:800;font-size:0.88rem;color:#f87171">${fmtMoney(log.cost,0)}</span>`:''}
                </div>
                <p style="font-size:0.7rem;color:rgba(100,116,139,0.8);margin-top:2px">${fmtDate(log.date)}${log.odometer?` · ${Number(log.odometer).toLocaleString()} mi`:''}${log.shop?` · ${log.shop}`:''}</p>
                ${rem!==null?`<p style="font-size:0.68rem;font-weight:700;margin-top:3px;color:${rem<=0?'#f87171':rem<=1000?'#fbbf24':'rgba(100,116,139,0.6)'}">Next: ${rem>0?rem.toLocaleString()+' mi to go':'OVERDUE'}</p>`:''}
              </div>
              <div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0">
                <button class="p-edit-maint" data-id="${log.id}" style="color:rgba(100,116,139,0.6);padding:4px">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="p-del-maint" data-id="${log.id}" style="color:rgba(100,116,139,0.5);padding:4px">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            </div>
          </div>`;
        }).join('')}

        <!-- Appearance -->
        <div class="glass-card" style="padding:16px;margin-bottom:10px">
          <p style="font-size:0.58rem;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:rgba(167,139,250,0.85);margin-bottom:12px">🎨 Appearance</p>
          <p class="settings-label">Accent Color</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;margin-bottom:14px">
            ${ACCENT_PRESETS.map(p => `
              <button type="button" class="color-swatch${theme.accentColor===p.id?' selected':''}" data-accent="${p.id}" title="${p.label}"
                      style="background:${p.hex};${theme.accentColor===p.id?'outline:3px solid rgba(255,255,255,0.6);outline-offset:2px':''}"></button>
            `).join('')}
          </div>
          <p class="settings-label">Background</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
            ${BG_PRESETS.map(p => `
              <button type="button" class="bg-swatch${theme.bgTheme===p.id?' selected':''}" data-bg="${p.id}"
                      style="background:${theme.bgTheme===p.id?'rgba(255,255,255,0.12)':'rgba(255,255,255,0.04)'};border:1px solid ${theme.bgTheme===p.id?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.08)'};color:${theme.bgTheme===p.id?'#fff':'rgba(148,163,184,0.7)'}">
                ${p.label}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Switch mode -->
        <div class="glass-card" style="padding:14px;text-align:center;margin-top:8px">
          <p style="font-size:0.7rem;color:rgba(100,116,139,0.7);margin-bottom:10px">Want to track a commercial truck?</p>
          <button id="switch-mode-btn" style="background:rgba(8,145,178,0.12);color:#67e8f9;border:1px solid rgba(8,145,178,0.25);font-weight:700;font-size:0.85rem;padding:10px 20px;border-radius:12px;width:100%">
            🚛 Switch to Trucking Mode
          </button>
        </div>

      </div>
    </div>`;

  function mount(container) {
    container.querySelectorAll('.color-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = loadTheme();
        saveTheme(btn.dataset.accent, t.bgTheme);
        applyTheme(btn.dataset.accent, t.bgTheme);
        window.refresh();
      });
    });
    container.querySelectorAll('.bg-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = loadTheme();
        saveTheme(t.accentColor, btn.dataset.bg);
        applyTheme(t.accentColor, btn.dataset.bg);
        window.refresh();
      });
    });

    container.querySelector('#p-settings-form').addEventListener('submit', ev => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      savePSettings({
        vehicleNickname: fd.get('vehicleNickname').trim() || 'My Car',
        vehicleYear:     fd.get('vehicleYear').trim(),
        vehicleMake:     fd.get('vehicleMake').trim(),
        vehicleModel:    fd.get('vehicleModel').trim(),
        targetMPG:       parseFloat(fd.get('targetMPG')) || 30,
        currentOdometer: parseFloat(fd.get('currentOdometer')) || 0,
      });
      toast('Vehicle info saved ✓');
      window.refresh();
    });

    function openForm(existing=null) {
      openModal(maintForm(existing, odo), el => {
        el.querySelector('#p-maint-form').addEventListener('submit', ev => {
          ev.preventDefault();
          const fd = new FormData(ev.target);
          const data = {
            serviceType:    fd.get('serviceType'),
            date:           fd.get('date'),
            odometer:       parseFloat(fd.get('odometer')) || null,
            cost:           parseFloat(fd.get('cost')) || 0,
            customInterval: parseFloat(fd.get('customInterval')) || null,
            shop:           fd.get('shop').trim(),
            notes:          fd.get('notes').trim(),
          };
          if (existing) updatePMaintenanceLog(existing.id, data); else addPMaintenanceLog(data);
          closeModal(); toast(existing ? 'Updated ✓' : 'Service logged ✓'); window.refresh();
        });
      });
    }

    container.querySelector('#add-p-maint-btn').addEventListener('click', () => openForm());
    container.querySelectorAll('.p-edit-maint').forEach(btn => {
      btn.addEventListener('click', () => { const m = getPMaintenanceLogs().find(m => m.id===btn.dataset.id); if(m) openForm(m); });
    });
    container.querySelectorAll('.p-del-maint').forEach(btn => {
      btn.addEventListener('click', () => { confirmSheet('Delete record?','','Delete',() => { deletePMaintenanceLog(btn.dataset.id); toast('Deleted','info'); window.refresh(); }); });
    });

    container.querySelector('#switch-mode-btn').addEventListener('click', () => {
      confirmSheet('Switch to Trucking Mode?', 'Your personal data stays saved.', 'Switch', () => {
        clearAppMode();
        window.navigate('role-select');
      });
    });
  }

  return { html, mount };
}
