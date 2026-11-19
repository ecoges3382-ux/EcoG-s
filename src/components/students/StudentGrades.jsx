// Fiche élève (équipe) : les notes de l'année, par trimestre et par matière, avec les moyennes et la courbe d'évolution.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { resumeNotesEleve, periodesAvecNotes, periodeParDefaut, pointsEvolution, TYPES_NOTE } from '../../lib/studentGrades.js';
import GradesTrendChart from '../GradesTrendChart.jsx';

const fmt = (n) => Number(n).toFixed(2).replace('.', ',');
const COURT = { 'Trimestre 1': 'T1', 'Trimestre 2': 'T2', 'Trimestre 3': 'T3', 'Semestre 1': 'S1', 'Semestre 2': 'S2' };

function couleurNote(note, sur) {
  const sur20 = (Number(note) / Number(sur)) * 20;
  if (sur20 >= 14) return 'var(--success)';
  if (sur20 < 10) return 'var(--danger)';
  return 'var(--ink)';
}

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
  const aDesExamens = resume.lignes.some((l) => l.notes.some((n) => n.type === 'examen'));
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
        <div>
          {resume.lignes.map((l, i) => (
            <div key={l.matiere.id} style={{ padding: '11px 0', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>
                  {l.matiere.nom}
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: 'var(--muted)' }}>coef. {l.coefficient}</span>
                </p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: l.moyenne == null ? 'var(--muted)' : 'var(--forest-text)', whiteSpace: 'nowrap' }}>
                  {l.moyenne == null ? '—' : `${fmt(l.moyenne)}/20`}
                </p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {l.notes.map((n) => (
                  <span key={n.id} title={`${TYPES_NOTE[n.type] || n.type}${annuel ? ` · ${n.periode}` : ''}${n.created_at ? ` · ${new Date(n.created_at).toLocaleDateString('fr-FR')}` : ''}`}
                    style={{ fontSize: 12, padding: '3px 9px', borderRadius: 14, background: 'var(--chip-bg)', color: couleurNote(n.note, n.sur), fontWeight: 600, opacity: n.type === 'examen' ? 0.75 : 1 }}>
                    <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{TYPES_NOTE[n.type] || n.type} </span>{Number(n.note)}/{Number(n.sur)}
                  </span>
                ))}
              </div>
              {annuel && (
                <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>
                  {l.parTrimestre.map((t) => `${COURT[t.periode]} ${t.moyenne == null ? '—' : fmt(t.moyenne)}`).join(' · ')}
                </p>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 6, paddingTop: 12, borderTop: '2px solid var(--line-strong)' }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>Moyenne générale{annuel ? ' (année)' : ''}</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--forest-text)' }}>
              {resume.generale == null ? '—' : `${fmt(resume.generale)}/20`}
              {resume.appreciation && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{resume.appreciation}</span>}
            </p>
          </div>
          {aDesExamens && <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted)' }}>Les examens sont affichés mais ne comptent pas dans la moyenne du trimestre.</p>}
        </div>
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
