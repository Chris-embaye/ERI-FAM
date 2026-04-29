import {
  getDetentionSessions, addDetentionSession, deleteDetentionSession,
  getActiveDetention, setActiveDetention,
  getSettings, fmtMoney, fmtDate
} from '../store.js';
import { openModal, closeModal } from '../modal.js';

function secsToDisplay(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startForm() {
  return `
    <div class="p-5">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-xl font-black">Start Detention</h2>
        <button onclick="closeModal()" class="text-gray-400 text-2xl leading-none">&times;</button>
      </div>
      <form id="start-detention-form" class="space-y-4">
        <div>
          <label class="text-xs text-gray-400 block mb-1">Facility Name</label>
          <input type="text" name="facility" placeholder="Savannah Port, Walmart DC..." class="form-input" required autofocus>
        </div>
        <button type="submit" class="btn-primary">Start Timer</button>
        <button type="button" onclick="closeModal()" class="btn-ghost">Cancel</button>
      </form>
    </div>`;
}

export function renderDetention() {
  const active   = getActiveDetention();
  const sessions = getDetentionSessions();
  const settings = getSettings();
  const graceMs  = (Number(settings.detentionGrace) || 2) * 3600000;
  const rate     = Number(settings.detentionRate) || 60;

  function calcValue(detentionMs) {
    const hours = detentionMs / 3600000;
    return +(hours * rate).toFixed(2);
  }

  const html = `
    <div class="flex flex-col h-full bg-black text-white">
      <div class="px-4 pt-5 pb-4 border-b border-gray-800 flex items-center gap-3 shrink-0">
        <button onclick="navigate('more')" class="text-gray-400">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 class="text-2xl font-black">Detention</h1>
          <p class="text-xs text-gray-500">$${rate}/hr · ${settings.detentionGrace}h grace period</p>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">

        ${active ? `
        <!-- Active session card -->
        <div class="bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl p-5 text-black">
          <p class="text-xs font-bold uppercase opacity-75 tracking-wider mb-1">⏱ Active Session</p>
          <p class="font-bold opacity-80 text-sm mb-2">${active.facility}</p>
          <div id="timer-elapsed" class="text-5xl font-black timer-active">00:00:00</div>
          <div class="mt-3 space-y-1 text-sm">
            <div class="flex justify-between">
              <span class="opacity-75">Grace period</span>
              <span id="timer-grace" class="font-bold">—</span>
            </div>
            <div class="flex justify-between">
              <span class="opacity-75">Detention time</span>
              <span id="timer-detention" class="font-bold">—</span>
            </div>
            <div class="flex justify-between text-lg font-black mt-2">
              <span>Claimable value</span>
              <span id="timer-value">$0.00</span>
            </div>
          </div>
        </div>

        <button id="end-session-btn" class="w-full bg-green-600 text-white font-black py-3 rounded-xl text-sm">
          End &amp; Save Session
        </button>
        <button id="cancel-session-btn" class="w-full bg-gray-800 text-gray-400 font-bold py-2.5 rounded-xl text-sm">
          Cancel Session (No Save)
        </button>
        ` : `
        <!-- No active session -->
        <div class="flex flex-col items-center justify-center py-8 text-center">
          <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full">
            <p class="text-4xl mb-3">⏱</p>
            <p class="font-black text-lg">No active session</p>
            <p class="text-gray-500 text-sm mt-1">Tap start when you arrive at a facility</p>
          </div>
        </div>
        <button id="start-session-btn" class="w-full bg-orange-600 text-black font-black py-3 rounded-xl">
          Start Detention Session
        </button>
        `}

        <!-- Past sessions -->
        ${sessions.length > 0 ? `
          <div>
            <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">Past Sessions</p>
            <div class="space-y-2">
              ${sessions.map(s => {
                const detMs = Math.max(0, (s.durationMs || 0) - graceMs);
                const val   = s.value != null ? Number(s.value) : calcValue(detMs);
                return `
                <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 flex justify-between items-start">
                  <div>
                    <p class="font-bold text-sm">${s.facility}</p>
                    <p class="text-xs text-gray-500 mt-0.5">${fmtDate(s.date)}</p>
                    <p class="text-xs text-gray-600 mt-0.5">
                      Total: ${secsToDisplay((s.durationMs || 0) / 1000)} ·
                      Detention: ${secsToDisplay(Math.max(0, (s.durationMs || 0) - graceMs) / 1000)}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="font-black text-green-400">${fmtMoney(val, 2)}</span>
                    <button class="del-session-btn text-gray-600 hover:text-red-500 p-1" data-id="${s.id}">
                      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                    </button>
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <div style="height:8px"></div>
      </div>
    </div>`;

  function mount(container, navigate) {
    let timerInterval = null;

    if (active) {
      function updateTimer() {
        const elapsedMs  = Date.now() - new Date(active.startedAt).getTime();
        const elapsedSec = elapsedMs / 1000;
        const detMs      = Math.max(0, elapsedMs - graceMs);
        const graceLeft  = Math.max(0, graceMs - elapsedMs);
        const val        = calcValue(detMs);

        const elEl  = container.querySelector('#timer-elapsed');
        const grEl  = container.querySelector('#timer-grace');
        const dtEl  = container.querySelector('#timer-detention');
        const valEl = container.querySelector('#timer-value');

        if (elEl)  elEl.textContent  = secsToDisplay(elapsedSec);
        if (grEl)  grEl.textContent  = graceLeft > 0 ? secsToDisplay(graceLeft / 1000) + ' left' : 'Expired';
        if (dtEl)  dtEl.textContent  = detMs > 0 ? secsToDisplay(detMs / 1000) : '—';
        if (valEl) valEl.textContent = fmtMoney(val, 2);
      }

      updateTimer();
      timerInterval = setInterval(updateTimer, 1000);

      container.querySelector('#end-session-btn')?.addEventListener('click', () => {
        clearInterval(timerInterval);
        const elapsedMs = Date.now() - new Date(active.startedAt).getTime();
        const detMs     = Math.max(0, elapsedMs - graceMs);
        const val       = calcValue(detMs);
        const date      = active.startedAt.slice(0, 10);

        addDetentionSession({
          facility: active.facility,
          date,
          arrivedAt: active.startedAt,
          departedAt: new Date().toISOString(),
          durationMs: elapsedMs,
          detentionMs: detMs,
          value: val,
        });
        setActiveDetention(null);
        navigate('detention');
      });

      container.querySelector('#cancel-session-btn')?.addEventListener('click', () => {
        if (confirm('Cancel this session without saving?')) {
          clearInterval(timerInterval);
          setActiveDetention(null);
          navigate('detention');
        }
      });

      // Cleanup: clear interval when leaving screen
      return () => clearInterval(timerInterval);

    } else {
      container.querySelector('#start-session-btn')?.addEventListener('click', () => {
        openModal(startForm(), el => {
          el.querySelector('#start-detention-form').addEventListener('submit', ev => {
            ev.preventDefault();
            const fd = new FormData(ev.target);
            setActiveDetention({
              facility: fd.get('facility').trim(),
              startedAt: new Date().toISOString(),
            });
            closeModal();
            navigate('detention');
          });
        });
      });
    }

    container.querySelectorAll('.del-session-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Delete this session?')) {
          deleteDetentionSession(btn.dataset.id);
          window.refresh();
        }
      });
    });
  }

  return { html, mount };
}
