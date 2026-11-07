// Applique la couleur principale choisie par l'école
function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex({ r, g, b }) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('')}`;
}

function mix(hex, target, amount) {
  const c = hexToRgb(hex);
  const t = hexToRgb(target);
  return rgbToHex({
    r: c.r + (t.r - c.r) * amount,
    g: c.g + (t.g - c.g) * amount,
    b: c.b + (t.b - c.b) * amount,
  });
}

export function applySchoolColor(hex) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  const root = document.documentElement.style;
  root.setProperty('--forest', hex);
  root.setProperty('--forest-dark', mix(hex, '#000000', 0.28));
  root.setProperty('--forest-light', mix(hex, '#ffffff', 0.88));
}

export function resetSchoolColor() {
  const root = document.documentElement.style;
  root.removeProperty('--forest');
  root.removeProperty('--forest-dark');
  root.removeProperty('--forest-light');
}

// ========== GESTION DU MODE SOMBRE ==========
const THEME_KEY = 'ecoges_theme';

export function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  // Si pas de sauvegarde, on utilise la préférence du système
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark-mode');
  } else {
    root.classList.remove('dark-mode');
  }
  localStorage.setItem(THEME_KEY, theme);
}

export function toggleTheme() {
  const current = document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
