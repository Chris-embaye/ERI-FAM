// All localStorage operations for Truck-Log

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
    detentionRate: 60,
    detentionGrace: 2,
    targetCPM: 0.50,
    dispatchPct: 0,          // % dispatcher/carrier takes off gross revenue
    eldMonthly: 0,           // ELD subscription ($/month)
    truckPaymentMonthly: 0,  // truck loan/lease ($/month)
    insuranceMonthly: 0,     // insurance ($/month)
    otherFixedMonthly: 0,    // other fixed monthly costs
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

// ── DVIRs ─────────────────────────────────────────────────────────────────────
export const getDVIRs = () => load('dvirs');

export function addDVIR(data) {
  const list = getDVIRs();
  const item = { id: genId(), date: today(), ...data };
  list.unshift(item);
  save('dvirs', list);
  return item;
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

// ── Settings ──────────────────────────────────────────────────────────────────
export const getSettings = () => load('settings');

export function saveSettings(data) {
  save('settings', { ...getSettings(), ...data });
}
