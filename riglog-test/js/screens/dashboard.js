import { getTrips, getExpenses, getSettings, fmtMoney } from '../store.js';
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
  const weekHours    = weekTrips.reduce((s, t) => s + Number(t.durationHours || 0), 0);
  const weekExpTotal = weekExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const prevRevenue  = prevTrips.reduce((s, t) => s + Number(t.revenue || 0), 0) * (1 - dispatchPct / 100);

  const ytdRevenue   = ytdTrips.reduce((s, t) => s + Number(t.revenue || 0), 0);
  const ytdMiles     = ytdTrips.reduce((s, t) => s + Number(t.miles || 0), 0);
  const ytdExpTotal  = ytdExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const ytdNet       = Math.max(0, ytdRevenue - ytdExpTotal);
  const ytdTaxEst    = estTax(ytdNet);

  const costPerMile  = weekMiles > 0 ? weekExpTotal / weekMiles : null;
  const revPerHour   = weekHours > 0 ? weekRevenue / weekHours : null;
  const netProfit    = weekRevenue - weekExpTotal;
  const weekPct      = targetWeekly > 0 ? pct(weekRevenue, targetWeekly) : null;

  const weekChange = prevRevenue > 0
    ? ((weekRevenue - prevRevenue) / prevRevenue * 100).toFixed(0) : null;
  const changeStr = weekChange !== null
    ? `${Number(weekChange) >= 0 ? '↑' : '↓'} ${Math.abs(Number(weekChange))}% vs last week`
    : '';

  const bestLane = monthTrips
    .filter(t => Number(t.miles) > 0 && Number(t.revenue) > 0)
    .sort((a, b) => (Number(b.revenue)/Number(b.miles)) - (Number(a.revenue)/Number(a.miles)))[0];

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
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div class="glass-card" style="padding:14px">
            <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">Net Profit</p>
            <p class="text-2xl font-black" style="color:${netProfit >= 0 ? '#34d399' : '#f87171'}">${fmtMoney(netProfit)}</p>
            <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">Revenue − expenses</p>
          </div>
          <div class="glass-card" style="padding:14px">
            <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">Cost / Mile</p>
            <p class="text-2xl font-black">${costPerMile !== null ? fmtMoney(costPerMile, 2) : '—'}</p>
            <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">${weekMiles > 0 ? weekMiles.toLocaleString()+' mi' : 'No trips'}</p>
          </div>
          <div class="glass-card" style="padding:14px">
            <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">Rev / Hour</p>
            <p class="text-2xl font-black">${revPerHour !== null ? fmtMoney(revPerHour) : '—'}</p>
            <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">${weekHours > 0 ? weekHours.toFixed(1)+'h driven' : 'No hours'}</p>
          </div>
          <div class="glass-card" style="padding:14px">
            <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">Trips</p>
            <p class="text-2xl font-black">${weekTrips.length}</p>
            <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">${weekMiles > 0 ? weekMiles.toLocaleString()+' miles' : 'This week'}</p>
          </div>
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

        <!-- Best Lane -->
        ${bestLane ? `
        <div class="glass-card mb-3" style="padding:14px">
          <p class="text-xs mb-2 font-bold uppercase tracking-wider" style="color:rgba(148,163,184,0.7)">Best Lane This Month</p>
          <p class="font-black text-base">${bestLane.origin} → ${bestLane.destination}</p>
          <div class="flex gap-3 mt-1">
            <span class="text-sm font-bold" style="color:#0891b2">${fmtMoney(Number(bestLane.revenue)/Number(bestLane.miles),2)}/mi</span>
            <span class="text-xs" style="color:rgba(100,116,139,0.8)">${Number(bestLane.miles).toLocaleString()} mi · ${fmtMoney(bestLane.revenue)}</span>
          </div>
        </div>
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
            const dotColor = rPerM >= (Number(s.targetRPM) || 2) ? '#34d399' : rPerM >= 1.2 ? '#fbbf24' : '#f87171';
            return `
            <div class="trip-row-dash">
              <div class="trip-dot" style="background:${dotColor}"></div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold truncate">${t.origin} → ${t.destination}</p>
                <p class="text-xs" style="color:rgba(100,116,139,0.8)">${Number(t.miles||0).toLocaleString()} mi</p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-sm font-bold">${fmtMoney(t.revenue)}</p>
                ${rPerM > 0 ? `<p class="text-xs" style="color:rgba(100,116,139,0.8)">${fmtMoney(rPerM,2)}/mi</p>` : ''}
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
