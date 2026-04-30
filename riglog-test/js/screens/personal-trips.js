import { getPTrips, addPTrip, deletePTrip, updatePTrip, fmtDate, today } from '../store.js';
import { openModal, closeModal, confirmSheet, toast } from '../modal.js';
import { requestLocation, locationDeniedMsg } from '../permissions.js';

let _filter = 'month';
const PURPOSES = ['Commute','Errand','Work','Medical','Leisure','Road Trip','Other'];

const LOC_ICON = `<svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.1 4.9C15.2 1 8.8 1 4.9 4.9S1 15.2 4.9 19.1l7.1 7.1 7.1-7.1c3.9-3.9 3.9-10.3 0-14.2z"/></svg>`;

async function getCityFromCoords(lat, lon) {
  try {
    const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`);
    const data = await res.json();
    const a    = data.address || {};
    const city = a.city || a.town || a.village || a.county || '';
    const st   = a.state_code || (a.state ? a.state.slice(0, 2).toUpperCase() : '');
    return st ? `${city}, ${st}` : city;
  } catch { return null; }
}

function tripForm(existing = null) {
  const t = existing || {};
  return `
    <div class="p-5">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-xl font-black">${existing ? 'Edit Trip' : 'Log Trip'}</h2>
        <button onclick="closeModal()" class="text-gray-400 text-2xl leading-none">&times;</button>
      </div>
      <form id="p-trip-form" class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="text-xs text-gray-400">From</label>
              <button type="button" id="p-use-location-btn" class="loc-btn">
                ${LOC_ICON} My Location
              </button>
            </div>
            <input type="text" id="p-trip-origin" name="origin" class="form-input" placeholder="Home" value="${t.origin || ''}">
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">To</label>
            <input type="text" name="destination" class="form-input" placeholder="Work" value="${t.destination || ''}">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-400 block mb-1">Miles</label>
            <input type="number" name="miles" class="form-input" placeholder="12" step="0.1" min="0" value="${t.miles || ''}" required>
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">Purpose</label>
            <select name="purpose" class="form-input">
              ${PURPOSES.map(p => `<option value="${p}"${t.purpose===p?' selected':''}>${p}</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Date</label>
          <input type="date" name="date" class="form-input" value="${t.date || today()}" required>
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Notes</label>
          <input type="text" name="notes" class="form-input" placeholder="Optional…" value="${t.notes || ''}">
        </div>
        <button type="submit" class="btn-primary">${existing ? 'Save Changes' : 'Save Trip'}</button>
        <button type="button" onclick="closeModal()" class="btn-ghost">Cancel</button>
      </form>
    </div>`;
}

const PURPOSE_ICONS = { Commute:'🏙', Errand:'🛒', Work:'💼', Medical:'🏥', Leisure:'🌄', 'Road Trip':'🗺', Other:'🚗' };

export function renderPersonalTrips() {
  const allTrips = getPTrips();
  const now            = new Date();
  const ms             = now.toISOString().slice(0,7) + '-01';
  const lm             = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const lms            = lm.toISOString().slice(0,7) + '-01';
  const monthMiles     = allTrips.filter(t => t.date >= ms).reduce((s,t) => s + Number(t.miles||0), 0);
  const displayTrips   = _filter === 'month' ? allTrips.filter(t => t.date >= ms)
    : _filter === 'last' ? allTrips.filter(t => t.date >= lms && t.date < ms)
    : allTrips;

  const html = `
    <div class="flex flex-col h-full text-white" style="background:rgb(4,10,18)">
      <div style="padding:16px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;align-items:center" class="shrink-0">
        <div>
          <h1 class="text-2xl font-black">Trips</h1>
          <p class="text-xs" style="color:rgba(100,116,139,0.8)">This month: ${monthMiles.toLocaleString()} mi</p>
        </div>
        <button id="add-p-trip-btn" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <div class="flex gap-2 px-4 pt-3 pb-2 shrink-0">
        <button class="filter-pill ${_filter==='month'?'active':''}" data-filter="month">This Month</button>
        <button class="filter-pill ${_filter==='last'?'active':''}" data-filter="last">Last Month</button>
        <button class="filter-pill ${_filter==='all'?'active':''}" data-filter="all">All Time</button>
      </div>
      <div class="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5">
        ${displayTrips.length === 0 ? `
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <div class="text-5xl mb-4">🗺</div>
            <p style="color:rgba(148,163,184,0.8)">${allTrips.length===0 ? 'No trips yet. Tap + to log your first drive.' : 'No trips this period.'}</p>
          </div>
        ` : displayTrips.map(t => `
          <div class="glass-card" style="padding:14px;margin-bottom:0" data-id="${t.id}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div style="display:flex;gap:10px;align-items:flex-start;min-width:0;flex:1">
                <span style="font-size:1.4rem;flex-shrink:0">${PURPOSE_ICONS[t.purpose] || '🚗'}</span>
                <div class="min-w-0">
                  <p style="font-weight:800;font-size:0.9rem;color:#e0f2fe">${t.origin && t.destination ? `${t.origin} → ${t.destination}` : t.purpose || 'Trip'}</p>
                  <p style="font-size:0.72rem;color:rgba(100,116,139,0.8);margin-top:2px">${fmtDate(t.date)}${t.purpose ? ` · ${t.purpose}` : ''}${t.notes ? ` · ${t.notes}` : ''}</p>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:8px">
                <span style="font-weight:800;color:#c4b5fd">${Number(t.miles||0).toLocaleString()} mi</span>
                <button class="edit-p-trip" data-id="${t.id}" style="color:rgba(100,116,139,0.6);padding:4px">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="del-p-trip" data-id="${t.id}" style="color:rgba(100,116,139,0.5);padding:4px">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            </div>
          </div>`).join('')}
        <div style="height:8px"></div>
      </div>
    </div>`;

  function mount(container) {
    container.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => { _filter = btn.dataset.filter; window.refresh(); });
    });
    function wireLocBtn(el) {
      const btn    = el.querySelector('#p-use-location-btn');
      const origin = el.querySelector('#p-trip-origin');
      if (!btn) return;
      btn.addEventListener('click', async () => {
        btn.innerHTML = `${LOC_ICON} Locating…`;
        btn.disabled  = true;
        const result  = await requestLocation();
        if (result.error) {
          btn.innerHTML = `${LOC_ICON} My Location`;
          btn.disabled  = false;
          toast(result.error === 'denied' ? locationDeniedMsg()
            : result.error === 'unsupported' ? 'Location not supported on this device'
            : 'Could not get location — try again', 'error');
          return;
        }
        const city   = await getCityFromCoords(result.coords.latitude, result.coords.longitude);
        origin.value = city || `${result.coords.latitude.toFixed(4)}, ${result.coords.longitude.toFixed(4)}`;
        btn.innerHTML = `${LOC_ICON} ✓ Located`;
        btn.disabled  = false;
      });
    }

    function openForm(existing=null) {
      openModal(tripForm(existing), el => {
        wireLocBtn(el);
        el.querySelector('#p-trip-form').addEventListener('submit', ev => {
          ev.preventDefault();
          const fd = new FormData(ev.target);
          const data = { origin: fd.get('origin').trim(), destination: fd.get('destination').trim(), miles: parseFloat(fd.get('miles')), purpose: fd.get('purpose'), date: fd.get('date'), notes: fd.get('notes').trim() };
          if (existing) updatePTrip(existing.id, data); else addPTrip(data);
          closeModal(); toast(existing ? 'Trip updated ✓' : 'Trip saved ✓'); window.refresh();
        });
      });
    }
    container.querySelector('#add-p-trip-btn').addEventListener('click', () => openForm());
    container.querySelectorAll('.edit-p-trip').forEach(btn => {
      btn.addEventListener('click', () => { const t = getPTrips().find(t => t.id === btn.dataset.id); if (t) openForm(t); });
    });
    container.querySelectorAll('.del-p-trip').forEach(btn => {
      btn.addEventListener('click', () => { confirmSheet('Delete trip?', '', 'Delete', () => { deletePTrip(btn.dataset.id); toast('Deleted','info'); window.refresh(); }); });
    });
  }
  return { html, mount };
}
