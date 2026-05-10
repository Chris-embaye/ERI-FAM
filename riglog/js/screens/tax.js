import { getTrips, getExpenses, getSettings, fmtMoney } from '../store.js';

const MILEAGE_RATE = 0.70; // 2025 IRS standard mileage rate
const SE_RATE      = 0.153;
const DEDUCTIBLE   = new Set(['Fuel','Repair','Toll','Insurance','Scale','Parking','Other']);

// 2025 single-filer federal brackets
function estFedTax(agi) {
  if (agi <= 0) return 0;
  const taxable = Math.max(0, agi - 15000); // 2025 standard deduction
  const brackets = [[11925,0.10],[48475,0.12],[103350,0.22],[197300,0.24],[250525,0.32],[626350,0.35],[Infinity,0.37]];
  let tax = 0, prev = 0;
  for (const [lim, rate] of brackets) {
    if (taxable <= prev) break;
    tax += (Math.min(taxable, lim) - prev) * rate;
    prev = lim;
  }
  return tax;
}

export function renderTax() {
  const year      = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const s         = getSettings();

  const trips    = getTrips().filter(t => t.date >= yearStart);
  const expenses = getExpenses().filter(e => e.date >= yearStart);

  // ── Revenue after dispatch cut ──────────────────────────────────────────────
  const ytdGrossRevenue = trips.reduce((sum, t) => sum + Number(t.revenue || 0), 0);
  const dispatchPct     = Number(s.dispatchPct) || 0;
  const dispatchCut     = ytdGrossRevenue * (dispatchPct / 100);
  const ytdNetRevenue   = ytdGrossRevenue - dispatchCut; // what actually hits your pocket

  const ytdMiles = trips.reduce((sum, t) => sum + Number(t.miles || 0), 0);

  // ── Months elapsed this year ────────────────────────────────────────────────
  const monthsElapsed = new Date().getMonth() + 1; // 1–12

  // ── Monthly fixed costs (YTD) ───────────────────────────────────────────────
  const eldMonthly          = Number(s.eldMonthly)          || 0;
  const truckPaymentMonthly = Number(s.truckPaymentMonthly) || 0;
  const insuranceMonthly    = Number(s.insuranceMonthly)    || 0;
  const otherFixedMonthly   = Number(s.otherFixedMonthly)   || 0;

  const eldYTD          = eldMonthly          * monthsElapsed;
  const insuranceYTD    = insuranceMonthly    * monthsElapsed;
  const truckPaymentYTD = truckPaymentMonthly * monthsElapsed; // note: only interest is deductible
  const otherFixedYTD   = otherFixedMonthly   * monthsElapsed;

  // Deductible fixed costs (ELD, insurance, other — not truck principal)
  const fixedDeductibleYTD = eldYTD + insuranceYTD + otherFixedYTD;

  // ── Logged variable expenses ────────────────────────────────────────────────
  const loggedDeductible   = expenses.filter(e => DEDUCTIBLE.has(e.category)).reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalActualExpenses = loggedDeductible + fixedDeductibleYTD;

  // ── Per Diem deduction ──────────────────────────────────────────────────────
  const perDiemRate      = Number(s.perDiemRate) || 80;
  const perDiemDays      = trips.reduce((sum, t) => sum + (Number(t.perDiemDays) || 0), 0);
  // IRS allows 80% of per diem for OTR transportation workers (Pub 463)
  const perDiemDeduction = perDiemDays * perDiemRate * 0.80;

  // ── Deduction method selection ──────────────────────────────────────────────
  const mileageDeduction = ytdMiles * MILEAGE_RATE;
  // Per diem applies to both methods — it's separate from mileage/actual expense choice
  const mileagePlusOther  = mileageDeduction + eldYTD + insuranceYTD + otherFixedYTD + perDiemDeduction;
  const totalActualExpensesWithPerDiem = totalActualExpenses + perDiemDeduction;
  const useStdMileage     = mileagePlusOther >= totalActualExpensesWithPerDiem;
  const chosenDeduction   = useStdMileage ? mileagePlusOther : totalActualExpensesWithPerDiem;

  // ── IFTA state miles breakdown (current quarter) ────────────────────────────
  function parseStateMiles(str) {
    if (!str) return {};
    const result = {};
    str.split(',').forEach(part => {
      const m = part.trim().match(/^([A-Z]{2})\s+(\d+)/i);
      if (m) result[m[1].toUpperCase()] = (result[m[1].toUpperCase()] || 0) + parseInt(m[2]);
    });
    return result;
  }
  const qStart = m < 3 ? `${year}-01-01` : m < 5 ? `${year}-04-01` : m < 8 ? `${year}-07-01` : `${year}-10-01`;
  const qLabel = m < 3 ? 'Q1' : m < 5 ? 'Q2' : m < 8 ? 'Q3' : 'Q4';
  const iftaMap = {};
  trips.filter(t => t.date >= qStart && t.stateMiles).forEach(t => {
    Object.entries(parseStateMiles(t.stateMiles)).forEach(([state, mi]) => {
      iftaMap[state] = (iftaMap[state] || 0) + mi;
    });
  });
  const iftaEntries = Object.entries(iftaMap).sort((a, b) => b[1] - a[1]);

  // ── Tax math ────────────────────────────────────────────────────────────────
  const netSE   = Math.max(0, ytdNetRevenue - chosenDeduction);
  const seTax   = netSE * 0.9235 * SE_RATE;
  const seHalf  = seTax * 0.5;
  const agi     = Math.max(0, netSE - seHalf);
  const fedTax  = estFedTax(agi);
  const totalTax       = seTax + fedTax;
  const quarterlyOwed  = totalTax / 4;
  const effectiveRate  = ytdGrossRevenue > 0 ? totalTax / ytdGrossRevenue * 100 : 0;

  // ── Quarterly schedule ──────────────────────────────────────────────────────
  const m = new Date().getMonth();
  const currentQ = m < 3 ? 1 : m < 5 ? 2 : m < 8 ? 3 : 4;
  const QUARTERS = [
    { q: 1, period: 'Jan–Mar', due: `Apr 15, ${year}` },
    { q: 2, period: 'Apr–May', due: `Jun 16, ${year}` },
    { q: 3, period: 'Jun–Aug', due: `Sep 15, ${year}` },
    { q: 4, period: 'Sep–Dec', due: `Jan 15, ${year + 1}` },
  ];

  // ── Expense breakdown ───────────────────────────────────────────────────────
  const catMap = {};
  expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount || 0); });
  const catList  = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const catTotal = catList.reduce((s, [, v]) => s + v, 0);

  const noData = ytdGrossRevenue === 0 && expenses.length === 0;

  const html = `
    <div class="flex flex-col h-full bg-black text-white">
      <div class="px-4 pt-5 pb-4 border-b border-gray-800 flex items-center gap-3 shrink-0">
        <button onclick="navigate('more')" class="text-gray-400">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="flex-1">
          <h1 class="text-2xl font-black">Tax Summary</h1>
          <p class="text-xs text-gray-500">YTD ${year} · Estimates only — consult a CPA</p>
        </div>
        <button id="taxExportCsvBtn" class="text-xs font-bold text-orange-500 border border-orange-800 rounded-lg px-3 py-1.5 shrink-0">
          ⬇ CSV
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">

        ${noData ? `
          <div class="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div class="text-5xl">📋</div>
            <p class="font-black text-lg">No data yet</p>
            <p class="text-gray-500 text-sm px-8">Log trips and expenses to see your YTD tax estimate here.</p>
            <button onclick="navigate('settings')" class="text-xs text-orange-600 font-bold mt-2">
              Set dispatch % and monthly costs in Settings →
            </button>
          </div>
        ` : `

        <!-- Total tax hero -->
        <div class="bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl p-5">
          <p class="text-xs font-bold uppercase opacity-75 mb-1 tracking-wider">Estimated Tax Owed (${year})</p>
          <p class="text-5xl font-black text-black">${fmtMoney(totalTax)}</p>
          <p class="text-xs mt-2 text-black/70">${effectiveRate.toFixed(1)}% of gross · ${fmtMoney(ytdGrossRevenue)} gross revenue</p>
        </div>

        <!-- Dispatch cut callout (if applicable) -->
        ${dispatchPct > 0 ? `
        <div class="bg-gray-900 border border-orange-900/50 rounded-xl p-4">
          <div class="flex justify-between items-center">
            <div>
              <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-0.5">After Dispatch Cut (${dispatchPct}%)</p>
              <p class="text-xs text-gray-600">Gross ${fmtMoney(ytdGrossRevenue)} → Your pocket ${fmtMoney(ytdNetRevenue)}</p>
            </div>
            <div class="text-right">
              <p class="text-base font-black text-orange-500">−${fmtMoney(dispatchCut)}</p>
              <p class="text-xs text-gray-600">dispatcher's share</p>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- Quarterly payments -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">Quarterly Payments — IRS Form 1040-ES</p>
          <div class="grid grid-cols-2 gap-2">
            ${QUARTERS.map(q => `
              <div class="rounded-xl p-3 ${q.q === currentQ ? 'bg-orange-600/20 border border-orange-600' : 'bg-gray-800 border border-gray-700'}">
                <p class="text-xs text-gray-400">Q${q.q} · ${q.period}</p>
                <p class="font-black text-base">${fmtMoney(quarterlyOwed)}</p>
                <p class="text-xs mt-0.5 ${q.q === currentQ ? 'text-orange-400 font-bold' : 'text-gray-600'}">Due ${q.due}</p>
                ${q.q === currentQ ? `<span class="text-orange-500 text-xs font-black">← PAY NOW</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Schedule C breakdown -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">Schedule C Breakdown</p>
          <div class="space-y-0">

            <div class="tax-line">
              <span class="text-gray-300">Gross Revenue</span>
              <span class="font-black">${fmtMoney(ytdGrossRevenue)}</span>
            </div>

            ${dispatchPct > 0 ? `
            <div class="tax-line">
              <span class="text-gray-300">Dispatch Fee (${dispatchPct}%)</span>
              <span class="font-black text-red-400">−${fmtMoney(dispatchCut)}</span>
            </div>
            <div class="tax-line font-bold">
              <span class="text-white">Net Revenue (Your Pocket)</span>
              <span class="font-black text-white">${fmtMoney(ytdNetRevenue)}</span>
            </div>
            ` : ''}

            <div class="tax-line">
              <span class="text-gray-300">${useStdMileage ? 'Mileage + Fixed + Per Diem' : 'Actual Expenses + Per Diem'}</span>
              <span class="font-black text-red-400">−${fmtMoney(chosenDeduction)}</span>
            </div>

            <!-- Deduction detail lines -->
            ${useStdMileage ? `
            <div class="flex justify-between text-xs py-1 border-b border-gray-800">
              <span class="text-gray-600 pl-3">${ytdMiles.toLocaleString()} mi × $${MILEAGE_RATE.toFixed(2)}/mi</span>
              <span class="text-gray-600">${fmtMoney(mileageDeduction)}</span>
            </div>
            ` : `
            <div class="flex justify-between text-xs py-1 border-b border-gray-800">
              <span class="text-gray-600 pl-3">Logged variable expenses</span>
              <span class="text-gray-600">${fmtMoney(loggedDeductible)}</span>
            </div>
            `}
            ${eldYTD > 0 ? `
            <div class="flex justify-between text-xs py-1 border-b border-gray-800">
              <span class="text-gray-600 pl-3">ELD (${monthsElapsed} mo × $${eldMonthly})</span>
              <span class="text-gray-600">${fmtMoney(eldYTD)}</span>
            </div>` : ''}
            ${insuranceYTD > 0 ? `
            <div class="flex justify-between text-xs py-1 border-b border-gray-800">
              <span class="text-gray-600 pl-3">Insurance (${monthsElapsed} mo × $${insuranceMonthly})</span>
              <span class="text-gray-600">${fmtMoney(insuranceYTD)}</span>
            </div>` : ''}
            ${otherFixedYTD > 0 ? `
            <div class="flex justify-between text-xs py-1 border-b border-gray-800">
              <span class="text-gray-600 pl-3">Other fixed (${monthsElapsed} mo × $${otherFixedMonthly})</span>
              <span class="text-gray-600">${fmtMoney(otherFixedYTD)}</span>
            </div>` : ''}
            ${truckPaymentYTD > 0 ? `
            <div class="flex justify-between text-xs py-1 border-b border-gray-800">
              <span class="text-yellow-700 pl-3">⚠ Truck payment (interest portion deductible only)</span>
              <span class="text-yellow-700">${fmtMoney(truckPaymentYTD)}</span>
            </div>` : ''}

            <div class="tax-line">
              <span class="text-gray-300">Net SE Income</span>
              <span class="font-black">${fmtMoney(netSE)}</span>
            </div>
            <div class="tax-line">
              <span class="text-gray-300">Self-Employment Tax (15.3%)</span>
              <span class="font-black text-red-400">−${fmtMoney(seTax)}</span>
            </div>
            <div class="tax-line">
              <span class="text-gray-300">½ SE Deduction (IRS allowed)</span>
              <span class="font-black text-green-400">+${fmtMoney(seHalf)}</span>
            </div>
            <div class="tax-line">
              <span class="text-gray-300">Adjusted Gross Income</span>
              <span class="font-black">${fmtMoney(agi)}</span>
            </div>
            <div class="tax-line">
              <span class="text-gray-300">Estimated Federal Income Tax</span>
              <span class="font-black text-red-400">−${fmtMoney(fedTax)}</span>
            </div>
            <div class="flex justify-between items-center pt-2 font-black text-base">
              <span>Total Tax Estimate</span>
              <span class="text-orange-600">${fmtMoney(totalTax)}</span>
            </div>
          </div>
        </div>

        <!-- Deduction strategy tips -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">Deduction Strategy</p>
          <div class="space-y-3 text-sm">
            <div class="flex items-start gap-2">
              <span class="mt-0.5 text-green-400">✓</span>
              <p class="text-gray-300">${useStdMileage
                ? `Using mileage method (${fmtMoney(mileagePlusOther)}) — beats actual expenses (${fmtMoney(totalActualExpensesWithPerDiem)}). Saves you ${fmtMoney(mileagePlusOther - totalActualExpensesWithPerDiem)} more.`
                : `Using actual expenses (${fmtMoney(totalActualExpensesWithPerDiem)}) — beats mileage deduction (${fmtMoney(mileagePlusOther)}). Saves you ${fmtMoney(totalActualExpensesWithPerDiem - mileagePlusOther)} more.`
              }</p>
            </div>
            ${dispatchPct > 0 ? `
            <div class="flex items-start gap-2">
              <span class="text-blue-400 mt-0.5">💡</span>
              <p class="text-gray-300"><span class="font-bold text-white">Dispatch fees</span> reduce your gross income but are NOT themselves a separate deduction — they reduce how much you received, so taxes are calculated on what you actually kept.</p>
            </div>
            ` : ''}
            ${truckPaymentMonthly > 0 ? `
            <div class="flex items-start gap-2">
              <span class="text-yellow-400 mt-0.5">⚠</span>
              <p class="text-gray-300"><span class="font-bold text-white">Truck payment:</span> Only the interest portion is deductible (not principal). Ask your lender for an amortization schedule to find the interest amount.</p>
            </div>
            ` : ''}
            ${perDiemDays > 0 ? `
            <div class="flex items-start gap-2">
              <span class="text-green-400 mt-0.5">✓</span>
              <p class="text-gray-300"><span class="font-bold text-white">Per Diem:</span> ${perDiemDays} nights × $${perDiemRate}/day × 80% = <span class="font-bold text-green-400">${fmtMoney(perDiemDeduction)}</span> deduction. Logged from your trip entries.</p>
            </div>
            ` : `
            <div class="flex items-start gap-2">
              <span class="text-blue-400 mt-0.5">💡</span>
              <p class="text-gray-300"><span class="font-bold text-white">Per Diem:</span> Log "Per Diem Days" on each trip to claim $${perDiemRate}/day (80% deductible). With 200 nights/year that's <span class="font-bold text-green-400">${fmtMoney(200 * perDiemRate * 0.80)}</span> in deductions.</p>
            </div>
            `}
            <div class="flex items-start gap-2">
              <span class="text-yellow-400 mt-0.5">⚠</span>
              <p class="text-gray-300">Pay <span class="font-bold text-white">~${fmtMoney(quarterlyOwed)}</span> quarterly to avoid IRS underpayment penalties. Next due: <span class="font-bold text-orange-500">${QUARTERS[currentQ - 1].due}</span>.</p>
            </div>
          </div>
        </div>

        <!-- Monthly cost overview -->
        ${(eldMonthly + truckPaymentMonthly + insuranceMonthly + otherFixedMonthly) > 0 ? `
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">Monthly Fixed Costs</p>
          ${[
            ['ELD Subscription', eldMonthly],
            ['Truck Payment / Lease', truckPaymentMonthly],
            ['Insurance', insuranceMonthly],
            ['Other Fixed', otherFixedMonthly],
          ].filter(([,v]) => v > 0).map(([label, val]) => `
            <div class="flex justify-between text-sm py-1.5 border-b border-gray-800 last:border-0">
              <span class="text-gray-400">${label}</span>
              <span class="font-bold">$${Number(val).toLocaleString()}/mo</span>
            </div>
          `).join('')}
          <div class="flex justify-between text-sm font-black pt-2 mt-1">
            <span>Total Fixed / year</span>
            <span class="text-red-400">$${((eldMonthly + truckPaymentMonthly + insuranceMonthly + otherFixedMonthly) * 12).toLocaleString()}</span>
          </div>
          <button onclick="navigate('settings')" class="w-full mt-3 text-xs text-orange-600 font-bold text-center py-1">
            Edit in Settings →
          </button>
        </div>
        ` : `
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p class="text-xs text-gray-500">Add your ELD, insurance, truck payment in</p>
          <button onclick="navigate('settings')" class="text-sm text-orange-600 font-bold mt-1">Settings → Monthly Fixed Costs</button>
          <p class="text-xs text-gray-600 mt-1">for a more accurate tax estimate.</p>
        </div>
        `}

        <!-- Expense breakdown -->
        ${catList.length > 0 ? `
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">YTD Logged Expenses by Category</p>
          ${catList.map(([cat, amt]) => {
            const pct   = catTotal > 0 ? Math.round(amt / catTotal * 100) : 0;
            const isDed = DEDUCTIBLE.has(cat);
            return `
            <div class="mb-3">
              <div class="flex justify-between items-center mb-1">
                <div class="flex items-center gap-1.5">
                  <span class="text-sm ${isDed ? 'text-gray-300' : 'text-gray-500'}">${cat}</span>
                  ${isDed ? `<span class="text-xs text-green-800 font-bold">deductible</span>` : ''}
                </div>
                <span class="text-sm font-black">${fmtMoney(amt, 2)}</span>
              </div>
              <div class="tax-bar-wrap">
                <div class="tax-bar" style="width:${pct}%"></div>
              </div>
            </div>`;
          }).join('')}
          <p class="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-800">Total logged: ${fmtMoney(catTotal, 2)}</p>
        </div>
        ` : ''}

        <!-- IFTA State Miles -->
        ${iftaEntries.length > 0 ? `
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div class="flex justify-between items-center mb-3">
            <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">IFTA Miles — ${qLabel} ${year}</p>
            <span class="text-xs text-gray-600">${iftaEntries.reduce((s,[,v])=>s+v,0).toLocaleString()} mi total</span>
          </div>
          <div class="space-y-1.5">
            ${iftaEntries.map(([state, mi]) => `
            <div class="flex justify-between text-sm">
              <span class="font-bold text-gray-300">${state}</span>
              <span class="text-gray-400">${mi.toLocaleString()} mi</span>
            </div>`).join('')}
          </div>
          <p class="text-xs text-gray-700 mt-3">From trips with state miles entered. Add state miles to trips for complete IFTA reporting.</p>
        </div>
        ` : `
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">IFTA Quarterly Mileage</p>
          <p class="text-xs text-gray-600">Add "State Miles" (e.g. GA 200, FL 150) when logging trips to track miles per state for IFTA fuel tax reports.</p>
          <button onclick="navigate('trips')" class="text-xs text-orange-600 font-bold mt-2">Log a trip with state miles →</button>
        </div>
        `}

        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p class="text-xs text-gray-600">Estimates use IRS ${year} rates. Consult a licensed CPA for accurate filing.</p>
        </div>

        `}
        <div style="height:8px"></div>
      </div>
    </div>
  `;

  function mount() {
    document.getElementById('taxExportCsvBtn')?.addEventListener('click', () => {
      const allTrips    = getTrips().filter(t => t.date >= yearStart);
      const allExpenses = getExpenses().filter(e => e.date >= yearStart);

      const rows = [
        ['Type','Date','Description','Amount','Miles','Origin','Destination'],
        ...allTrips.map(t => ['Trip', t.date, `${t.origin||''} → ${t.destination||''}`, t.revenue||0, t.miles||0, t.origin||'', t.destination||'']),
        ...allExpenses.map(e => ['Expense', e.date, e.category + (e.description ? ' - ' + e.description : ''), -(e.amount||0), '', '', '']),
      ];

      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `rig-log-${year}.csv`; a.click();
      URL.revokeObjectURL(url);
    });
  }

  return { html, mount };
}
