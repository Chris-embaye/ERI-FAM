import { getTrips, getExpenses, getFuelLogs, getSettings, fmtMoney } from '../store.js';

// Persists selected month across re-renders within the session
let _month = new Date().toISOString().slice(0, 7); // "YYYY-MM"

const NOW_MONTH = new Date().toISOString().slice(0, 7);

function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const CAT_COLORS = {
  Fuel: '#FF9F0A', Repair: '#FF453A', Toll: '#636366',
  Lodging: '#5E5CE6', Food: '#30D158', Parking: '#636366',
  Scale: '#636366', Insurance: '#0A84FF', Other: '#636366',
};

export function renderReports() {
  const s           = getSettings();
  const dispatchPct = Number(s.dispatchPct) || 0;
  const start       = _month + '-01';
  // Last day of month
  const [y, m]      = _month.split('-').map(Number);
  const end         = new Date(y, m, 0).toISOString().slice(0, 10);

  const trips    = getTrips()   .filter(t => t.date >= start && t.date <= end);
  const expenses = getExpenses().filter(e => e.date >= start && e.date <= end);
  const fuel     = getFuelLogs().filter(l => l.date >= start && l.date <= end);

  const grossRevenue   = trips.reduce((s, t) => s + Number(t.revenue || 0), 0);
  const netRevenue     = grossRevenue * (1 - dispatchPct / 100);
  const totalExpenses  = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalMiles     = trips.reduce((s, t) => s + Number(t.miles || 0), 0);
  const totalHours     = trips.reduce((s, t) => s + Number(t.durationHours || 0), 0);
  const netProfit      = netRevenue - totalExpenses;
  const profitPositive = netProfit >= 0;

  // Category breakdown
  const catMap = {};
  expenses.forEach(e => { catMap[e.category || 'Other'] = (catMap[e.category || 'Other'] || 0) + Number(e.amount || 0); });
  const catList  = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const maxCat   = catList[0]?.[1] || 1;

  const fuelTotal   = fuel.reduce((s, l) => s + (Number(l.total) || Number(l.gallons) * Number(l.pricePerGallon) || 0), 0);
  const fuelGallons = fuel.reduce((s, l) => s + Number(l.gallons || 0), 0);

  const isEmpty     = trips.length === 0 && expenses.length === 0;
  const atPresent   = _month >= NOW_MONTH;

  const cpm = totalMiles > 0 ? totalExpenses / totalMiles : null;
  const rpm = totalMiles > 0 ? netRevenue / totalMiles : null;

  const html = `
    <div class="flex flex-col h-full text-white" style="background:#1c1c2e">

      <!-- ── iOS Navigation bar ───────────────────────────── -->
      <div style="background:rgba(28,28,46,0.96);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,0.08)" class="shrink-0">
        <div class="flex items-center px-4 pt-5 pb-3">
          <button onclick="navigate('more')" style="color:#0A84FF;min-width:44px;text-align:left;font-size:.9rem;font-weight:600">
            ‹ More
          </button>
          <h1 class="flex-1 text-center font-black" style="font-size:1.06rem;letter-spacing:-.01em">Reports</h1>
          <div style="min-width:44px"></div>
        </div>

        <!-- ── Month navigator ───────────────────────────── -->
        <div class="flex items-center justify-between px-2 pb-3" style="gap:0">
          <button id="prev-month-btn"
            style="min-width:52px;min-height:44px;display:flex;align-items:center;justify-content:center;color:#0A84FF;font-size:1.5rem;font-weight:300;border-radius:12px">
            ‹
          </button>
          <div class="flex-1 text-center">
            <p style="font-size:1.05rem;font-weight:700;letter-spacing:-.01em">${monthLabel(_month)}</p>
          </div>
          <button id="next-month-btn"
            style="min-width:52px;min-height:44px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:300;border-radius:12px;${atPresent ? 'color:rgba(255,255,255,.18);pointer-events:none' : 'color:#0A84FF'}">
            ›
          </button>
        </div>
      </div>

      <!-- ── Scrollable content ────────────────────────────── -->
      <div class="flex-1 overflow-y-auto" style="padding:16px;display:flex;flex-direction:column;gap:12px">

        ${isEmpty ? `
        <!-- Empty state -->
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:48px 24px;gap:12px">
          <div style="font-size:3.5rem">📅</div>
          <p style="font-size:1.1rem;font-weight:800">No data for ${monthLabel(_month)}</p>
          <p style="font-size:.85rem;color:rgba(255,255,255,.4);line-height:1.5">Log trips and expenses to see your monthly report here.</p>
          <button onclick="navigate('trips')" style="margin-top:8px;background:#0A84FF;color:white;font-weight:700;font-size:.875rem;padding:10px 24px;border-radius:999px">
            Log a Trip
          </button>
        </div>
        ` : `

        <!-- ── Net profit hero ───────────────────────────── -->
        <div style="background:${profitPositive ? 'linear-gradient(135deg,#1c3a28,#1a4030)' : 'linear-gradient(135deg,#3a1c1c,#401a1a)'};border-radius:18px;padding:20px 20px 16px;border:1px solid ${profitPositive ? 'rgba(52,199,89,.25)' : 'rgba(255,69,58,.25)'}">
          <p style="font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:4px">
            Net Profit — ${monthLabel(_month)}
          </p>
          <p style="font-size:3rem;font-weight:900;letter-spacing:-.03em;color:${profitPositive ? '#34C759' : '#FF453A'};line-height:1">
            ${netProfit < 0 ? '−' : ''}${fmtMoney(Math.abs(netProfit))}
          </p>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;margin-top:16px;border-top:1px solid rgba(255,255,255,.08);padding-top:14px">
            <div style="text-align:center;border-right:1px solid rgba(255,255,255,.08)">
              <p style="font-size:1rem;font-weight:800;color:#34C759">${fmtMoney(netRevenue)}</p>
              <p style="font-size:.65rem;color:rgba(255,255,255,.4);margin-top:2px;text-transform:uppercase;letter-spacing:.05em">Revenue</p>
            </div>
            <div style="text-align:center;border-right:1px solid rgba(255,255,255,.08)">
              <p style="font-size:1rem;font-weight:800;color:#FF453A">${fmtMoney(totalExpenses)}</p>
              <p style="font-size:.65rem;color:rgba(255,255,255,.4);margin-top:2px;text-transform:uppercase;letter-spacing:.05em">Expenses</p>
            </div>
            <div style="text-align:center">
              <p style="font-size:1rem;font-weight:800">${totalMiles > 999 ? (totalMiles/1000).toFixed(1)+'k' : totalMiles.toLocaleString()}</p>
              <p style="font-size:.65rem;color:rgba(255,255,255,.4);margin-top:2px;text-transform:uppercase;letter-spacing:.05em">Miles</p>
            </div>
          </div>
        </div>

        <!-- ── Key metrics ───────────────────────────────── -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="background:#252538;border-radius:16px;padding:14px 16px;border:1px solid rgba(255,255,255,.06)">
            <p style="font-size:.65rem;color:rgba(255,255,255,.4);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Trips</p>
            <p style="font-size:1.8rem;font-weight:900;letter-spacing:-.02em">${trips.length}</p>
            <p style="font-size:.72rem;color:rgba(255,255,255,.35);margin-top:2px">${totalHours > 0 ? totalHours.toFixed(1)+' hrs driving' : 'no hours logged'}</p>
          </div>
          <div style="background:#252538;border-radius:16px;padding:14px 16px;border:1px solid rgba(255,255,255,.06)">
            <p style="font-size:.65rem;color:rgba(255,255,255,.4);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Rate / Mile</p>
            <p style="font-size:1.8rem;font-weight:900;letter-spacing:-.02em;color:${rpm !== null && rpm >= (Number(s.targetRPM)||2) ? '#34C759' : rpm !== null ? '#FF9F0A' : 'white'}">${rpm !== null ? fmtMoney(rpm, 2) : '—'}</p>
            <p style="font-size:.72rem;color:rgba(255,255,255,.35);margin-top:2px">target ${fmtMoney(Number(s.targetRPM)||2.00, 2)}/mi</p>
          </div>
          <div style="background:#252538;border-radius:16px;padding:14px 16px;border:1px solid rgba(255,255,255,.06)">
            <p style="font-size:.65rem;color:rgba(255,255,255,.4);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Cost / Mile</p>
            <p style="font-size:1.8rem;font-weight:900;letter-spacing:-.02em">${cpm !== null ? fmtMoney(cpm, 2) : '—'}</p>
            <p style="font-size:.72rem;color:rgba(255,255,255,.35);margin-top:2px">${totalMiles > 0 ? totalMiles.toLocaleString()+' mi driven' : 'no miles'}</p>
          </div>
          <div style="background:#252538;border-radius:16px;padding:14px 16px;border:1px solid rgba(255,255,255,.06)">
            <p style="font-size:.65rem;color:rgba(255,255,255,.4);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Fuel</p>
            <p style="font-size:1.8rem;font-weight:900;letter-spacing:-.02em">${fuelTotal > 0 ? fmtMoney(fuelTotal) : '—'}</p>
            <p style="font-size:.72rem;color:rgba(255,255,255,.35);margin-top:2px">${fuelGallons > 0 ? fuelGallons.toFixed(0)+' gallons' : 'none logged'}</p>
          </div>
        </div>

        ${trips.length > 0 ? `
        <!-- ── Trips ─────────────────────────────────────── -->
        <div style="background:#252538;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.06)">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px 10px">
            <p style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.4)">Trips</p>
            <p style="font-size:.8rem;font-weight:700;color:#34C759">${fmtMoney(netRevenue)}</p>
          </div>
          ${trips.map((t, i) => {
            const rpm   = Number(t.miles) > 0 ? Number(t.revenue) / Number(t.miles) : 0;
            const color = rpm >= (Number(s.targetRPM)||2) ? '#34C759' : rpm > 0 ? '#FF9F0A' : 'rgba(255,255,255,.35)';
            return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 16px;${i < trips.length-1 ? 'border-bottom:1px solid rgba(255,255,255,.06)' : ''}">
              <div style="min-width:0;flex:1">
                <p style="font-weight:700;font-size:.9rem">${t.origin} → ${t.destination}</p>
                <p style="font-size:.72rem;color:rgba(255,255,255,.4);margin-top:2px">
                  ${new Date(t.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                  ${t.miles ? ' · '+Number(t.miles).toLocaleString()+' mi' : ''}
                </p>
              </div>
              <div style="text-align:right;shrink:0;margin-left:12px">
                <p style="font-weight:800;font-size:.9rem">${fmtMoney(t.revenue)}</p>
                <p style="font-size:.7rem;color:${color};margin-top:1px">${rpm > 0 ? fmtMoney(rpm,2)+'/mi' : ''}</p>
              </div>
            </div>`;
          }).join('')}
        </div>
        ` : ''}

        ${catList.length > 0 ? `
        <!-- ── Expenses ──────────────────────────────────── -->
        <div style="background:#252538;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.06)">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px 12px">
            <p style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.4)">Expenses</p>
            <p style="font-size:.8rem;font-weight:700;color:#FF453A">${fmtMoney(totalExpenses)}</p>
          </div>
          <div style="padding:0 16px 14px;display:flex;flex-direction:column;gap:10px">
            ${catList.map(([cat, amt]) => {
              const pct   = Math.max(Math.round(amt / maxCat * 100), 4);
              const color = CAT_COLORS[cat] || '#636366';
              return `
              <div>
                <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                  <span style="font-size:.82rem;font-weight:600">${cat}</span>
                  <span style="font-size:.82rem;font-weight:700">${fmtMoney(amt, 2)}</span>
                </div>
                <div style="background:rgba(255,255,255,.08);border-radius:99px;height:4px;overflow:hidden">
                  <div style="width:${pct}%;height:4px;border-radius:99px;background:${color};transition:width .4s ease"></div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
        ` : ''}

        ${dispatchPct > 0 && grossRevenue > 0 ? `
        <!-- ── Dispatch breakdown ─────────────────────────── -->
        <div style="background:#252538;border-radius:18px;padding:14px 16px;border:1px solid rgba(255,255,255,.06)">
          <p style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.4);margin-bottom:10px">Dispatch (${dispatchPct}%)</p>
          <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:6px">
            <span style="color:rgba(255,255,255,.5)">Gross revenue</span>
            <span style="font-weight:700">${fmtMoney(grossRevenue)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:6px">
            <span style="color:rgba(255,255,255,.5)">Dispatcher's share</span>
            <span style="font-weight:700;color:#FF453A">−${fmtMoney(grossRevenue - netRevenue)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.85rem;border-top:1px solid rgba(255,255,255,.08);padding-top:8px;margin-top:2px">
            <span style="font-weight:600">Your take</span>
            <span style="font-weight:800;color:#34C759">${fmtMoney(netRevenue)}</span>
          </div>
        </div>
        ` : ''}

        `}

        <div style="height:8px"></div>
      </div>
    </div>`;

  function mount(container) {
    container.querySelector('#prev-month-btn')?.addEventListener('click', () => {
      _month = shiftMonth(_month, -1);
      window.refresh();
    });
    container.querySelector('#next-month-btn')?.addEventListener('click', () => {
      if (_month >= NOW_MONTH) return;
      _month = shiftMonth(_month, 1);
      window.refresh();
    });
  }

  return { html, mount };
}
