import { getDVIRs, addDVIR, fmtDate } from '../store.js';

const DVIR_SECTIONS = [
  {
    title: 'Tractor – External',
    icon: '🚛',
    items: [
      { key: 'tires',        label: 'Tires & Wheels' },
      { key: 'brakes',       label: 'Brakes & Drums' },
      { key: 'steering',     label: 'Steering' },
      { key: 'suspension',   label: 'Suspension' },
      { key: 'lights_front', label: 'Headlights & Turn Signals' },
      { key: 'lights_rear',  label: 'Tail Lights & Brake Lights' },
      { key: 'mirrors',      label: 'Mirrors & Glass' },
      { key: 'windshield',   label: 'Windshield & Wipers' },
      { key: 'horn',         label: 'Horn' },
      { key: 'exhaust',      label: 'Exhaust System' },
      { key: 'fifth_wheel',  label: 'Fifth Wheel / Coupling' },
      { key: 'fuel_tanks',   label: 'Fuel Tanks & Caps' },
    ],
  },
  {
    title: 'Engine Compartment',
    icon: '🔧',
    items: [
      { key: 'oil',         label: 'Engine Oil Level' },
      { key: 'coolant',     label: 'Coolant Level' },
      { key: 'belts',       label: 'Belts & Hoses' },
      { key: 'battery',     label: 'Battery & Terminals' },
      { key: 'air_filter',  label: 'Air Filter' },
      { key: 'power_steer', label: 'Power Steering Fluid' },
    ],
  },
  {
    title: 'Cab Interior',
    icon: '🪑',
    items: [
      { key: 'seatbelt',   label: 'Seat Belt' },
      { key: 'gauges',     label: 'Dashboard Gauges & Warning Lights' },
      { key: 'fire_ext',   label: 'Fire Extinguisher (charged)' },
      { key: 'triangles',  label: 'Reflective Triangles (3 required)' },
      { key: 'firstaid',   label: 'First Aid Kit' },
      { key: 'logbook',    label: 'Log Book / ELD Working' },
      { key: 'permits',    label: 'License, Registration & Permits' },
      { key: 'fuel_ok',    label: 'Fuel Level Adequate' },
      { key: 'clutch',     label: 'Clutch / Gearshift' },
    ],
  },
  {
    title: 'Trailer',
    icon: '📦',
    items: [
      { key: 'tr_tires',    label: 'Trailer Tires' },
      { key: 'tr_brakes',   label: 'Trailer Brakes' },
      { key: 'tr_lights',   label: 'Trailer Lights & Reflectors' },
      { key: 'tr_landing',  label: 'Landing Gear' },
      { key: 'tr_mudflaps', label: 'Mud Flaps' },
      { key: 'tr_doors',    label: 'Doors, Hinges & Seals' },
      { key: 'tr_kingpin',  label: 'Kingpin & Apron' },
      { key: 'tr_airlines', label: 'Air Lines & Gladhands' },
      { key: 'tr_cargo',    label: 'Cargo Securement' },
      { key: 'tr_conspic',  label: 'Reflective Tape & Conspicuity' },
    ],
  },
];

const ALL_ITEMS = DVIR_SECTIONS.flatMap(s => s.items);

function itemState(val) {
  if (val === 'ok')     return { cls: 'dvir-ok',     badge: `<span class="text-green-400 font-black text-lg">✓</span>` };
  if (val === 'defect') return { cls: 'dvir-defect',  badge: `<span class="text-orange-500 font-black text-lg">!</span>` };
  return                       { cls: 'dvir-blank',   badge: `<span class="text-gray-500 text-xl">○</span>` };
}

