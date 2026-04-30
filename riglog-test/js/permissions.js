// Shared permission utilities — check and request camera + location

export async function getPermissionState(name) {
  if (!navigator.permissions) return 'prompt';
  try {
    const { state } = await navigator.permissions.query({ name });
    return state; // 'granted' | 'denied' | 'prompt'
  } catch { return 'prompt'; }
}

// ── Location ──────────────────────────────────────────────────────────────────

export async function requestLocation(opts = {}) {
  if (!navigator.geolocation) return { error: 'unsupported' };
  const state = await getPermissionState('geolocation');
  if (state === 'denied') return { error: 'denied' };
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ coords: pos.coords }),
      err => resolve({ error: err.code === 1 ? 'denied' : 'failed' }),
      { timeout: 12000, enableHighAccuracy: false, ...opts }
    );
  });
}

export function locationDeniedMsg() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS) {
    return 'Location blocked. To enable: Settings → Privacy → Location Services → Safari → While Using App';
  }
  return 'Location blocked. Tap the 🔒 in your browser address bar → Site settings → Allow location.';
}

// ── Camera ────────────────────────────────────────────────────────────────────

export async function checkCameraPermission() {
  // Not all browsers support querying camera permission
  const state = await getPermissionState('camera');
  return state; // 'granted' | 'denied' | 'prompt'
}

export function cameraDeniedMsg() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS) {
    return 'Camera blocked. To enable: Settings → Privacy → Camera → your browser → Allow';
  }
  return 'Camera blocked. Tap the 🔒 in your browser address bar → Site settings → Allow camera.';
}
