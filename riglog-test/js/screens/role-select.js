import { setAppMode } from '../store.js';
import { getCurrentUser } from '../auth.js';

const TRUCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 170" style="width:100%;height:100%">
  <defs>
    <linearGradient id="tc1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1a8aaa"/><stop offset="100%" stop-color="#0a3f55"/></linearGradient>
    <linearGradient id="tc2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1e4d66"/><stop offset="100%" stop-color="#0c2535"/></linearGradient>
    <linearGradient id="tc3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#90e0ef" stop-opacity="0.65"/><stop offset="100%" stop-color="#0096b7" stop-opacity="0.35"/></linearGradient>
    <linearGradient id="tc4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#dde6ed"/><stop offset="100%" stop-color="#8aa8bc"/></linearGradient>
    <radialGradient id="tc5" cx="38%" cy="35%"><stop offset="0%" stop-color="#4a5568"/><stop offset="100%" stop-color="#0f172a"/></radialGradient>
  </defs>
  <ellipse cx="155" cy="158" rx="138" ry="8" fill="rgba(0,0,0,0.22)"/>
  <!-- Trailer -->
  <rect x="93" y="28" width="197" height="87" rx="5" fill="url(#tc2)"/>
  <rect x="93" y="28" width="197" height="8" rx="3" fill="rgba(255,255,255,0.13)"/>
  <line x1="128" y1="36" x2="128" y2="113" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>
  <line x1="163" y1="36" x2="163" y2="113" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>
  <line x1="198" y1="36" x2="198" y2="113" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>
  <line x1="233" y1="36" x2="233" y2="113" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>
  <line x1="268" y1="36" x2="268" y2="113" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>
  <rect x="93" y="109" width="197" height="6" fill="rgba(0,0,0,0.2)"/>
  <rect x="283" y="38" width="6" height="11" rx="1" fill="#ff2222"/>
  <rect x="283" y="53" width="6" height="8" rx="1" fill="#ff9900"/>
  <rect x="283" y="94" width="6" height="11" rx="1" fill="#ff2222"/>
  <!-- Fuel tank -->
  <rect x="79" y="78" width="16" height="37" rx="4" fill="#1a6580"/>
  <rect x="79" y="78" width="16" height="5" rx="2" fill="rgba(255,255,255,0.18)"/>
  <!-- Exhaust stack -->
  <rect x="56" y="8" width="8" height="30" rx="4" fill="#64748b"/>
  <rect x="55" y="8" width="10" height="4" rx="2" fill="#94a3b8"/>
  <!-- Hood -->
  <path d="M 10 92 L 10 58 Q 12 40 36 32 L 66 28 L 69 92 Z" fill="url(#tc1)"/>
  <path d="M 14 64 Q 16 48 38 38 L 64 31 L 64 35 L 42 42 Q 22 51 16 65 Z" fill="rgba(255,255,255,0.07)"/>
  <!-- Cab box -->
  <rect x="66" y="22" width="30" height="70" rx="3" fill="url(#tc1)"/>
  <!-- Windshield -->
  <path d="M 68 24 L 94 24 L 94 62 L 68 64 Z" fill="url(#tc3)"/>
  <path d="M 68 24 L 94 24 L 94 62 L 68 64 Z" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
  <path d="M 71 26 L 91 26 L 86 42 L 71 44 Z" fill="rgba(255,255,255,0.11)"/>
  <!-- Side window -->
  <rect x="16" y="64" width="42" height="22" rx="2" fill="#195a74" opacity="0.9"/>
  <rect x="18" y="66" width="18" height="10" rx="1" fill="rgba(255,255,255,0.08)"/>
  <line x1="47" y1="64" x2="47" y2="90" stroke="rgba(0,0,0,0.22)" stroke-width="1.5"/>
  <rect x="49" y="75" width="8" height="2.5" rx="1.25" fill="rgba(255,255,255,0.32)"/>
  <!-- Steps -->
  <rect x="10" y="88" width="12" height="5" rx="1" fill="url(#tc4)"/>
  <!-- Grille -->
  <rect x="5" y="50" width="12" height="30" rx="2" fill="#071c28"/>
  <line x1="8" y1="53" x2="8" y2="77" stroke="rgba(8,145,178,0.55)" stroke-width="1"/>
  <line x1="11" y1="53" x2="11" y2="77" stroke="rgba(8,145,178,0.55)" stroke-width="1"/>
  <line x1="14" y1="53" x2="14" y2="77" stroke="rgba(8,145,178,0.55)" stroke-width="1"/>
  <line x1="6" y1="59" x2="16" y2="59" stroke="rgba(8,145,178,0.28)" stroke-width="0.8"/>
  <line x1="6" y1="65" x2="16" y2="65" stroke="rgba(8,145,178,0.28)" stroke-width="0.8"/>
  <line x1="6" y1="71" x2="16" y2="71" stroke="rgba(8,145,178,0.28)" stroke-width="0.8"/>
  <!-- Headlights -->
  <rect x="5" y="40" width="14" height="10" rx="2" fill="#fef3c7"/>
  <rect x="6" y="41" width="12" height="8" rx="1.5" fill="#fbbf24"/>
  <rect x="6" y="41" width="12" height="3" rx="1" fill="rgba(255,255,255,0.5)"/>
  <!-- Running lights bar -->
  <rect x="5" y="36" width="62" height="3.5" rx="1.75" fill="#f97316" opacity="0.88"/>
  <!-- Chrome bumper -->
  <path d="M 4 88 L 4 96 Q 4 100 9 100 L 97 100 L 97 88 Z" fill="url(#tc4)"/>
  <rect x="4" y="88" width="93" height="3" rx="1" fill="rgba(255,255,255,0.45)"/>
  <!-- Mirror -->
  <rect x="54" y="28" width="13" height="9" rx="2" fill="#195a74"/>
  <line x1="60" y1="37" x2="67" y2="30" stroke="#195a74" stroke-width="2.5"/>
  <!-- Front wheel -->
  <circle cx="42" cy="126" r="22" fill="url(#tc5)"/>
  <circle cx="42" cy="126" r="14" fill="#1e293b"/>
  <line x1="42" y1="112" x2="42" y2="140" stroke="#475569" stroke-width="2.5"/>
  <line x1="28" y1="126" x2="56" y2="126" stroke="#475569" stroke-width="2.5"/>
  <line x1="32" y1="116" x2="52" y2="136" stroke="#475569" stroke-width="2"/>
  <line x1="52" y1="116" x2="32" y2="136" stroke="#475569" stroke-width="2"/>
  <circle cx="42" cy="126" r="5" fill="#94a3b8"/>
  <circle cx="42" cy="126" r="2.5" fill="#e2e8f0"/>
  <path d="M 24 113 Q 21 126 26 138" stroke="rgba(255,255,255,0.09)" stroke-width="4" fill="none" stroke-linecap="round"/>
  <!-- Drive outer -->
  <circle cx="168" cy="126" r="22" fill="url(#tc5)"/>
  <circle cx="168" cy="126" r="14" fill="#1e293b"/>
  <line x1="168" y1="112" x2="168" y2="140" stroke="#475569" stroke-width="2.5"/>
  <line x1="154" y1="126" x2="182" y2="126" stroke="#475569" stroke-width="2.5"/>
  <line x1="158" y1="116" x2="178" y2="136" stroke="#475569" stroke-width="2"/>
  <line x1="178" y1="116" x2="158" y2="136" stroke="#475569" stroke-width="2"/>
  <circle cx="168" cy="126" r="5" fill="#94a3b8"/>
  <circle cx="168" cy="126" r="2.5" fill="#e2e8f0"/>
  <path d="M 150 113 Q 147 126 152 138" stroke="rgba(255,255,255,0.09)" stroke-width="4" fill="none" stroke-linecap="round"/>
  <!-- Drive inner dual -->
  <circle cx="188" cy="126" r="19" fill="#0f172a"/>
  <circle cx="188" cy="126" r="12" fill="#1e293b"/>
  <circle cx="188" cy="126" r="4" fill="#334155"/>
  <!-- Trailer outer -->
  <circle cx="233" cy="126" r="22" fill="url(#tc5)"/>
  <circle cx="233" cy="126" r="14" fill="#1e293b"/>
  <line x1="233" y1="112" x2="233" y2="140" stroke="#475569" stroke-width="2.5"/>
  <line x1="219" y1="126" x2="247" y2="126" stroke="#475569" stroke-width="2.5"/>
  <line x1="223" y1="116" x2="243" y2="136" stroke="#475569" stroke-width="2"/>
  <line x1="243" y1="116" x2="223" y2="136" stroke="#475569" stroke-width="2"/>
  <circle cx="233" cy="126" r="5" fill="#94a3b8"/>
  <circle cx="233" cy="126" r="2.5" fill="#e2e8f0"/>
  <path d="M 215 113 Q 212 126 217 138" stroke="rgba(255,255,255,0.09)" stroke-width="4" fill="none" stroke-linecap="round"/>
  <!-- Trailer inner dual -->
  <circle cx="253" cy="126" r="19" fill="#0f172a"/>
  <circle cx="253" cy="126" r="12" fill="#1e293b"/>
  <circle cx="253" cy="126" r="4" fill="#334155"/>
