import { getTrips, addTrip, deleteTrip, updateTrip, getSettings, fmtMoney, fmtDate, today, calcTripPay } from '../store.js';
import { openModal, closeModal, confirmSheet, toast } from '../modal.js';
import { requestLocation, locationDeniedMsg } from '../permissions.js';
import { resizeImage, scanReceipt } from '../receipt-scanner.js';

let _filter = 'month';

// ── Geolocation helpers ───────────────────────────────────────────────────────

async function getCityFromCoords(lat, lon) {
  const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return '';
  const data = await res.json();
  const a    = data.address || {};
  const city = a.city || a.town || a.village || a.county || '';
  const st   = a.state_code || (a.state ? a.state.slice(0, 2).toUpperCase() : '');
  return st ? `${city}, ${st}` : city;
}

// ── Scan results card ─────────────────────────────────────────────────────────

function renderTripScanResults(r) {
  if (!r._found) return `
    <p class="text-xs font-bold mb-1" style="color:#f87171">⚠ Could not read document</p>
    <p class="text-xs" style="color:rgba(148,163,184,0.5)">
      ${r._lowQuality
        ? 'Image is too blurry or not a document. Take a clear, flat photo of the rate con.'
        : 'No fields recognized — fill the form manually or retake with better lighting.'}
    </p>`;
  const fmtD = v => new Date(v + 'T12:00').toLocaleDateString('en-US', { month:'short', day:'numeric' });
  const rows = [
    { label: 'Origin',      display: r.origin },
    { label: 'Destination', display: r.destination },
    { label: 'Revenue',     display: r.revenue != null ? '$' + r.revenue.toFixed(2)       : null },
    { label: 'Miles',       display: r.miles   != null ? r.miles.toLocaleString() + ' mi' : null },
    { label: 'Load #',      display: r.loadNum },
    { label: 'Date',        display: r.date ? fmtD(r.date) : null },
  ];
  return `
    <p class="text-xs font-bold mb-2" style="color:#4ade80">
      ✓ ${r._found} field${r._found !== 1 ? 's' : ''} read from document
    </p>
    <div>
      ${rows.map(row => `
        <div class="flex justify-between text-xs py-1.5" style="border-bottom:1px solid rgba(255,255,255,0.06)">
          <span style="color:rgba(148,163,184,0.7)">${row.label}</span>
          <span style="font-weight:${row.display ? 700 : 400};color:${row.display ? '#4ade80' : 'rgba(100,116,139,0.5)'}">
            ${row.display || '—'}
          </span>
        </div>
      `).join('')}
    </div>`;
}

// ── Form builder ──────────────────────────────────────────────────────────────

function stateMilesHtml(existingRows = []) {
  const rows = existingRows.length > 0 ? existingRows : [];
  return `
    <div id="state-miles-rows" class="space-y-2">
      ${rows.map((r, i) => stateRow(r.state, r.miles, i)).join('')}
    </div>
    <button type="button" id="add-state-row" class="loc-btn mt-2 w-full justify-center">
      + Add State
    </button>`;
}

let _rowCount = 0;
function stateRow(state = '', miles = '', idx = null) {
  const id = idx ?? _rowCount++;
  return `
    <div class="state-miles-row flex gap-2 items-center" data-row="${id}">
      <input type="text" class="form-input state-input" placeholder="OH" maxlength="3"
        value="${state}" style="width:64px;text-align:center;font-weight:700;text-transform:uppercase">
      <input type="number" class="form-input miles-input flex-1" placeholder="Miles" min="0" step="1"
        value="${miles}">
      <button type="button" class="del-state-row text-gray-500 p-1.5" style="flex-shrink:0">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`;
}

