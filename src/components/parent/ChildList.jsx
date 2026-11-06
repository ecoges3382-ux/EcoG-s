import { fmtF, initials } from '../../lib/utils.js';
import { computeEcheances } from '../../lib/retard.js';
import { toCalcEnrollment } from '../../lib/parentPortal.js';

function ChildCard({ s, schoolYear, feeSchedules, onClick }) {
  const feeSchedule = (feeSchedules || []).find((f) => f.niveau === s.classe_niveau) || null;
  const echeances = schoolYear ? computeEcheances(toCalcEnrollment(s), schoolYear, feeSchedule) : [];
  const enRetard = echeances.some((e) => e.enRetard);
  const reste = Number(s.montant_du) - Number(s.montant_paye);

  let badge = null;
  if (s.has_arrangement) badge = { label: 'Arrangement', bg: '#F0EDE5', fg: 'var(--muted)' };
  else if (enRetard) badge = { label: 'Solde à régler', bg: 'var(--danger-light)', fg: 'var(--danger)' };
  else if (reste > 0) badge = { label: `${fmtF(reste)} dû`, bg: 'var(--amber-light)', fg: 'var(--amber)' };
  else badge = { label: 'À jour', bg: 'var(--success-light)', fg: 'var(--success)' };

  const alertes = (s.absences_recentes || 0) + (s.retards_recents || 0);

  return (
    <button
      onClick={onClick}
      className="card-bold"
      style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', width: '100%', gap: 10, flexWrap: 'wrap' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, color: 'var(--clay-dark)', overflow: 'hidden', flexShrink: 0 }}>
          {s.photo_url ? <img src={s.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(s.full_name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: '0 0 2px', fontSize: 14.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.full_name}</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
            {s.niveau || '—'}{alertes > 0 ? ` · ${alertes} absence${alertes > 1 ? 's' : ''}/retard${alertes > 1 ? 's' : ''} (30j)` : ''}
          </p>
        </div>
      </div>
      <span style={{ background: badge.bg, color: badge.fg, fontSize: 11.5, fontWeight: 700, padding: '4px 11px', borderRadius: 20, whiteSpace: 'nowrap' }}>{badge.label}</span>
    </button>
  );
}

export default function ChildList({ summary, offline, changeCode, openStudent }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--cream)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600 }}>Bonjour, {summary.full_name}</p>
          <button onClick={changeCode} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Changer de code</button>
        </div>

        {summary.announcements?.length > 0 && (
          <div className="card-bold" style={{ padding: '14px 16px', marginBottom: 18, background: 'var(--forest-light)', borderColor: 'transparent' }}>
            <p style={{ margin: '0 0 8px', fontSize: 11.5, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>Dernières annonces</p>
            {summary.announcements.map((a, i) => (
              <div key={a.id} style={{ marginTop: i > 0 ? 8 : 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{a.titre}</p>
              </div>
            ))}
          </div>
        )}

        <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)' }}>
          {summary.students.length} enfant{summary.students.length > 1 ? 's' : ''} rattaché{summary.students.length > 1 ? 's' : ''}
          {summary.school_year ? ` · Année scolaire ${summary.school_year.label}` : ''}
        </p>

        <div style={{ display: 'grid', gap: 12 }}>
          {summary.students.map((s) => (
            <ChildCard key={s.id} s={s} schoolYear={summary.school_year} feeSchedules={summary.fee_schedules} onClick={() => openStudent(s)} />
          ))}
          {summary.students.length === 0 && (
            <div className="card-bold" style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>
              Aucun enfant n'est encore rattaché à ce code. Contacte le secrétariat de l'école.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
