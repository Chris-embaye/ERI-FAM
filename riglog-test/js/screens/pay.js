import { getTrips, getSettings, fmtMoney, fmtDate, calcTripPay } from '../store.js';

function weekBounds(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
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

export function renderPay() {
  const s = getSettings();
  const allTrips = getTrips();
  const isCompany = s.driverType === 'Company';

  const week = weekBounds(_weekOffset);
  const weekTrips = allTrips.filter(t => t.date >= week.start && t.date <= week.end);

  const grossPay = weekTrips.reduce((sum, t) => sum + (calcTripPay(t, s) || 0), 0);
  const totalMiles = weekTrips.reduce((sum, t) => sum + Number(t.miles || 0), 0);
  const totalGrossRevenue = weekTrips.reduce((sum, t) => sum + Number(t.revenue || 0), 0);

  const healthDed  = Number(s.healthInsDeductWeekly || 0);
  const k401Ded    = Number(s.k401DeductWeekly || 0);
  const otherDed   = Number(s.otherDeductWeekly || 0);
  const totalDed   = healthDed + k401Ded + otherDed;
  const netPay     = Math.max(0, grossPay - totalDed);

  // YTD (current year)
  const yearStart = new Date().getFullYear() + '-01-01';
  const ytdTrips  = allTrips.filter(t => t.date >= yearStart);
  const ytdPay    = ytdTrips.reduce((sum, t) => sum + (calcTripPay(t, s) || 0), 0);
  const ytdMiles  = ytdTrips.reduce((sum, t) => sum + Number(t.miles || 0), 0);

  const payLabel = s.companyPayType === 'percent'
    ? `${s.payPercent}% of Load`
    : `${(Number(s.cpmRate||0)*100).toFixed(1)}¢/mi`;

  const html = `
    <div class="flex flex-col h-full text-white" style="background:rgb(4,10,18)">

      <!-- Header -->
      <div class="dash-header shrink-0">
        <div>
          <h1 class="text-xl font-black">Pay Ledger</h1>
          <p class="text-xs" style="color:rgba(100,200,255,0.5)">${s.carrierName || 'Company Driver'} · ${payLabel}</p>
        </div>
        <button onclick="navigate('more')" style="font-size:1.3rem;background:none;border:none;color:rgba(148,163,184,0.7);padding:4px">✕</button>
      </div>

      <!-- Week selector -->
      <div class="flex items-center justify-between px-4 py-2 shrink-0" style="border-bottom:1px solid rgba(255,255,255,0.06)">
        <button id="prev-week-btn" class="px-3 py-1.5 rounded-xl text-sm font-bold" style="background:rgba(255,255,255,0.06);color:#94a3b8">‹ Prev</button>
        <p class="text-xs font-bold text-center" style="color:#e0f2fe">${week.label}</p>
        <button id="next-week-btn" class="px-3 py-1.5 rounded-xl text-sm font-bold" style="background:rgba(255,255,255,0.06);color:${_weekOffset < 0 ? '#94a3b8' : 'rgba(100,116,139,0.3)'}">Next ›</button>
      </div>

      <div class="flex-1 overflow-y-auto" style="padding:14px 14px 80px">

        ${!isCompany ? `
          <div class="glass-card text-center py-8">
            <p class="text-2xl mb-2">💼</p>
            <p class="font-bold">Switch to Company Driver</p>
            <p class="text-sm mt-1" style="color:rgba(148,163,184,0.6)">Set Driver Type to "Company Driver" in Settings to use Pay Ledger.</p>
            <button onclick="navigate('settings')" class="btn-primary mt-4 mx-auto" style="width:auto;padding:8px 20px">Open Settings</button>
          </div>
        ` : weekTrips.length === 0 ? `
          <div class="glass-card text-center py-8">
            <p class="text-3xl mb-2">📭</p>
            <p class="font-bold">No trips this week</p>
            <p class="text-sm mt-1" style="color:rgba(148,163,184,0.6)">Log trips on the Trips tab to see your pay here.</p>
          </div>
        ` : `

          <!-- Pay Summary Card -->
          <div class="dash-hero-card mb-3">
            <p class="text-xs font-bold uppercase tracking-wider mb-1" style="color:rgba(255,255,255,0.5)">Net Take-Home</p>
            <p class="text-5xl font-black" style="letter-spacing:-1px">${fmtMoney(netPay)}</p>
            <p class="text-xs mt-1" style="color:rgba(255,255,255,0.45)">Gross ${fmtMoney(grossPay)} · Deductions ${fmtMoney(totalDed)}</p>
          </div>

          <!-- Pay Breakdown -->
          <div class="glass-card mb-3" style="padding:14px">
            <p class="text-xs font-bold uppercase tracking-wider mb-3" style="color:rgba(148,163,184,0.7)">Pay Breakdown</p>
            <div class="space-y-2">
              <div class="flex justify-between text-sm py-1.5" style="border-bottom:1px solid rgba(255,255,255,0.05)">
                <span style="color:rgba(203,213,225,0.8)">Gross Pay (${payLabel})</span>
                <span class="font-bold text-green-400">${fmtMoney(grossPay)}</span>
              </div>
              ${healthDed > 0 ? `
              <div class="flex justify-between text-sm py-1.5" style="border-bottom:1px solid rgba(255,255,255,0.05)">
                <span style="color:rgba(203,213,225,0.8)">Health Insurance</span>
                <span class="font-bold text-red-400">- ${fmtMoney(healthDed)}</span>
              </div>` : ''}
              ${k401Ded > 0 ? `
              <div class="flex justify-between text-sm py-1.5" style="border-bottom:1px solid rgba(255,255,255,0.05)">
                <span style="color:rgba(203,213,225,0.8)">401(k) / Retirement</span>
                <span class="font-bold text-red-400">- ${fmtMoney(k401Ded)}</span>
              </div>` : ''}
              ${otherDed > 0 ? `
              <div class="flex justify-between text-sm py-1.5" style="border-bottom:1px solid rgba(255,255,255,0.05)">
                <span style="color:rgba(203,213,225,0.8)">Other Deductions</span>
                <span class="font-bold text-red-400">- ${fmtMoney(otherDed)}</span>
              </div>` : ''}
              <div class="flex justify-between text-sm pt-1.5">
                <span class="font-black">Net Take-Home</span>
                <span class="font-black text-green-400">${fmtMoney(netPay)}</span>
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
              <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">${s.companyPayType==='cpm' ? fmtMoney(grossPay/Math.max(totalMiles,1),2)+'/mi' : 'driven'}</p>
            </div>
            <div class="glass-card" style="padding:12px">
              <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">${s.companyPayType==='percent' ? 'Gross Rev' : 'Avg/Load'}</p>
              <p class="text-xl font-black">${s.companyPayType==='percent' ? fmtMoney(totalGrossRevenue) : fmtMoney(grossPay/Math.max(weekTrips.length,1))}</p>
              <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">${s.companyPayType==='percent' ? 'total loads' : 'per load'}</p>
            </div>
          </div>

          <!-- Per-Trip List -->
          <div class="glass-card" style="padding:14px">
            <p class="text-xs font-bold uppercase tracking-wider mb-3" style="color:rgba(148,163,184,0.7)">Trips This Week</p>
            ${weekTrips.map(t => {
              const pay = calcTripPay(t, s) || 0;
              return `
              <div class="flex items-center gap-3 py-2.5" style="border-bottom:1px solid rgba(255,255,255,0.05)">
                <div class="shrink-0 text-center" style="width:36px">
                  <p class="text-xs font-bold" style="color:rgba(100,116,139,0.8)">${fmtDate(t.date).slice(0,6)}</p>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold truncate">${t.origin || '?'} → ${t.destination || '?'}</p>
                  <p class="text-xs" style="color:rgba(100,116,139,0.8)">${Number(t.miles||0).toLocaleString()} mi${t.loadNum ? ' · #'+t.loadNum : ''}${s.companyPayType==='percent' ? ' · '+fmtMoney(t.revenue)+' load' : ''}</p>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-sm font-black text-green-400">${fmtMoney(pay)}</p>
                  <p class="text-xs" style="color:rgba(100,116,139,0.8)">${s.companyPayType==='cpm' ? (Number(s.cpmRate||0)*100).toFixed(1)+'¢/mi' : s.payPercent+'%'}</p>
                </div>
              </div>`;
            }).join('')}
          </div>

        `}

        <!-- YTD Summary -->
        ${isCompany && ytdPay > 0 ? `
        <div class="glass-card mt-3" style="padding:14px">
          <p class="text-xs font-bold uppercase tracking-wider mb-3" style="color:rgba(148,163,184,0.7)">YTD ${new Date().getFullYear()}</p>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div>
              <p class="text-base font-black" style="color:#34d399">${ytdPay >= 1000 ? '$'+(ytdPay/1000).toFixed(1)+'k' : fmtMoney(ytdPay)}</p>
              <p class="text-xs" style="color:rgba(100,116,139,0.8)">Gross Pay</p>
            </div>
            <div>
              <p class="text-base font-black">${ytdTrips.length}</p>
              <p class="text-xs" style="color:rgba(100,116,139,0.8)">Loads</p>
            </div>
            <div>
              <p class="text-base font-black">${ytdMiles >= 1000 ? (ytdMiles/1000).toFixed(1)+'k' : ytdMiles.toLocaleString()}</p>
              <p class="text-xs" style="color:rgba(100,116,139,0.8)">Miles</p>
            </div>
          </div>
        </div>
        ` : ''}

      </div>
    </div>`;

  function mount(container) {
    container.querySelector('#prev-week-btn')?.addEventListener('click', () => {
      _weekOffset--;
      window.refresh();
    });
    container.querySelector('#next-week-btn')?.addEventListener('click', () => {
      if (_weekOffset >= 0) return;
      _weekOffset++;
      window.refresh();
    });
  }

  return { html, mount };
}
