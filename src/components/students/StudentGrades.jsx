// Fiche élève (équipe) : les notes de l'année, par trimestre et par matière, avec les moyennes et la courbe d'évolution.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { PERIODES_BULLETIN } from '../../lib/bulletin.js';
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

const GROUPES = [
  { type: 'controle', titre: 'Interrogations' },
  { type: 'devoir', titre: 'Devoirs' },
  { type: 'examen', titre: 'Examens' },
];
const moyenneStyle = (m) => ({ fontWeight: 700, color: m == null ? 'var(--muted)' : couleurNote(m, 20), fontVariantNumeric: 'tabular-nums' });
const cellule = { textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums' };

export default function StudentGrades({ studentId, schoolYearId, canEdit }) {
  const [data, setData] = useState(null); // { subjects, grades } | 'erreur'
  const [periode, setPeriode] = useState(null);
  const [ouvertes, setOuvertes] = useState(() => new Set()); // matières dépliées (les notes sont repliées par défaut)

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
  // Colonnes du tableau : matière, puis la moyenne (ou T1 T2 T3 + année en vue annuelle).
  const grille = { display: 'grid', gridTemplateColumns: annuel ? `minmax(0, 1fr) repeat(${PERIODES_BULLETIN.length}, 46px) 56px` : 'minmax(0, 1fr) 72px', columnGap: 8 };
  const toutesOuvertes = resume.lignes.length > 0 && resume.lignes.every((l) => ouvertes.has(l.matiere.id));
  const basculer = (id) => setOuvertes((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="card-bold" style={{ padding: '16px 20px', marginBottom: 20, maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        {titre}
        <Link to="/bulletins" style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: 'var(--forest-text)', textDecoration: 'none' }}>Voir le bulletin</Link>
      </div>

      <div role="tablist" aria-label="Période" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {periodes.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={courante === p} onClick={() => { setPeriode(p); setOuvertes(new Set()); }} style={puce(courante === p)}>{p}</button>
        ))}
        <button type="button" role="tab" aria-selected={annuel} onClick={() => { setPeriode('annuel'); setOuvertes(new Set()); }} style={puce(annuel)}>Année</button>
      </div>

      {resume.lignes.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Aucune note pour cette période.</p>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
            <button type="button" onClick={() => setOuvertes(toutesOuvertes ? new Set() : new Set(resume.lignes.map((l) => l.matiere.id)))}
              style={{ background: 'none', border: 'none', padding: '2px 0', fontSize: 12, fontWeight: 600, color: 'var(--forest-text)', cursor: 'pointer' }}>
              {toutesOuvertes ? 'Tout replier' : 'Tout déplier'}
            </button>
          </div>

          <div role="table" aria-label={annuel ? 'Moyennes de l\'année' : `Moyennes du ${courante}`}>
            <div role="row" style={{ ...grille, padding: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--line-strong)' }}>
              <span role="columnheader">Matière</span>
              {annuel
                ? <>{PERIODES_BULLETIN.map((p) => <span key={p} role="columnheader" style={{ textAlign: 'right' }}>{COURT[p]}</span>)}<span role="columnheader" style={{ textAlign: 'right' }}>Année</span></>
                : <span role="columnheader" style={{ textAlign: 'right' }}>Moyenne</span>}
            </div>

            {resume.lignes.map((l) => {
              const ouverte = ouvertes.has(l.matiere.id);
              return (
                <div key={l.matiere.id} role="row" style={{ borderBottom: '1px solid var(--line)' }}>
                  <button type="button" aria-expanded={ouverte} onClick={() => basculer(l.matiere.id)}
                    style={{ ...grille, width: '100%', padding: '11px 0', background: 'none', border: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer', alignItems: 'center' }}>
                    <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span aria-hidden="true" style={{ flex: '0 0 auto', fontSize: 14, color: 'var(--muted)', transition: 'transform .15s', transform: ouverte ? 'rotate(90deg)' : 'none' }}>›</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, overflowWrap: 'anywhere' }}>{l.matiere.nom}</span>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>coef. {l.coefficient}</span>
                      </span>
                    </span>
                    {annuel && l.parTrimestre.map((t) => (
                      <span key={t.periode} role="cell" style={{ ...cellule, color: t.moyenne == null ? 'var(--muted)' : couleurNote(t.moyenne, 20) }}>{t.moyenne == null ? '—' : fmt(t.moyenne)}</span>
                    ))}
                    <span role="cell" style={{ ...cellule, fontSize: 14, ...moyenneStyle(l.moyenne) }}>{l.moyenne == null ? '—' : fmt(l.moyenne)}</span>
                  </button>

                  {ouverte && (
                    <div style={{ padding: '2px 0 12px 22px' }}>
                      {GROUPES.map((g) => {
                        const notes = l.notes.filter((n) => n.type === g.type);
                        if (notes.length === 0) return null;
                        return (
                          <div key={g.type} style={{ marginTop: 8 }}>
                            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>{g.titre} ({notes.length})</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {notes.map((n) => (
                                <span key={n.id} title={`${TYPES_NOTE[n.type] || n.type} · ${n.periode}${n.created_at ? ` · ${new Date(n.created_at).toLocaleDateString('fr-FR')}` : ''}`}
                                  style={{ fontSize: 12, padding: '3px 9px', borderRadius: 14, background: 'var(--chip-bg)', color: couleurNote(n.note, n.sur), fontWeight: 600, opacity: n.type === 'examen' ? 0.75 : 1 }}>
                                  {annuel && <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{COURT[n.periode] || n.periode} </span>}{Number(n.note)}/{Number(n.sur)}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {l.notes.some((n) => !GROUPES.some((g) => g.type === n.type)) && (
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {l.notes.filter((n) => !GROUPES.some((g) => g.type === n.type)).map((n) => (
                            <span key={n.id} style={{ fontSize: 12, padding: '3px 9px', borderRadius: 14, background: 'var(--chip-bg)', fontWeight: 600 }}>{n.type} {Number(n.note)}/{Number(n.sur)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div role="row" style={{ ...grille, alignItems: 'baseline', paddingTop: 12, borderTop: '2px solid var(--line-strong)', marginTop: -1 }}>
              <span role="cell" style={{ fontSize: 13.5, fontWeight: 700 }}>
                Moyenne générale{annuel ? ' (année)' : ''}<span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>sur 20</span>
                {resume.appreciation && <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{resume.appreciation}</span>}
              </span>
              {annuel && points.map((p) => (
                <span key={p.label} role="cell" style={{ ...cellule, fontWeight: 600, color: p.value == null ? 'var(--muted)' : couleurNote(p.value, 20) }}>{p.value == null ? '—' : fmt(p.value)}</span>
              ))}
              <span role="cell" style={{ ...cellule, fontSize: 16, color: resume.generale == null ? 'var(--muted)' : 'var(--forest-text)', fontWeight: 700 }}>
                {resume.generale == null ? '—' : fmt(resume.generale)}
              </span>
            </div>
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
