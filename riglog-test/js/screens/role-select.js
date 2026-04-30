import { setAppMode } from '../store.js';
import { getCurrentUser } from '../auth.js';

const TRUCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 170" style="width:100%;height:100%">
  <defs>
    <linearGradient id="tc1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4dd8f4"/><stop offset="22%" stop-color="#1a8aaa"/><stop offset="100%" stop-color="#063d55"/>
    </linearGradient>
    <linearGradient id="tc2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2e7a96"/><stop offset="42%" stop-color="#1a4f68"/><stop offset="100%" stop-color="#0a2535"/>
    </linearGradient>
    <linearGradient id="tc3" x1="0.2" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stop-color="#b8eef8" stop-opacity="0.82"/><stop offset="38%" stop-color="#67d3ec" stop-opacity="0.5"/><stop offset="100%" stop-color="#0086a8" stop-opacity="0.28"/>
    </linearGradient>
    <linearGradient id="tc4" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f0f5fa"/><stop offset="45%" stop-color="#8eacc0"/><stop offset="100%" stop-color="#3d5a72"/>
    </linearGradient>
    <radialGradient id="tc5" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#374151"/><stop offset="55%" stop-color="#1f2937"/><stop offset="100%" stop-color="#080e18"/>
    </radialGradient>
    <radialGradient id="tc6" cx="32%" cy="28%" r="70%">
      <stop offset="0%" stop-color="#5e6e82"/><stop offset="100%" stop-color="#1a2535"/>
    </radialGradient>
  </defs>
  <!-- Ground shadow -->
  <ellipse cx="155" cy="156" rx="142" ry="7" fill="rgba(0,0,0,0.3)"/>
  <!-- TRAILER body -->
  <rect x="92" y="26" width="194" height="90" rx="5" fill="url(#tc2)"/>
  <rect x="93" y="27" width="192" height="8" rx="3" fill="rgba(255,255,255,0.15)"/>
  <line x1="130" y1="35" x2="130" y2="114" stroke="rgba(255,255,255,0.055)" stroke-width="1.5"/>
  <line x1="168" y1="35" x2="168" y2="114" stroke="rgba(255,255,255,0.055)" stroke-width="1.5"/>
  <line x1="206" y1="35" x2="206" y2="114" stroke="rgba(255,255,255,0.055)" stroke-width="1.5"/>
  <line x1="244" y1="35" x2="244" y2="114" stroke="rgba(255,255,255,0.055)" stroke-width="1.5"/>
  <rect x="92" y="108" width="194" height="8" fill="rgba(0,0,0,0.22)"/>
  <rect x="281" y="36" width="6" height="12" rx="2" fill="#ef4444"/>
  <rect x="281" y="52" width="6" height="9" rx="1.5" fill="#f97316"/>
  <rect x="281" y="93" width="6" height="12" rx="2" fill="#ef4444"/>
  <!-- Fuel tank -->
  <rect x="78" y="76" width="15" height="38" rx="4" fill="#1a5e78"/>
  <rect x="78" y="76" width="15" height="5" rx="2" fill="rgba(255,255,255,0.22)"/>
  <!-- Exhaust stack -->
  <rect x="55" y="7" width="8" height="27" rx="4" fill="#475569"/>
  <rect x="55" y="7" width="8" height="4" rx="4" fill="#94a3b8"/>
  <ellipse cx="59" cy="6" rx="5" ry="3" fill="rgba(148,163,184,0.18)"/>
  <ellipse cx="58" cy="3" rx="4" ry="2.5" fill="rgba(148,163,184,0.1)"/>
  <!-- HOOD -->
  <path d="M 8 114 L 8 57 Q 10 38 36 29 L 66 25 L 66 114 Z" fill="url(#tc1)"/>
  <path d="M 14 60 Q 17 44 38 35 L 62 28 L 62 33 L 40 39 Q 20 48 16 62 Z" fill="rgba(255,255,255,0.09)"/>
  <rect x="8" y="100" width="58" height="14" fill="rgba(0,0,0,0.13)"/>
  <!-- CAB box -->
  <rect x="63" y="22" width="30" height="92" rx="3" fill="url(#tc1)"/>
  <rect x="63" y="22" width="6" height="92" rx="2" fill="rgba(255,255,255,0.07)"/>
  <!-- WINDSHIELD -->
  <path d="M 65 24 L 92 24 L 92 64 L 65 67 Z" fill="url(#tc3)"/>
  <path d="M 65 24 L 92 24 L 92 64 L 65 67 Z" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
  <path d="M 68 26 L 90 26 L 87 37 L 68 40 Z" fill="rgba(255,255,255,0.2)"/>
  <path d="M 65 55 L 92 53 L 92 64 L 65 67 Z" fill="rgba(0,0,0,0.13)"/>
  <!-- Side window -->
  <rect x="13" y="62" width="44" height="26" rx="2" fill="#0c4560"/>
  <rect x="15" y="63" width="40" height="6" rx="1" fill="rgba(255,255,255,0.14)"/>
  <line x1="46" y1="62" x2="46" y2="90" stroke="rgba(0,0,0,0.28)" stroke-width="1.5"/>
  <rect x="48" y="75" width="9" height="2.5" rx="1.25" fill="rgba(255,255,255,0.38)"/>
  <!-- Steps -->
  <rect x="8" y="90" width="13" height="5" rx="1.5" fill="url(#tc4)"/>
  <!-- GRILLE -->
  <rect x="3" y="47" width="12" height="40" rx="2" fill="#03111d"/>
  <line x1="6" y1="51" x2="6" y2="84" stroke="rgba(8,145,178,0.65)" stroke-width="1.2"/>
  <line x1="9" y1="51" x2="9" y2="84" stroke="rgba(8,145,178,0.65)" stroke-width="1.2"/>
  <line x1="12" y1="51" x2="12" y2="84" stroke="rgba(8,145,178,0.65)" stroke-width="1.2"/>
  <line x1="4" y1="58" x2="14" y2="58" stroke="rgba(8,145,178,0.3)" stroke-width="0.8"/>
  <line x1="4" y1="65" x2="14" y2="65" stroke="rgba(8,145,178,0.3)" stroke-width="0.8"/>
  <line x1="4" y1="72" x2="14" y2="72" stroke="rgba(8,145,178,0.3)" stroke-width="0.8"/>
  <line x1="4" y1="79" x2="14" y2="79" stroke="rgba(8,145,178,0.3)" stroke-width="0.8"/>
  <!-- HEADLIGHT -->
  <rect x="3" y="35" width="14" height="12" rx="3" fill="#fef3c7"/>
  <rect x="4" y="36" width="12" height="10" rx="2.5" fill="#fbbf24"/>
  <rect x="4" y="36" width="12" height="4" rx="2" fill="rgba(255,255,255,0.6)"/>
  <rect x="4" y="46" width="9" height="2" rx="1" fill="#f97316" opacity="0.9"/>
  <!-- Running light bar -->
  <rect x="3" y="31" width="64" height="3.5" rx="1.75" fill="#fb923c" opacity="0.92"/>
  <!-- CHROME BUMPER -->
  <path d="M 2 100 L 2 112 Q 2 118 8 118 L 93 118 L 93 100 Z" fill="url(#tc4)"/>
  <rect x="2" y="100" width="91" height="3" fill="rgba(255,255,255,0.52)"/>
  <rect x="2" y="114" width="91" height="2.5" fill="rgba(0,0,0,0.25)"/>
  <!-- Mirror -->
  <line x1="62" y1="34" x2="68" y2="27" stroke="#1a5e78" stroke-width="2.5"/>
  <rect x="55" y="25" width="13" height="9" rx="2.5" fill="#1a5e78"/>
  <rect x="55" y="25" width="13" height="2.5" fill="rgba(255,255,255,0.22)"/>
  <!-- FRONT WHEEL (steer) -->
  <circle cx="44" cy="128" r="22" fill="url(#tc5)"/>
  <path d="M 26 115 Q 22 128 27 141" stroke="rgba(255,255,255,0.07)" stroke-width="5" fill="none" stroke-linecap="round"/>
  <circle cx="44" cy="128" r="14" fill="url(#tc6)"/>
  <g transform="translate(44,128)">
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(0)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(45)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(90)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(135)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(180)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(225)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(270)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(315)"/>
    <circle r="4.5" fill="#64748b"/>
    <circle r="2.5" fill="#cbd5e1"/>
  </g>
  <!-- DRIVE tandem outer -->
  <circle cx="172" cy="128" r="22" fill="url(#tc5)"/>
  <path d="M 154 115 Q 150 128 155 141" stroke="rgba(255,255,255,0.07)" stroke-width="5" fill="none" stroke-linecap="round"/>
  <circle cx="172" cy="128" r="14" fill="url(#tc6)"/>
  <g transform="translate(172,128)">
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(22)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(67)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(112)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(157)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(202)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(247)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(292)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(337)"/>
    <circle r="4.5" fill="#64748b"/>
    <circle r="2.5" fill="#cbd5e1"/>
  </g>
  <!-- Drive inner dual -->
  <circle cx="194" cy="128" r="18" fill="#101a28"/>
  <circle cx="194" cy="128" r="11" fill="#1a2840"/>
  <circle cx="194" cy="128" r="4" fill="#2d3a50"/>
  <!-- TRAILER tandem outer -->
  <circle cx="239" cy="128" r="22" fill="url(#tc5)"/>
  <path d="M 221 115 Q 217 128 222 141" stroke="rgba(255,255,255,0.07)" stroke-width="5" fill="none" stroke-linecap="round"/>
  <circle cx="239" cy="128" r="14" fill="url(#tc6)"/>
  <g transform="translate(239,128)">
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(0)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(45)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(90)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(135)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(180)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(225)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(270)"/>
    <rect x="-1.5" y="-13" width="3" height="9" rx="1.5" fill="#5a6475" transform="rotate(315)"/>
    <circle r="4.5" fill="#64748b"/>
    <circle r="2.5" fill="#cbd5e1"/>
  </g>
  <!-- Trailer inner dual -->
  <circle cx="261" cy="128" r="18" fill="#101a28"/>
  <circle cx="261" cy="128" r="11" fill="#1a2840"/>
  <circle cx="261" cy="128" r="4" fill="#2d3a50"/>
