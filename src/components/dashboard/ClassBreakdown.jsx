import { Link } from 'react-router-dom';
import { fmtF, downloadCsv, stickyColStyle } from '../../lib/utils.js';
import RecouvrementChart from './RecouvrementChart.jsx';
import { virgule } from '../../lib/formatNote.js';
import Sur20 from '../Sur20.jsx';

export default function ClassBreakdown({ students, attendance, classResults, finance = true }) {
  // Sans accès aux finances : ni dû, ni reste, ni taux de recouvrement — seulement effectif, présences et moyennes
  const colonnes = finance ? '1.1fr 0.7fr 1.1fr 0.9fr 1fr 0.9fr' : '1.1fr 0.7fr 1fr 0.9fr';
  const attendanceByStudent = new Map();
  (attendance || []).forEach((r) => {
    const c = attendanceByStudent.get(r.student_id) || { absent: 0, retard: 0, present: 0 };
    c[r.statut] = (c[r.statut] || 0) + 1;
    attendanceByStudent.set(r.student_id, c);
  });

  const resultsByClasse = new Map((classResults || []).map((c) => [c.classe_id, c]));

  const byClasse = new Map();
  students.forEach((s) => {
    const key = s.classeId || s.niveau;
    if (!byClasse.has(key)) byClasse.set(key, { nom: s.niveau, effectif: 0, du: 0, paye: 0, absent: 0, retard: 0, present: 0, classeId: s.classeId });
    const c = byClasse.get(key);
    c.effectif += 1;
    c.du += Number(s.montant_du);
    c.paye += Number(s.montant_paye);
    const att = attendanceByStudent.get(s.id);
    if (att) { c.absent += att.absent || 0; c.retard += att.retard || 0; c.present += att.present || 0; }
  });

  const rows = [...byClasse.values()].sort((a, b) => a.nom.localeCompare(b.nom));

  function exportCsv() {
    const header = finance
      ? ['Classe', 'Effectif', 'Dû', 'Payé', 'Reste', 'Taux de recouvrement', 'Absences', 'Retards', 'Moyenne générale']
      : ['Classe', 'Effectif', 'Absences', 'Retards', 'Moyenne générale'];
    const lines = rows.map((r) => {
      const reste = r.du - r.paye;
      const taux = r.du > 0 ? Math.round((r.paye / r.du) * 100) : 0;
      const moyenne = resultsByClasse.get(r.classeId)?.moyenne_generale;
      const moy = moyenne != null ? Number(moyenne).toFixed(2) : '';
      return finance ? [r.nom, r.effectif, r.du, r.paye, reste, `${taux}%`, r.absent, r.retard, moy] : [r.nom, r.effectif, r.absent, r.retard, moy];
    });
    downloadCsv('repartition-par-classe.csv', [header, ...lines]);
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>Répartition par classe</p>
        <button onClick={exportCsv} style={{ fontSize: '11.5px', fontWeight: 600, padding: '7px 13px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}>
          <i className="ti ti-upload" style={{ fontSize: 13, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>Export CSV
        </button>
      </div>
      {finance && <RecouvrementChart rows={rows} />}
      <div className="card-bold" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 680 }}>
          <div style={{ display: 'grid', gridTemplateColumns: colonnes, gap: 10, padding: '11px 18px 11px 0', background: 'var(--forest-light)', fontSize: 11, fontWeight: 700, color: 'var(--forest-dark-text)', textTransform: 'uppercase' }}>
            <span style={{ ...stickyColStyle('var(--forest-light)'), paddingLeft: 18 }}>Classe</span><span>Effectif</span>{finance && <><span>Reste dû</span><span>Recouvrement</span></>}<span style={{ overflowWrap: 'break-word' }}>Absences/retards</span><span>Moyenne</span>
          </div>
          {rows.map((r, i) => {
            const reste = r.du - r.paye;
            const taux = r.du > 0 ? Math.round((r.paye / r.du) * 100) : 0;
            const cr = resultsByClasse.get(r.classeId);
            return (
              <Link
                key={r.nom}
                to="/eleves"
                className="row-link"
                style={{ display: 'grid', gridTemplateColumns: colonnes, gap: 10, padding: '11px 18px 11px 0', alignItems: 'center', borderTop: i > 0 ? '1px solid var(--line)' : 'none', fontSize: 13, textDecoration: 'none', color: 'inherit' }}
              >
                <span style={{ fontWeight: 600, ...stickyColStyle('var(--row-bg)'), paddingLeft: 18 }}>{r.nom}</span>
                <span>{r.effectif}</span>
                {finance && <><span style={{ color: reste > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{fmtF(reste)}</span><span>{taux}%</span></>}
                <span>{r.absent} / {r.retard}</span>
                <span>{cr?.moyenne_generale != null ? <>{virgule(cr.moyenne_generale, 2)}<Sur20 /></> : '—'}</span>
              </Link>
            );
          })}
          {rows.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucune classe avec des élèves inscrits cette année.</p>}
        </div>
      </div>
    </div>
  );
}
