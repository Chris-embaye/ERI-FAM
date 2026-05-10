import { getTrips, getExpenses, getSettings, fmtMoney } from '../store.js';
import { getCurrentUser } from '../auth.js';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function yearStart() {
  return `${new Date().getFullYear()}-01-01`;
}

// Estimate total tax (SE + rough federal) for YTD net income
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

export function renderDashboard() {
  const allTrips    = getTrips()   || [];
  const allExpenses = getExpenses() || [];
  const settings    = getSettings();
  const dispatchPct = Number(settings.dispatchPct) || 0;

  const weekAgo      = daysAgo(7);
  const twoWeeksAgo  = daysAgo(14);
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
  // Apply same dispatch % to prev week so the comparison is apples-to-apples
  const prevRevenue  = prevTrips.reduce((s, t) => s + Number(t.revenue || 0), 0) * (1 - dispatchPct / 100);

  const ytdRevenue  = ytdTrips.reduce((s, t) => s + Number(t.revenue || 0), 0);
  const ytdMiles    = ytdTrips.reduce((s, t) => s + Number(t.miles || 0), 0);
  const ytdExpTotal = ytdExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const ytdNet      = Math.max(0, ytdRevenue - ytdExpTotal);
  const ytdTaxEst   = estTax(ytdNet);

  const costPerMile = weekMiles > 0 ? weekExpTotal / weekMiles : null;
  const revPerHour  = weekHours > 0 ? weekRevenue / weekHours : null;

  const weekChange = prevRevenue > 0
    ? ((weekRevenue - prevRevenue) / prevRevenue * 100).toFixed(0)
    : null;

  const changeStr = weekChange !== null
    ? `${Number(weekChange) >= 0 ? '↑' : '↓'} ${Math.abs(Number(weekChange))}% vs last week`
    : 'No prior week comparison';

  // 8-week revenue sparkline data (oldest → newest)
  const weekBuckets = [];
  for (let i = 7; i >= 0; i--) {
    const endDate   = daysAgo(i * 7);
    const startDate = daysAgo(i * 7 + 6);
    const rev = allTrips
      .filter(t => t.date >= startDate && t.date <= endDate)
      .reduce((s, t) => s + Number(t.revenue || 0), 0) * (1 - dispatchPct / 100);
    const d = new Date(endDate + 'T12:00:00');
    const label = i === 0 ? 'Now' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    weekBuckets.push({ rev, label, isCurrent: i === 0 });
  }
  const maxBucketRev = Math.max(...weekBuckets.map(w => w.rev), 1);
  const avgBucketRev = weekBuckets.reduce((s, w) => s + w.rev, 0) / 8;

  const bestLane = monthTrips
    .filter(t => Number(t.miles) > 0 && Number(t.revenue) > 0)
    .sort((a, b) => (Number(b.revenue) / Number(b.miles)) - (Number(a.revenue) / Number(a.miles)))[0];

  // Monthly expense breakdown by category
  const monthExpenses = allExpenses.filter(e => e.date >= thisMonthStart);
  const expByCat = {};
  monthExpenses.forEach(e => {
    const cat = e.category || 'Other';
    expByCat[cat] = (expByCat[cat] || 0) + Number(e.amount || 0);
  });
  const expCatEntries = Object.entries(expByCat).sort((a, b) => b[1] - a[1]);
  const maxExpCat = Math.max(...expCatEntries.map(([, v]) => v), 1);

  const isEmpty = allTrips.length === 0 && allExpenses.length === 0;

  const user = getCurrentUser();
  const greeting = user?.displayName ? `Hey, ${user.displayName.split(' ')[0]}` : 'Dashboard';
  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const avatarLetter = user?.displayName
    ? user.displayName.trim()[0].toUpperCase()
    : user?.email?.[0].toUpperCase() ?? '?';

  const html = `
    <div class="flex flex-col h-full bg-black text-white">
      <div class="px-4 pt-5 pb-4 border-b border-gray-800 flex justify-between items-center shrink-0">
        <div>
          <h1 class="text-2xl font-black tracking-tight">${greeting}</h1>
          <p class="text-xs text-gray-500">This week's performance · ${todayStr}</p>
        </div>
        <button onclick="navigate('settings')"
          class="w-9 h-9 rounded-full bg-orange-600 flex items-center justify-center text-black font-black text-base shrink-0">
          ${user?.photoURL
            ? `<img src="${user.photoURL}" class="w-9 h-9 rounded-full object-cover" alt="">`
            : avatarLetter}
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        ${isEmpty ? `
          <div class="flex flex-col items-center justify-center py-16 space-y-4 text-center">
            <div class="text-6xl">🚛</div>
            <h2 class="text-xl font-black">Welcome to Rig Log</h2>
            <p class="text-gray-400 text-sm px-8">Log trips, track expenses, time detention, and inspect your truck — all in one place.</p>
            <div class="flex gap-3">
              <button onclick="navigate('trips')" class="bg-orange-600 text-black font-bold px-5 py-2.5 rounded-xl text-sm">Log First Trip</button>
              <button onclick="navigate('expenses')" class="bg-gray-800 text-white font-bold px-5 py-2.5 rounded-xl text-sm">Add Expense</button>
            </div>
          </div>
        ` : `

        <!-- YTD Summary bar -->
        ${ytdRevenue > 0 ? `
        <button onclick="navigate('tax')" class="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-left">
          <div class="flex justify-between items-center mb-2">
            <p class="text-xs font-bold uppercase tracking-wider text-gray-400">YTD ${new Date().getFullYear()}</p>
            <span class="text-xs text-orange-600 font-bold">Tax Summary →</span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div>
              <p class="text-base font-black">${ytdRevenue >= 1000 ? '$'+(ytdRevenue/1000).toFixed(1)+'k' : fmtMoney(ytdRevenue)}</p>
              <p class="text-xs text-gray-500">Revenue</p>
            </div>
            <div>
              <p class="text-base font-black">${ytdMiles >= 1000 ? (ytdMiles/1000).toFixed(1)+'k' : ytdMiles.toLocaleString()}</p>
              <p class="text-xs text-gray-500">Miles</p>
            </div>
            <div>
              <p class="text-base font-black text-orange-600">${fmtMoney(ytdTaxEst)}</p>
              <p class="text-xs text-gray-500">Est. Tax</p>
            </div>
          </div>
        </button>
        ` : ''}

        <!-- Weekly revenue hero card -->
        <div class="bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl p-5">
          <p class="text-xs font-bold uppercase opacity-75 mb-1 tracking-wider">
            Weekly ${dispatchPct > 0 ? 'Net Revenue (after ' + dispatchPct + '% dispatch)' : 'Revenue'}
          </p>
          <p class="text-5xl font-black text-black">${fmtMoney(weekRevenue)}</p>
          ${dispatchPct > 0 ? `<p class="text-xs text-black/60 mt-0.5">Gross: ${fmtMoney(weekGross)} · Dispatch cut: ${fmtMoney(weekGross - weekRevenue)}</p>` : ''}
          <p class="text-xs mt-1 text-black/70">${changeStr}</p>
        </div>

        <!-- 8-week revenue chart -->
        ${allTrips.length > 0 ? `
        <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div class="flex justify-between items-center mb-3">
            <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">8-Week Revenue</p>
            <p class="text-xs text-gray-500">${fmtMoney(avgBucketRev)}/wk avg</p>
          </div>
          <div class="flex items-end gap-1.5" style="height:60px">
            ${weekBuckets.map(w => {
              const pct = Math.max(Math.round(w.rev / maxBucketRev * 100), w.rev > 0 ? 4 : 2);
              const bg  = w.isCurrent ? '#ea580c' : w.rev > 0 ? '#4b5563' : '#1f2937';
              return `<div class="flex-1 rounded-sm" style="height:${pct}%;background:${bg}"></div>`;
            }).join('')}
          </div>
          <div class="flex gap-1.5 mt-1.5">
            ${weekBuckets.map(w =>
              `<div class="flex-1 text-center truncate" style="font-size:8px;color:${w.isCurrent ? '#ea580c' : '#6b7280'}">${w.label}</div>`
            ).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Key metrics grid -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p class="text-xs text-gray-400 mb-1">Cost / Mile</p>
            <p class="text-2xl font-black">${costPerMile !== null ? fmtMoney(costPerMile, 2) : '—'}</p>
            <p class="text-xs text-gray-600 mt-1">${weekMiles > 0 ? weekMiles.toLocaleString() + ' mi driven' : 'No trips this week'}</p>
          </div>
          <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p class="text-xs text-gray-400 mb-1">Revenue / Hour</p>
            <p class="text-2xl font-black">${revPerHour !== null ? fmtMoney(revPerHour) : '—'}</p>
            <p class="text-xs text-gray-600 mt-1">${weekHours > 0 ? weekHours.toFixed(1) + ' hours driven' : 'No hours logged'}</p>
          </div>
        </div>

        ${bestLane ? `
        <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p class="text-xs text-gray-400 mb-2">Best Lane This Month</p>
          <p class="font-black text-lg">${bestLane.origin} → ${bestLane.destination}</p>
          <p class="text-orange-600 font-bold">${fmtMoney(Number(bestLane.revenue) / Number(bestLane.miles), 2)}/mile</p>
          <p class="text-xs text-gray-500 mt-1">${Number(bestLane.miles).toLocaleString()} mi · ${fmtMoney(bestLane.revenue)} total</p>
        </div>
        ` : ''}

        <div class="grid grid-cols-3 gap-2">
          <div class="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center">
            <p class="text-xl font-black">${weekTrips.length}</p>
            <p class="text-xs text-gray-500">Trips</p>
          </div>
          <div class="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center">
            <p class="text-xl font-black">${weekMiles > 999 ? (weekMiles/1000).toFixed(1)+'k' : weekMiles || '0'}</p>
            <p class="text-xs text-gray-500">Miles</p>
          </div>
          <div class="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center">
            <p class="text-xl font-black">${weekHours > 0 ? Math.round(weekHours) : '0'}h</p>
            <p class="text-xs text-gray-500">Hours</p>
          </div>
        </div>

        ${weekExpenses.length > 0 ? `
        <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div class="flex justify-between items-center mb-3">
            <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">Expenses This Week</p>
            <span class="text-orange-600 font-black">${fmtMoney(weekExpTotal)}</span>
          </div>
          ${weekExpenses.slice(0, 4).map(e => `
            <div class="flex justify-between items-center text-sm py-1.5 border-b border-gray-800/50 last:border-0">
              <span class="text-gray-300">${e.category}${e.description ? ` · ${e.description}` : ''}</span>
              <span class="font-bold">${fmtMoney(e.amount, 2)}</span>
            </div>
          `).join('')}
          ${weekExpenses.length > 4 ? `<p class="text-xs text-gray-500 mt-2">+${weekExpenses.length - 4} more</p>` : ''}
        </div>
        ` : ''}

        ${expCatEntries.length > 0 ? `
        <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div class="flex justify-between items-center mb-3">
            <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">This Month's Expenses</p>
            <span class="text-xs text-orange-600 font-bold">${fmtMoney(monthExpenses.reduce((s, e) => s + Number(e.amount || 0), 0))}</span>
          </div>
          ${expCatEntries.map(([cat, amt]) => {
            const pct = Math.max(Math.round(amt / maxExpCat * 100), 4);
            return `<div class="flex items-center gap-2 mb-2 last:mb-0">
              <span class="text-xs text-gray-400 w-24 truncate shrink-0">${cat}</span>
              <div class="flex-1 bg-gray-800 rounded-full h-2">
                <div class="h-2 rounded-full bg-orange-600" style="width:${pct}%"></div>
              </div>
              <span class="text-xs text-gray-300 font-bold w-14 text-right shrink-0">${fmtMoney(amt)}</span>
            </div>`;
          }).join('')}
        </div>
        ` : ''}

        ${weekTrips.length > 0 ? `
        <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">Recent Trips</p>
          ${weekTrips.slice(0, 3).map(t => {
            const rPerM = Number(t.miles) > 0 ? Number(t.revenue) / Number(t.miles) : 0;
            const color = rPerM >= 1.5 ? 'border-green-600' : rPerM >= 1.0 ? 'border-orange-600' : 'border-gray-600';
            return `
            <div class="border-l-4 ${color} pl-3 mb-3 last:mb-0">
              <p class="font-bold text-sm">${t.origin} → ${t.destination}</p>
              <p class="text-xs text-gray-400">${Number(t.miles).toLocaleString()} mi · ${fmtMoney(t.revenue)} · ${rPerM > 0 ? fmtMoney(rPerM, 2)+'/mi' : ''}</p>
            </div>`;
          }).join('')}
        </div>
        ` : ''}

        `}
        <div style="height:8px"></div>
      </div>
    </div>
  `;

  return { html, mount: null };
}
