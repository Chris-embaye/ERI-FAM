import {
  signInEmail, signUpEmail, signInGoogle, sendPasswordReset
} from '../auth.js';

function setError(container, msg) {
  const el = container.querySelector('#auth-error');
  if (el) { el.textContent = msg; el.classList.toggle('hidden', !msg); }
}

export function renderSignIn() {
  const html = `
    <div class="flex flex-col h-full bg-black text-white overflow-hidden">
      <div class="flex-1 flex flex-col justify-center px-6 py-10 max-w-sm mx-auto w-full">

        <!-- Logo -->
        <div class="text-center mb-8">
          <div class="text-5xl mb-3">🚛</div>
          <h1 class="text-3xl font-black tracking-tight">Truck-Log</h1>
          <p class="text-gray-500 text-sm mt-1">Owner-operator toolkit</p>
        </div>

        <!-- Tabs (hidden when forgot-pw is active) -->
        <div id="auth-tabs" class="flex bg-gray-900 rounded-xl p-1 mb-6 border border-gray-800">
          <button id="tab-signin" class="flex-1 py-2 rounded-lg text-sm font-bold transition" style="background:var(--accent);color:#fff">Sign In</button>
          <button id="tab-signup" class="flex-1 py-2 rounded-lg text-sm font-bold text-gray-400 transition">Create Account</button>
        </div>

        <!-- Error / success banner -->
        <div id="auth-error" class="hidden bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-xl px-4 py-3 mb-4"></div>
        <div id="auth-success" class="hidden bg-green-900/40 border border-green-700 text-green-300 text-sm rounded-xl px-4 py-3 mb-4"></div>

        <!-- ── Sign-in form ── -->
        <form id="signin-form" class="space-y-3">
          <input type="email" name="email" placeholder="Email address"
            class="form-input w-full" autocomplete="email" required>
          <input type="password" name="password" placeholder="Password"
            class="form-input w-full" autocomplete="current-password" required>
          <button type="submit" id="auth-submit" data-label="Sign In"
            class="btn-primary mt-1">Sign In</button>
          <button type="button" id="forgot-btn"
            class="w-full text-center text-sm font-bold text-orange-500 py-2 transition">
            Forgot password?
          </button>
        </form>

        <!-- ── Sign-up form ── -->
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

        <!-- ── Forgot Password panel ── -->
        <div id="forgot-panel" class="hidden space-y-4">
          <div class="text-center mb-2">
            <p class="text-base font-black">Reset Your Password</p>
            <p class="text-xs text-gray-500 mt-1">We'll send a reset link to your email.</p>
          </div>
          <input type="email" id="forgot-email" placeholder="Email address"
            class="form-input w-full" autocomplete="email">
          <button id="forgot-send-btn" class="btn-primary">Send Reset Email</button>
          <button id="forgot-back-btn" class="w-full text-center text-sm text-gray-500 font-bold py-2">
            ← Back to Sign In
          </button>
        </div>

        <!-- Divider (hidden on forgot panel) -->
        <div id="auth-divider" class="flex items-center gap-3 my-5">
          <div class="flex-1 border-t border-gray-800"></div>
          <span class="text-xs text-gray-600">or</span>
          <div class="flex-1 border-t border-gray-800"></div>
        </div>

        <!-- Google sign-in (hidden on forgot panel) -->
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
    const tabSignIn   = container.querySelector('#tab-signin');
    const tabSignUp   = container.querySelector('#tab-signup');
    const authTabs    = container.querySelector('#auth-tabs');
    const formSignIn  = container.querySelector('#signin-form');
    const formSignUp  = container.querySelector('#signup-form');
    const forgotPanel = container.querySelector('#forgot-panel');
    const divider     = container.querySelector('#auth-divider');
    const googleBtn   = container.querySelector('#google-btn');

    const setTabActive   = el => { el.style.background = 'var(--accent)'; el.style.color = '#fff'; };
    const setTabInactive = el => { el.style.background = '';              el.style.color = '';     el.className = el.className.replace('text-white','') + ' text-gray-400'; };

    function showSignIn() {
      setTabActive(tabSignIn); setTabInactive(tabSignUp);
      formSignIn.classList.remove('hidden');
      formSignUp.classList.add('hidden');
      forgotPanel.classList.add('hidden');
      authTabs.classList.remove('hidden');
      divider.classList.remove('hidden');
      googleBtn.classList.remove('hidden');
      setError(container, '');
      setSuccess(container, '');
    }

    function showSignUp() {
      setTabActive(tabSignUp); setTabInactive(tabSignIn);
      formSignUp.classList.remove('hidden');
      formSignIn.classList.add('hidden');
      forgotPanel.classList.add('hidden');
      authTabs.classList.remove('hidden');
      divider.classList.remove('hidden');
      googleBtn.classList.remove('hidden');
      setError(container, '');
      setSuccess(container, '');
    }

    function showForgot() {
      formSignIn.classList.add('hidden');
      formSignUp.classList.add('hidden');
      forgotPanel.classList.remove('hidden');
      authTabs.classList.add('hidden');
      divider.classList.add('hidden');
      googleBtn.classList.add('hidden');
      setError(container, '');
      setSuccess(container, '');
      // Pre-fill email from sign-in form if they typed one
      const emailVal = formSignIn.querySelector('[name=email]')?.value;
      if (emailVal) container.querySelector('#forgot-email').value = emailVal;
    }

    tabSignIn.addEventListener('click', showSignIn);
    tabSignUp.addEventListener('click', showSignUp);

    // ── Sign-in ────────────────────────────────────────────────────────
    formSignIn.addEventListener('submit', async e => {
      e.preventDefault();
      const fd  = new FormData(e.target);
      const btn = formSignIn.querySelector('#auth-submit');

      // Kill code bypass — enter any email + "5455" as password
      if (fd.get('password') === '5455') {
        localStorage.setItem('rl_kill_access', '1');
        window.refresh?.();
        return;
      }

      btn.disabled = true; btn.textContent = 'Signing in…';
      setError(container, '');
      try {
        await signInEmail(fd.get('email'), fd.get('password'));
      } catch (err) {
        console.error('[RigLog] sign-in error:', err.code, err.message);
        setError(container, friendlyError(err.code));
        btn.disabled = false; btn.textContent = btn.dataset.label;
      }
    });

    // ── Sign-up ────────────────────────────────────────────────────────
    formSignUp.addEventListener('submit', async e => {
      e.preventDefault();
      const fd  = new FormData(e.target);
      const btn = formSignUp.querySelector('#auth-submit-signup');
      if (fd.get('password') !== fd.get('confirm')) {
        setError(container, 'Passwords do not match.'); return;
      }
      btn.disabled = true; btn.textContent = 'Creating account…';
      setError(container, '');
      try {
        await signUpEmail(fd.get('email'), fd.get('password'), fd.get('displayName').trim(), fd.get('truckId').trim());
      } catch (err) {
        setError(container, friendlyError(err.code));
        btn.disabled = false; btn.textContent = btn.dataset.label;
      }
    });

    // ── Google ─────────────────────────────────────────────────────────
    googleBtn.addEventListener('click', async () => {
      setError(container, '');
      try {
        await signInGoogle();
      } catch (err) {
        console.error('[RigLog] google sign-in error:', err.code, err.message);
        if (err.code !== 'auth/popup-closed-by-user') setError(container, friendlyError(err.code));
      }
    });

    // ── Forgot password – show panel ───────────────────────────────────
    container.querySelector('#forgot-btn').addEventListener('click', showForgot);
    container.querySelector('#forgot-back-btn').addEventListener('click', showSignIn);

    container.querySelector('#forgot-send-btn').addEventListener('click', async () => {
      const email = container.querySelector('#forgot-email').value.trim();
      if (!email) { setError(container, 'Enter your email address.'); return; }

      const btn = container.querySelector('#forgot-send-btn');
      btn.disabled = true; btn.textContent = 'Sending…';
      setError(container, '');

      try {
        await sendPasswordReset(email);
        btn.textContent = 'Email Sent ✓';
        setSuccess(container, `Reset email sent to ${email}. Check your inbox (and spam folder).`);
      } catch (err) {
        setError(container, friendlyError(err.code));
        btn.disabled = false; btn.textContent = 'Send Reset Email';
      }
    });
  }

  return { html, mount };
}

function setSuccess(container, msg) {
  const el = container.querySelector('#auth-success');
  if (el) { el.textContent = msg; el.classList.toggle('hidden', !msg); }
}

function friendlyError(code) {
  const map = {
    'auth/user-not-found':             'No account found with that email.',
    'auth/wrong-password':             'Incorrect password. Try again.',
    'auth/invalid-credential':         'Incorrect email or password.',
    'auth/invalid-login-credentials':  'Incorrect email or password.',
    'auth/email-already-in-use':       'An account with that email already exists.',
    'auth/invalid-email':              'Invalid email address.',
    'auth/weak-password':              'Password must be at least 6 characters.',
    'auth/too-many-requests':          'Too many failed attempts. Wait a few minutes and try again.',
    'auth/network-request-failed':     'Network error — check your connection.',
    'auth/user-disabled':              'This account has been disabled.',
    'auth/operation-not-allowed':      'Email sign-in is not enabled for this app.',
    'auth/popup-blocked':              'Pop-up was blocked — allow pop-ups and try again.',
    'auth/popup-closed-by-user':       'Sign-in cancelled.',
    'auth/missing-password':           'Please enter your password.',
    'auth/missing-email':              'Please enter your email.',
    'auth/account-exists-with-different-credential': 'An account already exists with that email. Try signing in differently.',
    'auth/unauthorized-domain': 'This domain is not authorized for sign-in. Contact the app administrator.',
  };
  return map[code] || `Sign-in failed (${code || 'unknown'}). Please try again.`;
}
