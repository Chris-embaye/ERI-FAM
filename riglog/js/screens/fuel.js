import { getFuelLogs, addFuelLog, deleteFuelLog, fmtMoney, fmtDate, today } from '../store.js';
import { openModal, closeModal } from '../modal.js';

function fuelForm() {
  return `
    <div class="p-5">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-xl font-black">Log Fuel Stop</h2>
        <button onclick="closeModal()" class="text-gray-400 text-2xl leading-none">&times;</button>
      </div>
      <form id="fuel-form" class="space-y-4">
        <div>
          <label class="text-xs text-gray-400 block mb-1">Location / Station</label>
          <input type="text" name="location" placeholder="Pilot Flying J, I-75 Exit 42"
            class="form-input" required>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-400 block mb-1">Gallons</label>
            <input type="number" name="gallons" step="0.01" min="0" placeholder="120.5"
              class="form-input" required>
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">Price / Gallon ($)</label>
            <input type="number" name="pricePerGallon" step="0.001" min="0" placeholder="3.89"
              class="form-input" required>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-400 block mb-1">Odometer (miles)</label>
            <input type="number" name="odometer" step="1" min="0" placeholder="Optional"
              class="form-input">
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">Date</label>
            <input type="date" name="date" class="form-input" value="${today()}" required>
          </div>
        </div>
        <div id="fuel-total-preview" class="text-center py-2 text-gray-400 text-sm"></div>
        <button type="submit" class="btn-primary">Save Fuel Stop</button>
        <button type="button" onclick="closeModal()" class="btn-ghost">Cancel</button>
      </form>
    </div>`;
}

function calcMPG(logs) {
  // logs sorted newest-first; to calc MPG we need consecutive fills with odometer
  const withOdo = logs.filter(l => l.odometer);
  if (withOdo.length < 2) return {};
  const mpgMap = {};
  // sort by odometer ascending to find consecutive
  const sorted = [...withOdo].sort((a, b) => Number(a.odometer) - Number(b.odometer));
  for (let i = 1; i < sorted.length; i++) {
    const miles = Number(sorted[i].odometer) - Number(sorted[i - 1].odometer);
    const gallons = Number(sorted[i].gallons);
    if (miles > 0 && gallons > 0) {
      mpgMap[sorted[i].id] = (miles / gallons).toFixed(1);
    }
  }
  return mpgMap;
}

export function renderFuel() {
  const logs = getFuelLogs();

  const thisMonthStart = new Date().toISOString().slice(0, 7) + '-01';
  const monthLogs = logs.filter(l => l.date >= thisMonthStart);
  const monthTotal = monthLogs.reduce((s, l) => s + Number(l.total || (l.gallons * l.pricePerGallon) || 0), 0);
  const monthGallons = monthLogs.reduce((s, l) => s + Number(l.gallons || 0), 0);

  const mpgMap = calcMPG(logs);

  const html = `
    <div class="flex flex-col h-full bg-black text-white">
      <div class="px-4 pt-5 pb-4 border-b border-gray-800 flex justify-between items-center shrink-0">
        <div>
          <h1 class="text-2xl font-black">Fuel</h1>
          <p class="text-xs text-gray-500">This month: ${fmtMoney(monthTotal, 2)} · ${monthGallons.toFixed(0)} gal</p>
        </div>
        <button id="add-fuel-btn" class="bg-orange-600 text-black rounded-full p-2.5">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        ${logs.length === 0 ? `
          <div class="flex flex-col items-center justify-center py-20 text-center">
            <div class="text-5xl mb-4">⛽</div>
            <p class="text-gray-400">No fuel stops logged.</p>
            <p class="text-gray-600 text-sm mt-1">Tap + to log your first fill-up.</p>
          </div>
        ` : logs.map(l => {
          const total = Number(l.total) || (Number(l.gallons) * Number(l.pricePerGallon));
          const mpg = mpgMap[l.id];
          return `
          <div class="bg-gray-900 border border-gray-800 rounded-xl p-4" data-id="${l.id}">
            <div class="flex justify-between items-start">
              <div class="min-w-0 flex-1">
                <p class="font-bold text-sm">⛽ ${l.location}</p>
                <p class="text-xs text-gray-500 mt-0.5">${fmtDate(l.date)}</p>
              </div>
              <div class="text-right shrink-0 ml-3">
                <p class="font-black text-base">${fmtMoney(total, 2)}</p>
              </div>
            </div>
            <div class="flex justify-between items-center mt-2">
              <div class="text-xs text-gray-500 space-x-3">
                <span>${Number(l.gallons).toFixed(2)} gal</span>
                <span>${fmtMoney(l.pricePerGallon, 3)}/gal</span>
                ${l.odometer ? `<span>📍 ${Number(l.odometer).toLocaleString()} mi</span>` : ''}
                ${mpg ? `<span class="text-green-400">🌿 ${mpg} MPG</span>` : ''}
              </div>
              <button class="del-fuel-btn text-gray-600 hover:text-red-500 p-1" data-id="${l.id}">
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
              </button>
            </div>
          </div>`;
        }).join('')}
        <div style="height:8px"></div>
      </div>
    </div>`;

  function mount(container) {
    container.querySelector('#add-fuel-btn').addEventListener('click', () => {
      openModal(fuelForm(), el => {
        // Live total preview
        const gallonsInput = el.querySelector('[name=gallons]');
        const priceInput   = el.querySelector('[name=pricePerGallon]');
        const preview      = el.querySelector('#fuel-total-preview');
        function updatePreview() {
          const g = parseFloat(gallonsInput.value);
          const p = parseFloat(priceInput.value);
          preview.textContent = (g > 0 && p > 0)
            ? `Total: ${fmtMoney(g * p, 2)}`
            : '';
        }
        gallonsInput.addEventListener('input', updatePreview);
        priceInput.addEventListener('input', updatePreview);

        el.querySelector('#fuel-form').addEventListener('submit', ev => {
          ev.preventDefault();
          const fd = new FormData(ev.target);
          const gallons = parseFloat(fd.get('gallons'));
          const ppg     = parseFloat(fd.get('pricePerGallon'));
          addFuelLog({
            location: fd.get('location').trim(),
            gallons,
            pricePerGallon: ppg,
            total: +(gallons * ppg).toFixed(2),
            odometer: fd.get('odometer') ? parseInt(fd.get('odometer')) : null,
            date: fd.get('date'),
          });
          closeModal();
          window.refresh();
        });
      });
    });

    container.querySelectorAll('.del-fuel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Delete this fuel log?')) {
          deleteFuelLog(btn.dataset.id);
          window.refresh();
        }
      });
    });
  }

  return { html, mount };
}
