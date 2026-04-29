import { getTrips, addTrip, deleteTrip, fmtMoney, fmtDate, today } from '../store.js';
import { openModal, closeModal } from '../modal.js';

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
            <label class="text-xs text-gray-400 block mb-1">Origin</label>
            <input type="text" name="origin" placeholder="ATL" class="form-input"
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
          <label class="text-xs text-gray-400 block mb-1">Notes</label>
          <textarea name="notes" rows="2" placeholder="Optional notes..."
            class="form-input resize-none">${t.notes || ''}</textarea>
        </div>
        <button type="submit" class="btn-primary">${existing ? 'Save Changes' : 'Save Trip'}</button>
        <button type="button" onclick="closeModal()" class="btn-ghost">Cancel</button>
      </form>
    </div>`;
}

export function renderTrips() {
  const trips = getTrips();

  const thisMonthStart = new Date().toISOString().slice(0, 7) + '-01';
  const monthTrips = trips.filter(t => t.date >= thisMonthStart);
  const monthRevenue = monthTrips.reduce((s, t) => s + Number(t.revenue || 0), 0);
  const monthMiles   = monthTrips.reduce((s, t) => s + Number(t.miles || 0), 0);

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
          const miles = Number(t.miles) || 0;
          const rev   = Number(t.revenue) || 0;
          const rPerM = miles > 0 ? rev / miles : 0;

          const profitColor = rPerM >= 1.5
            ? 'text-green-400 border-green-600'
            : rPerM >= 1.0
              ? 'text-orange-500 border-orange-600'
              : 'text-red-400 border-red-600';

          const borderColor = rPerM >= 1.5 ? 'border-green-600' : rPerM >= 1.0 ? 'border-orange-600' : 'border-red-600';

          return `
          <div class="bg-gray-900 border border-gray-800 border-l-4 ${borderColor} rounded-xl p-4" data-id="${t.id}">
            <div class="flex justify-between items-start">
              <div class="min-w-0 flex-1">
                <p class="font-black text-base">${t.origin} → ${t.destination}</p>
                <p class="text-xs text-gray-500 mt-0.5">${fmtDate(t.date)}${t.durationHours ? ` · ${Number(t.durationHours)}h drive` : ''}</p>
              </div>
              <div class="text-right shrink-0 ml-3">
                <p class="font-black text-lg ${profitColor.split(' ')[0]}">${fmtMoney(rev)}</p>
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

  function mount(container) {
    container.querySelector('#add-trip-btn').addEventListener('click', () => {
      openModal(tripForm(), el => {
        el.querySelector('#trip-form').addEventListener('submit', ev => {
          ev.preventDefault();
          const fd = new FormData(ev.target);
          addTrip({
            origin: fd.get('origin').trim().toUpperCase(),
            destination: fd.get('destination').trim().toUpperCase(),
            miles: parseFloat(fd.get('miles')),
            revenue: parseFloat(fd.get('revenue')),
            durationHours: fd.get('durationHours') ? parseFloat(fd.get('durationHours')) : null,
            date: fd.get('date'),
            notes: fd.get('notes').trim(),
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
