import { getPTrips, getPFuelLogs, getPExpenses, getPSettings, getPMaintenanceLogs, fmtMoney, fmtDate } from '../store.js';
import { getCurrentUser } from '../auth.js';

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

export function renderPersonalDashboard() {
  const trips    = getPTrips();
  const fuel     = getPFuelLogs();
  const expenses = getPExpenses();
  const maint    = getPMaintenanceLogs();
  const s        = getPSettings();
  const user     = getCurrentUser();

  const ms = monthStart();
  const firstName     = user?.displayName ? user.displayName.split(' ')[0] : null;
  const todayStr      = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const avatarLetter  = user?.displayName ? user.displayName.trim()[0].toUpperCase() : user?.email?.[0].toUpperCase() ?? '?';
  const vehicleLabel  = [s.vehicleYear, s.vehicleMake, s.vehicleModel].filter(Boolean).join(' ') || s.vehicleNickname || 'My Car';

  const monthTrips    = trips.filter(t => t.date >= ms);
  const monthFuel     = fuel.filter(f => f.date >= ms);
  const monthExpenses = expenses.filter(e => e.date >= ms);

  const monthMiles    = monthTrips.reduce((s, t) => s + Number(t.miles || 0), 0);
  const monthFuelCost = monthFuel.reduce((s, f) => s + Number(f.totalCost || 0), 0);
  const monthFuelGal  = monthFuel.reduce((s, f) => s + Number(f.gallons || 0), 0);
  const monthExpCost  = monthExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const monthTotal    = monthFuelCost + monthExpCost;

  // Average MPG from fuel logs
  const fuelWithMiles = fuel.filter(f => f.miles && f.gallons);
  const avgMPG        = fuelWithMiles.length > 0
    ? fuelWithMiles.reduce((s, f) => s + Number(f.miles) / Number(f.gallons), 0) / fuelWithMiles.length
    : null;

  // Maintenance alerts
  const odo = Number(s.currentOdometer) || 0;
  const MAINT_INTERVALS = { oil:5000, tires:10000, brakes:20000, airfilt:15000, other:null };
  const lastByType = {};
  maint.forEach(m => { if (!lastByType[m.serviceType]) lastByType[m.serviceType] = m; });
  const maintAlerts = Object.values(lastByType).filter(m => {
    const iv = m.customInterval || MAINT_INTERVALS[m.serviceType];
    if (!iv || !m.odometer || !odo) return false;
    return (Number(m.odometer) + iv - odo) <= 1000;
  }).length;

  const isEmpty = trips.length === 0 && fuel.length === 0;

  const html = `
    <div class="flex flex-col h-full text-white" style="background:rgb(4,10,18)">

      <!-- Header -->
      <div class="dash-header shrink-0" style="background:linear-gradient(180deg,rgba(139,92,246,0.09) 0%,transparent 100%)">
        <div>
          <h1 class="text-xl font-black tracking-tight">${firstName ? `Hey, ${firstName} 👋` : 'My Vehicle'}</h1>
          <p class="text-xs" style="color:rgba(196,181,253,0.55)">${todayStr} · ${vehicleLabel}</p>
        </div>
        <button onclick="navigate('p-more')"
          class="w-10 h-10 rounded-full flex items-center justify-center font-black text-base shrink-0 overflow-hidden"
          style="background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff">
          ${user?.photoURL ? `<img src="${user.photoURL}" class="w-10 h-10 rounded-full object-cover" alt="">` : avatarLetter}
        </button>
      </div>

      <div class="flex-1 overflow-y-auto" style="padding:12px 12px 32px">

        ${isEmpty ? `
          <div class="flex flex-col items-center justify-center py-16 text-center px-8">
            <div class="text-6xl mb-4">🚗</div>
            <h2 class="text-xl font-black">Start tracking your car</h2>
            <p class="text-sm mt-2" style="color:rgba(148,163,184,0.8)">Log your first fill-up or trip to see your stats here.</p>
            <div class="flex gap-3 mt-5">
              <button onclick="navigate('fuel')" class="font-bold px-5 py-2.5 rounded-xl text-sm" style="background:#7c3aed;color:#fff">Log Fill-Up</button>
              <button onclick="navigate('trips')" class="font-bold px-5 py-2.5 rounded-xl text-sm" style="background:rgba(255,255,255,0.07);color:#fff">Log Trip</button>
            </div>
          </div>
        ` : `

        <!-- Hero card -->
        <div style="background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 40%,#4c1d95 100%);border-radius:22px;padding:20px;margin-bottom:12px;position:relative;overflow:hidden;
          box-shadow:0 0 0 1px rgba(255,255,255,0.10),0 1px 0 rgba(255,255,255,0.18) inset,0 20px 50px rgba(109,40,217,0.3),0 8px 20px rgba(0,0,0,0.4)">
          <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,rgba(255,255,255,0.08) 0%,transparent 50%);border-radius:inherit"></div>
          <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent 5%,rgba(255,255,255,0.45) 30%,rgba(255,255,255,0.45) 70%,transparent 95%)"></div>
          <p style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.55);margin-bottom:4px">This Month's Cost</p>
          <p style="font-size:2.8rem;font-weight:900;letter-spacing:-1px;color:#fff;margin-bottom:2px">${fmtMoney(monthTotal)}</p>
          <p style="font-size:0.78rem;color:rgba(255,255,255,0.55)">Fuel ${fmtMoney(monthFuelCost)} · Other ${fmtMoney(monthExpCost)}</p>
        </div>

        <!-- Quick actions -->
        <div class="grid grid-cols-4 gap-2 mb-3">
          ${[
            ['fuel','⛽','Fill-Up'],
            ['trips','🗺','Trip'],
            ['expenses','💳','Expense'],
            ['p-more','🔧','Service'],
          ].map(([screen, icon, label]) => `
            <button onclick="navigate('${screen}')"
              class="flex flex-col items-center gap-1 py-3 rounded-2xl font-bold text-xs"
              style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06)">
              <span class="text-xl">${icon}</span>
              <span style="color:rgba(148,163,184,0.9)">${label}</span>
            </button>
          `).join('')}
        </div>

        <!-- Stats grid -->
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div class="glass-card" style="padding:14px">
            <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">Avg MPG</p>
            <p class="text-2xl font-black" style="color:${avgMPG ? (avgMPG >= (s.targetMPG || 30) ? '#34d399' : '#fbbf24') : '#e0f2fe'}">${avgMPG ? avgMPG.toFixed(1) : '—'}</p>
            <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">target ${s.targetMPG || 30} MPG</p>
          </div>
          <div class="glass-card" style="padding:14px">
            <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">Miles Driven</p>
            <p class="text-2xl font-black">${monthMiles.toLocaleString()}</p>
            <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">this month · ${monthTrips.length} trips</p>
          </div>
          <div class="glass-card" style="padding:14px">
            <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">Fuel This Month</p>
            <p class="text-2xl font-black" style="color:#c4b5fd">${fmtMoney(monthFuelCost)}</p>
            <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">${monthFuelGal.toFixed(1)} gal · ${monthFuel.length} fill-up${monthFuel.length !== 1 ? 's' : ''}</p>
          </div>
          <div class="glass-card" style="padding:14px">
            <p class="text-xs mb-1" style="color:rgba(148,163,184,0.7)">Cost/Mile</p>
            <p class="text-2xl font-black">${monthMiles > 0 ? fmtMoney(monthTotal / monthMiles, 2) : '—'}</p>
            <p class="text-xs mt-1" style="color:rgba(100,116,139,0.8)">all-in this month</p>
          </div>
        </div>

        <!-- Maintenance alert -->
        ${maintAlerts > 0 ? `
        <button onclick="navigate('p-more')" class="glass-card w-full text-left mb-3" style="padding:14px;border-color:rgba(251,191,36,0.3)">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:1.4rem">⚠️</span>
            <div>
              <p style="font-weight:800;color:#fbbf24">${maintAlerts} service${maintAlerts !== 1 ? 's' : ''} due soon</p>
              <p style="font-size:0.72rem;color:rgba(100,116,139,0.8);margin-top:2px">Tap to view maintenance reminders</p>
            </div>
          </div>
        </button>` : ''}

        <!-- Recent fill-ups -->
        ${monthFuel.length > 0 ? `
        <div class="glass-card" style="padding:14px;margin-bottom:12px">
          <div class="flex justify-between items-center mb-3">
            <p class="text-xs font-bold uppercase tracking-wider" style="color:rgba(148,163,184,0.7)">Recent Fill-Ups</p>
            <button onclick="navigate('fuel')" class="text-xs font-bold" style="color:#a78bfa">See All</button>
          </div>
          ${monthFuel.slice(0,3).map(f => {
            const mpg = (f.miles && f.gallons) ? (Number(f.miles)/Number(f.gallons)).toFixed(1) : null;
            return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
              <div>
                <p style="font-size:0.85rem;font-weight:700;color:#e0f2fe">⛽ ${Number(f.gallons||0).toFixed(2)} gal</p>
                <p style="font-size:0.7rem;color:rgba(100,116,139,0.8)">${fmtDate(f.date)}${f.station ? ` · ${f.station}` : ''}${mpg ? ` · ${mpg} MPG` : ''}</p>
              </div>
              <span style="font-weight:800;font-size:0.9rem;color:#c4b5fd">${fmtMoney(f.totalCost, 2)}</span>
            </div>`;
          }).join('')}
        </div>
        ` : ''}

        <!-- Recent trips -->
        ${monthTrips.length > 0 ? `
        <div class="glass-card" style="padding:14px">
          <div class="flex justify-between items-center mb-3">
            <p class="text-xs font-bold uppercase tracking-wider" style="color:rgba(148,163,184,0.7)">Recent Trips</p>
            <button onclick="navigate('trips')" class="text-xs font-bold" style="color:#a78bfa">See All</button>
          </div>
          ${monthTrips.slice(0,3).map(t => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
            <div>
              <p style="font-size:0.85rem;font-weight:700;color:#e0f2fe">${t.origin || '—'} → ${t.destination || '—'}</p>
              <p style="font-size:0.7rem;color:rgba(100,116,139,0.8)">${fmtDate(t.date)}${t.purpose ? ` · ${t.purpose}` : ''}</p>
            </div>
            <span style="font-weight:700;font-size:0.85rem;color:rgba(148,163,184,0.7)">${Number(t.miles||0).toLocaleString()} mi</span>
          </div>`).join('')}
        </div>
        ` : ''}

        `}
      </div>
    </div>`;

  return { html, mount: null };
}
