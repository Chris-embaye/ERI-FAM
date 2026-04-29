import { getDVIRs, addDVIR, fmtDate } from '../store.js';

const DVIR_ITEMS = [
  { key: 'tires',      label: 'Tires & Wheels' },
  { key: 'brakes',     label: 'Brakes' },
  { key: 'lights',     label: 'Lights & Reflectors' },
  { key: 'windshield', label: 'Windshield & Wipers' },
  { key: 'mirrors',    label: 'Mirrors & Glass' },
  { key: 'coupling',   label: 'Coupling Devices' },
  { key: 'horn',       label: 'Horn' },
  { key: 'steering',   label: 'Steering' },
  { key: 'fluids',     label: 'Fluids (Oil, Coolant)' },
  { key: 'emergency',  label: 'Emergency Equipment' },
  { key: 'airlines',   label: 'Air Lines / Hoses' },
];

function itemState(val) {
  if (val === 'ok')     return { cls: 'dvir-ok',     badge: `<span class="text-green-400 font-black text-lg">✓</span>` };
  if (val === 'defect') return { cls: 'dvir-defect',  badge: `<span class="text-orange-500 font-black text-lg">!</span>` };
  return                       { cls: 'dvir-blank',   badge: `<span class="text-gray-500 text-xl">○</span>` };
}

export function renderDVIR() {
  const dvirs = getDVIRs();
  const today = new Date().toISOString().slice(0, 10);

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
        <!-- New inspection -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div class="flex justify-between items-center mb-3">
            <p class="font-bold text-sm text-gray-300">New Inspection</p>
            <select id="dvir-type" class="form-input w-auto text-xs py-1 px-2">
              <option value="pre">Pre-Trip</option>
              <option value="post">Post-Trip</option>
            </select>
          </div>

          <div id="dvir-items" class="space-y-2">
            ${DVIR_ITEMS.map(item => {
              const { cls, badge } = itemState(null);
              return `
                <div class="dvir-item ${cls} border rounded-xl p-3 flex justify-between items-center cursor-pointer"
                     data-key="${item.key}" data-val="">
                  <span class="font-semibold text-sm">${item.label}</span>
                  <span class="dvir-badge">${badge}</span>
                </div>`;
            }).join('')}
          </div>

          <div class="mt-4">
            <label class="text-xs text-gray-400 block mb-1">Defect Notes</label>
            <textarea id="dvir-notes" rows="2" placeholder="Describe any defects..."
              class="form-input resize-none"></textarea>
          </div>

          <button id="dvir-submit" class="btn-primary mt-4">Sign &amp; Submit</button>
        </div>

        <!-- Past DVIRs -->
        ${dvirs.length > 0 ? `
          <div>
            <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">Past Inspections</p>
            <div class="space-y-2">
              ${dvirs.slice(0, 10).map(d => {
                const defects = DVIR_ITEMS.filter(i => d.items?.[i.key] === 'defect');
                const oks     = DVIR_ITEMS.filter(i => d.items?.[i.key] === 'ok');
                return `
                <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div class="flex justify-between items-center">
                    <div>
                      <p class="font-bold text-sm">${d.type === 'pre' ? 'Pre-Trip' : 'Post-Trip'}</p>
                      <p class="text-xs text-gray-500 mt-0.5">${fmtDate(d.date)}</p>
                    </div>
                    <div class="text-right text-xs">
                      <span class="text-green-400 font-bold">${oks.length} ✓</span>
                      ${defects.length > 0 ? `<span class="text-orange-500 font-bold ml-2">${defects.length} !</span>` : ''}
                    </div>
                  </div>
                  ${defects.length > 0 ? `
                    <p class="text-xs text-orange-400 mt-2">⚠ ${defects.map(i => i.label).join(', ')}</p>
                  ` : ''}
                  ${d.defectNotes ? `<p class="text-xs text-gray-500 mt-1 italic">${d.defectNotes}</p>` : ''}
                </div>`;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>`;

  function mount(container) {
    // Item state: each click cycles null → ok → defect → null
    const stateMap = {};
    DVIR_ITEMS.forEach(i => { stateMap[i.key] = null; });

    container.querySelectorAll('.dvir-item').forEach(el => {
      el.addEventListener('click', () => {
        const key = el.dataset.key;
        const cur = stateMap[key];
        const next = cur === null ? 'ok' : cur === 'ok' ? 'defect' : null;
        stateMap[key] = next;

        const { cls, badge } = itemState(next);
        el.className = `dvir-item ${cls} border rounded-xl p-3 flex justify-between items-center cursor-pointer`;
        el.querySelector('.dvir-badge').innerHTML = badge;
      });
    });

    container.querySelector('#dvir-submit').addEventListener('click', () => {
      const type  = container.querySelector('#dvir-type').value;
      const notes = container.querySelector('#dvir-notes').value.trim();
      const items = { ...stateMap };

      const hasAny = Object.values(items).some(v => v !== null);
      if (!hasAny) {
        alert('Please inspect at least one item before submitting.');
        return;
      }

      addDVIR({ type, items, defectNotes: notes, signed: true });
      alert('DVIR submitted ✓');
      window.refresh();
    });
  }

  return { html, mount };
}
