// Tableau de bord : taux de recouvrement (payé / dû) de chaque classe, la classe la plus en retard en haut.
// Les classes sans aucun montant dû n'y figurent pas : il n'y a rien à encaisser.
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList,
} from 'recharts';
import { fmtF } from '../../lib/utils.js';

// Seuils de couleur : au moins 80 % encaissé = bien, de 50 à 79 % = à surveiller, moins de 50 % = en retard.
export const SEUIL_BIEN = 80;
export const SEUIL_ALERTE = 50;

export function couleurTaux(taux) {
  if (taux >= SEUIL_BIEN) return 'var(--success)';
  if (taux >= SEUIL_ALERTE) return 'var(--gold)';
  return 'var(--danger)';
}

// rows : [{ nom, du, paye }]. Renvoie les classes à tracer (dû > 0), triées de la plus en retard à la mieux payée.
export function recouvrementParClasse(rows) {
  return rows
    .filter((r) => Number(r.du) > 0)
    .map((r) => ({ nom: r.nom, du: Number(r.du), paye: Number(r.paye), taux: Math.min(100, Math.round((Number(r.paye) / Number(r.du)) * 100)) }))
    .sort((a, b) => a.taux - b.taux || a.nom.localeCompare(b.nom));
}

// Étiquette dessinée à la main : celle de la bibliothèque passe à la ligne quand la barre est très courte.
function EtiquetteTaux({ x, y, width, height, value }) {
  return (
    <text x={Number(x) + Number(width) + 7} y={Number(y) + Number(height) / 2} dominantBaseline="central" fontSize={12} fontWeight={700} fill="var(--ink)">
      {value} %
    </text>
  );
}

function BarTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: 'var(--ink)', padding: '8px 12px', borderRadius: 8, color: 'var(--on-ink)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, opacity: 0.7 }}>{d.nom}</p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{d.taux} %</p>
      <p style={{ margin: '3px 0 0', fontSize: 12 }}>{fmtF(d.paye)} payés sur {fmtF(d.du)}</p>
    </div>
  );
}

export default function RecouvrementChart({ rows }) {
  const data = recouvrementParClasse(rows);
  if (data.length === 0) return null;

  const totalDu = data.reduce((a, d) => a + d.du, 0);
  const totalPaye = data.reduce((a, d) => a + d.paye, 0);
  const global = totalDu > 0 ? Math.min(100, Math.round((totalPaye / totalDu) * 100)) : 0;
  const hauteur = Math.max(110, data.length * 34 + 24);
  const lecture = data.map((d) => `${d.nom} : ${d.taux} pour cent`).join(', ');

  return (
    <div className="card-bold" style={{ padding: '18px 22px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Recouvrement par classe</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>Part de l'écolage déjà payée, la classe la plus en retard en haut</p>
        </div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: couleurTaux(global) }}>Ensemble de l'école : {global} %</p>
      </div>

      <div role="img" aria-label={`Recouvrement par classe. ${lecture}.`} style={{ width: '100%', height: hauteur }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }} barCategoryGap={6}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="nom" width={92} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink)' }} interval={0} />
            <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--line)', opacity: 0.5 }} />
            <Bar dataKey="taux" radius={[0, 6, 6, 0]} background={{ fill: 'var(--line)', radius: 6 }} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.nom} fill={couleurTaux(d.taux)} />)}
              <LabelList dataKey="taux" content={EtiquetteTaux} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8, fontSize: 11.5, color: 'var(--muted)' }}>
        {[['var(--success)', `${SEUIL_BIEN} % et plus`], ['var(--gold)', `${SEUIL_ALERTE} à ${SEUIL_BIEN - 1} %`], ['var(--danger)', `moins de ${SEUIL_ALERTE} %`]].map(([c, t]) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />{t}
          </span>
        ))}
      </div>
    </div>
  );
}
