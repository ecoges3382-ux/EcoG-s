import { useAuth } from '../../auth/AuthProvider.jsx';
import { fmtF, stickyColStyle } from '../../lib/utils.js';
import { useSelectedSchoolYear } from '../../lib/schoolYear.jsx';
import { computeRelance } from '../../lib/retard.js';
import { useEnrollmentsForYear } from '../../lib/enrollments.js';
import { SkeletonTableRows } from '../../components/Skeleton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { translateError } from '../../lib/errors.js';
import { UsersIcon } from './icons.jsx';

export default function FraisConnexes() {
  const { profile } = useAuth();
  const { schoolYear } = useSelectedSchoolYear(profile.school_id);
  const { students, error } = useEnrollmentsForYear(schoolYear);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {translateError(error)}</p>;
  if (!students) return <div className="card-bold"><SkeletonTableRows count={5} columns={5} /></div>;

  if (students.length === 0) {
    return (
      <div className="card-bold">
        <EmptyState
          icon={<UsersIcon />}
          title="Aucun élève inscrit cette année"
          subtitle="Les frais connexes s'affichent à partir des inscriptions. Commence par inscrire des élèves."
          actionLabel="Aller vers Élèves"
          actionTo="/eleves"
        />
      </div>
    );
  }

  const totalDu = students.reduce((a, s) => a + Number(s.frais_connexe_du), 0);
  const totalPaye = students.reduce((a, s) => a + Number(s.frais_connexe_paye), 0);
  const taux = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }} className="desktop-grid-3">
        <Stat label="Attendu" value={fmtF(totalDu)} />
        <Stat label="Encaissé" value={fmtF(totalPaye)} color="var(--success)" />
        <Stat label="Taux" value={`${taux}%`} />
      </div>
      <div className="card-bold" style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto' }}>
        <div style={{ minWidth: 560 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.9fr 0.9fr 1.1fr', gap: 8, padding: '12px 20px 12px 0', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
            <span style={{ ...stickyColStyle('var(--forest-light)'), paddingLeft: 20 }}>Élève</span><span>Classe</span><span>Dû</span><span>Payé</span><span>Statut</span>
          </div>
          {students.map((s, i) => {
            const reste = Number(s.frais_connexe_du) - Number(s.frais_connexe_paye);
            const relance = computeRelance(s, schoolYear, s.feeSchedule);
            const label = reste <= 0 ? 'À jour' : relance.moratoire ? 'Moratoire' : relance.relanceConnexe ? 'À relancer' : 'Retard';
            const color = reste <= 0 ? 'success' : relance.moratoire ? null : relance.relanceConnexe ? 'danger' : 'amber';
            return (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.9fr 0.9fr 1.1fr', gap: 8, padding: '12px 20px 12px 0', alignItems: 'center', borderBottom: i < students.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600, ...stickyColStyle('var(--paper)'), paddingLeft: 20 }}>{s.full_name}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{s.niveau}</span>
                <span style={{ fontSize: 13 }}>{fmtF(s.frais_connexe_du)}</span>
                <span style={{ fontSize: 13 }}>{fmtF(s.frais_connexe_paye)}</span>
                <span style={{ background: color ? `var(--${color}-light)` : '#F0EDE5', color: color ? `var(--${color})` : 'var(--muted)', fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20, width: 'fit-content' }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="card-bold" style={{ padding: '18px 20px' }}>
      <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}
