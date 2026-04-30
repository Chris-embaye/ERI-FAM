import { getDVIRs, getDetentionSessions, getActiveDetention, getSettings, getTrips, getExpenses, getFuelLogs } from '../store.js';

const ACCENT = '#0891b2';
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
  const trips    = getTrips();
  const expenses = getExpenses();
  const fuel     = getFuelLogs();

  const lastDVIRDate = dvirs[0]
    ? new Date(dvirs[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const totalDetention = sessions.reduce((s, d) => s + Number(d.value || 0), 0);

  const year      = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const ytdTrips  = trips.filter(t => t.date >= yearStart);
  const ytdExp    = expenses.filter(e => e.date >= yearStart);
  const ytdFuel   = fuel.filter(f => f.date >= yearStart);

  const ytdRev   = ytdTrips.reduce((s, t) => s + Number(t.revenue || 0), 0);
  const ytdMiles = ytdTrips.reduce((s, t) => s + Number(t.miles || 0), 0);
  const ytdExpAmt = ytdExp.reduce((s, e) => s + Number(e.amount || 0), 0);
  const ytdFuelAmt = ytdFuel.reduce((s, f) => s + Number(f.totalCost || 0), 0);
  const ytdNet   = ytdRev - ytdExpAmt - ytdFuelAmt;

  const calcId = 'more-calc';

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

        <!-- YTD Snapshot glass card -->
        <div class="glass-card" style="padding:16px;margin-bottom:10px">
          <p style="font-size:0.58rem;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:rgba(8,145,178,0.85);margin-bottom:12px">${year} Year-to-Date</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="background:rgba(8,145,178,0.08);border:1px solid rgba(8,145,178,0.18);border-radius:14px;padding:12px">
              <p style="font-size:0.62rem;color:rgba(100,116,139,0.8);font-weight:700">Revenue</p>
              <p style="font-size:1.15rem;font-weight:900;color:#67e8f9;margin-top:2px">$${Math.round(ytdRev).toLocaleString()}</p>
            </div>
            <div style="background:${ytdNet >= 0 ? 'rgba(21,128,61,0.1)' : 'rgba(185,28,28,0.1)'};border:1px solid ${ytdNet >= 0 ? 'rgba(21,128,61,0.25)' : 'rgba(185,28,28,0.25)'};border-radius:14px;padding:12px">
              <p style="font-size:0.62rem;color:rgba(100,116,139,0.8);font-weight:700">Net Profit</p>
              <p style="font-size:1.15rem;font-weight:900;color:${ytdNet >= 0 ? '#4ade80' : '#f87171'};margin-top:2px">${ytdNet < 0 ? '-' : ''}$${Math.abs(Math.round(ytdNet)).toLocaleString()}</p>
            </div>
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:12px">
              <p style="font-size:0.62rem;color:rgba(100,116,139,0.8);font-weight:700">Miles</p>
              <p style="font-size:1.15rem;font-weight:900;color:#e0f2fe;margin-top:2px">${Math.round(ytdMiles).toLocaleString()}</p>
            </div>
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:12px">
              <p style="font-size:0.62rem;color:rgba(100,116,139,0.8);font-weight:700">Expenses</p>
              <p style="font-size:1.15rem;font-weight:900;color:#fca5a5;margin-top:2px">$${Math.round(ytdExpAmt + ytdFuelAmt).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <!-- Tool cards -->
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
          `<svg width="22" height="22" fill="none" stroke="#4ade80" viewBox="0 0 24 24" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><path d="M7 10h2l2-4 2 8 2-4h2"/></svg>`,
          'rgba(21,128,61,0.15)',
          'Tax Summary',
          ytdRev > 0 ? `YTD ${year} · $${Math.round(ytdRev).toLocaleString()} revenue` : `YTD ${year} estimates & quarterly payments`,
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

        <!-- Calculator tool -->
        <div class="glass-card" id="${calcId}" style="padding:16px;margin-bottom:10px">
          <p style="font-size:0.58rem;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:rgba(8,145,178,0.85);margin-bottom:14px">Revenue Calculator</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
            <div class="settings-field" style="margin:0">
              <label class="settings-label">Miles</label>
              <input id="calc-miles" type="number" inputmode="decimal" class="form-input" placeholder="2 500" style="text-align:center;font-size:1rem;font-weight:700">
            </div>
            <div class="settings-field" style="margin:0">
              <label class="settings-label">Rate per mile $</label>
              <input id="calc-rpm" type="number" inputmode="decimal" step="0.01" class="form-input" placeholder="${(settings.targetRPM || 2.00).toFixed(2)}" style="text-align:center;font-size:1rem;font-weight:700">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
            <div class="settings-field" style="margin:0">
              <label class="settings-label">Fuel (gal)</label>
              <input id="calc-gal" type="number" inputmode="decimal" class="form-input" placeholder="auto" style="text-align:center">
            </div>
            <div class="settings-field" style="margin:0">
              <label class="settings-label">$/gallon</label>
              <input id="calc-ppg" type="number" inputmode="decimal" step="0.01" class="form-input" placeholder="3.99" style="text-align:center">
            </div>
          </div>
          <div id="calc-result" style="display:none;background:rgba(8,145,178,0.1);border:1px solid rgba(8,145,178,0.25);border-radius:14px;padding:14px;margin-bottom:12px">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
              <div>
                <p style="font-size:0.6rem;color:rgba(100,116,139,0.8);font-weight:700">Gross</p>
                <p id="calc-gross" style="font-size:1rem;font-weight:900;color:#67e8f9">—</p>
              </div>
              <div>
                <p style="font-size:0.6rem;color:rgba(100,116,139,0.8);font-weight:700">Fuel Cost</p>
                <p id="calc-fuel-cost" style="font-size:1rem;font-weight:900;color:#fca5a5">—</p>
              </div>
              <div>
                <p style="font-size:0.6rem;color:rgba(100,116,139,0.8);font-weight:700">Net</p>
                <p id="calc-net" style="font-size:1rem;font-weight:900;color:#4ade80">—</p>
              </div>
            </div>
          </div>
          <button id="calc-btn" class="save-btn-full" style="margin-top:0;padding:11px">Calculate</button>
        </div>

        <!-- Version -->
        <div class="glass-card" style="padding:14px 16px;text-align:center">
          <p style="font-weight:800;font-size:0.85rem;color:rgba(8,145,178,0.9)">Rig Log · TEST BUILD</p>
          <p style="font-size:0.7rem;color:rgba(100,116,139,0.7);margin-top:3px">v3.0 · owner-operator toolkit · isolated data</p>
        </div>

      </div>
    </div>`;

  function mount(container) {
    const milesEl   = container.querySelector('#calc-miles');
    const rpmEl     = container.querySelector('#calc-rpm');
    const galEl     = container.querySelector('#calc-gal');
    const ppgEl     = container.querySelector('#calc-ppg');
    const btn       = container.querySelector('#calc-btn');
    const result    = container.querySelector('#calc-result');
    const grossEl   = container.querySelector('#calc-gross');
    const fuelCostEl = container.querySelector('#calc-fuel-cost');
    const netEl     = container.querySelector('#calc-net');

    if (!btn) return;

    btn.addEventListener('click', () => {
      const miles = parseFloat(milesEl.value) || 0;
      const rpm   = parseFloat(rpmEl.value) || (settings.targetRPM || 2.00);
      const mpg   = settings.targetMPG || 6.5;

      let gallons = parseFloat(galEl.value);
      if (!gallons && miles > 0) gallons = miles / mpg;

      const ppg      = parseFloat(ppgEl.value) || 3.99;
      const gross    = miles * rpm;
      const fuelCost = gallons * ppg;
      const net      = gross - fuelCost;

      if (!miles) return;

      grossEl.textContent   = '$' + Math.round(gross).toLocaleString();
      fuelCostEl.textContent = '-$' + Math.round(fuelCost).toLocaleString();
      netEl.textContent     = (net < 0 ? '-$' : '$') + Math.abs(Math.round(net)).toLocaleString();
      netEl.style.color     = net >= 0 ? '#4ade80' : '#f87171';
      result.style.display  = 'block';
    });
  }

  return { html, mount };
}
