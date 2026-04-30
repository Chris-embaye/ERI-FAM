import { getTrips, addTrip, deleteTrip, fmtMoney, fmtDate, today } from '../store.js';
import { openModal, closeModal } from '../modal.js';

// ── Geolocation helpers ───────────────────────────────────────────────────────

async function getCityFromCoords(lat, lon) {
  const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
  const data = await res.json();
  const a    = data.address || {};
  const city = a.city || a.town || a.village || a.county || '';
  const state = a.state_code || (a.state ? a.state.substring(0, 2).toUpperCase() : '');
  return state ? `${city}, ${state}` : city;
}

function getCurrentCity() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return; }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const city = await getCityFromCoords(pos.coords.latitude, pos.coords.longitude);
          resolve(city || 'Unknown location');
        } catch { reject(new Error('Could not get city name')); }
      },
      err => reject(err),
      { timeout: 10000, enableHighAccuracy: false }
    );
  });
}

// ── Form builder ──────────────────────────────────────────────────────────────

function tripForm(existing = null) {
  const t = existing || {};
  return `
    <div class="p-5">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-xl font-black">${existing ? 'Edit Trip' : 'Log Trip'}</h2>
        <button onclick="closeModal()" class="text-gray-400 text-2xl leading-none">&times;</button>
      </div>
      <form id="trip-form" class="space-y-4">
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
        <button type="submit" class="btn-primary">${existing ? 'Save Changes' : 'Save Trip'}</button>
        <button type="button" onclick="closeModal()" class="btn-ghost">Cancel</button>
      </form>
    </div>`;
}

// ── Main render ───────────────────────────────────────────────────────────────

export function renderTrips() {
  const trips = getTrips();

  const thisMonthStart = new Date().toISOString().slice(0, 7) + '-01';
  const monthTrips   = trips.filter(t => t.date >= thisMonthStart);
  const monthRevenue = monthTrips.reduce((s, t) => s + Number(t.revenue || 0), 0);
  const monthMiles   = monthTrips.reduce((s, t) => s + Number(t.miles   || 0), 0);

  const html = `
    <div class="flex flex-col h-full bg-black text-white">
      <div class="px-4 pt-5 pb-4 border-b border-gray-800 flex justify-between items-center shrink-0">
        <div>
          <h1 class="text-2xl font-black">Trips</h1>
          <p class="text-xs text-gray-500">This month: ${fmtMoney(monthRevenue)} · ${monthMiles.toLocaleString()} mi</p>
        </div>
        <button id="add-trip-btn" class="bg-orange-600 text-black rounded-full p-2.5">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        ${trips.length === 0 ? `
          <div class="flex flex-col items-center justify-center py-20 text-center">
            <div class="text-5xl mb-4">🚛</div>
            <p class="text-gray-400">No trips logged yet.</p>
            <p class="text-gray-600 text-sm mt-1">Tap + to log your first run.</p>
          </div>
        ` : trips.map(t => {
          const miles   = Number(t.miles)   || 0;
          const rev     = Number(t.revenue) || 0;
          const rPerM   = miles > 0 ? rev / miles : 0;

          const borderColor = rPerM >= 1.5 ? 'border-green-600' : rPerM >= 1.0 ? 'border-orange-600' : 'border-red-600';
          const revenueColor = rPerM >= 1.5 ? 'text-green-400' : rPerM >= 1.0 ? 'text-orange-500' : 'text-red-400';

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
                ${rPerM > 0 ? `<p class="text-xs text-gray-500">${fmtMoney(rPerM, 2)}/mi</p>` : ''}
              </div>
            </div>
            <div class="flex justify-between items-center mt-2">
              <span class="text-xs text-gray-500">${miles.toLocaleString()} miles</span>
              <button class="del-trip-btn text-gray-600 hover:text-red-500 p-1" data-id="${t.id}">
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
              </button>
            </div>
            ${t.notes ? `<p class="text-xs text-gray-600 mt-1 italic">${t.notes}</p>` : ''}
          </div>`;
        }).join('')}
        <div style="height:8px"></div>
      </div>
    </div>`;

  function wireLocationBtn(el) {
    const btn    = el.querySelector('#use-location-btn');
    const origin = el.querySelector('#trip-origin');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      btn.textContent = 'Locating…';
      btn.disabled = true;
      try {
        const city = await getCurrentCity();
        origin.value = city;
        btn.textContent = '✓ Located';
      } catch (err) {
        btn.textContent = 'My Location';
        btn.disabled = false;
        if (err.code === 1) {
          alert('Location permission denied. Please allow location access in your browser settings.');
        } else {
          alert('Could not get location. Please enter manually.');
        }
      }
    });
  }

  function mount(container) {
    container.querySelector('#add-trip-btn').addEventListener('click', () => {
      openModal(tripForm(), el => {
        wireLocationBtn(el);
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
          });
          closeModal();
          window.refresh();
        });
      });
    });

    container.querySelectorAll('.del-trip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Delete this trip?')) {
          deleteTrip(btn.dataset.id);
          window.refresh();
        }
      });
    });
  }

  return { html, mount };
}
