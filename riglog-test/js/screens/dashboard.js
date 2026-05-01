import { getTrips, getExpenses, getSettings, fmtMoney, calcTripPay } from '../store.js';
import { getCurrentUser } from '../auth.js';

function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}
function yearStart() { return `${new Date().getFullYear()}-01-01`; }

function estTax(net) {
  if (net <= 0) return 0;
  const se = net * 0.9235 * 0.153;
  const agi = Math.max(0, net - se * 0.5 - 15000);
  let fed = 0;
  const brackets = [[11925,0.10],[48475,0.12],[103350,0.22],[197300,0.24],[Infinity,0.32]];
  let prev = 0;
  for (const [lim, rate] of brackets) {
    if (agi <= prev) break;
    fed += (Math.min(agi, lim) - prev) * rate;
    prev = lim;
  }
  return se + fed;
}

function pct(v, total) {
  return total > 0 ? Math.min(100, Math.round(v / total * 100)) : 0;
}

export function renderDashboard() {
  const allTrips    = getTrips();
  const allExpenses = getExpenses();
  const s           = getSettings();
  const dispatchPct = Number(s.dispatchPct) || 0;
  const targetWeekly = Number(s.targetWeeklyRevenue) || 0;

  const weekAgo        = daysAgo(7);
  const twoWeeksAgo    = daysAgo(14);
  const thisMonthStart = monthStart();
  const thisYearStart  = yearStart();

  const weekTrips    = allTrips.filter(t => t.date >= weekAgo);
  const weekExpenses = allExpenses.filter(e => e.date >= weekAgo);
  const prevTrips    = allTrips.filter(t => t.date >= twoWeeksAgo && t.date < weekAgo);
  const monthTrips   = allTrips.filter(t => t.date >= thisMonthStart);
  const ytdTrips     = allTrips.filter(t => t.date >= thisYearStart);
  const ytdExpenses  = allExpenses.filter(e => e.date >= thisYearStart);

  const weekGross    = weekTrips.reduce((s, t) => s + Number(t.revenue || 0), 0);
  const weekRevenue  = weekGross * (1 - dispatchPct / 100);
  const weekMiles    = weekTrips.reduce((s, t) => s + Number(t.miles || 0), 0);
  const weekExpTotal = weekExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const prevRevenue  = prevTrips.reduce((s, t) => s + Number(t.revenue || 0), 0) * (1 - dispatchPct / 100);

  const ytdRevenue   = ytdTrips.reduce((s, t) => s + Number(t.revenue || 0), 0);
  const ytdMiles     = ytdTrips.reduce((s, t) => s + Number(t.miles || 0), 0);
  const ytdExpTotal  = ytdExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const ytdNet       = Math.max(0, ytdRevenue - ytdExpTotal);
  const ytdTaxEst    = estTax(ytdNet);

  const costPerMile  = weekMiles > 0 ? weekExpTotal / weekMiles : null;
  const netProfit    = weekRevenue - weekExpTotal;
  const weekPct      = targetWeekly > 0 ? pct(weekRevenue, targetWeekly) : null;

  const isCompany = s.driverType === 'Company';
  const weekPay = isCompany
    ? weekTrips.reduce((sum, t) => sum + (calcTripPay(t, s) || 0), 0)
    : null;
  const weekDeductions = isCompany
    ? (Number(s.healthInsDeductWeekly||0) + Number(s.k401DeductWeekly||0) + Number(s.otherDeductWeekly||0))
    : 0;
  const weekNetPay = weekPay !== null ? Math.max(0, weekPay - weekDeductions) : null;
  const mileGuarantee = Number(s.weeklyMilesGuarantee || 0);
  const milesGuaranteePct = mileGuarantee > 0 ? Math.min(100, Math.round(weekMiles / mileGuarantee * 100)) : null;

  const weekChange = prevRevenue > 0
    ? ((weekRevenue - prevRevenue) / prevRevenue * 100).toFixed(0) : null;
  const changeStr = weekChange !== null
    ? `${Number(weekChange) >= 0 ? '↑' : '↓'} ${Math.abs(Number(weekChange))}% vs last week`
    : '';

  const isEmpty = allTrips.length === 0 && allExpenses.length === 0;
  const user    = getCurrentUser();
  const firstName = user?.displayName ? user.displayName.split(' ')[0] : null;
  const todayStr  = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const avatarLetter = user?.displayName
    ? user.displayName.trim()[0].toUpperCase()
    : user?.email?.[0].toUpperCase() ?? '?';

  const truckLabel = [s.truckYear, s.truckMake, s.truckModel].filter(Boolean).join(' ') || s.truckId || 'My Truck';

  const html = `
    <div class="flex flex-col h-full text-white" style="background:rgb(4,10,18)">

      <!-- Header -->
      <div class="dash-header shrink-0">
        <div>
          <h1 class="text-xl font-black tracking-tight">${firstName ? `Hey, ${firstName} 👋` : 'Dashboard'}</h1>
          <p class="text-xs" style="color:rgba(100,200,255,0.5)">${todayStr} · ${truckLabel}</p>
        </div>
        <button onclick="navigate('settings')"
          class="w-10 h-10 rounded-full flex items-center justify-center font-black text-base shrink-0 overflow-hidden"
          style="background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff">
          ${user?.photoURL
            ? `<img src="${user.photoURL}" class="w-10 h-10 rounded-full object-cover" alt="">`
            : avatarLetter}
        </button>
      </div>

      <div class="flex-1 overflow-y-auto" style="padding:12px 12px 32px">

        ${isEmpty ? `
          <div class="flex flex-col items-center justify-center py-16 space-y-4 text-center px-8">
            <div class="text-6xl mb-2">🚛</div>
            <h2 class="text-xl font-black">Welcome to RigLog TEST</h2>
            <p class="text-sm" style="color:rgba(148,163,184,0.8)">This is your isolated test environment. Data here never touches production.</p>
            <div class="flex gap-3 mt-2">
              <button onclick="navigate('trips')" class="font-bold px-5 py-2.5 rounded-xl text-sm" style="background:#0891b2;color:#fff">Log First Trip</button>
              <button onclick="navigate('expenses')" class="font-bold px-5 py-2.5 rounded-xl text-sm" style="background:rgba(255,255,255,0.07);color:#fff">Add Expense</button>
            </div>
          </div>
        ` : `

        <!-- Hero Revenue Card -->
        ${isCompany ? `
<div class="dash-hero-card">
  <div class="flex justify-between items-start mb-1">
    <p class="text-xs font-bold uppercase tracking-wider" style="color:rgba(255,255,255,0.55)">
      Est. Weekly Pay · ${s.companyPayType === 'percent' ? s.payPercent+'% of load' : (Number(s.cpmRate||0)*100).toFixed(1)+'¢/mi'}
    </p>
    <button onclick="navigate('pay')" class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:rgba(255,255,255,0.10);color:rgba(255,255,255,0.75)">Pay Ledger →</button>
  </div>
  <p class="text-5xl font-black mb-1" style="letter-spacing:-1px">${fmtMoney(weekNetPay || 0)}</p>
  <p class="text-xs" style="color:rgba(255,255,255,0.5)">Gross ${fmtMoney(weekPay||0)} · Deductions ${fmtMoney(weekDeductions)}</p>
  ${milesGuaranteePct !== null ? `
  <div class="mt-3">
    <div class="flex justify-between text-xs mb-1" style="color:rgba(255,255,255,0.6)">
      <span>Miles guarantee</span>
      <span>${weekMiles.toLocaleString()} / ${mileGuarantee.toLocaleString()} mi (${milesGuaranteePct}%)</span>
    </div>
    <div class="h-1.5 rounded-full overflow-hidden" style="background:rgba(255,255,255,0.15)">
      <div class="h-full rounded-full" style="width:${milesGuaranteePct}%;background:rgba(255,255,255,0.85)"></div>
    </div>
  </div>` : ''}
</div>
` : `
<div class="dash-hero-card">
  <div class="flex justify-between items-start mb-1">
    <p class="text-xs font-bold uppercase tracking-wider" style="color:rgba(255,255,255,0.55)">
      ${dispatchPct > 0 ? `Net Revenue (after ${dispatchPct}% dispatch)` : 'Weekly Revenue'}
    </p>
    ${changeStr ? `<span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:rgba(255,255,255,0.12);color:rgba(255,255,255,0.8)">${changeStr}</span>` : ''}
  </div>
  <p class="text-5xl font-black mb-1" style="letter-spacing:-1px">${fmtMoney(weekRevenue)}</p>
  ${dispatchPct > 0 ? `<p class="text-xs" style="color:rgba(255,255,255,0.5)">Gross ${fmtMoney(weekGross)} · Dispatch ${fmtMoney(weekGross-weekRevenue)}</p>` : ''}
  ${weekPct !== null ? `
  <div class="mt-3">
    <div class="flex justify-between text-xs mb-1" style="color:rgba(255,255,255,0.6)">
      <span>Weekly goal</span>
      <span>${weekPct}% of ${fmtMoney(targetWeekly)}</span>
    </div>
    <div class="h-1.5 rounded-full overflow-hidden" style="background:rgba(255,255,255,0.15)">
      <div class="h-full rounded-full transition-all" style="width:${weekPct}%;background:rgba(255,255,255,0.85)"></div>
    </div>
  </div>` : ''}
</div>
`}

        <!-- Quick Actions -->
        <div class="grid grid-cols-4 gap-2 mb-3">
          ${[
            ['trips','🗺','Trip'],
            ['expenses','💳','Expense'],
            ['detention','⏱','Detention'],
            ['fuel','⛽','Fuel'],
          ].map(([screen, icon, label]) => `
            <button onclick="navigate('${screen}')"
              class="flex flex-col items-center gap-1 py-3 rounded-2xl font-bold text-xs"
              style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06)">
              <span class="text-xl">${icon}</span>
              <span style="color:rgba(148,163,184,0.9)">${label}</span>
            </button>
          `).join('')}
        </div>

        <!-- Stats Grid -->
        <div class="grid grid-cols-3 gap-2 mb-3">
          ${isCompany ? `
            <div class="glass-card" style="padding:12px">
              <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">Est. Pay</p>
              <p class="text-xl font-black" style="color:#34d399">${fmtMoney(weekNetPay||0)}</p>
              <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">This week</p>
            </div>
            <div class="glass-card" style="padding:12px">
              <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">Miles</p>
              <p class="text-xl font-black">${weekMiles > 0 ? weekMiles.toLocaleString() : '0'}</p>
              <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">${mileGuarantee > 0 ? 'of '+mileGuarantee.toLocaleString()+' guar.' : 'This week'}</p>
            </div>
            <div class="glass-card" style="padding:12px">
              <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">Loads</p>
              <p class="text-xl font-black">${weekTrips.length}</p>
              <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">This week</p>
            </div>
          ` : `
            <div class="glass-card" style="padding:12px">
              <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">Net Profit</p>
              <p class="text-xl font-black" style="color:${netProfit >= 0 ? '#34d399' : '#f87171'}">${fmtMoney(netProfit)}</p>
              <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">This week</p>
            </div>
            <div class="glass-card" style="padding:12px">
              <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">Cost / Mile</p>
              <p class="text-xl font-black">${costPerMile !== null ? fmtMoney(costPerMile, 2) : '—'}</p>
              <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">${weekMiles > 0 ? weekMiles.toLocaleString()+' mi' : 'No trips'}</p>
            </div>
            <div class="glass-card" style="padding:12px">
              <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">Trips</p>
              <p class="text-xl font-black">${weekTrips.length}</p>
              <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">${weekMiles > 0 ? weekMiles.toLocaleString()+' mi' : 'This week'}</p>
            </div>
          `}
        </div>

        <!-- YTD Summary -->
        ${ytdRevenue > 0 ? `
        <button onclick="navigate('tax')" class="glass-card w-full text-left mb-3" style="padding:14px">
          <div class="flex justify-between items-center mb-3">
            <p class="text-xs font-bold uppercase tracking-wider" style="color:rgba(148,163,184,0.7)">YTD ${new Date().getFullYear()}</p>
            <span class="text-xs font-bold" style="color:#0891b2">Tax Summary →</span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div>
              <p class="text-base font-black">${ytdRevenue >= 1000 ? '$'+(ytdRevenue/1000).toFixed(1)+'k' : fmtMoney(ytdRevenue)}</p>
              <p class="text-xs" style="color:rgba(100,116,139,0.8)">Revenue</p>
            </div>
            <div>
              <p class="text-base font-black">${ytdMiles >= 1000 ? (ytdMiles/1000).toFixed(1)+'k mi' : ytdMiles.toLocaleString()}</p>
              <p class="text-xs" style="color:rgba(100,116,139,0.8)">Miles</p>
            </div>
            <div>
              <p class="text-base font-black" style="color:#f87171">${fmtMoney(ytdTaxEst)}</p>
              <p class="text-xs" style="color:rgba(100,116,139,0.8)">Est. Tax</p>
            </div>
          </div>
        </button>
        ` : ''}

        <!-- Recent Trips -->
        ${weekTrips.length > 0 ? `
        <div class="glass-card" style="padding:14px">
          <div class="flex justify-between items-center mb-3">
            <p class="text-xs font-bold uppercase tracking-wider" style="color:rgba(148,163,184,0.7)">Recent Trips</p>
            <button onclick="navigate('trips')" class="text-xs font-bold" style="color:#0891b2">See All</button>
          </div>
          ${weekTrips.slice(0, 4).map(t => {
            const rPerM = Number(t.miles) > 0 ? Number(t.revenue)/Number(t.miles) : 0;
            const dotColor = isCompany
              ? '#34d399'
              : (rPerM >= (Number(s.targetRPM)||2) ? '#34d399' : rPerM >= 1.2 ? '#fbbf24' : '#f87171');
            const tripPay = calcTripPay(t, s);
            return `
            <div class="trip-row-dash">
              <div class="trip-dot" style="background:${dotColor}"></div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold truncate">${t.origin} → ${t.destination}</p>
                <p class="text-xs" style="color:rgba(100,116,139,0.8)">${Number(t.miles||0).toLocaleString()} mi${isCompany && s.companyPayType==='percent' ? ` · $${fmtMoney(t.revenue)} load` : ''}</p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-sm font-bold">${isCompany && tripPay !== null ? fmtMoney(tripPay) : fmtMoney(t.revenue)}</p>
                ${isCompany
                  ? `<p class="text-xs" style="color:rgba(100,116,139,0.8)">${s.companyPayType==='cpm' ? (Number(s.cpmRate||0)*100).toFixed(1)+'¢/mi' : s.payPercent+'%'}</p>`
                  : (rPerM > 0 ? `<p class="text-xs" style="color:rgba(100,116,139,0.8)">${fmtMoney(rPerM,2)}/mi</p>` : '')}
              </div>
            </div>`;
          }).join('')}
        </div>
        ` : ''}

        <!-- Weekly Expenses -->
        ${weekExpenses.length > 0 ? `
        <div class="glass-card mt-3" style="padding:14px">
          <div class="flex justify-between items-center mb-3">
            <p class="text-xs font-bold uppercase tracking-wider" style="color:rgba(148,163,184,0.7)">Expenses This Week</p>
            <span class="text-sm font-black" style="color:#f87171">${fmtMoney(weekExpTotal)}</span>
          </div>
          ${weekExpenses.slice(0, 4).map(e => `
            <div class="flex justify-between items-center text-sm py-1.5" style="border-bottom:1px solid rgba(255,255,255,0.04)">
              <span style="color:rgba(203,213,225,0.8)">${e.category}${e.description ? ` · ${e.description}` : ''}</span>
              <span class="font-bold">${fmtMoney(e.amount,2)}</span>
            </div>
          `).join('')}
          ${weekExpenses.length > 4 ? `<p class="text-xs mt-2" style="color:rgba(100,116,139,0.7)">+${weekExpenses.length-4} more</p>` : ''}
        </div>
        ` : ''}

        `}
      </div>
    </div>`;

  return { html, mount: null };
}
