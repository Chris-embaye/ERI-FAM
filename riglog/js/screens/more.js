import { getDVIRs, getDetentionSessions, getActiveDetention, getSettings, getTrips, getExpenses, getMaintenanceLogs } from '../store.js';

export function renderMore() {
  const dvirs    = getDVIRs();
  const sessions = getDetentionSessions();
  const active   = getActiveDetention();
  const settings = getSettings();

  const maintLogs    = getMaintenanceLogs();
  const estOdo       = getTrips().reduce((s, t) => s + Number(t.miles || 0), 0);
  const overdueCount = maintLogs.filter(l => l.nextDueMiles && estOdo > 0 && (Number(l.nextDueMiles) - estOdo) <= 0).length;
  const upcomingCount= maintLogs.filter(l => l.nextDueMiles && estOdo > 0 && (Number(l.nextDueMiles) - estOdo) > 0 && (Number(l.nextDueMiles) - estOdo) < 5000).length;

  const lastDVIR     = dvirs[0];
  const lastDVIRDate = lastDVIR
    ? new Date(lastDVIR.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const totalDetentionClaims = sessions.reduce((s, d) => s + Number(d.value || 0), 0);

  // YTD quick stats for tax card
  const year      = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const ytdRev = getTrips().filter(t => t.date >= yearStart).reduce((s, t) => s + Number(t.revenue || 0), 0);

  const html = `
    <div class="flex flex-col h-full bg-black text-white">
      <div class="px-4 pt-5 pb-4 border-b border-gray-800 shrink-0">
        <h1 class="text-2xl font-black">More</h1>
        <p class="text-xs text-gray-500">Tools &amp; settings</p>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-3">

        <!-- Monthly Reports -->
        <button onclick="navigate('reports')" class="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-left">
          <div class="flex justify-between items-start">
            <div class="flex items-center gap-3">
              <div class="rounded-xl p-2.5" style="background:rgba(10,132,255,.15)">
                <svg width="22" height="22" fill="none" stroke="#0A84FF" viewBox="0 0 24 24" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  <line x1="8" y1="14" x2="8" y2="14" stroke-width="2.5" stroke-linecap="round"/>
                  <line x1="12" y1="14" x2="16" y2="14" stroke-width="2" stroke-linecap="round"/>
                  <line x1="8" y1="18" x2="8" y2="18" stroke-width="2.5" stroke-linecap="round"/>
                  <line x1="12" y1="18" x2="16" y2="18" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
              <div>
                <p class="font-black">Monthly Reports</p>
                <p class="text-xs text-gray-500 mt-0.5">Revenue · expenses · profit by month</p>
              </div>
            </div>
            <svg class="text-gray-600 mt-1" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </button>

        <!-- Detention -->
        <button onclick="navigate('detention')" class="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-left">
          <div class="flex justify-between items-start">
            <div class="flex items-center gap-3">
              <div class="bg-orange-600/20 rounded-xl p-2.5">
                <svg width="22" height="22" fill="none" stroke="#EA580C" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div>
                <p class="font-black">Detention Timer</p>
                <p class="text-xs text-gray-500 mt-0.5">${active ? '🟢 Session active — tap to manage' : sessions.length > 0 ? `${sessions.length} sessions logged` : 'No sessions yet'}</p>
              </div>
            </div>
            <div class="text-right">
              ${active ? `<span class="text-orange-600 font-bold text-xs">ACTIVE</span>` : totalDetentionClaims > 0 ? `<span class="text-green-400 font-bold text-sm">$${totalDetentionClaims.toFixed(0)}</span>` : ''}
              <svg class="text-gray-600 mt-1 ml-auto" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        </button>

        <!-- DVIR -->
        <button onclick="navigate('dvir')" class="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-left">
          <div class="flex justify-between items-start">
            <div class="flex items-center gap-3">
              <div class="bg-blue-600/20 rounded-xl p-2.5">
                <svg width="22" height="22" fill="none" stroke="#3b82f6" viewBox="0 0 24 24" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>
              </div>
              <div>
                <p class="font-black">Vehicle Inspection (DVIR)</p>
                <p class="text-xs text-gray-500 mt-0.5">${lastDVIR ? `Last: ${lastDVIRDate} · 37 check items` : '37 inspection items'}</p>
              </div>
            </div>
            <svg class="text-gray-600 mt-1" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </button>

        <!-- Tax Summary -->
        <button onclick="navigate('tax')" class="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-left">
          <div class="flex justify-between items-start">
            <div class="flex items-center gap-3">
              <div class="bg-green-600/20 rounded-xl p-2.5">
                <svg width="22" height="22" fill="none" stroke="#22c55e" viewBox="0 0 24 24" stroke-width="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  <path d="M7 10h2l2-4 2 8 2-4h2"/>
                </svg>
              </div>
              <div>
                <p class="font-black">Tax Summary</p>
                <p class="text-xs text-gray-500 mt-0.5">${ytdRev > 0 ? `YTD ${year} · $${Math.round(ytdRev).toLocaleString()} revenue` : `YTD ${year} estimates & quarterly payments`}</p>
              </div>
            </div>
            <svg class="text-gray-600 mt-1" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </button>

        <!-- Maintenance -->
        <button onclick="navigate('maintenance')" class="w-full bg-gray-900 border ${overdueCount > 0 ? 'border-red-900' : 'border-gray-800'} rounded-xl p-4 text-left">
          <div class="flex justify-between items-start">
            <div class="flex items-center gap-3">
              <div class="bg-orange-600/20 rounded-xl p-2.5">
                <svg width="22" height="22" fill="none" stroke="#EA580C" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </div>
              <div>
                <p class="font-black">Maintenance Log</p>
                <p class="text-xs mt-0.5 ${overdueCount > 0 ? 'text-red-400 font-bold' : 'text-gray-500'}">
                  ${overdueCount > 0 ? `⚠ ${overdueCount} overdue` : upcomingCount > 0 ? `${upcomingCount} due soon` : maintLogs.length > 0 ? `${maintLogs.length} service records` : 'Track oil changes, DOT, tires'}
                </p>
              </div>
            </div>
            <svg class="text-gray-600 mt-1" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </button>

        <!-- Load Calculator -->
        <button onclick="navigate('loadcalc')" class="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-left">
          <div class="flex justify-between items-start">
            <div class="flex items-center gap-3">
              <div class="bg-green-600/20 rounded-xl p-2.5">
                <svg width="22" height="22" fill="none" stroke="#22c55e" viewBox="0 0 24 24" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <div>
                <p class="font-black">Load Calculator</p>
                <p class="text-xs text-gray-500 mt-0.5">Is this load worth it? Rate, fuel, net profit</p>
              </div>
            </div>
            <svg class="text-gray-600 mt-1" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </button>

        <!-- Settings -->
        <button onclick="navigate('settings')" class="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-left">
          <div class="flex justify-between items-start">
            <div class="flex items-center gap-3">
              <div class="bg-gray-700/50 rounded-xl p-2.5">
                <svg width="22" height="22" fill="none" stroke="#9ca3af" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </div>
              <div>
                <p class="font-black">Settings</p>
                <p class="text-xs text-gray-500 mt-0.5">${settings.truckId} · $${settings.detentionRate}/hr detention</p>
              </div>
            </div>
            <svg class="text-gray-600 mt-1" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </button>

        <!-- About -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="font-bold text-sm text-gray-300">Rig Log</p>
          <p class="text-xs text-gray-600 mt-0.5">Owner-operator toolkit · v4.0</p>
          <p class="text-xs text-gray-700 mt-2">Data synced to your account — accessible on all your devices.</p>
        </div>

      </div>
    </div>`;

  return { html, mount: null };
}
