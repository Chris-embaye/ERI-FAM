import { getTrips, getExpenses, getSettings, fmtMoney, fmtDate, calcTripPay } from '../store.js';
import { openModal, closeModal, toast } from '../modal.js';
import { getCurrentUser } from '../auth.js';

const CAT_ICONS = {
  Fuel: '⛽', Repair: '🔧', Toll: '🛣️', Lodging: '🏨',
  Food: '🍔', Parking: '🅿️', Scale: '⚖️', Insurance: '🛡️', Other: '📋',
};

function weekBounds(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end:   sunday.toISOString().slice(0, 10),
    label: monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
           + ' – ' + sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  };
}

let _weekOffset = 0;

// ── PDF generation ────────────────────────────────────────────────────────────

function generatePayReportPDF({ trips, expenses, deductions, startDate, endDate, s, isCompany }) {
  const user       = getCurrentUser();
  const driverName = user?.displayName || user?.email || 'Driver';
  const carrier    = s.carrierName || (isCompany ? 'Company' : 'Owner-Operator');
  const now        = new Date();
  const reportDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const fmt$ = v => '$' + Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fmtD = v => new Date(v + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (isCompany) {
    // ── Company driver PDF ──
    const payRate   = s.companyPayType === 'percent'
      ? `${Number(s.payPercent || 50)}% of Load`
      : `${(Number(s.cpmRate || 0) * 100).toFixed(1)}¢ / Mile`;
    const isPercent = s.companyPayType === 'percent';
    const grossPay  = trips.reduce((sum, t) => sum + (calcTripPay(t, s) || 0), 0);
    const totalDed  = deductions.reduce((sum, d) => sum + d.amount, 0);
    const netPay    = Math.max(0, grossPay - totalDed);

    const tripRows = trips.map(t => {
      const pay = calcTripPay(t, s) || 0;
      const rev = Number(t.revenue || 0);
      const mi  = Number(t.miles || 0);
      const payDetail = isPercent
        ? `${fmt$(rev)} × ${Number(s.payPercent || 50)}%`
        : `${mi.toLocaleString()} mi × ${(Number(s.cpmRate || 0) * 100).toFixed(1)}¢`;
      return `<tr>
        <td>${t.loadNum || '—'}</td>
        <td>${fmtD(t.date)}</td>
        <td>${t.origin || '—'}</td>
        <td>${t.destination || '—'}</td>
        <td style="text-align:right">${Number(t.miles||0).toLocaleString()}</td>
        <td style="text-align:right">${fmt$(rev)}</td>
        <td style="text-align:right;color:#555">${payDetail}</td>
        <td style="text-align:right;font-weight:700;color:#1a7a3a">${fmt$(pay)}</td>
      </tr>`;
    }).join('');

    const dedRows = deductions.map(d => `<tr>
      <td colspan="7" style="padding-left:16px">${d.label}</td>
      <td style="text-align:right;color:#c00;font-weight:600">− ${fmt$(d.amount)}</td>
    </tr>`).join('');

    return buildPDF({
      driverName, carrier, reportDate, startDate, endDate, tripCount: trips.length,
      payRate, body: `
        <h2>Load Detail</h2>
        <table>
          <thead><tr>
            <th>Load #</th><th>Date</th><th>Origin</th><th>Destination</th>
            <th style="text-align:right">Miles</th>
            <th style="text-align:right">Gross Rate</th>
            <th style="text-align:right">Pay Calc</th>
            <th style="text-align:right">Driver Pay</th>
          </tr></thead>
          <tbody>
            ${tripRows || '<tr><td colspan="8" style="text-align:center;padding:16px;color:#999">No trips in this period</td></tr>'}
            <tr class="subtotal-row">
              <td colspan="7" style="text-align:right;padding-right:16px">Gross Driver Pay</td>
              <td style="text-align:right;color:#1a7a3a">${fmt$(grossPay)}</td>
            </tr>
            ${deductions.length ? dedRows + `<tr class="subtotal-row">
              <td colspan="7" style="text-align:right;padding-right:16px">Total Deductions</td>
              <td style="text-align:right;color:#c00">− ${fmt$(deductions.reduce((s,d)=>s+d.amount,0))}</td>
            </tr>` : ''}
            <tr class="total-row">
              <td colspan="7" style="text-align:right;padding-right:16px">NET PAY</td>
              <td class="amount" style="text-align:right">${fmt$(netPay)}</td>
            </tr>
          </tbody>
        </table>`,
      footnote: `${trips.length} load${trips.length!==1?'s':''} · Gross ${fmt$(grossPay)}${deductions.length ? ' · Net ' + fmt$(netPay) + ' after deductions' : ''}`
    });

  } else {
    // ── Owner-operator PDF ──
    const totalRevenue = trips.reduce((sum, t) => sum + Number(t.revenue || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;

    const tripRows = trips.map(t => `<tr>
      <td>${t.loadNum || '—'}</td>
      <td>${fmtD(t.date)}</td>
      <td>${t.origin || '—'}</td>
      <td>${t.destination || '—'}</td>
      <td style="text-align:right">${Number(t.miles||0).toLocaleString()}</td>
      <td style="text-align:right;font-weight:700;color:#1a7a3a">${fmt$(Number(t.revenue||0))}</td>
    </tr>`).join('');

    // Group expenses by category
    const expByCategory = {};
    expenses.forEach(e => {
      const cat = e.category || 'Other';
      expByCategory[cat] = (expByCategory[cat] || 0) + Number(e.amount || 0);
    });
    const expRows = Object.entries(expByCategory).map(([cat, amt]) => `<tr>
      <td colspan="5" style="padding-left:16px">${cat}</td>
      <td style="text-align:right;color:#c00;font-weight:600">− ${fmt$(amt)}</td>
    </tr>`).join('');

    return buildPDF({
      driverName, carrier, reportDate, startDate, endDate, tripCount: trips.length,
      payRate: 'Owner-Operator', body: `
        <h2>Load Revenue</h2>
        <table>
          <thead><tr>
            <th>Load #</th><th>Date</th><th>Origin</th><th>Destination</th>
            <th style="text-align:right">Miles</th>
            <th style="text-align:right">Revenue</th>
          </tr></thead>
          <tbody>
            ${tripRows || '<tr><td colspan="6" style="text-align:center;padding:16px;color:#999">No trips in this period</td></tr>'}
            <tr class="subtotal-row">
              <td colspan="5" style="text-align:right;padding-right:16px">Total Revenue</td>
              <td style="text-align:right;color:#1a7a3a">${fmt$(totalRevenue)}</td>
            </tr>
            ${expenses.length ? expRows + `<tr class="subtotal-row">
              <td colspan="5" style="text-align:right;padding-right:16px">Total Operating Expenses</td>
              <td style="text-align:right;color:#c00">− ${fmt$(totalExpenses)}</td>
            </tr>` : ''}
            <tr class="total-row">
              <td colspan="5" style="text-align:right;padding-right:16px">NET OPERATING INCOME</td>
              <td class="amount" style="text-align:right;color:${netProfit>=0?'#1a7a3a':'#c00'}">${netProfit < 0 ? '−' : ''}${fmt$(Math.abs(netProfit))}</td>
            </tr>
          </tbody>
        </table>`,
      footnote: `${trips.length} load${trips.length!==1?'s':''} · Revenue ${fmt$(totalRevenue)} · Expenses ${fmt$(totalExpenses)} · Net ${fmt$(netProfit)}`
    });
  }
}

function buildPDF({ driverName, carrier, reportDate, startDate, endDate, tripCount, payRate, body, footnote }) {
  const fmt$ = v => '$' + Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fmtD = v => new Date(v + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Driver Pay Report — ${driverName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #111; padding: 32px; }
  h1 { font-size: 22px; font-weight: 800; color: #1a1a2e; }
  h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #444; margin-bottom: 8px; margin-top: 20px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #ea580c; padding-bottom: 14px; margin-bottom: 20px; }
  .header-left p { color: #555; margin-top: 4px; font-size: 12px; }
  .header-right { text-align: right; }
  .header-right p { color: #555; font-size: 12px; margin-top: 3px; }
  .header-right .date-range { font-weight: 700; color: #111; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #1a1a2e; color: #fff; }
  thead th { padding: 8px 6px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  tbody tr:nth-child(even) { background: #fafafa; }
  tbody td { padding: 7px 6px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
  .subtotal-row td { border-top: 2px solid #ccc; font-weight: 700; padding-top: 10px; }
  .total-row td { border-top: 3px solid #ea580c; background: #fff7f0; font-size: 14px; font-weight: 800; padding: 10px 6px; }
  .amount { font-size: 16px; }
  .note { margin-top: 24px; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  <div class="header-left">
    <h1>Driver Pay Report</h1>
    <p>${driverName}</p>
    <p>${carrier}</p>
    <p>Type: ${payRate}</p>
  </div>
  <div class="header-right">
    <p>Report Generated:</p>
    <p class="date-range">${reportDate}</p>
    <p style="margin-top:8px">Period Covered:</p>
    <p class="date-range">${fmtD(startDate)} – ${fmtD(endDate)}</p>
    <p style="margin-top:8px">Total Loads: <strong>${tripCount}</strong></p>
  </div>
</div>
${body}
<div class="note">Generated by Truck-Log on ${reportDate}. ${footnote}.</div>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ── Pay Report modal ──────────────────────────────────────────────────────────

function openPayReportModal(defaultStart, defaultEnd, allTrips, allExpenses, s, isCompany) {
  const html = `
    <div class="p-5">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-xl font-black">Generate Pay Report</h2>
        <button onclick="closeModal()" class="text-gray-400 text-2xl leading-none">&times;</button>
      </div>
      <div class="space-y-4">

        <div>
          <label class="text-xs text-gray-400 block mb-2 font-bold uppercase tracking-wider">Pay Period</label>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 block mb-1">From</label>
              <input type="date" id="report-start" class="form-input" value="${defaultStart}">
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">To</label>
              <input type="date" id="report-end" class="form-input" value="${defaultEnd}">
            </div>
          </div>
        </div>

        ${isCompany ? `
        <div>
          <label class="text-xs text-gray-400 block mb-2 font-bold uppercase tracking-wider">One-Time Deductions</label>
          <div id="deduction-rows" class="space-y-2">
            <div class="deduction-row flex gap-2 items-center">
              <input type="text" class="form-input ded-label flex-1" placeholder="e.g. Fuel Advance">
              <div class="flex items-center gap-1" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:0 10px">
                <span class="text-gray-400 text-sm">$</span>
                <input type="number" class="ded-amount text-white text-sm font-bold bg-transparent outline-none" placeholder="0.00" step="0.01" min="0" style="width:80px;padding:10px 4px">
              </div>
              <button type="button" class="del-ded text-gray-600 hover:text-red-500 p-1.5">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <button type="button" id="add-ded-btn" class="mt-2 w-full py-2 rounded-xl text-sm font-bold text-center"
            style="background:rgba(255,255,255,0.04);border:1px dashed rgba(255,255,255,0.1);color:rgba(148,163,184,0.7)">
            + Add Deduction
          </button>
        </div>` : ''}

        <div id="trip-preview" class="rounded-xl p-3 text-sm" style="background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.15)">
          <p class="text-xs font-bold mb-1" style="color:rgba(74,222,128,0.8)">PREVIEW</p>
          <p id="preview-text" style="color:rgba(203,213,225,0.8)">Select dates to preview</p>
        </div>

        <button id="gen-pdf-btn" class="btn-primary flex items-center justify-center gap-2 mt-2">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          Generate PDF
        </button>
        <button onclick="closeModal()" class="btn-ghost">Cancel</button>
      </div>
    </div>`;

  openModal(html, el => {
    const startEl   = el.querySelector('#report-start');
    const endEl     = el.querySelector('#report-end');
    const previewEl = el.querySelector('#preview-text');
    const rowsEl    = el.querySelector('#deduction-rows');

    function updatePreview() {
      const start = startEl.value;
      const end   = endEl.value;
      if (!start || !end || start > end) { previewEl.textContent = 'Select a valid date range'; return; }
      const filtered = allTrips.filter(t => t.date >= start && t.date <= end);
      const rev      = filtered.reduce((sum, t) => sum + Number(t.revenue || 0), 0);
      if (isCompany) {
        const gross = filtered.reduce((sum, t) => sum + (calcTripPay(t, s) || 0), 0);
        previewEl.innerHTML = `<strong style="color:#4ade80">${filtered.length} load${filtered.length!==1?'s':''}</strong> · Driver Pay: <strong style="color:#4ade80">${fmtMoney(gross)}</strong>`;
      } else {
        const exps  = allExpenses.filter(e => e.date >= start && e.date <= end);
        const spent = exps.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        previewEl.innerHTML = `<strong style="color:#4ade80">${filtered.length} load${filtered.length!==1?'s':''}</strong> · Revenue: <strong style="color:#4ade80">${fmtMoney(rev)}</strong> · Expenses: <span style="color:#f87171">${fmtMoney(spent)}</span> · Net: <strong style="color:#4ade80">${fmtMoney(rev-spent)}</strong>`;
      }
    }

    startEl.addEventListener('change', updatePreview);
    endEl.addEventListener('change', updatePreview);
    updatePreview();

    if (rowsEl) {
      rowsEl.querySelector('.del-ded')?.addEventListener('click', e => e.target.closest('.deduction-row').remove());
      el.querySelector('#add-ded-btn')?.addEventListener('click', () => {
        const div = document.createElement('div');
        div.className = 'deduction-row flex gap-2 items-center';
        div.innerHTML = `
          <input type="text" class="form-input ded-label flex-1" placeholder="e.g. Zelle Advance">
          <div class="flex items-center gap-1" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:0 10px">
            <span class="text-gray-400 text-sm">$</span>
            <input type="number" class="ded-amount text-white text-sm font-bold bg-transparent outline-none" placeholder="0.00" step="0.01" min="0" style="width:80px;padding:10px 4px">
          </div>
          <button type="button" class="del-ded text-gray-600 hover:text-red-500 p-1.5">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>`;
        rowsEl.appendChild(div);
        div.querySelector('.del-ded').addEventListener('click', () => div.remove());
      });
    }

    el.querySelector('#gen-pdf-btn').addEventListener('click', () => {
      const start = startEl.value;
      const end   = endEl.value;
      if (!start || !end || start > end) { toast('Set a valid date range first', 'error'); return; }
      const rangeTrips    = allTrips.filter(t => t.date >= start && t.date <= end);
      const rangeExpenses = allExpenses.filter(e => e.date >= start && e.date <= end);
      const deductions    = [];
      rowsEl?.querySelectorAll('.deduction-row').forEach(row => {
        const label  = row.querySelector('.ded-label')?.value.trim();
        const amount = parseFloat(row.querySelector('.ded-amount')?.value || '0');
        if (label && amount > 0) deductions.push({ label, amount });
      });
      closeModal();
      generatePayReportPDF({ trips: rangeTrips, expenses: rangeExpenses, deductions, startDate: start, endDate: end, s, isCompany });
    });
  });
}

// ── Main render ───────────────────────────────────────────────────────────────

export function renderPay() {
  const s          = getSettings();
  const allTrips   = getTrips();
  const allExpenses= getExpenses();
  const isCompany  = s.driverType === 'Company';

  const week      = weekBounds(_weekOffset);
  const weekTrips = allTrips.filter(t => t.date >= week.start && t.date <= week.end);
  const weekExps  = allExpenses.filter(e => e.date >= week.start && e.date <= week.end);

  const totalMiles        = weekTrips.reduce((sum, t) => sum + Number(t.miles || 0), 0);
  const totalGrossRevenue = weekTrips.reduce((sum, t) => sum + Number(t.revenue || 0), 0);
  const totalExpenses     = weekExps.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  // Company: pay is % or CPM of load revenue
  const grossPay = isCompany
    ? weekTrips.reduce((sum, t) => sum + (calcTripPay(t, s) || 0), 0)
    : totalGrossRevenue;

  const healthDed = Number(s.healthInsDeductWeekly || 0);
  const k401Ded   = Number(s.k401DeductWeekly || 0);
  const otherDed  = Number(s.otherDeductWeekly || 0);
  const settingsDed = healthDed + k401Ded + otherDed;

  // O/O: net = revenue - operating expenses; Company: net = driver pay - payroll deductions
  const netPay = isCompany
    ? Math.max(0, grossPay - settingsDed)
    : totalGrossRevenue - totalExpenses;

  // YTD
  const yearStart  = new Date().getFullYear() + '-01-01';
  const ytdTrips   = allTrips.filter(t => t.date >= yearStart);
  const ytdExps    = allExpenses.filter(e => e.date >= yearStart);
  const ytdPay     = isCompany
    ? ytdTrips.reduce((sum, t) => sum + (calcTripPay(t, s) || 0), 0)
    : ytdTrips.reduce((sum, t) => sum + Number(t.revenue || 0), 0);
  const ytdMiles   = ytdTrips.reduce((sum, t) => sum + Number(t.miles || 0), 0);
  const ytdExpAmt  = ytdExps.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const payLabel = isCompany
    ? (s.companyPayType === 'percent' ? `${s.payPercent}% of Load` : `${(Number(s.cpmRate||0)*100).toFixed(1)}¢/mi`)
    : 'Owner-Operator';

  const html = `
    <div class="flex flex-col h-full text-white" style="background:rgb(4,10,18)">

      <!-- Header -->
      <div class="dash-header shrink-0">
        <div>
          <h1 class="text-xl font-black">Pay Ledger</h1>
          <p class="text-xs" style="color:rgba(100,200,255,0.5)">${s.carrierName || s.driverType || 'Driver'} · ${payLabel}</p>
        </div>
        <div class="flex items-center gap-2">
          <button id="gen-report-btn" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
            style="background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.25);color:#4ade80">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Pay Report
          </button>
          <button onclick="navigate('more')" style="font-size:1.3rem;background:none;border:none;color:rgba(148,163,184,0.7);padding:4px">✕</button>
        </div>
      </div>

      <!-- Week selector -->
      <div class="flex items-center justify-between px-4 py-2 shrink-0" style="border-bottom:1px solid rgba(255,255,255,0.06)">
        <button id="prev-week-btn" class="px-3 py-1.5 rounded-xl text-sm font-bold" style="background:rgba(255,255,255,0.06);color:#94a3b8">‹ Prev</button>
        <p class="text-xs font-bold text-center" style="color:#e0f2fe">${week.label}</p>
        <button id="next-week-btn" class="px-3 py-1.5 rounded-xl text-sm font-bold" style="background:rgba(255,255,255,0.06);color:${_weekOffset < 0 ? '#94a3b8' : 'rgba(100,116,139,0.3)'}">Next ›</button>
      </div>

      <div class="flex-1 overflow-y-auto" style="padding:14px 14px 80px">

        ${weekTrips.length === 0 ? `
          <div class="glass-card text-center py-8">
            <p class="text-3xl mb-2">📭</p>
            <p class="font-bold">No trips this week</p>
            <p class="text-sm mt-1" style="color:rgba(148,163,184,0.6)">Log trips on the Trips tab to see your pay here.</p>
          </div>
        ` : `

          <!-- Pay Summary Card -->
          <div class="dash-hero-card mb-3">
            <p class="text-xs font-bold uppercase tracking-wider mb-1" style="color:rgba(255,255,255,0.5)">
              ${isCompany ? 'Net Take-Home' : 'Net Operating Income'}
            </p>
            <p class="text-5xl font-black" style="letter-spacing:-1px;color:${netPay < 0 ? '#f87171' : '#fff'}">${fmtMoney(Math.abs(netPay))}</p>
            <p class="text-xs mt-1" style="color:rgba(255,255,255,0.45)">
              ${isCompany
                ? `Gross ${fmtMoney(grossPay)} · Deductions ${fmtMoney(settingsDed)}`
                : `Revenue ${fmtMoney(totalGrossRevenue)} · Expenses ${fmtMoney(totalExpenses)}`}
            </p>
          </div>

          <!-- Pay Breakdown -->
          <div class="glass-card mb-3" style="padding:14px">
            <p class="text-xs font-bold uppercase tracking-wider mb-3" style="color:rgba(148,163,184,0.7)">
              ${isCompany ? 'Pay Breakdown' : 'Revenue & Expenses'}
            </p>
            <div class="space-y-2">
              <div class="flex justify-between text-sm py-1.5" style="border-bottom:1px solid rgba(255,255,255,0.05)">
                <span style="color:rgba(203,213,225,0.8)">${isCompany ? `Gross Pay (${payLabel})` : 'Gross Revenue'}</span>
                <span class="font-bold text-green-400">${fmtMoney(grossPay)}</span>
              </div>

              ${isCompany ? `
                ${healthDed > 0 ? `<div class="flex justify-between text-sm py-1.5" style="border-bottom:1px solid rgba(255,255,255,0.05)">
                  <span style="color:rgba(203,213,225,0.8)">Health Insurance</span>
                  <span class="font-bold text-red-400">- ${fmtMoney(healthDed)}</span>
                </div>` : ''}
                ${k401Ded > 0 ? `<div class="flex justify-between text-sm py-1.5" style="border-bottom:1px solid rgba(255,255,255,0.05)">
                  <span style="color:rgba(203,213,225,0.8)">401(k) / Retirement</span>
                  <span class="font-bold text-red-400">- ${fmtMoney(k401Ded)}</span>
                </div>` : ''}
                ${otherDed > 0 ? `<div class="flex justify-between text-sm py-1.5" style="border-bottom:1px solid rgba(255,255,255,0.05)">
                  <span style="color:rgba(203,213,225,0.8)">Other Deductions</span>
                  <span class="font-bold text-red-400">- ${fmtMoney(otherDed)}</span>
                </div>` : ''}
              ` : weekExps.length > 0 ? weekExps.map(e => `
                <div class="flex justify-between text-sm py-1.5" style="border-bottom:1px solid rgba(255,255,255,0.05)">
                  <span style="color:rgba(203,213,225,0.8)">${CAT_ICONS[e.category]||'📋'} ${e.category}${e.description ? ' · ' + e.description.slice(0,20) : ''}</span>
                  <span class="font-bold text-red-400">- ${fmtMoney(e.amount)}</span>
                </div>`).join('') : ''}

              <div class="flex justify-between text-sm pt-1.5">
                <span class="font-black">${isCompany ? 'Net Take-Home' : 'Net Income'}</span>
                <span class="font-black" style="color:${netPay < 0 ? '#f87171' : '#4ade80'}">${netPay < 0 ? '- ' : ''}${fmtMoney(Math.abs(netPay))}</span>
              </div>
            </div>
          </div>

          <!-- Stats row -->
          <div class="grid grid-cols-3 gap-2 mb-3">
            <div class="glass-card" style="padding:12px">
              <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">Loads</p>
              <p class="text-xl font-black">${weekTrips.length}</p>
              <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">This week</p>
            </div>
            <div class="glass-card" style="padding:12px">
              <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">Miles</p>
              <p class="text-xl font-black">${totalMiles.toLocaleString()}</p>
              <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">${fmtMoney(totalGrossRevenue/Math.max(totalMiles,1),2)}/mi</p>
            </div>
            <div class="glass-card" style="padding:12px">
              <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">${isCompany ? 'Avg/Load' : 'Gross Rev'}</p>
              <p class="text-xl font-black">${isCompany ? fmtMoney(grossPay/Math.max(weekTrips.length,1)) : fmtMoney(totalGrossRevenue)}</p>
              <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">${isCompany ? 'per load' : 'total'}</p>
            </div>
          </div>

          <!-- Per-Trip List -->
          <div class="glass-card" style="padding:14px">
            <p class="text-xs font-bold uppercase tracking-wider mb-3" style="color:rgba(148,163,184,0.7)">Trips This Week</p>
            ${weekTrips.map(t => {
              const pay = isCompany ? (calcTripPay(t, s) || 0) : Number(t.revenue || 0);
              return `
              <div class="flex items-center gap-3 py-2.5" style="border-bottom:1px solid rgba(255,255,255,0.05)">
                <div class="shrink-0 text-center" style="width:36px">
                  <p class="text-xs font-bold" style="color:rgba(100,116,139,0.8)">${fmtDate(t.date).slice(0,6)}</p>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold truncate">${t.origin || '?'} → ${t.destination || '?'}</p>
                  <p class="text-xs" style="color:rgba(100,116,139,0.8)">${Number(t.miles||0).toLocaleString()} mi${t.loadNum ? ' · #'+t.loadNum : ''}</p>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-sm font-black text-green-400">${fmtMoney(pay)}</p>
                  <p class="text-xs" style="color:rgba(100,116,139,0.8)">${isCompany ? payLabel : fmtMoney(Number(t.revenue||0)/Math.max(Number(t.miles||1),1),2)+'/mi'}</p>
                </div>
              </div>`;
            }).join('')}
          </div>

          <!-- Calculate CTA -->
          <button id="calc-week-btn" class="mt-3 w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
            style="background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.2);color:#4ade80">
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Calculate & Export Pay Report
          </button>
        `}

        <!-- YTD Summary -->
        ${ytdPay > 0 ? `
        <div class="glass-card mt-3" style="padding:14px">
          <p class="text-xs font-bold uppercase tracking-wider mb-3" style="color:rgba(148,163,184,0.7)">YTD ${new Date().getFullYear()}</p>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div>
              <p class="text-base font-black" style="color:#34d399">${ytdPay >= 1000 ? '$'+(ytdPay/1000).toFixed(1)+'k' : fmtMoney(ytdPay)}</p>
              <p class="text-xs" style="color:rgba(100,116,139,0.8)">${isCompany ? 'Gross Pay' : 'Revenue'}</p>
            </div>
            <div>
              <p class="text-base font-black">${ytdTrips.length}</p>
              <p class="text-xs" style="color:rgba(100,116,139,0.8)">Loads</p>
            </div>
            <div>
              <p class="text-base font-black">${isCompany ? (ytdMiles >= 1000 ? (ytdMiles/1000).toFixed(1)+'k' : ytdMiles.toLocaleString()) : (ytdExpAmt >= 1000 ? '$'+(ytdExpAmt/1000).toFixed(1)+'k' : fmtMoney(ytdExpAmt))}</p>
              <p class="text-xs" style="color:rgba(100,116,139,0.8)">${isCompany ? 'Miles' : 'Expenses'}</p>
            </div>
          </div>
        </div>
        ` : ''}

      </div>
    </div>`;

  function mount(container) {
    container.querySelector('#prev-week-btn')?.addEventListener('click', () => { _weekOffset--; window.refresh(); });
    container.querySelector('#next-week-btn')?.addEventListener('click', () => { if (_weekOffset >= 0) return; _weekOffset++; window.refresh(); });

    const openReport = () => openPayReportModal(week.start, week.end, allTrips, allExpenses, s, isCompany);
    container.querySelector('#gen-report-btn')?.addEventListener('click', openReport);
    container.querySelector('#calc-week-btn')?.addEventListener('click', openReport);
  }

  return { html, mount };
}
