// Logo EcoGès : un E niché dans un G (même couleur), la barre du E devient celle du G ; le mot « EcoGès » est en tracés vectoriels
// (voir logoData.js) : aucun chargement de police, net à toutes les tailles.
//  - Wordmark  : symbole + mot (logo horizontal), height = hauteur du symbole ; tone « onLight » (fond clair) ou « onDark » (fond vert/foncé) ;
//                tagline : ajoute « GESTION SCOLAIRE » sous le mot.
//  - Monogram  : l'icône de l'appli (carré arrondi vert, symbole or).
//  - LogoSymbol: le symbole seul.
import { useId } from 'react';
import { LOGO } from './logoData.js';

const FOREST = '#0F4C3A';
const PALETTE = {
  onLight: { sym: FOREST, txt: FOREST, acc: '#D9A53A', tag: '#B38016' },
  onDark: { sym: '#EDBB55', txt: '#FAF6EC', acc: '#EDBB55', tag: '#EDBB55' },
};

function Symbole({ couleur }) {
  return (
    <>
      <path d={LOGO.symbole.anneau} fill={couleur} />
      <path d={LOGO.symbole.barre} fill={couleur} />
      <path d={LOGO.symbole.e} fill={couleur} />
    </>
  );
}

export function Wordmark({ tone = 'onLight', height = 32, className, title = 'EcoGès', style = {}, tagline = false }) {
  const c = PALETTE[tone] || PALETTE.onLight;
  const width = Math.round((height * LOGO.largeur) / 100);
  const base = tagline ? LOGO.mot.baseAvecSignature : LOGO.mot.baseSeul;
  return (
    <svg viewBox={`0 0 ${LOGO.largeur} 100`} width={width} height={height} role="img" aria-label={title} className={className} style={{ display: 'block', ...style }}>
      <Symbole couleur={c.sym} />
      <g transform={`translate(${LOGO.xTexte} ${base})`}>
        <path d={LOGO.mot.corps} fill={c.txt} />
        <path d={LOGO.mot.accent} fill={c.acc} />
      </g>
      {tagline && (
        <g transform={`translate(${LOGO.xTexte} ${LOGO.signature.base})`}>
          <path d={LOGO.signature.d} fill={c.tag} />
        </g>
      )}
    </svg>
  );
}

export function LogoSymbol({ size = 48, tone = 'onLight', className, title = 'EcoGès', style = {} }) {
  const c = PALETTE[tone] || PALETTE.onLight;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title} className={className} style={{ display: 'block', ...style }}>
      <Symbole couleur={c.sym} />
    </svg>
  );
}

export function Monogram({ size = 56, rounded = true, className, title = 'EcoGès', style = {} }) {
  const id = useId().replace(/:/g, '');
  const echelle = 0.74;
  const dec = 50 - 50 * echelle;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title} className={className} style={{ display: 'block', ...style }}>
      <defs>
        <linearGradient id={`fond-${id}`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#145540" />
          <stop offset="1" stopColor="#0A3A2C" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx={rounded ? 22.5 : 0} fill={`url(#fond-${id})`} />
      <g transform={`translate(${dec} ${dec}) scale(${echelle})`}>
        <Symbole couleur="#D9A53A" />
      </g>
    </svg>
  );
}
