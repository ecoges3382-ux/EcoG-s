// Zoom d'affichage : bornes, validation de ce qui est lu du stockage, texte de la balise viewport, et cohérence entre
// src/lib/zoom.js et le petit script de index.html qui applique le zoom avant le premier affichage.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { maxZoomForWidth, sanitizeZoom, viewportContent, applyZoom, ZOOM_DEFAULT } from '../src/lib/zoom.js';

const BASE = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content';

function fauxDocument() {
  const attrs = { content: BASE };
  const meta = {
    dataset: {},
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    setAttribute: (k, v) => { attrs[k] = v; if (k.startsWith('data-')) meta.dataset[k.slice(5)] = v; },
  };
  return { meta, document: { querySelector: (sel) => (sel === 'meta[name="viewport"]' ? meta : null) } };
}

describe('zoom maximal selon la largeur de l\'écran', () => {
  it('garde au moins 320 px de mise en page', () => {
    expect(maxZoomForWidth(390)).toBe(120);  // iPhone récent : 390 / 1,2 = 325 px
    expect(maxZoomForWidth(375)).toBe(110);
    expect(maxZoomForWidth(360)).toBe(110);
    expect(maxZoomForWidth(320)).toBe(100);
    expect(maxZoomForWidth(768)).toBe(150);  // tablette : plafond général
    expect(maxZoomForWidth(1920)).toBe(150);
  });
  it('jamais en dessous de 100 %, même sur un très petit écran', () => {
    expect(maxZoomForWidth(280)).toBe(100);
  });
});

describe('valeur lue du stockage', () => {
  it('accepte seulement un multiple de 10 entre 80 et le maximum de l\'écran', () => {
    expect(sanitizeZoom('110', 120)).toBe(110);
    expect(sanitizeZoom('80', 120)).toBe(80);
    expect(sanitizeZoom('120', 120)).toBe(120);
  });
  it('refuse le reste et retombe sur 100 %', () => {
    for (const v of ['130', '70', '115', '1.2', 'abc', '', null, undefined, '-100', '1000']) expect(sanitizeZoom(v, 120), String(v)).toBe(ZOOM_DEFAULT);
  });
  it('un zoom trop grand pour CET écran est ignoré (écran plus petit que celui où il a été réglé)', () => {
    expect(sanitizeZoom('150', 110)).toBe(ZOOM_DEFAULT);
  });
});

describe('balise viewport', () => {
  it('sans « width » : la largeur se déduit du zoom, et reste juste en tournant l\'appareil', () => {
    const c = viewportContent(120);
    expect(c).toContain('initial-scale=1.2');
    expect(c).toContain('minimum-scale=1.2');
    expect(c).toContain('maximum-scale=1.2');
    expect(c).not.toMatch(/width=/);
    expect(c).toContain('viewport-fit=cover');
    expect(c).toContain('interactive-widget=resizes-content'); // indispensable au clavier mobile
  });

  it('applyZoom change la balise, et 100 % rétablit la balise d\'origine exactement', () => {
    const { meta, document } = fauxDocument();
    globalThis.document = document;
    try {
      applyZoom(120);
      expect(meta.getAttribute('content')).toBe(viewportContent(120));
      applyZoom(90);
      expect(meta.getAttribute('content')).toBe(viewportContent(90));
      applyZoom(100);
      expect(meta.getAttribute('content')).toBe(BASE);
    } finally { delete globalThis.document; }
  });
});

describe('le script de index.html applique le même zoom que src/lib/zoom.js', () => {
  const html = fs.readFileSync(path.resolve(import.meta.dirname, '../index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?ecoges_zoom[\s\S]*?)<\/script>/)[1];

  function executer(valeurStockee, largeurEcran) {
    const { meta, document } = fauxDocument();
    const fenetre = { localStorage: { getItem: () => valeurStockee }, screen: { width: largeurEcran, height: 844 }, document };
    new Function('localStorage', 'screen', 'document', script)(fenetre.localStorage, fenetre.screen, fenetre.document);
    return meta.getAttribute('content');
  }

  it('même texte de balise que viewportContent', () => {
    for (const z of [80, 90, 110, 120]) expect(executer(String(z), 390), `zoom ${z}`).toBe(viewportContent(z));
  });
  it('aucun changement à 100 % ou sans valeur enregistrée', () => {
    expect(executer(null, 390)).toBe(BASE);
    expect(executer('100', 390)).toBe(BASE);
  });
  it('mêmes refus que sanitizeZoom : valeur invalide, ou trop grande pour l\'écran', () => {
    for (const v of ['115', 'abc', '70', '160']) expect(executer(v, 390), v).toBe(BASE);
    expect(executer('130', 390)).toBe(BASE); // 390 px : maximum 120 %
    expect(executer('150', 768)).toBe(viewportContent(150));
  });
  it('mêmes limites d\'écran que maxZoomForWidth (hors rotation : la plus petite dimension compte)', () => {
    for (const w of [320, 360, 375, 390, 430, 768]) {
      const max = maxZoomForWidth(Math.min(w, 844));
      expect(executer(String(max), w) === viewportContent(max) || max === 100, `largeur ${w}`).toBe(true);
      if (max < 150) expect(executer(String(max + 10), w), `largeur ${w}, ${max + 10}`).toBe(BASE);
    }
  });
});
