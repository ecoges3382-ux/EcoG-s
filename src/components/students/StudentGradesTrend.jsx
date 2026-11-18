// Fiche élève (équipe) : évolution de la moyenne générale sur les trimestres de l'année affichée.
// Charge elle-même les notes de cet élève ; ne s'affiche que s'il y en a.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { PERIODES_BULLETIN, periodeMoyenneGenerale } from '../../lib/bulletin.js';
import GradesTrendChart from '../GradesTrendChart.jsx';

const NOMS_COURTS = { 'Trimestre 1': 'T1', 'Trimestre 2': 'T2', 'Trimestre 3': 'T3' };

export default function StudentGradesTrend({ studentId, schoolYearId, classeNom }) {
  const [data, setData] = useState(null); // { subjects, grades } | 'erreur'

  useEffect(() => {
    if (!studentId || !schoolYearId) return;
    let cancelled = false;
    setData(null);
    Promise.all([
      supabase.from('subjects').select('id, coefficient, niveau'),
      supabase.from('grades').select('student_id, subject_id, type, note, sur, periode').eq('student_id', studentId).eq('school_year_id', schoolYearId),
    ]).then(([su, gr]) => {
      if (cancelled) return;
      setData(su.error || gr.error ? 'erreur' : { subjects: su.data || [], grades: gr.data || [] });
    });
    return () => { cancelled = true; };
  }, [studentId, schoolYearId]);

  if (!data || data === 'erreur') return null; // en cas de doute, on n'affiche rien plutôt qu'un graphique faux

  // Mêmes matières que l'écran Bulletins : celles de la classe de l'élève, ou communes à toutes les classes.
  const matieres = data.subjects.filter((su) => !su.niveau || su.niveau === classeNom);
  const points = PERIODES_BULLETIN.map((p) => ({
    name: NOMS_COURTS[p],
    label: p,
    value: periodeMoyenneGenerale(matieres, data.grades, studentId, p),
  }));
  if (points.every((p) => p.value == null)) return null;

  return (
    <div className="card-bold" style={{ padding: '16px 20px', marginBottom: 20, maxWidth: 640 }}>
      <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Évolution des moyennes</p>
      <GradesTrendChart points={points} />
    </div>
  );
}