</svg>`;

const CAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 170" style="width:100%;height:100%">
  <defs>
    <linearGradient id="cc1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c3aed"/><stop offset="55%" stop-color="#5b21b6"/><stop offset="100%" stop-color="#2e1065"/></linearGradient>
    <linearGradient id="cc2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#4c1d95"/></linearGradient>
    <linearGradient id="cc3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#c4b5fd" stop-opacity="0.6"/><stop offset="100%" stop-color="#7c3aed" stop-opacity="0.25"/></linearGradient>
    <linearGradient id="cc4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#dde6ed"/><stop offset="100%" stop-color="#8aa8bc"/></linearGradient>
    <radialGradient id="cc5" cx="38%" cy="35%"><stop offset="0%" stop-color="#4b5563"/><stop offset="100%" stop-color="#0f172a"/></radialGradient>
  </defs>
  <ellipse cx="150" cy="158" rx="132" ry="8" fill="rgba(0,0,0,0.22)"/>
  <!-- Lower body -->
  <path d="M 18 100 L 20 76 L 45 72 L 75 55 L 192 51 L 226 60 L 266 78 L 268 100 Z" fill="url(#cc1)"/>
  <!-- Roofline -->
  <path d="M 75 55 L 96 29 L 197 27 L 226 55" fill="url(#cc2)"/>
  <!-- Roof shine -->
  <path d="M 98 31 L 195 29 L 215 48 L 107 50 Z" fill="rgba(255,255,255,0.09)"/>
  <!-- Body outline -->
  <path d="M 18 100 L 20 76 L 45 72 L 75 55 L 96 29 L 197 27 L 226 55 L 226 60 L 266 78 L 268 100 Z" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
  <!-- Character line -->
  <path d="M 28 88 Q 148 68 268 84" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1.5" stroke-linecap="round"/>
  <!-- Windshield -->
  <path d="M 78 55 L 97 31 L 148 29 L 148 54 Z" fill="url(#cc3)"/>
  <path d="M 78 55 L 97 31 L 148 29 L 148 54 Z" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1"/>
  <path d="M 83 54 L 99 33 L 132 31 L 116 52 Z" fill="rgba(255,255,255,0.11)"/>
  <!-- Front side window -->
  <path d="M 150 29 L 179 28 L 179 54 L 150 54 Z" fill="url(#cc3)"/>
  <path d="M 150 29 L 179 28 L 179 54 L 150 54 Z" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>
  <rect x="153" y="30" width="14" height="12" rx="1" fill="rgba(255,255,255,0.07)"/>
  <!-- Rear side window -->
  <path d="M 181 28 L 208 29 L 221 54 L 181 54 Z" fill="url(#cc3)"/>
  <path d="M 181 28 L 208 29 L 221 54 L 181 54 Z" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>
  <!-- Pillars -->
  <line x1="97" y1="31" x2="78" y2="55" stroke="#2e1065" stroke-width="4"/>
  <line x1="149" y1="54" x2="149" y2="29" stroke="#2e1065" stroke-width="4"/>
  <line x1="180" y1="54" x2="180" y2="28" stroke="#2e1065" stroke-width="4"/>
  <line x1="222" y1="54" x2="208" y2="29" stroke="#2e1065" stroke-width="4"/>
  <!-- Door lines -->
  <line x1="149" y1="55" x2="151" y2="98" stroke="rgba(0,0,0,0.2)" stroke-width="1.5"/>
  <line x1="181" y1="55" x2="183" y2="98" stroke="rgba(0,0,0,0.2)" stroke-width="1.5"/>
  <!-- Door handles -->
  <rect x="112" y="79" width="12" height="3" rx="1.5" fill="url(#cc4)"/>
  <rect x="163" y="79" width="12" height="3" rx="1.5" fill="url(#cc4)"/>
  <!-- Rocker panel -->
  <rect x="28" y="96" width="232" height="7" rx="2" fill="#1e0a4c"/>
  <rect x="28" y="96" width="232" height="2" rx="1" fill="rgba(255,255,255,0.1)"/>
  <!-- Front bumper -->
  <path d="M 13 100 Q 13 112 22 114 L 78 114 L 78 100 Z" fill="#2e1065"/>
  <path d="M 13 112 Q 13 116 20 116 L 78 116 L 78 114 Z" fill="url(#cc4)"/>
  <!-- Headlight housing -->
  <path d="M 15 78 Q 16 70 28 68 L 62 68 L 68 80 L 15 80 Z" fill="#c4b5fd"/>
  <path d="M 17 79 Q 18 72 28 70 L 61 70 L 66 79 Z" fill="#7c3aed"/>
  <!-- DRL bar -->
  <path d="M 15 80 L 68 80 L 64 84 L 17 84 Z" fill="#a78bfa"/>
  <path d="M 17 82 L 66 82" stroke="rgba(255,255,255,0.55)" stroke-width="1.5"/>
  <!-- Projector lens -->
  <circle cx="36" cy="74" r="7" fill="#4c1d95"/>
  <circle cx="36" cy="74" r="5" fill="#6d28d9"/>
  <circle cx="36" cy="74" r="3" fill="rgba(255,255,255,0.92)"/>
  <!-- Grille -->
  <path d="M 16 86 L 67 86 L 67 94 Q 67 98 62 98 L 20 98 Q 16 98 16 94 Z" fill="#1a0650"/>
  <line x1="23" y1="86" x2="23" y2="98" stroke="rgba(124,58,237,0.45)" stroke-width="1"/>
  <line x1="30" y1="86" x2="30" y2="98" stroke="rgba(124,58,237,0.45)" stroke-width="1"/>
  <line x1="37" y1="86" x2="37" y2="98" stroke="rgba(124,58,237,0.45)" stroke-width="1"/>
  <line x1="44" y1="86" x2="44" y2="98" stroke="rgba(124,58,237,0.45)" stroke-width="1"/>
  <line x1="51" y1="86" x2="51" y2="98" stroke="rgba(124,58,237,0.45)" stroke-width="1"/>
  <line x1="58" y1="86" x2="58" y2="98" stroke="rgba(124,58,237,0.45)" stroke-width="1"/>
  <line x1="17" y1="91" x2="66" y2="91" stroke="rgba(124,58,237,0.3)" stroke-width="0.8"/>
  <!-- Rear bumper -->
  <path d="M 218 100 L 218 114 L 274 114 Q 280 114 280 108 L 280 100 Z" fill="#2e1065"/>
  <path d="M 218 114 Q 218 117 222 117 L 273 117 Q 278 117 278 112 L 278 110" fill="url(#cc4)"/>
  <!-- Rear lights -->
  <path d="M 248 68 L 277 72 Q 282 78 282 92 L 248 92 Z" fill="#ff2222"/>
  <path d="M 250 70 L 278 74 Q 280 80 280 90 L 250 90 Z" fill="#ff4444"/>
  <path d="M 250 70 L 278 74" stroke="rgba(255,255,255,0.45)" stroke-width="1.5"/>
  <rect x="252" y="77" width="22" height="6" rx="2" fill="#ff0000" opacity="0.7"/>
  <!-- Exhaust -->
  <ellipse cx="263" cy="115" rx="6" ry="3.5" fill="#475569"/>
  <ellipse cx="263" cy="115" rx="4" ry="2.5" fill="#1e293b"/>
  <!-- Front wheel -->
  <circle cx="80" cy="122" r="26" fill="url(#cc5)"/>
  <circle cx="80" cy="122" r="26" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="5"/>
  <circle cx="80" cy="122" r="18" fill="#1e293b"/>
  <line x1="80" y1="104" x2="80" y2="140" stroke="#6b7280" stroke-width="3"/>
  <line x1="63" y1="112" x2="97" y2="132" stroke="#6b7280" stroke-width="3"/>
  <line x1="63" y1="132" x2="97" y2="112" stroke="#6b7280" stroke-width="3"/>
  <line x1="68" y1="106" x2="92" y2="138" stroke="#6b7280" stroke-width="2.5"/>
  <line x1="92" y1="106" x2="68" y2="138" stroke="#6b7280" stroke-width="2.5"/>
  <circle cx="80" cy="122" r="7" fill="#374151"/>
  <circle cx="80" cy="122" r="4.5" fill="#9ca3af"/>
  <circle cx="80" cy="122" r="2.5" fill="#f1f5f9"/>
  <path d="M 68 109 Q 60 114 60 122 Q 60 130 68 135" stroke="#ef4444" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M 57 110 Q 54 122 59 134" stroke="rgba(255,255,255,0.08)" stroke-width="4" fill="none" stroke-linecap="round"/>
  <!-- Rear wheel -->
  <circle cx="222" cy="122" r="26" fill="url(#cc5)"/>
  <circle cx="222" cy="122" r="26" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="5"/>
  <circle cx="222" cy="122" r="18" fill="#1e293b"/>
  <line x1="222" y1="104" x2="222" y2="140" stroke="#6b7280" stroke-width="3"/>
  <line x1="205" y1="112" x2="239" y2="132" stroke="#6b7280" stroke-width="3"/>
  <line x1="205" y1="132" x2="239" y2="112" stroke="#6b7280" stroke-width="3"/>
  <line x1="210" y1="106" x2="234" y2="138" stroke="#6b7280" stroke-width="2.5"/>
  <line x1="234" y1="106" x2="210" y2="138" stroke="#6b7280" stroke-width="2.5"/>
  <circle cx="222" cy="122" r="7" fill="#374151"/>
  <circle cx="222" cy="122" r="4.5" fill="#9ca3af"/>
  <circle cx="222" cy="122" r="2.5" fill="#f1f5f9"/>
  <path d="M 210 109 Q 202 114 202 122 Q 202 130 210 135" stroke="#ef4444" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M 199 110 Q 196 122 201 134" stroke="rgba(255,255,255,0.08)" stroke-width="4" fill="none" stroke-linecap="round"/>
</svg>`;

