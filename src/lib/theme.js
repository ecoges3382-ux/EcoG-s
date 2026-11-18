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

function luminance({ r, g, b }) {
  const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(hexA, hexB) {
  const la = luminance(hexToRgb(hexA));
  const lb = luminance(hexToRgb(hexB));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Version éclaircie de la couleur de l'école, assez claire pour écrire sur le fond du mode sombre
// (contraste d'au moins 5 contre la carte sombre #1F2937).
function liftForDark(hex) {
  let amount = 0.45;
  let out = mix(hex, '#ffffff', amount);
  while (contrast(out, '#1F2937') < 5 && amount < 0.95) {
    amount += 0.05;
    out = mix(hex, '#ffffff', amount);
  }
  return out;
}

export function applySchoolColor(hex) {
  if (typeof window === 'undefined') return;
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  const root = document.documentElement.style;
  root.setProperty('--forest', hex);
  root.setProperty('--forest-dark', mix(hex, '#000000', 0.35));
  // Teinte de fond (pastilles, cartes teintées) : claire en mode clair, sombre en mode sombre.
  root.setProperty('--forest-tint-light', mix(hex, '#ffffff', 0.88));
  root.setProperty('--forest-tint-dark', mix(hex, '#111827', 0.72));
  // Couleur utilisable comme TEXTE en mode sombre
  root.setProperty('--forest-lift', liftForDark(hex));

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
  root.removeProperty('--forest-tint-light');
  root.removeProperty('--forest-tint-dark');
  root.removeProperty('--forest-lift');

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
  } catch { /* stockage indisponible : on ignore */ }
}

export function toggleTheme(userId) {
  if (typeof window === 'undefined') return 'light';
  const current = document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next, userId);
  return next;
}
