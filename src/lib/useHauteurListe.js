// Hauteur maximale d'une liste qui défile dans son cadre (comme la liste des élèves) : la place restante sous son début de
// page. Sur téléphone l'en-tête est plus haut et la barre du bas prend de la place : on garde au moins ~4 lignes visibles
// (la page défile alors, comme les autres). `deps` : ce qui peut déplacer le haut de la liste (erreur, bandeau, recherche…).
import { useLayoutEffect, useRef, useState } from 'react';

export function calculerHauteurListe({ hauteurFenetre, largeurFenetre, hautListe }) {
  const telephone = largeurFenetre <= 900;
  return Math.max(telephone ? 290 : 200, Math.round(hauteurFenetre - hautListe - (telephone ? 96 : 24)));
}

export default function useHauteurListe(deps = []) {
  const ref = useRef(null);
  const [hauteur, setHauteur] = useState(null);
  useLayoutEffect(() => {
    function mesurer() {
      const liste = ref.current;
      if (!liste) return;
      const haut = liste.getBoundingClientRect().top + (document.getElementById('screen')?.scrollTop || 0);
      setHauteur(calculerHauteurListe({ hauteurFenetre: window.innerHeight, largeurFenetre: window.innerWidth, hautListe: haut }));
    }
    mesurer();
    window.addEventListener('resize', mesurer);
    return () => window.removeEventListener('resize', mesurer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [ref, hauteur];
}
