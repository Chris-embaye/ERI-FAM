import { getSettings, fmtMoney } from '../store.js';

export function renderLoadCalc() {
  const s           = getSettings();
  const targetRPM   = Number(s.targetRPM)   || 2.00;
  const targetCPM   = Number(s.targetCPM)   || 0.50;
  const dispatchPct = Number(s.dispatchPct) || 0;

  const html = `
    <div class="flex flex-col h-full bg-black text-white">
      <div class="px-4 pt-5 pb-4 border-b border-gray-800 flex items-center gap-3 shrink-0">
        <button onclick="navigate('more')" class="text-gray-400">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 class="text-2xl font-black">Load Calculator</h1>
          <p class="text-xs text-gray-500">Is this load worth it?</p>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">

        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
          <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">Load Details</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-400 block mb-1">Rate ($)</label>
              <input type="number" id="lc-rate" class="form-input" placeholder="1200" step="1" min="0">
            </div>
            <div>
              <label class="text-xs text-gray-400 block mb-1">Miles</label>
              <input type="number" id="lc-miles" class="form-input" placeholder="450" step="1" min="0">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-400 block mb-1">Fuel Cost / Mile ($)</label>
              <input type="number" id="lc-fuel" class="form-input" step="0.01" min="0"
                value="${targetCPM.toFixed(2)}" placeholder="${targetCPM.toFixed(2)}">
            </div>
            <div>
              <label class="text-xs text-gray-400 block mb-1">Other Costs ($)</label>
              <input type="number" id="lc-other" class="form-input" step="1" min="0"
                value="0" placeholder="0">
            </div>
          </div>
          ${dispatchPct > 0
            ? `<p class="text-xs text-gray-600">Dispatch fee (${dispatchPct}%) is automatically deducted from the rate.</p>`
            : ''}
        </div>

        <!-- Result -->
        <div id="lc-result" class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-500 text-center py-4">Enter rate and miles above to see the breakdown</p>
        </div>

        <!-- Targets reference -->
        <div class="bg-gray-800/50 border border-gray-800 rounded-xl p-4 space-y-2">
          <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Your Targets (from Settings)</p>
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">Target rate / mile</span>
            <span class="font-bold">${fmtMoney(targetRPM, 2)}/mi</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">Target cost / mile</span>
            <span class="font-bold">${fmtMoney(targetCPM, 2)}/mi</span>
          </div>
          <button onclick="navigate('settings')" class="text-xs text-orange-600 font-bold mt-1">Edit targets in Settings →</button>
        </div>

        <div style="height:8px"></div>
      </div>
    </div>`;

  function mount(container) {
    const rateEl   = container.querySelector('#lc-rate');
    const milesEl  = container.querySelector('#lc-miles');
    const fuelEl   = container.querySelector('#lc-fuel');
    const otherEl  = container.querySelector('#lc-other');
    const resultEl = container.querySelector('#lc-result');

    function calc() {
      const rate    = parseFloat(rateEl.value)  || 0;
      const miles   = parseFloat(milesEl.value) || 0;
      const fuelCPM = parseFloat(fuelEl.value)  || 0;
      const other   = parseFloat(otherEl.value) || 0;

      if (!rate || !miles) {
        resultEl.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Enter rate and miles above to see the breakdown</p>';
        return;
      }

      const dispatchCut        = rate * (dispatchPct / 100);
      const grossAfterDispatch = rate - dispatchCut;
      const fuelCost           = fuelCPM * miles;
      const totalCost          = fuelCost + other;
      const net                = grossAfterDispatch - totalCost;
      const netRPM             = miles > 0 ? grossAfterDispatch / miles : 0;
      const netCPM             = miles > 0 ? net / miles : 0;
      const meetsTarget        = netRPM >= targetRPM;

      resultEl.innerHTML = `
        <div class="text-center mb-4 py-2 rounded-xl ${meetsTarget ? 'bg-green-600/15' : 'bg-red-600/15'}">
          <div class="text-2xl font-black ${meetsTarget ? 'text-green-400' : 'text-red-400'}">
            ${meetsTarget ? '✓ Take It' : '✗ Below Target'}
          </div>
          <p class="text-xs ${meetsTarget ? 'text-green-600' : 'text-red-600'} mt-0.5">
            ${meetsTarget
              ? `${fmtMoney(netRPM - targetRPM, 2)}/mi above your target`
              : `${fmtMoney(targetRPM - netRPM, 2)}/mi below your target`}
          </p>
        </div>
        <div class="space-y-2">
          <div class="flex justify-between text-sm py-1 border-b border-gray-800">
            <span class="text-gray-400">Gross rate</span>
            <span class="font-bold">${fmtMoney(rate, 2)}</span>
          </div>
          ${dispatchPct > 0 ? `
          <div class="flex justify-between text-sm py-1 border-b border-gray-800">
            <span class="text-gray-400">Dispatch fee (${dispatchPct}%)</span>
            <span class="font-bold text-red-400">−${fmtMoney(dispatchCut, 2)}</span>
          </div>
          <div class="flex justify-between text-sm py-1 border-b border-gray-800">
            <span class="text-gray-400">Your rate</span>
            <span class="font-bold">${fmtMoney(grossAfterDispatch, 2)}</span>
          </div>` : ''}
          <div class="flex justify-between text-sm py-1 border-b border-gray-800">
            <span class="text-gray-400">Fuel (${fmtMoney(fuelCPM, 2)}/mi × ${miles.toLocaleString()} mi)</span>
            <span class="font-bold text-red-400">−${fmtMoney(fuelCost, 2)}</span>
          </div>
          ${other > 0 ? `
          <div class="flex justify-between text-sm py-1 border-b border-gray-800">
            <span class="text-gray-400">Other costs</span>
            <span class="font-bold text-red-400">−${fmtMoney(other, 2)}</span>
          </div>` : ''}
          <div class="flex justify-between text-base font-black pt-2">
            <span>Net Profit</span>
            <span class="${net >= 0 ? 'text-green-400' : 'text-red-400'}">${net < 0 ? '−' : ''}${fmtMoney(Math.abs(net), 2)}</span>
          </div>
          <div class="bg-gray-800 rounded-xl p-3 mt-2 space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Rate / mile</span>
              <span class="font-bold ${netRPM >= targetRPM ? 'text-green-400' : 'text-red-400'}">
                ${fmtMoney(netRPM, 2)}/mi
                ${netRPM >= targetRPM ? '' : `<span class="text-gray-600 text-xs">(need ${fmtMoney(targetRPM, 2)})</span>`}
              </span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Net profit / mile</span>
              <span class="font-bold">${fmtMoney(netCPM, 2)}/mi</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Break-even rate</span>
              <span class="font-bold">${fmtMoney((totalCost + dispatchCut) / miles, 2)}/mi</span>
            </div>
          </div>
        </div>`;
    }

    [rateEl, milesEl, fuelEl, otherEl].forEach(el => el?.addEventListener('input', calc));
  }

  return { html, mount };
}
