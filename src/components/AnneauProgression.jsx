// Anneau de progression qui se remplit (technique de la vidéo : strokeDashoffset de C vers C × (1 − part), 1,9 s, courbe douce).
// Le contenu (le pourcentage, par exemple) se place au centre. En mode « réduit », l'anneau s'affiche directement rempli.
export default function AnneauProgression({ pct, taille = 96, epaisseur = 10, couleur = 'var(--gold)', fond = 'rgba(255,255,255,0.18)', children, titre }) {
  const part = Math.min(100, Math.max(0, Number(pct) || 0)) / 100;
  const r = (taille - epaisseur) / 2;
  const C = 2 * Math.PI * r;
  return (
    <div role="img" aria-label={titre || `${Math.round(part * 100)} %`} style={{ position: 'relative', width: taille, height: taille, flexShrink: 0 }}>
      <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} style={{ transform: 'rotate(-90deg)', display: 'block' }} aria-hidden="true">
        <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke={fond} strokeWidth={epaisseur} />
        <circle className="anneau-arc" cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke={couleur} strokeWidth={epaisseur} strokeLinecap="round"
          style={{ '--c': C, '--cible': C * (1 - part), strokeDasharray: C, strokeDashoffset: C * (1 - part) }} />
      </svg>
      {children && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>}
    </div>
  );
}
