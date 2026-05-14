import { getTrips, getFuelLogs, getSettings } from '../store.js';
import { toast } from '../modal.js';

const ALL_JURISDICTIONS = [
  'AL','AZ','AR','CA','CO','CT','DE','FL','GA','ID','IL','IN','IA','KS','KY',
  'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA',
  'WV','WI','WY',
  // Canadian provinces (IFTA members)
  'AB','BC','MB','NB','NL','NS','ON','PE','QC','SK',
];

function quarterBounds(year, q) {
  const starts = ['01-01','04-01','07-01','10-01'];
  const ends   = ['03-31','06-30','09-30','12-31'];
  return { start: `${year}-${starts[q-1]}`, end: `${year}-${ends[q-1]}` };
}

function currentQuarter() {
  const m = new Date().getMonth(); // 0-11
  return Math.floor(m / 3) + 1;
}

function exportCSV(year, q, stateTotals, totalMiles) {
  const { start, end } = quarterBounds(year, q);
  let csv = `IFTA Report — Q${q} ${year} (${start} to ${end})\n`;
  csv += `Jurisdiction,Miles\n`;
  Object.entries(stateTotals)
    .sort((a, b) => b[1] - a[1])
    .forEach(([st, mi]) => { csv += `${st},${mi}\n`; });
  csv += `TOTAL,${totalMiles}\n`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url, download: `IFTA-Q${q}-${year}.csv`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

export function renderIFTA() {
  const year = new Date().getFullYear();
  const q    = currentQuarter();

  return buildView(year, q);
}

function buildView(year, q) {
  const { start, end } = quarterBounds(year, q);
  const allTrips = getTrips();
  const settings = getSettings();

  const qTrips = allTrips.filter(t => t.date >= start && t.date <= end);
  const withState = qTrips.filter(t => t.stateMiles?.length > 0);
  const withoutState = qTrips.filter(t => !t.stateMiles?.length);

  // Aggregate miles by state
  const stateTotals = {};
  withState.forEach(trip => {
    (trip.stateMiles || []).forEach(({ state, miles }) => {
      if (!state) return;
      stateTotals[state] = (stateTotals[state] || 0) + Number(miles || 0);
    });
  });
  const totalMiles = Object.values(stateTotals).reduce((s, v) => s + v, 0);
  const stateSorted = Object.entries(stateTotals).sort((a, b) => b[1] - a[1]);

  // Fuel summary for the quarter
  const fuelLogs = getFuelLogs().filter(f => f.date >= start && f.date <= end);
  const totalGallons = fuelLogs.reduce((s, f) => s + Number(f.gallons || 0), 0);

  const quarters = [1,2,3,4];

  const html = `
    <div class="flex flex-col h-full text-white" style="background:rgb(4,10,18)">

      <!-- Header -->
      <div class="dash-header shrink-0">
        <div style="display:flex;align-items:center;gap:10px">
          <button onclick="navigate('more')" class="settings-back-btn">
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 style="font-size:1.3rem;font-weight:900;color:#e0f2fe">IFTA Report</h1>
            <p style="font-size:0.7rem;color:rgba(100,116,139,0.8)">International Fuel Tax Agreement</p>
          </div>
        </div>
        ${stateSorted.length > 0 ? `
        <button id="export-csv-btn" style="background:rgba(8,145,178,0.15);color:#67e8f9;border:1px solid rgba(8,145,178,0.3);font-weight:700;font-size:0.75rem;padding:7px 12px;border-radius:10px;white-space:nowrap">
          ↓ CSV
        </button>` : ''}
      </div>

      <div class="flex-1 overflow-y-auto" style="padding:12px 14px 80px">

        <!-- Quarter picker -->
        <div style="display:flex;gap:6px;margin-bottom:12px">
          ${quarters.map(qt => `
          <button class="q-btn" data-year="${year}" data-q="${qt}"
            style="flex:1;padding:8px 4px;border-radius:12px;font-weight:800;font-size:0.8rem;
            ${qt === q
              ? 'background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;box-shadow:0 0 12px rgba(8,145,178,0.4)'
              : 'background:rgba(255,255,255,0.05);color:rgba(148,163,184,0.7);border:1px solid rgba(255,255,255,0.08)'}">
            Q${qt}<br><span style="font-size:0.65rem;font-weight:600;opacity:0.75">${year}</span>
          </button>`).join('')}
        </div>

        <!-- Period label -->
        <p style="font-size:0.58rem;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:rgba(8,145,178,0.85);margin-bottom:10px">
          Q${q} ${year} · ${start} — ${end}
        </p>

        <!-- Summary card -->
        <div class="glass-card" style="padding:16px;margin-bottom:10px">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center">
            <div>
              <p style="font-size:0.62rem;color:rgba(100,116,139,0.8);font-weight:700">Trips</p>
              <p style="font-size:1.2rem;font-weight:900;color:#e0f2fe">${qTrips.length}</p>
            </div>
            <div>
              <p style="font-size:0.62rem;color:rgba(100,116,139,0.8);font-weight:700">Reported Miles</p>
              <p style="font-size:1.2rem;font-weight:900;color:#67e8f9">${totalMiles.toLocaleString()}</p>
            </div>
            <div>
              <p style="font-size:0.62rem;color:rgba(100,116,139,0.8);font-weight:700">Total Gallons</p>
              <p style="font-size:1.2rem;font-weight:900;color:#a78bfa">${Math.round(totalGallons).toLocaleString()}</p>
            </div>
          </div>
          ${withoutState.length > 0 ? `
          <div style="margin-top:12px;padding:10px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:12px">
            <p style="font-size:0.75rem;font-weight:700;color:#fbbf24">⚠ ${withoutState.length} trip${withoutState.length !== 1 ? 's' : ''} missing state breakdown</p>
            <p style="font-size:0.68rem;color:rgba(100,116,139,0.8);margin-top:3px">Edit those trips and add state miles for a complete report.</p>
          </div>` : qTrips.length > 0 ? `
          <div style="margin-top:12px;padding:10px;background:rgba(21,128,61,0.1);border:1px solid rgba(21,128,61,0.25);border-radius:12px">
            <p style="font-size:0.75rem;font-weight:700;color:#4ade80">✓ All trips have state miles logged</p>
          </div>` : ''}
        </div>

        <!-- State breakdown table -->
        ${stateSorted.length > 0 ? `
        <p style="font-size:0.58rem;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:rgba(100,116,139,0.7);margin-bottom:8px">Miles by Jurisdiction</p>
        <div class="glass-card" style="padding:0;overflow:hidden">
          <div style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.06);display:grid;grid-template-columns:3rem 1fr 4rem;gap:8px;font-size:0.62rem;font-weight:900;color:rgba(100,116,139,0.7);letter-spacing:1.5px;text-transform:uppercase">
            <span>State</span><span>Miles</span><span style="text-align:right">%</span>
          </div>
          ${stateSorted.map(([st, mi]) => {
            const pct = totalMiles > 0 ? (mi / totalMiles * 100) : 0;
            return `
            <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.04);display:grid;grid-template-columns:3rem 1fr 4rem;gap:8px;align-items:center">
              <span style="font-weight:900;font-size:0.9rem;color:#67e8f9">${st}</span>
              <div>
                <p style="font-weight:700;font-size:0.88rem;color:#e0f2fe">${Math.round(mi).toLocaleString()}</p>
                <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:3px;margin-top:4px">
                  <div style="height:3px;background:linear-gradient(90deg,#0891b2,#06b6d4);border-radius:3px;width:${Math.min(100,pct)}%"></div>
                </div>
              </div>
              <span style="font-size:0.8rem;color:rgba(100,116,139,0.7);text-align:right">${pct.toFixed(1)}%</span>
            </div>`;
          }).join('')}
          <div style="padding:12px 14px;display:grid;grid-template-columns:3rem 1fr 4rem;gap:8px;align-items:center;background:rgba(8,145,178,0.08)">
            <span style="font-weight:900;font-size:0.8rem;color:rgba(100,116,139,0.8)">ALL</span>
            <span style="font-weight:900;font-size:1rem;color:#e0f2fe">${totalMiles.toLocaleString()}</span>
            <span style="font-size:0.8rem;color:rgba(100,116,139,0.7);text-align:right">100%</span>
          </div>
        </div>
        ` : `
        <div style="display:flex;flex-direction:column;align-items:center;padding:40px 0;text-align:center">
          <div style="font-size:3rem;margin-bottom:12px">🗺</div>
          <p style="font-weight:700;color:rgba(148,163,184,0.8)">No state miles for Q${q} ${year}</p>
          <p style="font-size:0.82rem;color:rgba(100,116,139,0.7);margin-top:6px;line-height:1.5;padding:0 24px">
            When logging a trip, expand <strong style="color:#0891b2">State Miles (IFTA)</strong> and enter each state you crossed with the miles driven in that state.
          </p>
        </div>
        `}

        <!-- Filing reminder -->
        <div class="glass-card" style="padding:14px;margin-top:4px">
          <p style="font-size:0.58rem;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:rgba(8,145,178,0.85);margin-bottom:8px">Filing Deadlines</p>
          <div style="display:grid;gap:4px">
            ${[['Q1 (Jan–Mar)','Apr 30'],['Q2 (Apr–Jun)','Jul 31'],['Q3 (Jul–Sep)','Oct 31'],['Q4 (Oct–Dec)','Jan 31']].map(([period, due], i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.8rem">
              <span style="color:${i+1===q ? '#67e8f9' : 'rgba(148,163,184,0.7)'};font-weight:${i+1===q ? 800 : 500}">${period}</span>
              <span style="color:${i+1===q ? '#67e8f9' : 'rgba(100,116,139,0.6)'};font-weight:700">${due}</span>
            </div>`).join('')}
          </div>
          <p style="font-size:0.68rem;color:rgba(100,116,139,0.6);margin-top:8px">File with your base jurisdiction. Late filing = $50+ penalty or 10% of tax due.</p>
        </div>

      </div>
    </div>`;

  function mount(container) {
    container.querySelectorAll('.q-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const yr = parseInt(btn.dataset.year);
        const qt = parseInt(btn.dataset.q);
        const { html: newHtml, mount: newMount } = buildView(yr, qt);
        container.innerHTML = newHtml;
        if (newMount) newMount(container);
      });
    });

    container.querySelector('#export-csv-btn')?.addEventListener('click', () => {
      exportCSV(year, q, stateTotals, totalMiles);
      toast('IFTA report exported ✓');
    });
  }

  return { html, mount };
}
