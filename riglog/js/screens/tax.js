import { getTrips, getExpenses, fmtMoney } from '../store.js';

const MILEAGE_RATE = 0.70; // 2025 IRS standard mileage rate
const SE_RATE      = 0.153;
const DEDUCTIBLE   = new Set(['Fuel','Repair','Toll','Insurance','Scale','Parking','Other']);

// 2025 single-filer federal brackets (after standard deduction applied separately)
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

  const trips    = getTrips().filter(t => t.date >= yearStart);
  const expenses = getExpenses().filter(e => e.date >= yearStart);

  const ytdRevenue = trips.reduce((s, t) => s + Number(t.revenue || 0), 0);
  const ytdMiles   = trips.reduce((s, t) => s + Number(t.miles   || 0), 0);

  const actualDeductions  = expenses.filter(e => DEDUCTIBLE.has(e.category)).reduce((s, e) => s + Number(e.amount || 0), 0);
  const mileageDeduction  = ytdMiles * MILEAGE_RATE;
  const useStdMileage     = mileageDeduction >= actualDeductions;
  const chosenDeduction   = Math.max(actualDeductions, mileageDeduction);

  const netSE          = Math.max(0, ytdRevenue - chosenDeduction);
  const seTax          = netSE * 0.9235 * SE_RATE;
  const seHalf         = seTax * 0.5;
  const agi            = Math.max(0, netSE - seHalf);
  const fedTax         = estFedTax(agi);
  const totalTax       = seTax + fedTax;
  const quarterlyOwed  = totalTax / 4;
  const effectiveRate  = ytdRevenue > 0 ? totalTax / ytdRevenue * 100 : 0;

  const m = new Date().getMonth();
  const currentQ = m < 3 ? 1 : m < 5 ? 2 : m < 8 ? 3 : 4;
  const QUARTERS = [
    { q: 1, period: 'Jan–Mar', due: `Apr 15, ${year}` },
    { q: 2, period: 'Apr–May', due: `Jun 16, ${year}` },
    { q: 3, period: 'Jun–Aug', due: `Sep 15, ${year}` },
    { q: 4, period: 'Sep–Dec', due: `Jan 15, ${year + 1}` },
  ];

  // Expense breakdown by category
  const catMap = {};
  expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount || 0); });
  const catList = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const catTotal = catList.reduce((s, [, v]) => s + v, 0);

  const noData = ytdRevenue === 0 && expenses.length === 0;

  const html = `
    <div class="flex flex-col h-full bg-black text-white">
      <div class="px-4 pt-5 pb-4 border-b border-gray-800 flex items-center gap-3 shrink-0">
        <button onclick="navigate('more')" class="text-gray-400">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 class="text-2xl font-black">Tax Summary</h1>
          <p class="text-xs text-gray-500">YTD ${year} · Estimates only — consult a CPA</p>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">

        ${noData ? `
          <div class="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div class="text-5xl">📋</div>
            <p class="font-black text-lg">No data yet</p>
            <p class="text-gray-500 text-sm px-8">Log trips and expenses to see your YTD tax estimate here.</p>
          </div>
        ` : `

        <!-- Total tax hero -->
        <div class="bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl p-5">
          <p class="text-xs font-bold uppercase opacity-75 mb-1 tracking-wider">Estimated Tax Owed (${year})</p>
          <p class="text-5xl font-black text-black">${fmtMoney(totalTax)}</p>
          <p class="text-xs mt-2 text-black/70">${effectiveRate.toFixed(1)}% effective rate · ${fmtMoney(ytdRevenue)} revenue</p>
        </div>

        <!-- Quarterly payment schedule -->
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
              <span class="text-gray-300">Gross Revenue (Line 1)</span>
              <span class="font-black">${fmtMoney(ytdRevenue)}</span>
            </div>
            <div class="tax-line">
              <span class="text-gray-300">${useStdMileage ? 'Standard Mileage Deduction' : 'Actual Business Expenses'}</span>
              <span class="font-black text-red-400">−${fmtMoney(chosenDeduction)}</span>
            </div>
            <div class="flex justify-between items-center text-xs py-1 border-b border-gray-800">
              <span class="text-gray-600 pl-3">${useStdMileage
                ? `${ytdMiles.toLocaleString()} mi × $${MILEAGE_RATE.toFixed(2)}/mi`
                : `Logged expenses (actual)`
              }</span>
              <span class="text-gray-600">${fmtMoney(chosenDeduction)}</span>
            </div>
            ${!useStdMileage && mileageDeduction > 0 ? `
            <div class="flex justify-between items-center text-xs py-1 border-b border-gray-800">
              <span class="text-gray-600 pl-3">Mileage alt: ${ytdMiles.toLocaleString()} mi × $${MILEAGE_RATE.toFixed(2)}</span>
              <span class="text-gray-600">${fmtMoney(mileageDeduction)}</span>
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
              <span class="text-gray-300">Federal Income Tax (est.)</span>
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
              <span class="mt-0.5 ${useStdMileage ? 'text-green-400' : 'text-blue-400'}">✓</span>
              <p class="text-gray-300">${useStdMileage
                ? `Standard mileage ($${fmtMoney(mileageDeduction)}) beats actual expenses ($${fmtMoney(actualDeductions)}) — saving you ${fmtMoney(mileageDeduction - actualDeductions)} extra.`
                : `Actual expenses (${fmtMoney(actualDeductions)}) beat standard mileage (${fmtMoney(mileageDeduction)}) — you're saving ${fmtMoney(actualDeductions - mileageDeduction)} more.`
              }</p>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-blue-400 mt-0.5">💡</span>
              <p class="text-gray-300"><span class="font-bold text-white">Per Diem:</span> $80/day for overnight trips away from home. Keep a travel log — this can be a large deduction.</p>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-blue-400 mt-0.5">💡</span>
              <p class="text-gray-300"><span class="font-bold text-white">Cell phone &amp; internet:</span> Deduct the business-use percentage of your monthly plans.</p>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-blue-400 mt-0.5">💡</span>
              <p class="text-gray-300"><span class="font-bold text-white">Truck loan interest:</span> If financing your truck, the interest portion is deductible on Schedule C.</p>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-yellow-400 mt-0.5">⚠</span>
              <p class="text-gray-300">Pay <span class="font-bold text-white">~${fmtMoney(quarterlyOwed)}</span> quarterly to avoid IRS underpayment penalties. Mark due dates in your calendar.</p>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-yellow-400 mt-0.5">⚠</span>
              <p class="text-gray-300">Keep every receipt — digital copies in this app count. The IRS can audit up to 3 years back.</p>
            </div>
          </div>
        </div>

        <!-- Expense breakdown by category -->
        ${catList.length > 0 ? `
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">YTD Expenses by Category</p>
          ${catList.map(([cat, amt]) => {
            const pct = catTotal > 0 ? Math.round(amt / catTotal * 100) : 0;
            const isDed = DEDUCTIBLE.has(cat);
            return `
            <div class="mb-3">
              <div class="flex justify-between items-center mb-1">
                <div class="flex items-center gap-1.5">
                  <span class="text-sm ${isDed ? 'text-gray-300' : 'text-gray-500'}">${cat}</span>
                  ${isDed ? `<span class="text-xs text-green-700 font-bold">deductible</span>` : ''}
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

        <!-- Disclaimer -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p class="text-xs text-gray-600">These are estimates based on ${year} IRS rates. Tax laws change. Consult a licensed CPA or tax professional for accurate filing.</p>
        </div>

        `}
        <div style="height:8px"></div>
      </div>
    </div>
  `;

  return { html, mount: null };
}
