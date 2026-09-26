// Applique la couleur principale choisie par l'école (Paramètres →
// Identité de l'établissement) aux variables CSS du thème — jusqu'ici le
// champ enregistrait bien schools.color en base, mais rien ne le relisait
// pour l'appliquer à l'écran : changer la couleur n'avait strictement
// aucun effet visible. --forest-dark/--forest-light sont dérivées de la
// couleur choisie (assombrie/éclaircie) puisque le sélecteur ne capture
// qu'une seule teinte alors que le thème en utilise trois.
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

// Mélange vers le noir (amount>0 = assombrir) ou le blanc (éclaircir).
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
