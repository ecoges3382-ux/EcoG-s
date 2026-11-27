// Le vert WhatsApp (#25D366) et l'orange des relances (#ff8c00) sont clairs : du texte BLANC dessus se lit mal (contraste d'environ 2 pour 1).
// Les boutons posés sur ces couleurs utilisent la couleur foncée --wa-icon. Ce test empêche le blanc d'y revenir et vérifie le contraste réel.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const RACINE = path.resolve(import.meta.dirname, '..');
const VERT = '#25D366';
const ORANGE = '#ff8c00';

function fichiers(dossier) {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = path.join(dossier, e.name);
    if (e.isDirectory()) return fichiers(chemin);
    return /\.(jsx?|css)$/.test(e.name) ? [chemin] : [];
  });
}

const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
};
const contraste = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe('texte sur le vert WhatsApp', () => {
  it('aucun texte ou icône blanc posé sur le vert WhatsApp', () => {
    const fautifs = [];
    for (const f of fichiers(path.join(RACINE, 'src'))) {
      fs.readFileSync(f, 'utf8').split('\n').forEach((ligne, i) => {
        if (!/25d366/i.test(ligne)) return;
        const blanc = /color:\s*['"]?(#fff\b|#ffffff|white)/i.test(ligne) || /25d366['"],\s*['"](#fff|#ffffff|white)['"]/i.test(ligne);
        // la bordure ou le point de présence en ligne ne portent pas de texte
        const surBouton = /background:\s*['"]?#25D366/i.test(ligne) || /actionBtnStyle\(['"]#25D366/i.test(ligne) || /background:\s*#25D366/i.test(ligne);
        if (blanc && surBouton) fautifs.push(`${path.relative(RACINE, f)}:${i + 1}`);
      });
    }
    expect(fautifs, 'du blanc sur le vert WhatsApp : utiliser color: var(--wa-icon)').toEqual([]);
  });

  it('aucun texte blanc posé sur l’orange des boutons de relance', () => {
    const fautifs = [];
    for (const f of fichiers(path.join(RACINE, 'src'))) {
      fs.readFileSync(f, 'utf8').split('\n').forEach((ligne, i) => {
        if (!/ff8c00/i.test(ligne)) return;
        // « background: … ? '#ff8c00' : … , color: … ? '#fff' : … » : le blanc suit l'orange dans la même condition
        if (/ff8c00['"]\s*:[^,]*,\s*color:\s*[^,]*\?\s*['"](#fff|#ffffff|white)['"]/i.test(ligne) || /background:\s*['"]?#ff8c00['"]?,\s*color:\s*['"](#fff|#ffffff|white)['"]/i.test(ligne)) fautifs.push(`${path.relative(RACINE, f)}:${i + 1}`);
      });
    }
    expect(fautifs, 'du blanc sur l’orange : utiliser color: var(--wa-icon)').toEqual([]);
  });

  it('blanc sur ce vert ou sur cet orange : contraste insuffisant (pourquoi on ne le fait pas)', () => {
    expect(contraste('#FFFFFF', VERT)).toBeLessThan(2.5);
    expect(contraste('#FFFFFF', ORANGE)).toBeLessThan(2.5);
  });

  it('la couleur foncée choisie est très lisible sur ce vert, en mode clair comme en mode sombre', () => {
    const css = fs.readFileSync(path.join(RACINE, 'src/styles.css'), 'utf8');
    const ink = css.match(/:root\s*\{[^}]*--ink:\s*(#[0-9A-Fa-f]{6})/)[1];
    const sombre = css.match(/html\.dark-mode, body\.dark-mode \{[^}]*--wa-icon:\s*(#[0-9A-Fa-f]{6})/)[1];
    expect(contraste(ink, VERT)).toBeGreaterThanOrEqual(7);
    expect(contraste(sombre, VERT)).toBeGreaterThanOrEqual(7);
    // sur l'orange, plus sombre que le vert : au moins 4,5 (seuil de lisibilité d'un texte courant)
    expect(contraste(ink, ORANGE)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(sombre, ORANGE)).toBeGreaterThanOrEqual(4.5);
  });
});
