// Courbe de l'évolution de la moyenne générale d'un élève, trimestre après trimestre.
// Utilisée sur la fiche élève (équipe) et dans le portail parent. N'affiche rien tant qu'il n'y a aucune moyenne.
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, LabelList,
} from 'recharts';
import Sur20 from './Sur20.jsx';

const fmt1 = (n) => Number(n).toFixed(1).replace('.', ',');

// points : [{ name: 'T1', label: 'Trimestre 1', value: 12.4 | null }, ...]
export function trendSummary(points) {
  const valides = points.filter((p) => p.value != null);
  if (valides.length < 2) return null;
  const premier = valides[0];
  const dernier = valides[valides.length - 1];
  const ecart = dernier.value - premier.value;
  if (Math.abs(ecart) < 0.05) return { sens: 'stable', texte: `Stable depuis le ${premier.label}`, ecart: 0 };
  const signe = ecart > 0 ? '+' : '−';
  const mots = Math.abs(ecart) >= 1.95 ? 'points' : 'point';
  return {
    sens: ecart > 0 ? 'hausse' : 'baisse',
    texte: `${ecart > 0 ? 'En progrès' : 'En baisse'} : ${signe}${fmt1(Math.abs(ecart))} ${mots} depuis le ${premier.label}`,
    ecart,
  };
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload || !payload.length || payload[0].value == null) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: 'var(--ink)', padding: '8px 12px', borderRadius: 8, color: 'var(--on-ink)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, opacity: 0.7 }}>{p.label}</p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{fmt1(p.value)}<Sur20 /></p>
    </div>
  );
}

export default function GradesTrendChart({ points }) {
  const valides = points.filter((p) => p.value != null);
  if (valides.length === 0) return null;

  if (valides.length === 1) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
        Une seule période notée pour l'instant ({valides[0].label} : <strong style={{ color: 'var(--ink)' }}>{fmt1(valides[0].value)}<Sur20 /></strong>). La courbe apparaîtra dès qu'une deuxième période aura des notes.
      </p>
    );
  }

  const resume = trendSummary(points);
  const couleurResume = resume.sens === 'hausse' ? 'var(--success)' : resume.sens === 'baisse' ? 'var(--danger)' : 'var(--muted)';
  const lecture = points.map((p) => (p.value == null ? `${p.label} : pas de note` : `${p.label} : ${fmt1(p.value)} sur 20`)).join(', ');

  return (
    <div>
      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: couleurResume }}>{resume.texte}</p>
      <div role="img" aria-label={`Évolution de la moyenne générale. ${lecture}.`} style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 22, right: 18, left: -14, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
            <XAxis dataKey="name" padding={{ left: 28, right: 28 }} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} dy={8} />
            <YAxis domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
            <ReferenceLine y={10} stroke="var(--muted)" strokeDasharray="4 4" strokeOpacity={0.6} />
            <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'var(--line)', strokeWidth: 1, strokeDasharray: '3 3' }} />
            <Line
              type="linear"
              dataKey="value"
              connectNulls
              stroke="var(--forest-text)"
              strokeWidth={3}
              dot={{ r: 4, fill: 'var(--paper)', stroke: 'var(--forest-text)', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: 'var(--forest-text)' }}
              isAnimationActive={false}
            >
              <LabelList dataKey="value" position="top" offset={10} formatter={(v) => (v == null ? '' : fmt1(v))} style={{ fontSize: 11, fontWeight: 700, fill: 'var(--ink)' }} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted)' }}>Moyenne générale sur 20 · le trait pointillé marque la moyenne (10).</p>
    </div>
  );
}