export function renderRoleSelect() {
  const user = getCurrentUser();
  const firstName = user?.displayName ? user.displayName.split(' ')[0] : null;

  const html = `
    <div class="flex flex-col h-full text-white" style="background:var(--bg-base,rgb(4,10,18))">
      <div class="flex-1 flex flex-col items-center justify-center" style="padding:24px 20px">

        <!-- Greeting -->
        <div style="text-align:center;margin-bottom:32px">
          <h1 style="font-size:1.6rem;font-weight:900;color:#e0f2fe;letter-spacing:-0.5px">
            ${firstName ? `Welcome, ${firstName}!` : 'Welcome to RigLog'}
          </h1>
          <p style="font-size:0.85rem;color:rgba(148,163,184,0.8);margin-top:6px">What are you tracking today?</p>
        </div>

        <!-- Mode cards -->
        <div style="width:100%;display:flex;flex-direction:column;gap:14px;max-width:380px">

          <!-- Trucking card -->
          <button id="mode-trucking" style="
            width:100%;text-align:left;padding:0;border-radius:22px;overflow:hidden;
            background:linear-gradient(135deg,rgba(8,145,178,0.18) 0%,rgba(6,182,212,0.06) 100%);
            border:1.5px solid rgba(8,145,178,0.4);
            box-shadow:0 8px 32px rgba(8,145,178,0.14),0 1px 0 rgba(255,255,255,0.08) inset;
            position:relative">
            <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(8,145,178,0.75),transparent)"></div>
            <!-- SVG vehicle image -->
            <div style="width:100%;height:120px;overflow:hidden;border-radius:20px 20px 0 0;background:linear-gradient(180deg,rgba(8,145,178,0.08) 0%,rgba(4,10,18,0.6) 100%)">
              ${TRUCK_SVG}
            </div>
            <!-- Card text -->
            <div style="padding:16px 18px 18px">
              <p style="font-size:1.05rem;font-weight:900;color:#67e8f9;margin-bottom:4px">🚛 Trucking / Owner-Operator</p>
              <p style="font-size:0.78rem;color:rgba(148,163,184,0.75);line-height:1.45">
                Revenue &amp; load tracking · IFTA miles · DVIR inspections · Detention timer · Tax summary
              </p>
              <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
                ${['Revenue','Trips','IFTA','Detention','Tax'].map(t =>
                  `<span style="font-size:0.65rem;font-weight:700;padding:3px 8px;border-radius:6px;background:rgba(8,145,178,0.15);color:#67e8f9;border:1px solid rgba(8,145,178,0.25)">${t}</span>`
                ).join('')}
              </div>
            </div>
          </button>

          <!-- Personal card -->
          <button id="mode-personal" style="
            width:100%;text-align:left;padding:0;border-radius:22px;overflow:hidden;
            background:linear-gradient(135deg,rgba(139,92,246,0.15) 0%,rgba(168,85,247,0.05) 100%);
            border:1.5px solid rgba(139,92,246,0.35);
            box-shadow:0 8px 32px rgba(139,92,246,0.12),0 1px 0 rgba(255,255,255,0.08) inset;
            position:relative">
            <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(139,92,246,0.75),transparent)"></div>
            <!-- SVG vehicle image -->
            <div style="width:100%;height:120px;overflow:hidden;border-radius:20px 20px 0 0;background:linear-gradient(180deg,rgba(124,58,237,0.08) 0%,rgba(4,10,18,0.6) 100%)">
              ${CAR_SVG}
            </div>
            <!-- Card text -->
            <div style="padding:16px 18px 18px">
              <p style="font-size:1.05rem;font-weight:900;color:#c4b5fd;margin-bottom:4px">🚗 Personal Vehicle</p>
              <p style="font-size:0.78rem;color:rgba(148,163,184,0.75);line-height:1.45">
                MPG tracking · Fill-up log · Car expenses · Maintenance reminders
              </p>
              <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
                ${['MPG','Fuel Log','Expenses','Maintenance','Trips'].map(t =>
                  `<span style="font-size:0.65rem;font-weight:700;padding:3px 8px;border-radius:6px;background:rgba(139,92,246,0.12);color:#c4b5fd;border:1px solid rgba(139,92,246,0.25)">${t}</span>`
                ).join('')}
              </div>
            </div>
          </button>

        </div>

        <p style="font-size:0.7rem;color:rgba(100,116,139,0.6);margin-top:24px;text-align:center">
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
