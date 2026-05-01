import { getDVIRs, getDetentionSessions, getActiveDetention, getSettings, getMaintenanceLogs } from '../store.js';

const chevron = `<svg width="16" height="16" fill="none" stroke="rgba(100,116,139,0.7)" viewBox="0 0 24 24" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;

function moreCard(iconSvg, iconBg, title, sub, badge, onClick) {
  return `
    <button onclick="${onClick}" class="glass-card w-full text-left" style="padding:14px 16px;margin-bottom:10px">
      <div class="flex items-center gap-3">
        <div style="background:${iconBg};border-radius:14px;padding:10px;flex-shrink:0">${iconSvg}</div>
        <div class="flex-1 min-w-0">
          <p style="font-weight:800;font-size:0.9rem;color:#e0f2fe">${title}</p>
          <p style="font-size:0.72rem;color:rgba(100,116,139,0.85);margin-top:2px;line-height:1.3">${sub}</p>
        </div>
        ${badge ? `<div style="font-size:0.75rem;font-weight:800;color:#67e8f9">${badge}</div>` : ''}
        ${chevron}
      </div>
    </button>`;
}

export function renderMore() {
  const dvirs    = getDVIRs();
  const sessions = getDetentionSessions();
  const active   = getActiveDetention();
  const settings = getSettings();
  const maint    = getMaintenanceLogs();

  const lastDVIRDate = dvirs[0]
    ? new Date(dvirs[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const totalDetention = sessions.reduce((s, d) => s + Number(d.value || 0), 0);

  const year = new Date().getFullYear();

  // Maintenance alert count
  const odo = Number(settings.currentOdometer) || 0;
  const maintAlerts = maint.filter(m => {
    const INTERVALS = { oil:25000, pm:30000, tires:50000, brakes:60000, airfilt:50000, fuelfilt:30000, trans:100000, coolant:100000 };
    const interval = m.customInterval || INTERVALS[m.serviceType];
    if (!interval || !m.odometer || !odo) return false;
    return (Number(m.odometer) + interval - odo) <= 3000;
  }).length;

  const html = `
    <div class="flex flex-col h-full text-white" style="background:transparent">
      <!-- Header -->
      <div class="dash-header shrink-0">
        <div>
          <h1 style="font-size:1.4rem;font-weight:900;color:#e0f2fe;letter-spacing:-0.3px">More</h1>
          <p style="font-size:0.7rem;color:rgba(100,116,139,0.8);margin-top:1px">Tools &amp; settings</p>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto" style="padding:14px 14px 80px">

        <!-- Tool cards -->
        ${moreCard(
          `<svg width="22" height="22" fill="none" stroke="#4ade80" viewBox="0 0 24 24" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
          'rgba(74,222,128,0.12)',
          'Pay Ledger',
          settings.driverType === 'Company'
            ? (settings.companyPayType === 'cpm'
                ? `${(Number(settings.cpmRate||0)*100).toFixed(1)}¢/mi · weekly pay statement`
                : `${settings.payPercent}% of load · weekly pay statement`)
            : 'Company drivers — weekly pay tracker',
          '',
          "navigate('pay')"
        )}
        ${moreCard(
          `<svg width="22" height="22" fill="none" stroke="#67e8f9" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
          'rgba(8,145,178,0.15)',
          'Detention Timer',
          active ? 'Session active — tap to manage' : sessions.length > 0 ? `${sessions.length} sessions logged` : 'No sessions yet',
          active ? '<span style="color:#67e8f9;animation:pulse-cyan 2s infinite">● LIVE</span>' : totalDetention > 0 ? `$${Math.round(totalDetention)}` : '',
          "navigate('detention')"
        )}
        ${moreCard(
          `<svg width="22" height="22" fill="none" stroke="#60a5fa" viewBox="0 0 24 24" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>`,
          'rgba(59,130,246,0.15)',
          'Vehicle Inspection (DVIR)',
          lastDVIRDate ? `Last: ${lastDVIRDate} · 37 check items` : '37 inspection items · no entries yet',
          dvirs.length > 0 ? `${dvirs.length}` : '',
          "navigate('dvir')"
        )}
        ${moreCard(
          `<svg width="22" height="22" fill="none" stroke="#fb923c" viewBox="0 0 24 24" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
          'rgba(251,146,60,0.12)',
          'Maintenance Log',
          maint.length > 0 ? `${maint.length} service records` : 'Track oil changes, tires, PM intervals',
          maintAlerts > 0 ? `<span style="color:#fbbf24">⚠ ${maintAlerts} due</span>` : '',
          "navigate('maintenance')"
        )}
        ${moreCard(
          `<svg width="22" height="22" fill="none" stroke="#a78bfa" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
          'rgba(139,92,246,0.12)',
          'IFTA Report',
          'Miles by state/province · quarterly filing',
          '',
          "navigate('ifta')"
        )}
        ${moreCard(
          `<svg width="22" height="22" fill="none" stroke="#4ade80" viewBox="0 0 24 24" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><path d="M7 10h2l2-4 2 8 2-4h2"/></svg>`,
          'rgba(21,128,61,0.15)',
          'Tax Summary',
          `YTD ${year} · estimates &amp; quarterly payments`,
          '',
          "navigate('tax')"
        )}
        ${moreCard(
          `<svg width="22" height="22" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
          'rgba(100,116,139,0.15)',
          'Settings',
          `${settings.truckId || 'My Truck'} · $${settings.detentionRate || 60}/hr detention`,
          '',
          "navigate('settings')"
        )}

        <!-- Version -->
        <div class="glass-card" style="padding:14px 16px;text-align:center">
          <p style="font-weight:800;font-size:0.85rem;color:rgba(8,145,178,0.9)">Rig Log · TEST BUILD</p>
          <p style="font-size:0.7rem;color:rgba(100,116,139,0.7);margin-top:3px">v3.2 · owner-operator toolkit · isolated data</p>
        </div>

      </div>
    </div>`;

  return { html };
}
