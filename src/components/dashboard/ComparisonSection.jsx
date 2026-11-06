import { useEffect, useState } from 'react';
import { fmtF } from '../../lib/utils.js';
import { useEnrollmentsForYear } from '../../lib/enrollments.js';
import { supabase } from '../../lib/supabase.js';
import { SkeletonTableRows } from '../Skeleton.jsx';

export default function ComparisonSection({ currentYear, previousYear, currentStudents, currentAttendance }) {
  const { students: prevStudents } = useEnrollmentsForYear(previousYear);
  const [prevAttendance, setPrevAttendance] = useState(null);

  useEffect(() => {
    if (!previousYear) { setPrevAttendance(null); return; }
    let cancelled = false;
    supabase.from('attendance_records').select('statut').eq('school_year_id', previousYear.id)
      .then(({ data }) => { if (!cancelled) setPrevAttendance(data || []); });
    return () => { cancelled = true; };
  }, [previousYear?.id]);

  if (!previousYear) {
    return (
      <div style={{ marginBottom: 10 }}>
        <p className="page-title" style={{ margin: '0 0 10px', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>Comparaison avec l'année précédente</p>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Aucune année antérieure disponible pour comparer.</p>
      </div>
    );
  }

  const hasPrevData = !!(prevStudents && prevStudents.length > 0);

  return (
    <div style={{ marginBottom: 10 }}>
      <p className="page-title" style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>
        Comparaison {currentYear.label} vs {previousYear.label}
      </p>
      {!hasPrevData ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Données insuffisantes pour {previousYear.label} — comparaison non disponible.
        </p>
      ) : (
        <CompareTable
          currentYear={currentYear} previousYear={previousYear}
          currStudents={currentStudents} currAttendance={currentAttendance}
          prevStudents={prevStudents} prevAttendance={prevAttendance}
        />
      )}
    </div>
  );
}

function CompareTable({ currentYear, previousYear, currStudents, currAttendance, prevStudents, prevAttendance }) {
  if (!currStudents || !currAttendance || !prevAttendance) return <div className="card-bold"><SkeletonTableRows count={4} columns={3} /></div>;

  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  const tauxPresenceOf = (records) => {
    const c = { present: 0, retard: 0 };
    records.forEach((r) => { if (r.statut === 'present') c.present++; else if (r.statut === 'retard') c.retard++; });
    return records.length > 0 ? Math.round(((c.present + c.retard) / records.length) * 100) : null;
  };

  const rows = [
    { label: 'Effectif', cur: currStudents.length, prev: prevStudents.length, fmt: (v) => String(v) },
    { label: 'Total encaissé', cur: sum(currStudents, (s) => Number(s.montant_paye)), prev: sum(prevStudents, (s) => Number(s.montant_paye)), fmt: fmtF },
    {
      label: 'Taux de recouvrement',
      cur: sum(currStudents, (s) => Number(s.montant_du)) > 0 ? Math.round((sum(currStudents, (s) => Number(s.montant_paye)) / sum(currStudents, (s) => Number(s.montant_du))) * 100) : 0,
      prev: sum(prevStudents, (s) => Number(s.montant_du)) > 0 ? Math.round((sum(prevStudents, (s) => Number(s.montant_paye)) / sum(prevStudents, (s) => Number(s.montant_du))) * 100) : 0,
      fmt: (v) => `${v}%`,
    },
    { label: 'Taux de présence', cur: tauxPresenceOf(currAttendance), prev: tauxPresenceOf(prevAttendance), fmt: (v) => (v != null ? `${v}%` : '—') },
  ];

  return (
    <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 640 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', padding: '11px 18px', background: 'var(--forest-light)', fontSize: 11, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
        <span>Indicateur</span><span>{currentYear.label}</span><span>{previousYear.label}</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', padding: '11px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none', fontSize: 13.5 }}>
          <span style={{ color: 'var(--muted)' }}>{r.label}</span>
          <span style={{ fontWeight: 700 }}>{r.fmt(r.cur)}</span>
          <span>{r.fmt(r.prev)}</span>
        </div>
      ))}
    </div>
  );
}
