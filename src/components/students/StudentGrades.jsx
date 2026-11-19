// Fiche élève (équipe) : les notes de l'année, par trimestre et par matière, avec les moyennes et la courbe d'évolution.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { resumeNotesEleve, periodesAvecNotes, periodeParDefaut, pointsEvolution } from '../../lib/studentGrades.js';
import GradesTrendChart from '../GradesTrendChart.jsx';
import NotesParMatiere from '../NotesParMatiere.jsx';

const puce = (actif) => ({
  padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  border: `1px solid ${actif ? 'var(--forest)' : 'var(--line-strong)'}`, background: actif ? 'var(--forest)' : 'var(--paper)', color: actif ? '#fff' : 'var(--ink)',
});

export default function StudentGrades({ studentId, schoolYearId, canEdit }) {
  const [data, setData] = useState(null); // { subjects, grades } | 'erreur'
  const [periode, setPeriode] = useState(null);

  useEffect(() => {
    if (!studentId || !schoolYearId) return;
    let cancelled = false;
    setData(null);
    Promise.all([
      supabase.from('subjects').select('id, nom, coefficient, niveau'),
      supabase.from('grades').select('id, student_id, subject_id, type, note, sur, periode, created_at').eq('student_id', studentId).eq('school_year_id', schoolYearId).order('created_at'),
    ]).then(([su, gr]) => {
      if (cancelled) return;
      if (su.error || gr.error) { setData('erreur'); return; }
      const grades = gr.data || [];
      setData({ subjects: su.data || [], grades });
      setPeriode(periodeParDefaut(grades));
    });
    return () => { cancelled = true; };
  }, [studentId, schoolYearId]);

  if (!data) {
    return (
      <div className="card-bold" style={{ padding: '16px 20px', marginBottom: 20, maxWidth: 640 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Chargement des notes…</p>
      </div>
    );
  }
  if (data === 'erreur') {
    return (
      <div className="card-bold" style={{ padding: '16px 20px', marginBottom: 20, maxWidth: 640 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>Impossible de charger les notes pour l'instant. Vérifie ta connexion et recharge la page.</p>
      </div>
    );
  }

  const { subjects, grades } = data;
  const titre = <p style={{ margin: '0 0 12px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Notes de l'année</p>;

  if (grades.length === 0) {
    return (
      <div className="card-bold" style={{ padding: '16px 20px', marginBottom: 20, maxWidth: 640 }}>
        {titre}
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          Aucune note enregistrée pour cet élève cette année.{' '}
          {canEdit && <Link to="/notes" style={{ color: 'var(--forest-text)', fontWeight: 600 }}>Saisir une note</Link>}
        </p>
      </div>
    );
  }

  const periodes = periodesAvecNotes(grades);
  const courante = periode || periodeParDefaut(grades);
  const resume = resumeNotesEleve(grades, subjects, studentId, courante);
  const annuel = courante === 'annuel';
  const points = pointsEvolution(grades, subjects, studentId);

  return (
    <div className="card-bold" style={{ padding: '16px 20px', marginBottom: 20, maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        {titre}
        <Link to="/bulletins" style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: 'var(--forest-text)', textDecoration: 'none' }}>Voir le bulletin</Link>
      </div>

      <div role="tablist" aria-label="Période" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {periodes.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={courante === p} onClick={() => setPeriode(p)} style={puce(courante === p)}>{p}</button>
        ))}
        <button type="button" role="tab" aria-selected={annuel} onClick={() => setPeriode('annuel')} style={puce(annuel)}>Année</button>
      </div>

      {resume.lignes.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Aucune note pour cette période.</p>
      ) : (
        <NotesParMatiere
          key={courante}
          annuel={annuel}
          ariaLabel={annuel ? 'Moyennes de l\'année' : `Moyennes du ${courante}`}
          lignes={resume.lignes.map((l) => ({ id: l.matiere.id, nom: l.matiere.nom, coefficient: l.coefficient, notes: l.notes, moyenne: l.moyenne, parTrimestre: l.parTrimestre }))}
          total={{ generale: resume.generale, appreciation: resume.appreciation, parTrimestre: points }}
        />
      )}

      {points.filter((p) => p.value != null).length >= 2 && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Évolution des moyennes</p>
          <GradesTrendChart points={points} />
        </div>
      )}
    </div>
  );
}