function tripForm(existing = null) {
  _rowCount = 0;
  const t = existing || {};
  const hasStateMiles = t.stateMiles?.length > 0;
  return `
    <div class="p-5">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-xl font-black">${existing ? 'Edit Trip' : 'Log Trip'}</h2>
        <button onclick="closeModal()" class="text-gray-400 text-2xl leading-none">&times;</button>
      </div>
      <form id="trip-form" class="space-y-4">

        <!-- Rate Con / BOL scanner -->
        <div>
          <label class="text-xs text-gray-400 block mb-1.5">Rate Con / BOL <span style="color:rgba(100,116,139,0.5)">(optional)</span></label>
          <div id="trip-scan-preview-wrap" class="${t.receiptPhoto ? '' : 'hidden'} mb-2 relative rounded-xl overflow-hidden"
               style="background:#0d1117">
            <img id="trip-scan-preview" src="${t.receiptPhoto || ''}"
                 class="w-full" style="max-height:200px;object-fit:contain" alt="Document">
            <button type="button" id="trip-receipt-clear"
              class="absolute top-2 right-2 bg-black/80 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-base leading-none">&times;</button>
            <div id="trip-scan-overlay" class="hidden absolute inset-0 flex flex-col items-center justify-center"
                 style="background:rgba(0,0,0,0.82)">
              <div class="text-3xl animate-pulse">📡</div>
              <p class="text-sm font-bold mt-2" style="color:#67e8f9">Scanning document…</p>
              <p class="text-xs mt-1" style="color:rgba(103,232,249,0.5)">This takes a few seconds</p>
            </div>
          </div>
          <label id="trip-scan-label" for="trip-doc-input" class="receipt-cap-label">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <rect x="5" y="2" width="14" height="20" rx="2"/>
              <line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/>
            </svg>
            Scan Rate Con / BOL
          </label>
          <input type="file" id="trip-doc-input" accept="image/*,application/pdf"
                 style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden">
          <input type="hidden" id="trip-doc-data" name="receiptPhoto" value="${t.receiptPhoto || ''}">
          <div id="trip-scan-results" class="hidden mt-2 rounded-xl p-3"
               style="background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.2)"></div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="text-xs text-gray-400">Origin</label>
              <button type="button" id="use-location-btn" class="loc-btn">
                <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                  <circle cx="12" cy="12" r="3"/><path d="M19.1 4.9C15.2 1 8.8 1 4.9 4.9S1 15.2 4.9 19.1l7.1 7.1 7.1-7.1c3.9-3.9 3.9-10.3 0-14.2z"/>
                </svg>
                My Location
              </button>
            </div>
            <input type="text" id="trip-origin" name="origin" placeholder="ATL" class="form-input"
              value="${t.origin || ''}" required>
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">Destination</label>
            <input type="text" name="destination" placeholder="JAX" class="form-input"
              value="${t.destination || ''}" required>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-400 block mb-1">Miles</label>
            <input type="number" name="miles" step="1" min="0" placeholder="287"
              class="form-input" value="${t.miles || ''}" required>
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">Gross Revenue ($)</label>
            <input type="number" name="revenue" step="0.01" min="0" placeholder="350.00"
              class="form-input" value="${t.revenue || ''}" required>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-400 block mb-1">Drive Time (hours)</label>
            <input type="number" name="durationHours" step="0.25" min="0" placeholder="4.5"
              class="form-input" value="${t.durationHours || ''}">
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">Date</label>
            <input type="date" name="date" class="form-input" value="${t.date || today()}" required>
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Load / BOL #</label>
          <input type="text" name="loadNum" placeholder="Optional load or BOL number"
            class="form-input" value="${t.loadNum || ''}">
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Notes</label>
          <textarea name="notes" rows="2" placeholder="Optional notes..."
            class="form-input resize-none">${t.notes || ''}</textarea>
        </div>

        <!-- IFTA State Miles (collapsible) -->
        <div>
          <button type="button" id="ifta-toggle"
            style="display:flex;align-items:center;gap:6px;font-size:0.75rem;font-weight:700;color:${hasStateMiles ? '#0891b2' : 'rgba(100,116,139,0.7)'};width:100%;padding:8px 0">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
            State Miles (IFTA) ${hasStateMiles ? `· ${t.stateMiles.length} states` : '· optional'}
            <svg id="ifta-chevron" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"
              style="margin-left:auto;transition:transform 0.2s;transform:${hasStateMiles ? 'rotate(90deg)' : 'rotate(0deg)'}">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <div id="ifta-body" style="display:${hasStateMiles ? 'block' : 'none'};padding:4px 0 8px">
            <p style="font-size:0.7rem;color:rgba(100,116,139,0.7);margin-bottom:8px;line-height:1.4">
              Enter miles driven in each state/province. Used to auto-generate your quarterly IFTA report.
            </p>
            ${stateMilesHtml(t.stateMiles || [])}
          </div>
        </div>

        <button type="submit" class="btn-primary">${existing ? 'Save Changes' : 'Save Trip'}</button>
        <button type="button" onclick="closeModal()" class="btn-ghost">Cancel</button>
      </form>
    </div>`;
}

// ── Main render ───────────────────────────────────────────────────────────────

