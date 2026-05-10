import {
  getDetentionSessions, addDetentionSession, deleteDetentionSession, updateDetentionSession,
  getActiveDetention, setActiveDetention,
  getSettings, fmtMoney, fmtDate
} from '../store.js';
import { openModal, closeModal, confirmSheet, toast } from '../modal.js';

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
          <input type="text" name="facility" placeholder="Savannah Port, Walmart DC..."
            class="form-input" required autofocus>
        </div>
        <button type="submit" class="btn-primary">Start Timer</button>
        <button type="button" onclick="closeModal()" class="btn-ghost">Cancel</button>
      </form>
    </div>`;
}

function editSessionForm(session) {
  return `
    <div class="p-5">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-xl font-black">Edit Session</h2>
        <button onclick="closeModal()" class="text-gray-400 text-2xl leading-none">&times;</button>
      </div>
      <form id="edit-session-form" class="space-y-4">
        <div>
          <label class="text-xs text-gray-400 block mb-1">Facility Name</label>
          <input type="text" name="facility" class="form-input" value="${session.facility || ''}" required>
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Claimable Value ($)</label>
          <input type="number" name="value" step="0.01" min="0" class="form-input"
            value="${Number(session.value || 0).toFixed(2)}">
          <p class="text-xs text-gray-600 mt-1">Override the auto-calculated detention charge if needed.</p>
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Date</label>
          <input type="date" name="date" class="form-input" value="${session.date || ''}">
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">Notes</label>
          <textarea name="notes" rows="2" class="form-input resize-none"
            placeholder="Optional notes...">${session.notes || ''}</textarea>
        </div>
        <button type="submit" class="btn-primary">Save Changes</button>
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
    return +((detentionMs / 3600000) * rate).toFixed(2);
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
        <!-- Active session -->
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
        <div class="flex flex-col items-center justify-center py-6 text-center">
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
                <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div class="flex justify-between items-start">
                    <div class="min-w-0 flex-1">
                      <p class="font-bold text-sm">${s.facility}</p>
                      <p class="text-xs text-gray-500 mt-0.5">${fmtDate(s.date)}</p>
                      <p class="text-xs text-gray-600 mt-0.5">
                        Total: ${secsToDisplay((s.durationMs || 0) / 1000)} ·
                        Detention: ${secsToDisplay(Math.max(0, (s.durationMs || 0) - graceMs) / 1000)}
                      </p>
                      ${s.notes ? `<p class="text-xs text-gray-600 mt-1 italic">${s.notes}</p>` : ''}
                    </div>
                    <div class="flex items-start gap-2 shrink-0 ml-2">
                      <span class="font-black text-green-400">${fmtMoney(val, 2)}</span>
                      <button class="edit-session-btn text-gray-500 hover:text-white p-1" data-id="${s.id}">
                        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button class="del-session-btn text-gray-600 hover:text-red-500 p-1" data-id="${s.id}">
                        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                      </button>
                    </div>
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
    let timerInterval  = null;
    let graceNotified  = false;

    if (active) {
      function updateTimer() {
        const elapsedMs  = Date.now() - new Date(active.startedAt).getTime();
        const detMs      = Math.max(0, elapsedMs - graceMs);
        const graceLeft  = Math.max(0, graceMs - elapsedMs);

        // Fire one notification the moment grace period expires
        if (graceLeft === 0 && !graceNotified) {
          graceNotified = true;
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Detention — Grace Period Expired', {
              body: `You can now bill ${active.facility} detention at $${rate}/hr`,
              icon: './icon-512.png',
              tag:  'rl-detention-grace',
            });
          }
        }

        const elEl  = container.querySelector('#timer-elapsed');
        const grEl  = container.querySelector('#timer-grace');
        const dtEl  = container.querySelector('#timer-detention');
        const valEl = container.querySelector('#timer-value');

        if (elEl)  elEl.textContent  = secsToDisplay(elapsedMs / 1000);
        if (grEl)  grEl.textContent  = graceLeft > 0 ? secsToDisplay(graceLeft / 1000) + ' left' : 'Expired';
        if (dtEl)  dtEl.textContent  = detMs > 0 ? secsToDisplay(detMs / 1000) : '—';
        if (valEl) valEl.textContent = fmtMoney(calcValue(detMs), 2);
      }

      updateTimer();
      timerInterval = setInterval(updateTimer, 1000);

      container.querySelector('#end-session-btn')?.addEventListener('click', () => {
        clearInterval(timerInterval);
        const elapsedMs = Date.now() - new Date(active.startedAt).getTime();
        const detMs     = Math.max(0, elapsedMs - graceMs);
        addDetentionSession({
          facility:    active.facility,
          date:        active.startedAt.slice(0, 10),
          arrivedAt:   active.startedAt,
          departedAt:  new Date().toISOString(),
          durationMs:  elapsedMs,
          detentionMs: detMs,
          value:       calcValue(detMs),
        });
        setActiveDetention(null);
        toast('Session saved ✓');
        navigate('detention');
      });

      container.querySelector('#cancel-session-btn')?.addEventListener('click', () => {
        confirmSheet('Cancel session?', 'Timer will be discarded and nothing saved.', 'Discard', () => {
          clearInterval(timerInterval);
          setActiveDetention(null);
          navigate('detention');
        });
      });

      return () => clearInterval(timerInterval);

    } else {
      container.querySelector('#start-session-btn')?.addEventListener('click', () => {
        openModal(startForm(), el => {
          el.querySelector('#start-detention-form').addEventListener('submit', ev => {
            ev.preventDefault();
            const fd = new FormData(ev.target);
            setActiveDetention({ facility: fd.get('facility').trim(), startedAt: new Date().toISOString() });
            closeModal();
            // Request notification permission so grace-period alert can fire
            if ('Notification' in window && Notification.permission === 'default') {
              Notification.requestPermission();
            }
            navigate('detention');
          });
        });
      });
    }

    container.querySelectorAll('.edit-session-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const session = getDetentionSessions().find(s => s.id === btn.dataset.id);
        if (!session) return;
        openModal(editSessionForm(session), el => {
          el.querySelector('#edit-session-form').addEventListener('submit', ev => {
            ev.preventDefault();
            const fd = new FormData(ev.target);
            updateDetentionSession(session.id, {
              facility: fd.get('facility').trim(),
              value:    parseFloat(fd.get('value')) || 0,
              date:     fd.get('date') || session.date,
              notes:    fd.get('notes').trim(),
            });
            closeModal();
            toast('Session updated ✓');
            window.refresh();
          });
        });
      });
    });

    container.querySelectorAll('.del-session-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        confirmSheet('Delete this session?', 'This cannot be undone.', 'Delete', () => {
          deleteDetentionSession(btn.dataset.id);
          toast('Session deleted', 'info');
          window.refresh();
        });
      });
    });
  }

  return { html, mount };
}
