// Couleur personnelle : chaque utilisateur a la sienne (mémorisée sous son nom), sans effet sur les autres ; une couleur trop claire
// est foncée pour que le texte blanc reste lisible.
import { describe, it, expect, beforeEach, vi } from 'vitest';

function installerStockage() {
  const magasin = new Map();
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', {
    getItem: (k) => (magasin.has(k) ? magasin.get(k) : null),
    setItem: (k, v) => { magasin.set(k, String(v)); },
    removeItem: (k) => { magasin.delete(k); },
  });
  return magasin;
}

describe('couleur personnelle', () => {
  let theme;
  beforeEach(async () => {
    installerStockage();
    theme = await import('../src/lib/theme.js');
  });

  it('sans choix, aucune couleur personnelle (c’est celle de l’école qui s’applique)', () => {
    expect(theme.couleurPersonnelle('u1')).toBeNull();
  });

  it('chaque utilisateur garde sa couleur sans toucher à celle des autres', () => {
    theme.enregistrerCouleurPersonnelle('u1', '#1D4ED8');
    theme.enregistrerCouleurPersonnelle('u2', '#B91C1C');
    expect(theme.couleurPersonnelle('u1')).toBe('#1d4ed8');
    expect(theme.couleurPersonnelle('u2')).toBe('#b91c1c');
    expect(theme.couleurPersonnelle('u3')).toBeNull();
  });

  it('revenir à la couleur de l’école efface seulement le choix de cet utilisateur', () => {
    theme.enregistrerCouleurPersonnelle('u1', '#1D4ED8');
    theme.enregistrerCouleurPersonnelle('u2', '#B91C1C');
    theme.enregistrerCouleurPersonnelle('u1', null);
    expect(theme.couleurPersonnelle('u1')).toBeNull();
    expect(theme.couleurPersonnelle('u2')).toBe('#b91c1c');
  });

  it('une couleur invalide est ignorée', () => {
    expect(theme.enregistrerCouleurPersonnelle('u1', 'rouge')).toBeNull();
    expect(theme.couleurPersonnelle('u1')).toBeNull();
    expect(theme.couleurLisible('#12')).toBeNull();
  });

  it('une valeur abîmée dans le stockage est ignorée', () => {
    localStorage.setItem('ecoges_couleur_u1', 'n’importe quoi');
    expect(theme.couleurPersonnelle('u1')).toBeNull();
  });

  it('une couleur trop claire est foncée pour que le texte blanc reste lisible, une couleur foncée reste telle quelle', () => {
    expect(theme.couleurLisible('#0F4C3A')).toBe('#0f4c3a');
    const jaune = theme.couleurLisible('#FFEB3B');
    expect(jaune).not.toBe('#ffeb3b');
    // contraste avec le blanc d'au moins 4,5
    const lum = (hex) => { const n = parseInt(hex.slice(1), 16); const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
    expect(1.05 / (lum(jaune) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it('toutes les couleurs proposées sont déjà lisibles avec du texte blanc (elles ne sont pas modifiées)', () => {
    for (const c of theme.COULEURS_PROPOSEES) expect(theme.couleurLisible(c.hex)).toBe(c.hex.toLowerCase());
  });

  it('le mode clair/sombre reste propre à chaque utilisateur', () => {
    localStorage.setItem('ecoges_theme_u1', 'dark');
    localStorage.setItem('ecoges_theme_u2', 'light');
    expect(theme.getInitialTheme('u1')).toBe('dark');
    expect(theme.getInitialTheme('u2')).toBe('light');
  });
});
