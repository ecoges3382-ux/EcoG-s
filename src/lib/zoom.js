// Zoom de l'affichage (réglable dans Paramètres), par appareil, par pas de 10 %.
//
// Principe : on change la balise « viewport » de la page, ce qui reproduit exactement le zoom d'un navigateur : la
// largeur disponible diminue (à 120 %, un téléphone de 390 px offre 325 px), le texte et les boutons grossissent, et
// toutes les mises en page restent cohérentes. (Un zoom en CSS décalait les menus déroulants et les visites guidées.)
// Cela ne marche que sur téléphone et tablette ; sur ordinateur, le navigateur a déjà Ctrl + / Ctrl −.
//
// Au chargement, un petit script dans index.html applique le zoom enregistré avant le premier affichage : si tu changes
// la logique ici, change-la aussi là-bas.

export const ZOOM_DEFAULT = 100;
export const ZOOM_MIN = 80;
export const ZOOM_MAX = 150;
export const ZOOM_STEP = 10;
// En dessous de cette largeur (en pixels), les écrans de l'application ne tiennent plus : on plafonne le zoom.
export const MIN_LAYOUT_WIDTH = 320;
export const ZOOM_KEY = 'ecoges_zoom';

// Zoom maximum que permet un écran de cette largeur (la plus petite des deux dimensions : l'écran peut tourner).
export function maxZoomForWidth(screenWidth) {
  const m = Math.floor((screenWidth / MIN_LAYOUT_WIDTH) * 10) * 10;
  return Math.max(ZOOM_DEFAULT, Math.min(ZOOM_MAX, m));
}

export function maxZoomForScreen() {
  if (typeof window === 'undefined' || !window.screen) return ZOOM_MAX;
  const w = Math.min(window.screen.width || 0, window.screen.height || 0);
  return w > 0 ? maxZoomForWidth(w) : ZOOM_DEFAULT;
}

// Une valeur lue du stockage n'est acceptée que si c'est un multiple de 10 dans les bornes de l'écran.
export function sanitizeZoom(value, max = ZOOM_MAX) {
  const n = Number(value);
  if (!Number.isInteger(n) || n % ZOOM_STEP !== 0) return ZOOM_DEFAULT;
  if (n < ZOOM_MIN || n > Math.min(ZOOM_MAX, max)) return ZOOM_DEFAULT;
  return n;
}

export function getZoom() {
  try {
    return sanitizeZoom(localStorage.getItem(ZOOM_KEY), maxZoomForScreen());
  } catch {
    return ZOOM_DEFAULT;
  }
}

export function saveZoom(zoom) {
  try {
    if (zoom === ZOOM_DEFAULT) localStorage.removeItem(ZOOM_KEY);
    else localStorage.setItem(ZOOM_KEY, String(zoom));
  } catch { /* stockage indisponible : le zoom s'applique quand même jusqu'au prochain chargement */ }
}

// Texte de la balise viewport pour un zoom donné. Pas de « width » : le navigateur en déduit la largeur
// (largeur de l'écran ÷ zoom), ce qui reste juste quand on tourne l'appareil.
export function viewportContent(zoom) {
  const s = String(zoom / 100);
  return `initial-scale=${s}, minimum-scale=${s}, maximum-scale=${s}, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content`;
}

export function applyZoom(zoom) {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  if (!meta.dataset.base) meta.dataset.base = meta.getAttribute('content') || '';
  meta.setAttribute('content', zoom === ZOOM_DEFAULT ? meta.dataset.base : viewportContent(zoom));
}

// Ordinateur, ou écran tactile ? Seuls les écrans tactiles obéissent à la balise viewport.
export function supportsViewportZoom() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse)').matches;
}