</svg>`;

const CAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 170" style="width:100%;height:100%">
  <defs>
    <linearGradient id="cc1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#9d5cf5"/><stop offset="22%" stop-color="#7c3aed"/><stop offset="62%" stop-color="#5b21b6"/><stop offset="100%" stop-color="#2e1065"/>
    </linearGradient>
    <linearGradient id="cc2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#4c1d95"/>
    </linearGradient>
    <linearGradient id="cc3" x1="0.1" y1="0" x2="0.7" y2="1">
      <stop offset="0%" stop-color="#c4b5fd" stop-opacity="0.78"/><stop offset="40%" stop-color="#8b5cf6" stop-opacity="0.48"/><stop offset="100%" stop-color="#4c1d95" stop-opacity="0.28"/>
    </linearGradient>
    <linearGradient id="cc4" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f0f5fa"/><stop offset="45%" stop-color="#8eacc0"/><stop offset="100%" stop-color="#3d5a72"/>
    </linearGradient>
    <radialGradient id="cc5" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#374151"/><stop offset="55%" stop-color="#1f2937"/><stop offset="100%" stop-color="#080e18"/>
    </radialGradient>
    <radialGradient id="cc6" cx="32%" cy="28%" r="70%">
      <stop offset="0%" stop-color="#5e6e82"/><stop offset="100%" stop-color="#1a2535"/>
    </radialGradient>
  </defs>
  <!-- Ground shadow -->
  <ellipse cx="150" cy="156" rx="134" ry="7" fill="rgba(0,0,0,0.28)"/>
  <!-- LOWER BODY -->
  <path d="M 18 108 L 20 80 L 45 72 L 76 56 L 192 52 L 226 62 L 266 80 L 268 108 Z" fill="url(#cc1)"/>
  <!-- Body top highlight strip -->
  <path d="M 76 56 L 130 54 L 130 58 L 76 60 Z" fill="rgba(255,255,255,0.1)"/>
  <path d="M 130 52 L 192 52 L 192 56 L 130 54 Z" fill="rgba(255,255,255,0.07)"/>
  <!-- Body shadow bottom -->
  <path d="M 18 100 L 268 100 L 268 108 L 18 108 Z" fill="rgba(0,0,0,0.12)"/>
  <!-- Character line -->
  <path d="M 28 88 Q 148 70 268 86" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" stroke-linecap="round"/>
  <!-- ROOFLINE -->
  <path d="M 76 56 L 97 28 L 197 26 L 226 56 Z" fill="url(#cc2)"/>
  <path d="M 100 30 L 194 28 L 212 46 L 110 48 Z" fill="rgba(255,255,255,0.1)"/>
  <path d="M 108 28 L 192 26 L 198 30 L 110 32 Z" fill="rgba(255,255,255,0.14)"/>
  <!-- WINDSHIELD -->
  <path d="M 79 56 L 98 30 L 148 28 L 148 55 Z" fill="url(#cc3)"/>
  <path d="M 79 56 L 98 30 L 148 28 L 148 55 Z" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
  <path d="M 84 54 L 100 32 L 130 30 L 116 52 Z" fill="rgba(255,255,255,0.14)"/>
  <!-- Front door window -->
  <path d="M 150 28 L 180 27 L 180 55 L 150 55 Z" fill="url(#cc3)"/>
  <path d="M 150 28 L 180 27 L 180 55 L 150 55 Z" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>
  <rect x="152" y="29" width="16" height="10" rx="1" fill="rgba(255,255,255,0.09)"/>
  <!-- Rear door window -->
  <path d="M 182 27 L 210 28 L 222 55 L 182 55 Z" fill="url(#cc3)"/>
  <path d="M 182 27 L 210 28 L 222 55 L 182 55 Z" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>
  <!-- Pillars -->
  <line x1="98" y1="30" x2="79" y2="56" stroke="#1e0855" stroke-width="4"/>
  <line x1="149" y1="55" x2="149" y2="28" stroke="#1e0855" stroke-width="4"/>
  <line x1="181" y1="55" x2="181" y2="27" stroke="#1e0855" stroke-width="4"/>
  <line x1="222" y1="55" x2="210" y2="28" stroke="#1e0855" stroke-width="4"/>
  <!-- Door lines -->
  <line x1="149" y1="56" x2="151" y2="107" stroke="rgba(0,0,0,0.2)" stroke-width="1.5"/>
  <line x1="181" y1="56" x2="183" y2="107" stroke="rgba(0,0,0,0.2)" stroke-width="1.5"/>
  <!-- Door handles -->
  <rect x="112" y="80" width="12" height="3" rx="1.5" fill="url(#cc4)"/>
  <rect x="164" y="80" width="12" height="3" rx="1.5" fill="url(#cc4)"/>
  <!-- Rocker panel -->
  <rect x="28" y="104" width="234" height="7" rx="2" fill="#1a0845"/>
  <rect x="28" y="104" width="234" height="2" fill="rgba(255,255,255,0.1)"/>
  <!-- FRONT FASCIA -->
  <path d="M 13 108 Q 13 120 22 122 L 78 122 L 78 108 Z" fill="#200a5a"/>
  <path d="M 13 120 Q 13 124 20 124 L 78 124 L 78 122 Z" fill="url(#cc4)"/>
  <!-- HEADLIGHT housing -->
  <path d="M 15 78 Q 16 68 29 66 L 64 66 L 70 80 L 15 80 Z" fill="#c4b5fd"/>
  <path d="M 17 79 Q 18 70 29 68 L 63 68 L 68 79 Z" fill="#7c3aed"/>
  <!-- DRL bar -->
  <path d="M 16 80 L 69 80 L 65 85 L 17 85 Z" fill="#a78bfa"/>
  <path d="M 18 82 L 67 82" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>
  <!-- Projector lens -->
  <circle cx="36" cy="73" r="7.5" fill="#3b0d8f"/>
  <circle cx="36" cy="73" r="5.5" fill="#6d28d9"/>
  <circle cx="36" cy="73" r="3.5" fill="rgba(255,255,255,0.95)"/>
  <circle cx="34.5" cy="71.5" r="1.5" fill="rgba(255,255,255,1)"/>
  <!-- GRILLE -->
  <path d="M 16 87 L 68 87 L 68 96 Q 68 100 63 100 L 20 100 Q 16 100 16 96 Z" fill="#130440"/>
  <line x1="24" y1="87" x2="24" y2="100" stroke="rgba(124,58,237,0.5)" stroke-width="1"/>
  <line x1="31" y1="87" x2="31" y2="100" stroke="rgba(124,58,237,0.5)" stroke-width="1"/>
  <line x1="38" y1="87" x2="38" y2="100" stroke="rgba(124,58,237,0.5)" stroke-width="1"/>
  <line x1="45" y1="87" x2="45" y2="100" stroke="rgba(124,58,237,0.5)" stroke-width="1"/>
  <line x1="52" y1="87" x2="52" y2="100" stroke="rgba(124,58,237,0.5)" stroke-width="1"/>
  <line x1="59" y1="87" x2="59" y2="100" stroke="rgba(124,58,237,0.5)" stroke-width="1"/>
  <line x1="17" y1="93" x2="67" y2="93" stroke="rgba(124,58,237,0.3)" stroke-width="0.8"/>
  <!-- REAR BUMPER -->
  <path d="M 218 108 L 218 122 L 275 122 Q 281 122 281 116 L 281 108 Z" fill="#200a5a"/>
  <path d="M 218 122 Q 218 125 222 125 L 274 125 Q 279 125 279 120 L 279 118" fill="url(#cc4)"/>
  <!-- REAR LIGHTS -->
  <path d="M 248 68 L 278 72 Q 284 80 284 94 L 248 94 Z" fill="#dc2626"/>
  <path d="M 250 70 L 279 74 Q 282 82 282 92 L 250 92 Z" fill="#ef4444"/>
  <path d="M 252 70 L 279 74" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
  <rect x="254" y="78" width="22" height="7" rx="2" fill="#ff0000" opacity="0.65"/>
  <!-- Exhaust -->
  <ellipse cx="264" cy="123" rx="6" ry="3" fill="#3d4f64"/>
  <ellipse cx="264" cy="123" rx="4" ry="2" fill="#1a2535"/>
  <!-- FRONT WHEEL -->
  <circle cx="80" cy="126" r="24" fill="url(#cc5)"/>
  <path d="M 60 112 Q 56 126 62 140" stroke="rgba(255,255,255,0.07)" stroke-width="5" fill="none" stroke-linecap="round"/>
  <circle cx="80" cy="126" r="16" fill="url(#cc6)"/>
  <g transform="translate(80,126)">
    <rect x="-2" y="-15" width="4" height="10" rx="2" fill="#4b5870" transform="rotate(0)"/>
    <rect x="-2" y="-15" width="4" height="10" rx="2" fill="#4b5870" transform="rotate(72)"/>
    <rect x="-2" y="-15" width="4" height="10" rx="2" fill="#4b5870" transform="rotate(144)"/>
    <rect x="-2" y="-15" width="4" height="10" rx="2" fill="#4b5870" transform="rotate(216)"/>
    <rect x="-2" y="-15" width="4" height="10" rx="2" fill="#4b5870" transform="rotate(288)"/>
    <circle r="5.5" fill="#4b5870"/>
    <circle r="3.5" fill="#94a3b8"/>
    <circle r="1.8" fill="#e2e8f0"/>
  </g>
  <!-- Brake caliper front -->
  <path d="M 67 112 Q 63 116 63 121 Q 63 126 67 130" stroke="#ef4444" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- REAR WHEEL -->
  <circle cx="222" cy="126" r="24" fill="url(#cc5)"/>
  <path d="M 202 112 Q 198 126 204 140" stroke="rgba(255,255,255,0.07)" stroke-width="5" fill="none" stroke-linecap="round"/>
  <circle cx="222" cy="126" r="16" fill="url(#cc6)"/>
  <g transform="translate(222,126)">
    <rect x="-2" y="-15" width="4" height="10" rx="2" fill="#4b5870" transform="rotate(36)"/>
    <rect x="-2" y="-15" width="4" height="10" rx="2" fill="#4b5870" transform="rotate(108)"/>
    <rect x="-2" y="-15" width="4" height="10" rx="2" fill="#4b5870" transform="rotate(180)"/>
    <rect x="-2" y="-15" width="4" height="10" rx="2" fill="#4b5870" transform="rotate(252)"/>
    <rect x="-2" y="-15" width="4" height="10" rx="2" fill="#4b5870" transform="rotate(324)"/>
    <circle r="5.5" fill="#4b5870"/>
    <circle r="3.5" fill="#94a3b8"/>
    <circle r="1.8" fill="#e2e8f0"/>
  </g>
  <!-- Brake caliper rear -->
  <path d="M 209 112 Q 205 116 205 121 Q 205 126 209 130" stroke="#ef4444" stroke-width="3" fill="none" stroke-linecap="round"/>
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
