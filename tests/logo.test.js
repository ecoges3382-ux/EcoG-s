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

  it('l\'image de partage (Facebook, WhatsApp, X) fait 1200 x 630 et reste légère', () => {
    const buf = lire('og-image.jpg');
    expect(jpegTaille(buf)).toEqual({ w: 1200, h: 630 });
    expect(buf.length).toBeLessThan(300 * 1024); // WhatsApp ignore les images trop lourdes
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

  it('l\'image de partage est une adresse complète vers un fichier qui existe', () => {
    const og = html.match(/property="og:image" content="([^"]+)"/)[1];
    expect(og).toMatch(/^https:\/\//);
    expect(existsSync(publicPath(new URL(og).pathname))).toBe(true);
    expect(html).toMatch(/property="og:image:width" content="1200"/);
    expect(html).toMatch(/property="og:image:height" content="630"/);
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
  });
});
