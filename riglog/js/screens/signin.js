import {
  signInEmail, signUpEmail, signInGoogle, sendPasswordReset
} from '../auth.js';

function setError(container, msg) {
  const el = container.querySelector('#auth-error');
  if (el) { el.textContent = msg; el.classList.toggle('hidden', !msg); }
}

function setLoading(container, loading) {
  const btn = container.querySelector('#auth-submit');
  if (btn) {
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait…' : btn.dataset.label;
  }
}

export function renderSignIn() {
  const html = `
    <div class="flex flex-col h-full bg-black text-white overflow-y-auto">
      <div class="flex-1 flex flex-col justify-center px-6 py-10 max-w-sm mx-auto w-full">

        <!-- Logo -->
        <div class="text-center mb-8">
          <div class="text-5xl mb-3">🚛</div>
          <h1 class="text-3xl font-black tracking-tight">RIGLOG</h1>
          <p class="text-gray-500 text-sm mt-1">Owner-operator toolkit</p>
        </div>

        <!-- Tabs -->
        <div class="flex bg-gray-900 rounded-xl p-1 mb-6 border border-gray-800">
          <button id="tab-signin" class="flex-1 py-2 rounded-lg text-sm font-bold bg-orange-600 text-black transition">Sign In</button>
          <button id="tab-signup" class="flex-1 py-2 rounded-lg text-sm font-bold text-gray-400 transition">Create Account</button>
        </div>

        <!-- Error banner -->
        <div id="auth-error" class="hidden bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-xl px-4 py-3 mb-4"></div>

        <!-- Sign-in form -->
        <form id="signin-form" class="space-y-3">
          <input type="email" name="email" placeholder="Email address"
            class="form-input w-full" autocomplete="email" required>
          <input type="password" name="password" placeholder="Password"
            class="form-input w-full" autocomplete="current-password" required>
          <button type="submit" id="auth-submit" data-label="Sign In"
            class="btn-primary mt-1">Sign In</button>
          <button type="button" id="forgot-btn"
            class="w-full text-center text-xs text-gray-500 hover:text-orange-500 py-1">
            Forgot password?
          </button>
        </form>

        <!-- Sign-up form (hidden) -->
        <form id="signup-form" class="space-y-3 hidden">
          <input type="text" name="displayName" placeholder="Your name"
            class="form-input w-full" autocomplete="name" required>
          <input type="text" name="truckId" placeholder="Truck name / unit # (optional)"
            class="form-input w-full">
          <input type="email" name="email" placeholder="Email address"
            class="form-input w-full" autocomplete="email" required>
          <input type="password" name="password" placeholder="Password (min 6 chars)"
            class="form-input w-full" autocomplete="new-password" minlength="6" required>
          <input type="password" name="confirm" placeholder="Confirm password"
            class="form-input w-full" autocomplete="new-password" required>
          <button type="submit" id="auth-submit-signup" data-label="Create Account"
            class="btn-primary mt-1">Create Account</button>
        </form>

        <!-- Divider -->
        <div class="flex items-center gap-3 my-5">
          <div class="flex-1 border-t border-gray-800"></div>
          <span class="text-xs text-gray-600">or</span>
          <div class="flex-1 border-t border-gray-800"></div>
        </div>

        <!-- Google sign-in -->
        <button id="google-btn"
          class="w-full flex items-center justify-center gap-3 bg-gray-900 border border-gray-700 rounded-xl py-3 text-sm font-bold hover:border-gray-500 transition">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <p class="text-center text-xs text-gray-700 mt-6">
          Your data is stored locally and optionally synced to your account.
        </p>
      </div>
    </div>`;

  function mount(container) {
    const tabSignIn  = container.querySelector('#tab-signin');
    const tabSignUp  = container.querySelector('#tab-signup');
    const formSignIn = container.querySelector('#signin-form');
    const formSignUp = container.querySelector('#signup-form');

    function showSignIn() {
      tabSignIn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-orange-600 text-black transition';
      tabSignUp.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-gray-400 transition';
      formSignIn.classList.remove('hidden');
      formSignUp.classList.add('hidden');
      setError(container, '');
    }

    function showSignUp() {
      tabSignUp.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-orange-600 text-black transition';
      tabSignIn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-gray-400 transition';
      formSignUp.classList.remove('hidden');
      formSignIn.classList.add('hidden');
      setError(container, '');
    }

    tabSignIn.addEventListener('click', showSignIn);
    tabSignUp.addEventListener('click', showSignUp);

    // ── Sign-in form ──────────────────────────────────────────────
    formSignIn.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = formSignIn.querySelector('#auth-submit');
      btn.disabled = true; btn.textContent = 'Signing in…';
      setError(container, '');
      try {
        await signInEmail(fd.get('email'), fd.get('password'));
        // auth state change handled by initAuth → window.refresh()
      } catch (err) {
        setError(container, friendlyError(err.code));
        btn.disabled = false; btn.textContent = btn.dataset.label;
      }
    });

    // ── Sign-up form ──────────────────────────────────────────────
    formSignUp.addEventListener('submit', async e => {
      e.preventDefault();
      const fd  = new FormData(e.target);
      const btn = formSignUp.querySelector('#auth-submit-signup');

      if (fd.get('password') !== fd.get('confirm')) {
        setError(container, 'Passwords do not match.');
        return;
      }
      btn.disabled = true; btn.textContent = 'Creating account…';
      setError(container, '');
      try {
        await signUpEmail(
          fd.get('email'),
          fd.get('password'),
          fd.get('displayName').trim(),
          fd.get('truckId').trim()
        );
        // auth state change → refresh
      } catch (err) {
        setError(container, friendlyError(err.code));
        btn.disabled = false; btn.textContent = btn.dataset.label;
      }
    });

    // ── Google ────────────────────────────────────────────────────
    container.querySelector('#google-btn').addEventListener('click', async () => {
      setError(container, '');
      try {
        await signInGoogle();
      } catch (err) {
        if (err.code !== 'auth/popup-closed-by-user') {
          setError(container, friendlyError(err.code));
        }
      }
    });

    // ── Forgot password ───────────────────────────────────────────
    container.querySelector('#forgot-btn').addEventListener('click', async () => {
      const email = formSignIn.querySelector('[name=email]').value.trim();
      if (!email) {
        setError(container, 'Enter your email address first.');
        return;
      }
      try {
        await sendPasswordReset(email);
        setError(container, '');
        alert(`Password reset email sent to ${email}`);
      } catch (err) {
        setError(container, friendlyError(err.code));
      }
    });
  }

  return { html, mount };
}

function friendlyError(code) {
  const map = {
    'auth/user-not-found':       'No account found with that email.',
    'auth/wrong-password':       'Incorrect password.',
    'auth/email-already-in-use': 'An account with that email already exists.',
    'auth/invalid-email':        'Invalid email address.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/too-many-requests':    'Too many attempts. Try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/invalid-credential':   'Invalid email or password.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
