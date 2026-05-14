export const ACCENT_PRESETS = [
  { id: 'cyan',     label: 'Ocean',    hex: '#0891b2', dark: '#0e7490', light: '#67e8f9', ar: 8,   ag: 145, ab: 178 },
  { id: 'violet',   label: 'Violet',   hex: '#7c3aed', dark: '#6d28d9', light: '#c4b5fd', ar: 124, ag: 58,  ab: 237 },
  { id: 'emerald',  label: 'Emerald',  hex: '#059669', dark: '#047857', light: '#6ee7b7', ar: 5,   ag: 150, ab: 105 },
  { id: 'ember',    label: 'Ember',    hex: '#ea580c', dark: '#c2410c', light: '#fdba74', ar: 234, ag: 88,  ab: 12  },
  { id: 'rose',     label: 'Rose',     hex: '#e11d48', dark: '#be123c', light: '#fda4af', ar: 225, ag: 29,  ab: 72  },
  { id: 'sapphire', label: 'Sapphire', hex: '#2563eb', dark: '#1d4ed8', light: '#93c5fd', ar: 37,  ag: 99,  ab: 235 },
  { id: 'gold',     label: 'Gold',     hex: '#d97706', dark: '#b45309', light: '#fcd34d', ar: 217, ag: 119, ab: 6   },
  { id: 'pink',     label: 'Neon',     hex: '#db2777', dark: '#be185d', light: '#f9a8d4', ar: 219, ag: 39,  ab: 119 },
];

export const BG_PRESETS = [
  { id: 'dark',  label: 'Space', base: 'rgb(4,10,18)',  r: 4, g: 10, b: 18 },
  { id: 'black', label: 'Abyss', base: 'rgb(0,0,3)',    r: 0, g: 0,  b: 3  },
  { id: 'navy',  label: 'Navy',  base: 'rgb(3,6,20)',   r: 3, g: 6,  b: 20 },
  { id: 'slate', label: 'Slate', base: 'rgb(9,9,11)',   r: 9, g: 9,  b: 11 },
];

export function loadTheme() {
  try {
    return JSON.parse(localStorage.getItem('rl_theme') || 'null') || { accentColor: 'cyan', bgTheme: 'dark' };
  } catch {
    return { accentColor: 'cyan', bgTheme: 'dark' };
  }
}

export function saveTheme(accentColor, bgTheme) {
  localStorage.setItem('rl_theme', JSON.stringify({ accentColor, bgTheme }));
}

export function applyTheme(accentId = 'cyan', bgId = 'dark') {
  const a = ACCENT_PRESETS.find(p => p.id === accentId) ?? ACCENT_PRESETS[0];
  const b = BG_PRESETS.find(p => p.id === bgId) ?? BG_PRESETS[0];

  let tag = document.getElementById('rl-theme-vars');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'rl-theme-vars';
    document.head.appendChild(tag);
  }

  tag.textContent = `
:root {
  --accent: ${a.hex};
  --accent-dark: ${a.dark};
  --accent-light: ${a.light};
  --ar: ${a.ar}; --ag: ${a.ag}; --ab: ${a.ab};
  --bg-base: ${b.base};
}
html, body { background: var(--bg-base) !important; }
#screen > div { background: var(--bg-base) !important; }`;
}
