// Répartition filles / garçons en camembert « 3D » (dessiné en SVG : la bibliothèque de graphiques n'a pas de 3D).
// Les pourcentages sont écrits sur chaque part : l'effet de perspective grossit visuellement les parts de devant,
// c'est le chiffre qui fait foi.

const COLORS = {
  'Garçons': { top: '#4A90E2', light: '#8FC0F5', side: '#2D6AB3' },
  'Filles': { top: '#E26D8A', light: '#F5A6BB', side: '#B24663' },
  'Non renseigné': { top: '#999999', light: '#C4C4C4', side: '#6E6E6E' },
};

// Dimensions de la vue (le SVG s'adapte à la largeur de la carte).
const CX = 150;
const CY = 70;
const RX = 108;   // rayon horizontal du dessus
const RY = 54;    // rayon vertical du dessus (la perspective)
const DEPTH = 30; // épaisseur du camembert

const RAD = Math.PI / 180;
// Angle en degrés, 0 = en haut, sens des aiguilles d'une montre.
const pt = (deg, k = 1, dy = 0) => [CX + RX * k * Math.sin(deg * RAD), CY - RY * k * Math.cos(deg * RAD) + dy];
const f = (n) => n.toFixed(2);

// Dessus d'une part. Une part de 360° (tous les élèves du même type) devient une ellipse complète.
function topPath(a0, a1) {
  if (a1 - a0 >= 359.99) {
    return `M ${f(CX - RX)} ${f(CY)} A ${RX} ${RY} 0 1 1 ${f(CX + RX)} ${f(CY)} A ${RX} ${RY} 0 1 1 ${f(CX - RX)} ${f(CY)} Z`;
  }
  const [x0, y0] = pt(a0);
  const [x1, y1] = pt(a1);
  return `M ${CX} ${CY} L ${f(x0)} ${f(y0)} A ${RX} ${RY} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)} Z`;
}

// Tranche visible de l'épaisseur : seulement la moitié avant (de 90° à 270°).
function wallPath(a0, a1) {
  const s = Math.max(a0, 90);
  const e = Math.min(a1, 270);
  if (e <= s) return null;
  const [x0, y0] = pt(s);
  const [x1, y1] = pt(e);
  return `M ${f(x0)} ${f(y0)} A ${RX} ${RY} 0 0 1 ${f(x1)} ${f(y1)} L ${f(x1)} ${f(y1 + DEPTH)} A ${RX} ${RY} 0 0 0 ${f(x0)} ${f(y0 + DEPTH)} Z`;
}

export default function DemographicsSection({ students }) {
  const boys = students.filter((s) => s.sexe === 'M').length;
  const girls = students.filter((s) => s.sexe === 'F').length;
  const other = students.length - boys - girls;

  const data = [
    { name: 'Garçons', value: boys },
    { name: 'Filles', value: girls },
  ];
  if (other > 0) data.push({ name: 'Non renseigné', value: other });

  const total = students.length;

  // Parts à dessiner (les valeurs à zéro n'ont pas de part, mais restent dans la légende).
  let cursor = 0;
  const slices = total === 0 ? [] : data.filter((d) => d.value > 0).map((d) => {
    const angle = (d.value / total) * 360;
    const slice = { ...d, a0: cursor, a1: cursor + angle, pct: Math.round((d.value / total) * 100) };
    cursor += angle;
    return slice;
  });

  const resume = data.map((d) => `${d.name} : ${d.value}`).join(', ');

  return (
    <div className="card-bold" style={{ padding: '20px 24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Répartition Filles / Garçons</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>Démographie de l'école</p>
      </div>

      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
        {total === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>Aucun élève inscrit.</p>
        ) : (
          <svg
            viewBox="0 0 300 170"
            role="img"
            aria-label={`Répartition des élèves. ${resume}.`}
            style={{ width: '100%', maxWidth: 380, height: 'auto', marginTop: 6 }}
          >
            <defs>
              {slices.map((s) => (
                <linearGradient key={s.name} id={`demo-top-${s.name === 'Garçons' ? 'g' : s.name === 'Filles' ? 'f' : 'n'}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS[s.name].light} />
                  <stop offset="100%" stopColor={COLORS[s.name].top} />
                </linearGradient>
              ))}
            </defs>

            {/* ombre posée au sol */}
            <ellipse cx={CX} cy={CY + DEPTH + 6} rx={RX * 0.98} ry={RY} fill="#000" opacity="0.12" />

            {/* tranche (épaisseur), puis dessus : la tranche passe derrière le dessus */}
            {slices.map((s) => {
              const d = wallPath(s.a0, s.a1);
              return d ? <path key={`w-${s.name}`} d={d} fill={COLORS[s.name].side} /> : null;
            })}
            {slices.map((s) => {
              const mid = (s.a0 + s.a1) / 2;
              const [lx, ly] = pt(mid, 0.62);
              const id = s.name === 'Garçons' ? 'g' : s.name === 'Filles' ? 'f' : 'n';
              return (
                <g key={`t-${s.name}`}>
                  <title>{`${s.name} : ${s.value} élève${s.value > 1 ? 's' : ''} (${s.pct} %)`}</title>
                  <path d={topPath(s.a0, s.a1)} fill={`url(#demo-top-${id})`} stroke="var(--paper)" strokeWidth="2" strokeLinejoin="round" />
                  {s.pct >= 5 && (
                    <text x={f(lx)} y={f(ly)} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="700" style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.28)', strokeWidth: 2.5 }}>
                      {s.pct}%
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10, flexWrap: 'wrap' }}>
        {data.map((d) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[d.name].top }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{d.name}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>({d.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
