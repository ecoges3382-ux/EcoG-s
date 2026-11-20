// Logo EcoGès : toutes les images référencées existent, ont la bonne taille, et le logo vectoriel est complet.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { LOGO } from '../src/components/logoData.js';

const publicPath = (p) => new URL('../public/' + p.replace(/^\//, ''), import.meta.url);
const lire = (p) => readFileSync(publicPath(p));
const pngTaille = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
function jpegTaille(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marqueur = buf[i + 1];
    const longueur = buf.readUInt16BE(i + 2);
    if (marqueur >= 0xc0 && marqueur <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marqueur)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + longueur;
  }
  return null;
}

describe('logo vectoriel', () => {
  it('contient le symbole (anneau, barre, E), le mot en tracés avec son accent, et la signature', () => {
    for (const d of [LOGO.symbole.anneau, LOGO.symbole.barre, LOGO.symbole.e, LOGO.mot.corps, LOGO.mot.accent, LOGO.signature.d]) {
      expect(typeof d).toBe('string');
      expect(d.length).toBeGreaterThan(10);
      expect(d).toMatch(/^M/);
    }
  });

  it('le logo horizontal est plus large que haut, la signature est sous le mot', () => {
    expect(LOGO.largeur).toBeGreaterThan(250);
    expect(LOGO.signature.base).toBeGreaterThan(LOGO.mot.baseAvecSignature);
  });
});

describe('icônes et images de partage', () => {
  it.each([
    ['pwa-192x192.png', 192, 192], ['pwa-512x512.png', 512, 512], ['icons/icon-maskable-512.png', 512, 512],
    ['apple-touch-icon.png', 180, 180], ['badge-96x96.png', 96, 96], ['brand/monogram-1024.png', 1024, 1024],
  ])('%s fait bien %s x %s', (fichier, w, h) => {
    expect(pngTaille(lire(fichier))).toEqual({ w, h });
  });

  it('l\'image de partage par défaut (WhatsApp, X…) est carrée (1200 x 1200) et reste légère', () => {
    const buf = lire('og-image.jpg');
    expect(jpegTaille(buf)).toEqual({ w: 1200, h: 1200 });
    expect(buf.length).toBeLessThan(300 * 1024); // WhatsApp ignore les images trop lourdes
  });

  it('l\'image de partage Facebook est le logo rectangulaire (1200 x 630) et reste légère', () => {
    const buf = lire('og-facebook.jpg');
    expect(jpegTaille(buf)).toEqual({ w: 1200, h: 630 });
    expect(buf.length).toBeLessThan(300 * 1024);
  });

  it('favicon.ico contient les tailles 16, 32 et 48', () => {
    const ico = lire('favicon.ico');
    expect(ico.readUInt16LE(2)).toBe(1); // type icône
    const n = ico.readUInt16LE(4);
    const tailles = Array.from({ length: n }, (_, i) => ico[6 + 16 * i] || 256);
    expect(tailles).toEqual([16, 32, 48]);
  });

  it('les icônes sans transparence inutile : pas de PNG de plus de 60 Ko (les dégradés alourdissent le cache de l\'appli)', () => {
    for (const f of ['pwa-192x192.png', 'pwa-512x512.png', 'icons/icon-maskable-512.png', 'apple-touch-icon.png', 'badge-96x96.png']) {
      expect(lire(f).length).toBeLessThan(60 * 1024);
    }
  });
});

describe('références dans index.html et le manifeste', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const vite = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');

  it('l\'image de partage est une adresse complète, servie selon le robot (WhatsApp, Facebook, autres)', () => {
    const og = html.match(/property="og:image" content="([^"]+)"/)[1];
    expect(og).toMatch(/^https:\/\//);
    const chemin = new URL(og).pathname;
    expect(existsSync(publicPath(chemin))).toBe(false); // pas un vrai fichier : vercel.json choisit l'image
    // pas de largeur/hauteur annoncées : elles seraient fausses pour l'une des deux images
    expect(html).not.toMatch(/og:image:(width|height)/);
    const regles = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')).rewrites;
    const celles = regles.filter((r) => r.source === chemin);
    const ua = (r) => (r.has && r.has[0].value) || null;
    const cible = (agent) => (celles.find((r) => !r.has || new RegExp(r.has[0].value).test(agent)) || {}).destination;
    // WhatsApp peut se présenter aussi comme Facebook : il doit tomber sur l'image carrée
    expect(cible('WhatsApp/2.24.1 A')).toBe('/og-image.jpg');
    expect(cible('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php) WhatsApp/2.24')).toBe('/og-image.jpg');
    expect(cible('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe('/og-facebook.jpg');
    expect(cible('Facebot')).toBe('/og-facebook.jpg');
    expect(cible('Twitterbot/1.0')).toBe('/og-image.jpg');
    expect(cible('')).toBe('/og-image.jpg');
    for (const r of celles) expect(existsSync(publicPath(r.destination))).toBe(true);
    expect(celles.some((r) => ua(r) === null)).toBe(true); // une règle par défaut existe
    // ces règles passent avant celle qui renvoie tout le reste vers l'application
    const iPartage = regles.findIndex((r) => r.source === chemin);
    const iApplication = regles.findIndex((r) => r.destination === '/index.html');
    expect(iPartage).toBeLessThan(iApplication);
    expect(html).toMatch(/name="twitter:card" content="summary"/); // image carrée : carte « summary », pas « summary_large_image »
    expect(html).toContain(`name="twitter:image" content="${og}"`);
  });

  it('le favicon et l\'icône Apple existent', () => {
    for (const m of html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)) {
      expect(existsSync(publicPath(m[1]))).toBe(true);
    }
  });

  it('chaque icône du manifeste existe', () => {
    const icones = [...vite.matchAll(/src: '([^']+\.png)'/g)].map((m) => m[1]);
    expect(icones.length).toBeGreaterThanOrEqual(3);
    for (const i of icones) expect(existsSync(publicPath(i))).toBe(true);
  });

  it('l\'image de partage n\'est pas préchargée dans le cache de l\'appli (inutile hors ligne)', () => {
    expect(vite).toContain("'og-image.jpg'");
    expect(vite).toContain("'og-facebook.jpg'");
  });
});