export function renderDVIR() {
  const dvirs = getDVIRs();

  const html = `
    <div class="flex flex-col h-full bg-black text-white">
      <div class="px-4 pt-5 pb-4 border-b border-gray-800 flex items-center gap-3 shrink-0">
        <button onclick="navigate('more')" class="text-gray-400">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 class="text-2xl font-black">DVIR</h1>
          <p class="text-xs text-gray-500">Driver Vehicle Inspection Report</p>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">

        <!-- New inspection form -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div class="flex justify-between items-center mb-3">
            <p class="font-bold text-sm text-gray-300">New Inspection</p>
            <select id="dvir-type" class="form-input w-auto text-xs py-1 px-2">
              <option value="pre">🌅 Pre-Trip</option>
              <option value="post">🌙 Post-Trip</option>
            </select>
          </div>

          <!-- Odometer & unit # -->
          <div class="grid grid-cols-2 gap-2 mb-4">
            <div>
              <label class="text-xs text-gray-500 block mb-1">Odometer (mi)</label>
              <input id="dvir-odometer" type="number" class="form-input text-sm" placeholder="e.g. 258400">
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">Truck / Unit #</label>
              <input id="dvir-unit" type="text" class="form-input text-sm" placeholder="e.g. T-112">
            </div>
          </div>

          <!-- Inspection items by section -->
          <div id="dvir-items" class="space-y-1">
            ${DVIR_SECTIONS.map((section, si) => `
              <p class="dvir-section-header ${si === 0 ? 'first' : ''}">${section.icon} ${section.title}</p>
              ${section.items.map(item => {
                const { cls, badge } = itemState(null);
                return `
                  <div class="dvir-item ${cls} border rounded-xl p-3 flex justify-between items-center cursor-pointer"
                       data-key="${item.key}">
                    <span class="font-semibold text-sm">${item.label}</span>
                    <span class="dvir-badge">${badge}</span>
                  </div>`;
              }).join('')}
            `).join('')}
          </div>

          <!-- Defect notes -->
          <div class="mt-4">
            <label class="text-xs text-gray-400 block mb-1">Defect Notes / Remarks</label>
            <textarea id="dvir-notes" rows="2"
              placeholder="Describe any defects, required repairs, or additional remarks..."
              class="form-input resize-none"></textarea>
          </div>

          <!-- Quick actions -->
          <div class="flex gap-2 mt-3">
            <button id="dvir-all-ok" class="flex-1 bg-green-900/40 border border-green-800 text-green-400 rounded-xl py-2.5 text-sm font-bold">
              ✓ Mark All OK
            </button>
            <button id="dvir-clear" class="flex-1 bg-gray-800 border border-gray-700 text-gray-400 rounded-xl py-2.5 text-sm font-bold">
              ↺ Clear All
            </button>
          </div>

          <button id="dvir-submit" class="btn-primary mt-3">Sign &amp; Submit Inspection</button>
        </div>

        <!-- Past inspections -->
        ${dvirs.length > 0 ? `
          <div>
            <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">Past Inspections</p>
            <div class="space-y-2">
              ${dvirs.slice(0, 20).map(d => {
                const defects = ALL_ITEMS.filter(i => d.items?.[i.key] === 'defect');
                const oks     = ALL_ITEMS.filter(i => d.items?.[i.key] === 'ok');
                const total   = oks.length + defects.length;
                return `
                <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div class="flex justify-between items-start">
                    <div>
                      <p class="font-bold text-sm">${d.type === 'pre' ? '🌅 Pre-Trip' : '🌙 Post-Trip'}</p>
                      <p class="text-xs text-gray-500 mt-0.5">
                        ${fmtDate(d.date)}${d.odometer ? ` · ${Number(d.odometer).toLocaleString()} mi` : ''}${d.unit ? ` · Unit ${d.unit}` : ''}
                      </p>
                    </div>
                    <div class="text-right text-xs space-y-0.5">
                      <div><span class="text-green-400 font-bold">${oks.length}/${total} ✓</span></div>
                      ${defects.length > 0 ? `<div><span class="text-orange-500 font-bold">${defects.length} defect${defects.length !== 1 ? 's' : ''}</span></div>` : ''}
                    </div>
                  </div>
                  ${defects.length > 0 ? `
                    <div class="mt-2 p-2 bg-orange-900/20 border border-orange-900/40 rounded-lg">
                      <p class="text-xs text-orange-400 font-bold">⚠ ${defects.map(i => i.label).join(' · ')}</p>
                    </div>
                  ` : `<p class="text-xs text-green-800 mt-1">All inspected items satisfactory</p>`}
                  ${d.defectNotes ? `<p class="text-xs text-gray-500 mt-1.5 italic">"${d.defectNotes}"</p>` : ''}
                </div>`;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <div style="height:8px"></div>
      </div>
    </div>`;

  function mount(container) {
    const stateMap = {};
    ALL_ITEMS.forEach(i => { stateMap[i.key] = null; });

    function applyState(el, state) {
      const { cls, badge } = itemState(state);
      el.className = `dvir-item ${cls} border rounded-xl p-3 flex justify-between items-center cursor-pointer`;
      el.querySelector('.dvir-badge').innerHTML = badge;
    }

    container.querySelectorAll('.dvir-item').forEach(el => {
      el.addEventListener('click', () => {
        const key  = el.dataset.key;
        const next = stateMap[key] === null ? 'ok' : stateMap[key] === 'ok' ? 'defect' : null;
        stateMap[key] = next;
        applyState(el, next);
      });
    });

    container.querySelector('#dvir-all-ok').addEventListener('click', () => {
      ALL_ITEMS.forEach(item => { stateMap[item.key] = 'ok'; });
      container.querySelectorAll('.dvir-item').forEach(el => applyState(el, 'ok'));
    });

    container.querySelector('#dvir-clear').addEventListener('click', () => {
      ALL_ITEMS.forEach(item => { stateMap[item.key] = null; });
      container.querySelectorAll('.dvir-item').forEach(el => applyState(el, null));
    });

    container.querySelector('#dvir-submit').addEventListener('click', () => {
      const type     = container.querySelector('#dvir-type').value;
      const notes    = container.querySelector('#dvir-notes').value.trim();
      const odoRaw   = container.querySelector('#dvir-odometer').value;
      const unit     = container.querySelector('#dvir-unit').value.trim();
      const items    = { ...stateMap };

      if (!Object.values(items).some(v => v !== null)) {
        alert('Please inspect at least one item before submitting.');
        return;
      }

      addDVIR({
        type,
        items,
        defectNotes: notes,
        signed: true,
        odometer: odoRaw ? Number(odoRaw) : null,
        unit: unit || null,
      });
      alert('DVIR submitted ✓');
      window.refresh();
    });
  }

  return { html, mount };
}
