// Firebase auth wrapper for Truck-Log
// Uses the compat SDK loaded globally in index.html

let _user = null;
let _ready = false;
const _listeners = [];

export function onAuthReady(callback) {
  if (_ready) {
    callback(_user);
  } else {
    _listeners.push(callback);
  }
}

export function getCurrentUser() { return _user; }
export function isAuthReady()    { return _ready; }

export function initAuth() {
  if (!window.firebase?.auth) {
    // Firebase not available — run in offline/guest mode
    _user = null;
    _ready = true;
    _listeners.forEach(fn => fn(null));
    return;
  }

  firebase.auth().onAuthStateChanged(user => {
    _user = user;
    if (!_ready) {
      _ready = true;
      _listeners.forEach(fn => fn(user));
    } else {
      // Subsequent changes (sign out, etc.)
      window.refresh?.();
    }
  });
}

export async function signInEmail(email, password) {
  return firebase.auth().signInWithEmailAndPassword(email, password);
}

export async function signUpEmail(email, password, displayName, truckId) {
  const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
  await cred.user.updateProfile({ displayName });
  await saveProfile(cred.user.uid, {
    name: displayName,
    email,
    truckId: truckId || 'My Truck',
    createdAt: new Date().toISOString(),
  });
  return cred;
}

export async function signInGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  return firebase.auth().signInWithPopup(provider);
}

export async function signOut() {
  return firebase.auth().signOut();
}

export async function saveProfile(uid, data) {
  try {
    if (!window.firebase?.firestore) return;
    await firebase.firestore()
      .collection('truck_log_users').doc(uid)
      .set(data, { merge: true });
  } catch (e) {
    console.warn('Profile save failed:', e);
  }
}

export async function loadProfile(uid) {
  try {
    if (!window.firebase?.firestore) return null;
    const doc = await firebase.firestore().collection('truck_log_users').doc(uid).get();
    return doc.exists ? doc.data() : null;
  } catch (e) {
    return null;
  }
}

export async function sendPasswordReset(email) {
  return firebase.auth().sendPasswordResetEmail(email);
}
