// All localStorage operations for Truck-Log

let _uid = null;

export function setCurrentUID(uid) {
  _uid = uid;
}

function getDB() {
  try {
    if (!window.firebase?.apps?.length) return null;
    return window.firebase.firestore ? window.firebase.firestore() : null;
  } catch { return null; }
}

async function pushKey(key, val) {
  if (!_uid) return;
  const db = getDB();
  if (!db) return;
  try {
    // Strip base64 receipt photos — they're too large for Firestore's 1MB doc limit
    const clean = key === 'expenses'
      ? val.map(({ receiptPhoto, ...rest }) => rest)
      : val;
    const payload = key === 'settings'
      ? { settings: clean, at: Date.now() }
      : { items: clean, at: Date.now() };
    await db.collection('rl_users').doc(_uid).collection('data').doc(key).set(payload);
  } catch (e) {
    console.warn('[rl] push failed', key, e.message);
  }
}

export async function syncUp() {
  const SYNC_KEYS = ['expenses', 'trips', 'dvirs', 'detention', 'fuel', 'settings'];
  await Promise.all(SYNC_KEYS.map(k => pushKey(k, load(k))));
}

export async function clearCloudData() {
  if (!_uid) return;
  const db = getDB();
  if (!db) return;
  try {
    const snap = await db.collection('rl_users').doc(_uid).collection('data').get();
    await Promise.all(snap.docs.map(d => d.ref.delete()));
  } catch (e) {
    console.warn('[rl] clearCloudData failed', e.message);
  }
}

export async function syncDown(uid) {
  const db = getDB();
  if (!uid || !db) return;

  const SYNC_KEYS = ['expenses', 'trips', 'dvirs', 'detention', 'fuel', 'settings'];
  const hasLocal = SYNC_KEYS.some(k => localStorage.getItem(KEYS[k]) !== null);

  if (hasLocal) {
    // Already have data — push up to Firestore in background so cloud stays current
    SYNC_KEYS.forEach(k => pushKey(k, load(k)));
    return;
  }

  // New / wiped device — pull from Firestore before first render
  try {
    const snap = await db.collection('rl_users').doc(uid).collection('data').get();
    snap.forEach(doc => {
      const key  = doc.id;
      const data = doc.data();
      if (!(key in KEYS)) return;
      if (key === 'settings' && data.settings) {
        localStorage.setItem(KEYS.settings, JSON.stringify(data.settings));
      } else if (key !== 'settings' && Array.isArray(data.items) && data.items.length > 0) {
        localStorage.setItem(KEYS[key], JSON.stringify(data.items));
      }
    });
  } catch (e) {
    console.warn('[rl] sync down failed', e.message);
  }
}

const KEYS = {
  expenses: 'rl_expenses',
  trips: 'rl_trips',
  dvirs: 'rl_dvirs',
  detention: 'rl_detention',
  fuel: 'rl_fuel',
  settings: 'rl_settings',
  activeDetention: 'rl_active_detention',
};

const DEFAULTS = {
  settings: {
    truckId: 'My Truck',
    homeBase: '',
    detentionRate: 60,
    detentionGrace: 2,
    targetCPM: 0.50,
    targetRPM: 2.00,
    dispatchPct: 0,
    eldMonthly: 0,
    truckPaymentMonthly: 0,
    insuranceMonthly: 0,
    otherFixedMonthly: 0,
    perDiemRate: 80,
  },
};

function load(key) {
  try {
    const raw = localStorage.getItem(KEYS[key]);
    return raw ? JSON.parse(raw) : (DEFAULTS[key] ?? []);
  } catch {
    return DEFAULTS[key] ?? [];
  }
}

function save(key, val) {
  localStorage.setItem(KEYS[key], JSON.stringify(val));
  if (key !== 'activeDetention') pushKey(key, val);
}

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtMoney(n, decimals = 0) {
  const abs = Math.abs(Number(n) || 0);
  return '$' + abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function secsToHMS(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

// ── Expenses ──────────────────────────────────────────────────────────────────
export const getExpenses = () => load('expenses');

export function addExpense(data) {
  const list = getExpenses();
  const item = { id: genId(), date: today(), ...data };
  list.unshift(item);
  save('expenses', list);
  return item;
}

export function deleteExpense(id) {
  save('expenses', getExpenses().filter(e => e.id !== id));
}

export function updateExpense(id, data) {
  save('expenses', getExpenses().map(e => e.id === id ? { ...e, ...data } : e));
}

// ── Trips ─────────────────────────────────────────────────────────────────────
export const getTrips = () => load('trips');

export function addTrip(data) {
  const list = getTrips();
  const item = { id: genId(), date: today(), ...data };
  list.unshift(item);
  save('trips', list);
  return item;
}

export function deleteTrip(id) {
  save('trips', getTrips().filter(t => t.id !== id));
}

export function updateTrip(id, data) {
  save('trips', getTrips().map(t => t.id === id ? { ...t, ...data } : t));
}

// ── DVIRs ─────────────────────────────────────────────────────────────────────
export const getDVIRs = () => load('dvirs');

export function addDVIR(data) {
  const list = getDVIRs();
  const item = { id: genId(), date: today(), ...data };
  list.unshift(item);
  save('dvirs', list);
  return item;
}

export function deleteDVIR(id) {
  save('dvirs', getDVIRs().filter(d => d.id !== id));
}

// ── Detention sessions ────────────────────────────────────────────────────────
export const getDetentionSessions = () => load('detention');

export function addDetentionSession(data) {
  const list = getDetentionSessions();
  const item = { id: genId(), ...data };
  list.unshift(item);
  save('detention', list);
  return item;
}

export function deleteDetentionSession(id) {
  save('detention', getDetentionSessions().filter(s => s.id !== id));
}

export function updateDetentionSession(id, data) {
  save('detention', getDetentionSessions().map(s => s.id === id ? { ...s, ...data } : s));
}

export function getActiveDetention() {
  const raw = localStorage.getItem(KEYS.activeDetention);
  return raw ? JSON.parse(raw) : null;
}

export function setActiveDetention(data) {
  if (data) {
    localStorage.setItem(KEYS.activeDetention, JSON.stringify(data));
  } else {
    localStorage.removeItem(KEYS.activeDetention);
  }
}

// ── Fuel logs ─────────────────────────────────────────────────────────────────
export const getFuelLogs = () => load('fuel');

export function addFuelLog(data) {
  const list = getFuelLogs();
  const item = { id: genId(), date: today(), ...data };
  list.unshift(item);
  save('fuel', list);
  return item;
}

export function deleteFuelLog(id) {
  save('fuel', getFuelLogs().filter(l => l.id !== id));
}

export function updateFuelLog(id, data) {
  save('fuel', getFuelLogs().map(l => l.id === id ? { ...l, ...data } : l));
}

// ── Settings ──────────────────────────────────────────────────────────────────
export const getSettings = () => load('settings');

export function saveSettings(data) {
  save('settings', { ...getSettings(), ...data });
}
