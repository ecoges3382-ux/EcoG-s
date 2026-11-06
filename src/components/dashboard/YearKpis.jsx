import { Link } from 'react-router-dom';
import { fmtF } from '../../lib/utils.js';
import { Stat } from './DashboardUI.jsx';

export default function YearKpis({ students, attendance, classResults }) {
  const totalDu = students.reduce((a, s) => a + Number(s.montant_du), 0);
  const totalPaye = students.reduce((a, s) => a + Number(s.montant_paye), 0);
  const totalReste = totalDu - totalPaye;
  const tauxRecouv = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;
  const nbAJour = students.filter((s) => Number(s.montant_du) - Number(s.montant_paye) <= 0).length;
  const nbAvecSolde = students.length - nbAJour;

  const counts = { present: 0, absent: 0, retard: 0 };
  (attendance || []).forEach((r) => { counts[r.statut] = (counts[r.statut] || 0) + 1; });
  const totalAppels = (attendance || []).length;
  const tauxPresence = totalAppels > 0 ? Math.round(((counts.present + counts.retard) / totalAppels) * 100) : null;

  const avecNotes = (classResults || []).reduce((a, c) => a + Number(c.nb_avec_notes || 0), 0);
  const moyennesPonderees = (classResults || []).filter((c) => c.moyenne_generale != null);
  const moyenneEcole = moyennesPonderees.length > 0
    ? moyennesPonderees.reduce((a, c) => a + Number(c.moyenne_generale) * Number(c.nb_avec_notes), 0) / moyennesPonderees.reduce((a, c) => a + Number(c.nb_avec_notes), 0)
    : null;

  return (
    <>
      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 18 }}>
        <Link to="/recouvrement" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }} title="Voir le recouvrement détaillé">
          <div className="card-bold stat-in" style={{ padding: '22px 24px', background: 'var(--forest)', borderColor: 'var(--forest)', color: '#fff', cursor: 'pointer', height: '100%' }}>
            <p style={{ margin: '0 0 6px', fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: 600 }}>Taux de recouvrement</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
              <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 46, fontWeight: 700, lineHeight: 1 }}>{tauxRecouv}%</p>
              <p style={{ margin: 0, fontSize: '13.5px', color: 'rgba(255,255,255,0.65)' }}>de {fmtF(totalDu)} attendus</p>
            </div>
            <div style={{ height: 9, background: 'rgba(255,255,255,0.18)', borderRadius: 8, overflow: 'hidden' }}>
              <div className="fill-bar" style={{ height: '100%', width: `${tauxRecouv}%`, background: 'var(--gold)' }}></div>
            </div>
          </div>
        </Link>
        <Link to="/eleves" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }} title="Voir la liste des élèves">
          <div className="card-bold stat-in" style={{ padding: '22px 24px', cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Effectif global</p>
            <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 38, fontWeight: 700 }}>{students.length}</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>élève{students.length > 1 ? 's' : ''} inscrit{students.length > 1 ? 's' : ''}</p>
          </div>
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }} className="desktop-grid-3">
        <Stat label="Encaissé" value={fmtF(totalPaye)} color="var(--success)" to="/recouvrement" />
        <Stat label="Reste à recouvrer" value={fmtF(totalReste)} color="var(--danger)" to="/recouvrement?statut=avec_solde" />
        <Stat label="Élèves à jour / avec solde" value={`${nbAJour} / ${nbAvecSolde}`} to="/recouvrement" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 26 }} className="desktop-grid-3">
        <Stat label="Taux de présence" value={tauxPresence != null ? `${tauxPresence}%` : '—'} color="var(--success)" to="/presences" />
        <Stat label="Absences / retards" value={`${counts.absent} / ${counts.retard}`} color={counts.absent > 0 ? 'var(--danger)' : undefined} to="/presences" />
        <Stat
          label="Moyenne générale de l'école"
          value={moyenneEcole != null ? `${moyenneEcole.toFixed(2)}/20` : '—'}
          sub={classResults ? `${avecNotes} élève${avecNotes > 1 ? 's' : ''} avec notes` : undefined}
          to="/bulletins"
        />
      </div>
    </>
  );
}
