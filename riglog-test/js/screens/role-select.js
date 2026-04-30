import { setAppMode } from '../store.js';
import { getCurrentUser } from '../auth.js';

export function renderRoleSelect() {
  const user = getCurrentUser();
  const firstName = user?.displayName ? user.displayName.split(' ')[0] : null;

  const html = `
    <div class="flex flex-col h-full text-white" style="background:rgb(4,10,18)">
      <div class="flex-1 flex flex-col items-center justify-center" style="padding:24px 20px">

        <!-- Logo / greeting -->
        <div style="text-align:center;margin-bottom:36px">
          <div style="font-size:2.8rem;margin-bottom:10px">📱</div>
          <h1 style="font-size:1.6rem;font-weight:900;color:#e0f2fe;letter-spacing:-0.5px">
            ${firstName ? `Welcome, ${firstName}!` : 'Welcome to RigLog'}
          </h1>
          <p style="font-size:0.85rem;color:rgba(148,163,184,0.8);margin-top:6px">What are you tracking?</p>
        </div>

        <!-- Mode cards -->
        <div style="width:100%;display:flex;flex-direction:column;gap:14px;max-width:360px">

          <!-- Trucking card -->
          <button id="mode-trucking" style="
            width:100%;text-align:left;padding:22px 20px;border-radius:22px;
            background:linear-gradient(135deg,rgba(8,145,178,0.18) 0%,rgba(6,182,212,0.06) 100%);
            border:1.5px solid rgba(8,145,178,0.4);
            box-shadow:0 8px 32px rgba(8,145,178,0.12),0 1px 0 rgba(255,255,255,0.08) inset;
            position:relative;overflow:hidden">
            <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(8,145,178,0.7),transparent)"></div>
            <div style="display:flex;align-items:center;gap:16px">
              <div style="font-size:2.4rem;line-height:1">🚛</div>
              <div>
                <p style="font-size:1.05rem;font-weight:900;color:#67e8f9;margin-bottom:4px">Trucking / Owner-Operator</p>
                <p style="font-size:0.78rem;color:rgba(148,163,184,0.75);line-height:1.45">
                  Revenue &amp; load tracking · IFTA miles · DVIR inspections · Detention timer · Tax summary
                </p>
              </div>
            </div>
            <div style="margin-top:14px;display:flex;gap:6px;flex-wrap:wrap">
              ${['Revenue','Trips','IFTA','Detention','Tax'].map(t =>
                `<span style="font-size:0.65rem;font-weight:700;padding:3px 8px;border-radius:6px;background:rgba(8,145,178,0.15);color:#67e8f9;border:1px solid rgba(8,145,178,0.25)">${t}</span>`
              ).join('')}
            </div>
          </button>

          <!-- Personal card -->
          <button id="mode-personal" style="
            width:100%;text-align:left;padding:22px 20px;border-radius:22px;
            background:linear-gradient(135deg,rgba(139,92,246,0.15) 0%,rgba(168,85,247,0.05) 100%);
            border:1.5px solid rgba(139,92,246,0.35);
            box-shadow:0 8px 32px rgba(139,92,246,0.10),0 1px 0 rgba(255,255,255,0.08) inset;
            position:relative;overflow:hidden">
            <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(139,92,246,0.7),transparent)"></div>
            <div style="display:flex;align-items:center;gap:16px">
              <div style="font-size:2.4rem;line-height:1">🚗</div>
              <div>
                <p style="font-size:1.05rem;font-weight:900;color:#c4b5fd;margin-bottom:4px">Personal Vehicle</p>
                <p style="font-size:0.78rem;color:rgba(148,163,184,0.75);line-height:1.45">
                  MPG tracking · Fill-up log · Car expenses · Maintenance reminders
                </p>
              </div>
            </div>
            <div style="margin-top:14px;display:flex;gap:6px;flex-wrap:wrap">
              ${['MPG','Fuel Log','Expenses','Maintenance','Trips'].map(t =>
                `<span style="font-size:0.65rem;font-weight:700;padding:3px 8px;border-radius:6px;background:rgba(139,92,246,0.12);color:#c4b5fd;border:1px solid rgba(139,92,246,0.25)">${t}</span>`
              ).join('')}
            </div>
          </button>

        </div>

        <p style="font-size:0.7rem;color:rgba(100,116,139,0.6);margin-top:28px;text-align:center">
          Switch modes anytime from Settings
        </p>
      </div>
    </div>`;

  function mount(container) {
    container.querySelector('#mode-trucking').addEventListener('click', () => {
      setAppMode('trucking');
      window.navigate('dashboard');
    });
    container.querySelector('#mode-personal').addEventListener('click', () => {
      setAppMode('personal');
      window.navigate('dashboard');
    });
  }

  return { html, mount };
}