export function renderTrips() {
  const allTrips = getTrips();
  const s = getSettings();
  const { targetRPM = 2.00 } = s;
  const isCompany = s.driverType === 'Company';

  const now            = new Date();
  const thisMonthStart = now.toISOString().slice(0, 7) + '-01';
  const lastMonthDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStart = lastMonthDate.toISOString().slice(0, 7) + '-01';
  const lastMonthEnd   = thisMonthStart;

  const monthTrips   = allTrips.filter(t => t.date >= thisMonthStart);
  const monthRevenue = monthTrips.reduce((s, t) => s + Number(t.revenue || 0), 0);
  const monthMiles   = monthTrips.reduce((s, t) => s + Number(t.miles   || 0), 0);

  const displayTrips = _filter === 'month' ? monthTrips
    : _filter === 'last'  ? allTrips.filter(t => t.date >= lastMonthStart && t.date < lastMonthEnd)
    : allTrips;

  const html = `
    <div class="flex flex-col h-full bg-black text-white">
      <div class="px-4 pt-2 pb-3 border-b border-gray-800 flex justify-between items-center shrink-0">
        <div>
          <h1 class="text-2xl font-black">Trips</h1>
          <p class="text-xs text-gray-500">This month: ${fmtMoney(monthRevenue)} · ${monthMiles.toLocaleString()} mi</p>
        </div>
        <button id="add-trip-btn" class="bg-orange-600 text-black rounded-full p-2.5">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <!-- Filter pills -->
      <div class="flex gap-2 px-4 pt-3 pb-2 shrink-0">
        <button class="filter-pill ${_filter === 'month' ? 'active' : ''}" data-filter="month">This Month</button>
        <button class="filter-pill ${_filter === 'last'  ? 'active' : ''}" data-filter="last">Last Month</button>
        <button class="filter-pill ${_filter === 'all'   ? 'active' : ''}" data-filter="all">All Time</button>
      </div>

      <div class="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        ${displayTrips.length === 0 ? `
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <div class="text-5xl mb-4">🚛</div>
            <p class="text-gray-400">${allTrips.length === 0 ? 'No trips logged yet.' : 'No trips this period.'}</p>
            <p class="text-gray-600 text-sm mt-1">${allTrips.length === 0 ? 'Tap + to log your first run.' : 'Switch to All Time or add a new trip.'}</p>
          </div>
        ` : displayTrips.map(t => {
          const miles   = Number(t.miles)   || 0;
          const rev     = Number(t.revenue) || 0;
          const rPerM   = miles > 0 ? rev / miles : 0;
          const tripPay = calcTripPay(t, s);

          const borderColor  = isCompany ? 'border-green-600' : (rPerM >= targetRPM ? 'border-green-600' : rPerM >= targetRPM * 0.7 ? 'border-orange-600' : 'border-red-600');
          const revenueColor = isCompany ? 'text-green-400'   : (rPerM >= targetRPM ? 'text-green-400'   : rPerM >= targetRPM * 0.7 ? 'text-orange-500'   : 'text-red-400');

          return `
          <div class="bg-gray-900 border border-gray-800 border-l-4 ${borderColor} rounded-xl p-4" data-id="${t.id}">
            <div class="flex justify-between items-start">
              <div class="min-w-0 flex-1">
                <p class="font-black text-base">${t.origin} → ${t.destination}</p>
                <p class="text-xs text-gray-500 mt-0.5">
                  ${fmtDate(t.date)}${t.durationHours ? ` · ${Number(t.durationHours)}h drive` : ''}
                  ${t.loadNum ? ` · #${t.loadNum}` : ''}
                </p>
              </div>
              <div class="text-right shrink-0 ml-3">
                <p class="font-black text-lg ${revenueColor}">${fmtMoney(rev)}</p>
                ${isCompany && tripPay !== null
                  ? `<p class="text-xs text-green-500">Your cut: ${fmtMoney(tripPay)}</p>`
                  : (rPerM > 0 ? `<p class="text-xs text-gray-500">${fmtMoney(rPerM, 2)}/mi</p>` : '')}
              </div>
            </div>
            <div class="flex justify-between items-center mt-2">
              <div class="flex items-center gap-2 text-xs text-gray-500">
                <span>${miles.toLocaleString()} miles</span>
                ${t.receiptPhoto ? `<img src="${t.receiptPhoto}" class="receipt-thumb" alt="Rate Con" onclick="window._viewTripDoc('${t.id}')">` : ''}
              </div>
              <div class="flex gap-1">
                <button class="edit-trip-btn text-gray-500 hover:text-white p-1" data-id="${t.id}">
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="del-trip-btn text-gray-600 hover:text-red-500 p-1" data-id="${t.id}">
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                </button>
              </div>
            </div>
            ${t.notes ? `<p class="text-xs text-gray-600 mt-1 italic">${t.notes}</p>` : ''}
          </div>`;
        }).join('')}
        <div style="height:8px"></div>
      </div>
    </div>`;

  function wireStateMiles(el) {
    const toggle   = el.querySelector('#ifta-toggle');
    const body     = el.querySelector('#ifta-body');
    const chevron  = el.querySelector('#ifta-chevron');
    const addBtn   = el.querySelector('#add-state-row');

    toggle.addEventListener('click', () => {
      const open = body.style.display === 'block';
      body.style.display  = open ? 'none' : 'block';
      chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
      if (!open && addBtn && el.querySelector('#state-miles-rows').children.length === 0) addBtn.click();
    });

    addBtn.addEventListener('click', () => {
      const rows = el.querySelector('#state-miles-rows');
      rows.insertAdjacentHTML('beforeend', stateRow());
      wireDelButtons(el);
    });

    wireDelButtons(el);

    // Auto-uppercase state input
    el.addEventListener('input', ev => {
      if (ev.target.classList.contains('state-input')) {
        const cur = ev.target.selectionStart;
        ev.target.value = ev.target.value.toUpperCase().replace(/[^A-Z]/g, '');
        ev.target.setSelectionRange(cur, cur);
      }
    });
  }

  function wireDelButtons(el) {
    el.querySelectorAll('.del-state-row').forEach(btn => {
      btn.onclick = () => btn.closest('.state-miles-row').remove();
    });
  }

  function collectStateMiles(el) {
    const result = [];
    el.querySelectorAll('.state-miles-row').forEach(row => {
      const state = row.querySelector('.state-input').value.trim().toUpperCase();
      const miles = parseFloat(row.querySelector('.miles-input').value);
      if (state && miles > 0) result.push({ state, miles });
    });
    return result;
  }

  const LOC_ICON = `<svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.1 4.9C15.2 1 8.8 1 4.9 4.9S1 15.2 4.9 19.1l7.1 7.1 7.1-7.1c3.9-3.9 3.9-10.3 0-14.2z"/></svg>`;

  function wireLocationBtn(el) {
    const btn    = el.querySelector('#use-location-btn');
    const origin = el.querySelector('#trip-origin');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      btn.innerHTML = `${LOC_ICON} Locating…`;
      btn.disabled  = true;

      // Short hint so the user knows to accept the OS dialog
      const hint = setTimeout(() => toast('Allow location when your browser asks', 'info'), 1500);

      const result = await requestLocation({ timeout: 15000 });
      clearTimeout(hint);

      if (result.error === 'denied' || result.error === 'unsupported') {
        btn.innerHTML = `${LOC_ICON} My Location`;
        btn.disabled  = false;
        if (result.error === 'unsupported') {
          toast('Location not supported on this device', 'error');
        } else {
          toast(locationDeniedMsg(), 'error');
        }
        return;
      }
      if (result.error) {
        btn.innerHTML = `${LOC_ICON} My Location`;
        btn.disabled  = false;
        toast('Could not get location — check GPS signal and try again', 'error');
        return;
      }

      try {
        const city  = await getCityFromCoords(result.coords.latitude, result.coords.longitude);
        origin.value = city || `${result.coords.latitude.toFixed(4)}, ${result.coords.longitude.toFixed(4)}`;
        btn.innerHTML = `${LOC_ICON} ✓ Located`;
        btn.disabled  = false;
      } catch {
        origin.value = `${result.coords.latitude.toFixed(4)}, ${result.coords.longitude.toFixed(4)}`;
        btn.innerHTML = `${LOC_ICON} ✓ Located`;
        btn.disabled  = false;
      }
    });
  }

  function wireTripScanner(el) {
    const fileInput   = el.querySelector('#trip-doc-input');
    const previewWrap = el.querySelector('#trip-scan-preview-wrap');
    const previewImg  = el.querySelector('#trip-scan-preview');
    const docData     = el.querySelector('#trip-doc-data');
    const overlay     = el.querySelector('#trip-scan-overlay');
    const results     = el.querySelector('#trip-scan-results');
    const scanLabel   = el.querySelector('#trip-scan-label');
    const clearBtn    = el.querySelector('#trip-receipt-clear');
    const originEl    = el.querySelector('#trip-origin');
    const destEl      = el.querySelector('[name="destination"]');
    const milesEl     = el.querySelector('[name="miles"]');
    const revenueEl   = el.querySelector('[name="revenue"]');
    const loadNumEl   = el.querySelector('[name="loadNum"]');
    const dateEl      = el.querySelector('[name="date"]');

    const DOC_SVG    = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg>`;
    const RETAKE_SVG = `${DOC_SVG} Retake / Replace`;
    const SCAN_SVG   = `${DOC_SVG} Scan Rate Con / BOL`;

    if (!fileInput) return;

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;

      const base64 = await resizeImage(file);
      docData.value   = base64;
      previewImg.src  = base64;
      previewWrap.classList.remove('hidden');
      scanLabel.innerHTML = RETAKE_SVG;
      overlay.classList.remove('hidden');
      results.classList.add('hidden');

      const r = await scanReceipt(base64, 'trip');
      overlay.classList.add('hidden');

      if (r.origin      && originEl  && !originEl.value)  originEl.value  = r.origin;
      if (r.destination && destEl    && !destEl.value)     destEl.value    = r.destination;
      if (r.miles       && milesEl   && !milesEl.value)    milesEl.value   = r.miles;
      if (r.revenue     && revenueEl && !revenueEl.value)  revenueEl.value = r.revenue.toFixed(2);
      if (r.loadNum     && loadNumEl && !loadNumEl.value)  loadNumEl.value = r.loadNum;
      if (r.date        && dateEl)                         dateEl.value    = r.date;

      results.innerHTML = renderTripScanResults(r);
      results.classList.remove('hidden');
    });

    clearBtn?.addEventListener('click', () => {
      docData.value   = '';
      previewImg.src  = '';
      previewWrap.classList.add('hidden');
      fileInput.value = '';
      results.classList.add('hidden');
      scanLabel.innerHTML = SCAN_SVG;
    });
  }

  function mount(container) {
    container.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        _filter = btn.dataset.filter;
        window.refresh();
      });
    });

    window._viewTripDoc = (id) => {
      const trip = getTrips().find(t => t.id === id);
      if (!trip?.receiptPhoto) return;
      openModal(`
        <div class="p-4">
          <div class="flex justify-between items-center mb-3">
            <p class="font-black">Rate Con — ${trip.origin} → ${trip.destination}</p>
            <button onclick="closeModal()" class="text-gray-400 text-2xl leading-none">&times;</button>
          </div>
          <img src="${trip.receiptPhoto}" class="w-full rounded-xl" alt="Rate Con">
          <p class="text-xs text-gray-500 mt-2 text-center">${fmtDate(trip.date)}</p>
        </div>`, () => {});
    };

    container.querySelector('#add-trip-btn').addEventListener('click', () => {
      openModal(tripForm(), el => {
        wireTripScanner(el);
        wireLocationBtn(el);
        wireStateMiles(el);
        el.querySelector('#trip-form').addEventListener('submit', ev => {
          ev.preventDefault();
          const fd = new FormData(ev.target);
          addTrip({
            origin:        fd.get('origin').trim().toUpperCase(),
            destination:   fd.get('destination').trim().toUpperCase(),
            miles:         parseFloat(fd.get('miles')),
            revenue:       parseFloat(fd.get('revenue')),
            durationHours: fd.get('durationHours') ? parseFloat(fd.get('durationHours')) : null,
            date:          fd.get('date'),
            loadNum:       fd.get('loadNum').trim(),
            notes:         fd.get('notes').trim(),
            stateMiles:    collectStateMiles(el),
            receiptPhoto:  fd.get('receiptPhoto') || null,
          });
          closeModal();
          toast('Trip saved ✓');
          window.refresh();
        });
      });
    });

    container.querySelectorAll('.edit-trip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const existing = getTrips().find(t => t.id === btn.dataset.id);
        if (!existing) return;
        openModal(tripForm(existing), el => {
          wireTripScanner(el);
          wireLocationBtn(el);
          wireStateMiles(el);
          el.querySelector('#trip-form').addEventListener('submit', ev => {
            ev.preventDefault();
            const fd = new FormData(ev.target);
            updateTrip(existing.id, {
              origin:        fd.get('origin').trim().toUpperCase(),
              destination:   fd.get('destination').trim().toUpperCase(),
              miles:         parseFloat(fd.get('miles')),
              revenue:       parseFloat(fd.get('revenue')),
              durationHours: fd.get('durationHours') ? parseFloat(fd.get('durationHours')) : null,
              date:          fd.get('date'),
              loadNum:       fd.get('loadNum').trim(),
              notes:         fd.get('notes').trim(),
              stateMiles:    collectStateMiles(el),
              receiptPhoto:  fd.get('receiptPhoto') || null,
            });
            closeModal();
            toast('Trip updated ✓');
            window.refresh();
          });
        });
      });
    });

    container.querySelectorAll('.del-trip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        confirmSheet('Delete this trip?', 'This cannot be undone.', 'Delete', () => {
          deleteTrip(btn.dataset.id);
          toast('Trip deleted', 'info');
          window.refresh();
        });
      });
    });
  }

  return { html, mount };
}
