import { getSettings } from '../store.js';
import { toast } from '../modal.js';

export function renderCalculator() {
  const html = `
    <div class="flex flex-col h-full text-white" style="background:transparent">

      <!-- Header -->
      <div class="dash-header shrink-0">
        <div>
          <h1 style="font-size:1.4rem;font-weight:900;color:#e0f2fe;letter-spacing:-0.3px">Load Calculator</h1>
          <p style="font-size:0.7rem;color:rgba(100,116,139,0.8);margin-top:1px">Evaluate loads before you accept</p>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto" style="padding:14px 14px 80px">

        <!-- Input card -->
        <div class="glass-card" style="padding:16px;margin-bottom:12px">
          <p style="font-size:0.58rem;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:rgba(8,145,178,0.85);margin-bottom:14px">Load Details</p>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div class="settings-field" style="margin:0">
              <label class="settings-label">Offered Rate ($)</label>
              <input id="lc-rate" type="number" inputmode="decimal" step="0.01" class="form-input"
                     placeholder="1 800" style="text-align:center;font-size:1rem;font-weight:700">
            </div>
            <div class="settings-field" style="margin:0">
              <label class="settings-label">Loaded Miles</label>
              <input id="lc-miles" type="number" inputmode="decimal" class="form-input"
                     placeholder="450" style="text-align:center;font-size:1rem;font-weight:700">
            </div>
            <div class="settings-field" style="margin:0">
              <label class="settings-label">Empty Miles (DH)</label>
              <input id="lc-empty" type="number" inputmode="decimal" class="form-input"
                     placeholder="0" style="text-align:center">
            </div>
            <div class="settings-field" style="margin:0">
              <label class="settings-label">Fuel $/gal</label>
              <input id="lc-ppg" type="number" inputmode="decimal" step="0.01" class="form-input"
                     placeholder="3.99" style="text-align:center">
            </div>
          </div>

          <!-- Result panel -->
          <div id="lc-result" style="display:none;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid transparent">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;margin-bottom:12px">
              <div>
                <p style="font-size:0.6rem;color:rgba(100,116,139,0.8);font-weight:700;text-transform:uppercase;letter-spacing:1px">RPM</p>
                <p id="lc-rpm-out" style="font-size:1.2rem;font-weight:900;margin-top:2px">—</p>
              </div>
              <div>
                <p style="font-size:0.6rem;color:rgba(100,116,139,0.8);font-weight:700;text-transform:uppercase;letter-spacing:1px">Fuel Cost</p>
                <p id="lc-fuel-out" style="font-size:1.2rem;font-weight:900;color:#fca5a5;margin-top:2px">—</p>
              </div>
              <div>
                <p style="font-size:0.6rem;color:rgba(100,116,139,0.8);font-weight:700;text-transform:uppercase;letter-spacing:1px">Net</p>
                <p id="lc-net-out" style="font-size:1.2rem;font-weight:900;margin-top:2px">—</p>
              </div>
            </div>
            <div id="lc-verdict" style="text-align:center;padding:12px;border-radius:10px;font-weight:800;font-size:0.95rem"></div>
          </div>

          <button id="lc-btn" class="save-btn-full" style="padding:14px;font-size:1rem;font-weight:900">
            Evaluate Load
          </button>
        </div>

        <!-- Breakdown card (visible after first calc) -->
        <div id="lc-breakdown" class="glass-card" style="padding:16px;margin-bottom:12px;display:none">
          <p style="font-size:0.58rem;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:rgba(100,116,139,0.7);margin-bottom:12px">Breakdown</p>
          <div id="lc-breakdown-rows" class="space-y-2"></div>
        </div>

        <!-- Settings note -->
        <div class="glass-card" style="padding:12px 14px">
          <p style="font-size:0.7rem;color:rgba(100,116,139,0.7);line-height:1.6">
            Target RPM, MPG and dispatch % come from
            <button onclick="navigate('settings')" style="color:#67e8f9;font-weight:700;background:none;border:none;padding:0;cursor:pointer;font-size:inherit">Settings</button>.
            Set them once and every evaluation uses your numbers automatically.
          </p>
        </div>

      </div>
    </div>`;

  function mount(container) {
    const btn = container.querySelector('#lc-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      try {
        const rate   = parseFloat(container.querySelector('#lc-rate')?.value)  || 0;
        const loaded = parseFloat(container.querySelector('#lc-miles')?.value) || 0;
        const empty  = parseFloat(container.querySelector('#lc-empty')?.value) || 0;
        const ppg    = parseFloat(container.querySelector('#lc-ppg')?.value)   || 3.99;

        if (!rate && !loaded) { toast('Enter Offered Rate and Loaded Miles', 'error'); return; }
        if (!rate)            { toast('Enter the Offered Rate ($)', 'error'); return; }
        if (!loaded)          { toast('Enter the Loaded Miles', 'error'); return; }

        const cfg       = getSettings();
        const mpg       = Number(cfg?.targetMPG)   || 6.5;
        const targetRPM = Number(cfg?.targetRPM)   || 2.00;
        const dispPct   = Number(cfg?.dispatchPct) || 0;

        const totalMiles  = loaded + empty;
        const fuelCost    = (totalMiles / mpg) * ppg;
        const dispFee     = rate * (dispPct / 100);
        const netRevenue  = rate - dispFee;
        const rpm         = rate / loaded;
        const net         = netRevenue - fuelCost;

        // Update summary numbers
        const rpmOut  = container.querySelector('#lc-rpm-out');
        const fuelOut = container.querySelector('#lc-fuel-out');
        const netOut  = container.querySelector('#lc-net-out');
        const verdict = container.querySelector('#lc-verdict');
        const result  = container.querySelector('#lc-result');

        if (rpmOut)  rpmOut.textContent  = `$${rpm.toFixed(2)}/mi`;
        if (fuelOut) fuelOut.textContent = `-$${Math.round(fuelCost).toLocaleString()}`;
        if (netOut) {
          netOut.textContent = (net < 0 ? '-$' : '$') + Math.abs(Math.round(net)).toLocaleString();
          netOut.style.color = net >= 0 ? '#4ade80' : '#f87171';
        }

        const pct = rpm / targetRPM;
        let bg, border, color, msg;
        if (pct >= 1) {
          bg = 'rgba(21,128,61,0.15)'; border = 'rgba(21,128,61,0.4)'; color = '#4ade80';
          msg = `✓ TAKE IT — $${rpm.toFixed(2)}/mi beats your $${targetRPM.toFixed(2)} target`;
        } else if (pct >= 0.85) {
          bg = 'rgba(251,191,36,0.1)'; border = 'rgba(251,191,36,0.3)'; color = '#fbbf24';
          msg = `~ BORDERLINE — ${Math.round(pct * 100)}% of your $${targetRPM.toFixed(2)} target`;
        } else {
          bg = 'rgba(220,38,38,0.12)'; border = 'rgba(220,38,38,0.35)'; color = '#f87171';
          msg = `✕ PASS — only $${rpm.toFixed(2)}/mi, need $${targetRPM.toFixed(2)}`;
        }

        if (result) {
          result.style.background  = bg;
          result.style.borderColor = border;
          result.style.display     = 'block';
        }
        if (verdict) { verdict.textContent = msg; verdict.style.color = color; }
        if (rpmOut)  rpmOut.style.color = color;

        // Detailed breakdown
        const bdEl   = container.querySelector('#lc-breakdown');
        const bdRows = container.querySelector('#lc-breakdown-rows');
        if (bdEl && bdRows) {
          const rows = [
            ['Gross Rate',      `$${rate.toLocaleString()}`,         '#e0f2fe'],
            ['Dispatch Fee',    dispPct > 0 ? `-$${Math.round(dispFee).toLocaleString()} (${dispPct}%)` : 'None', dispPct > 0 ? '#fca5a5' : 'rgba(100,116,139,0.6)'],
            ['Net Revenue',     `$${Math.round(netRevenue).toLocaleString()}`, '#67e8f9'],
            ['Total Miles',     `${totalMiles.toLocaleString()} mi (${loaded} loaded + ${empty} empty)`, 'rgba(148,163,184,0.8)'],
            ['Fuel',            `-$${Math.round(fuelCost).toLocaleString()} (${totalMiles} mi ÷ ${mpg} mpg × $${ppg})`, '#fca5a5'],
            ['Net After Fuel',  (net < 0 ? '-$' : '$') + Math.abs(Math.round(net)).toLocaleString(), net >= 0 ? '#4ade80' : '#f87171'],
          ];
          bdRows.innerHTML = rows.map(([label, val, c]) => `
            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
              <span style="font-size:0.75rem;color:rgba(100,116,139,0.75)">${label}</span>
              <span style="font-size:0.8rem;font-weight:700;color:${c};text-align:right">${val}</span>
            </div>`).join('');
          bdEl.style.display = 'block';
        }
      } catch (err) {
        console.error('[calc]', err);
        toast('Calculator error — check your inputs', 'error');
      }
    });
  }

  return { html, mount };
}
