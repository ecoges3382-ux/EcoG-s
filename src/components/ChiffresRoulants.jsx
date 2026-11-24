// Chiffres qui roulent comme un compteur kilométrique (technique de la vidéo : chaque chiffre est une bande 0-9-0-9 qui défile).
// Reçoit un texte DÉJÀ formaté (« 4 850 000 F CFA », « 78 % ») : les chiffres roulent, le reste reste fixe. Quand le texte change plus tard,
// chaque colonne roule de sa position actuelle vers le nouveau chiffre. En mode « réduit », le texte s'affiche tel quel, sans mouvement.
import { useEffect, useMemo, useRef, useState } from 'react';
import { decouperTexte, positionCible, positionEn, useModeAnimations } from '../lib/animations.js';

const BANDE = Array.from({ length: 20 }, (_, i) => i % 10);

function Colonne({ chiffre, depart = 0, duree, retard }) {
  const [pos, setPos] = useState(depart);
  const posRef = useRef(depart);
  useEffect(() => {
    const cible = positionCible(chiffre);
    const debutPos = posRef.current;
    if (debutPos === cible) return undefined;
    let raf; let t0 = null;
    const tick = (t) => {
      if (t0 === null) t0 = t;
      const p = Math.min(1, Math.max(0, (t - t0 - retard) / duree));
      const v = positionEn(debutPos, cible, p);
      posRef.current = v; setPos(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else { posRef.current = cible; setPos(cible); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [chiffre, duree, retard]);
  // Un chiffre invisible fixe la largeur ET la ligne de base de la colonne : le chiffre qui roule reste aligné avec le reste du texte
  // (« F CFA », points des milliers). La découpe se fait par clip-path et non par overflow, qui déplacerait la ligne de base vers le bas.
  return (
    <span style={{ position: 'relative', display: 'inline-block', textAlign: 'center', userSelect: 'none', clipPath: 'inset(0)' }}>
      <span style={{ visibility: 'hidden' }}>0</span>
      <span style={{ position: 'absolute', left: 0, right: 0, top: 0, transform: `translateY(${-pos * 5}%)`, willChange: 'transform' }}>
        {BANDE.map((n, i) => <span key={i} style={{ display: 'block' }}>{n}</span>)}
      </span>
    </span>
  );
}

export default function ChiffresRoulants({ texte, duree = 1100, decalage = 35 }) {
  const mode = useModeAnimations();
  const morceaux = useMemo(() => decouperTexte(texte), [texte]);
  if (mode === 'reduit') return <>{texte}</>;
  return (
    <span style={{ whiteSpace: 'pre', fontVariantNumeric: 'tabular-nums' }}>
      <span className="sr-only">{texte}</span>
      <span aria-hidden="true">
        {morceaux.map((m) => (m.chiffre === null
          ? <span key={m.cle}>{m.c}</span>
          : <Colonne key={m.cle} chiffre={m.chiffre} duree={duree} retard={Math.min(m.cle - 1, 10) * decalage} />))}
      </span>
    </span>
  );
}
