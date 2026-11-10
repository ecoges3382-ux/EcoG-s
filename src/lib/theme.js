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
  if (typeof window === 'undefined') return;
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  const root = document.documentElement.style;
  root.setProperty('--forest', hex);
  root.setProperty('--forest-dark', mix(hex, '#000000', 0.35));
  root.setProperty('--forest-light', mix(hex, '#ffffff', 0.88));

  // 🚀 MISE À JOUR DE LA BARRE D'ÉTAT (Android/iOS)
  const darkColor = mix(hex, '#000000', 0.35);
  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme) {
    metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    document.head.appendChild(metaTheme);
  }
  metaTheme.setAttribute('content', darkColor);
}

export function resetSchoolColor() {
  if (typeof window === 'undefined') return;
  const root = document.documentElement.style;
  root.removeProperty('--forest');
  root.removeProperty('--forest-dark');
  root.removeProperty('--forest-light');

  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', '#0F4C3A');
  }
}

// ========== GESTION DU MODE SOMBRE (PERSONNALISÉ PAR UTILISATEUR) ==========

// 👇 LA CLÉ DEVIENT DYNAMIQUE SELON L'UTILISATEUR 👇
function getThemeKey(userId) {
  return userId ? `ecoges_theme_${userId}` : 'ecoges_theme_guest';
}

export function getInitialTheme(userId) {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(getThemeKey(userId));
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme, userId) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark-mode');
  } else {
    root.classList.remove('dark-mode');
  }
  try {
    localStorage.setItem(getThemeKey(userId), theme);
  } catch {}
}

export function toggleTheme(userId) {
  if (typeof window === 'undefined') return 'light';
  const current = document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next, userId);
  return next;
}
