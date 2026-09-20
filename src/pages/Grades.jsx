import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useCurrentSchoolYear } from '../lib/schoolYear.js';
import SchoolTabs from '../layout/SchoolTabs.jsx';

function appreciation(moyenne) {
  if (moyenne >= 16) return 'Excellent';
  if (moyenne >= 14) return 'Très bien';
  if (moyenne >= 12) return 'Bien';
  if (moyenne >= 10) return 'Passable';
  return 'Insuffisant';
}

export default function Grades() {
  const { profile } = useAuth();
  const { schoolYear } = useCurrentSchoolYear(profile.school_id);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [grades, setGrades] = useState(null);
  const [error, setError] = useState('');
  const [niveau, setNiveau] = useState('');
  const [studentId, setStudentId] = useState('');
  const [periode, setPeriode] = useState('Trimestre 1');

  // La classe d'un élève est propre à l'année scolaire en cours
  // (enrollments) — students ne garde que son identité.
  useEffect(() => {
    if (!schoolYear) return;
    Promise.all([
      supabase.from('enrollments').select('classes ( nom ), students ( id, full_name, matricule ) ').eq('school_year_id', schoolYear.id),
      supabase.from('subjects').select('id, nom, coefficient, niveau').order('nom'),
      supabase.from('grades').select('student_id, subject_id, note, sur, periode').eq('school_year_id', schoolYear.id),
    ]).then(([{ data: enr, error: enrError }, { data: su }, { data: gr }]) => {
      if (enrError) { setError(enrError.message); return; }
      const st = (enr || [])
        .map((e) => ({ id: e.students.id, full_name: e.students.full_name, matricule: e.students.matricule, niveau: e.classes?.nom || '—' }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
      setStudents(st);
      setSubjects(su || []);
      setGrades(gr || []);
      if (st.length) setNiveau(st[0].niveau);
    });
  }, [schoolYear?.id]);

  const niveaux = useMemo(() => [...new Set(students.map((s) => s.niveau))].sort(), [students]);
  const studentsInNiveau = students.filter((s) => s.niveau === niveau);

  useEffect(() => {
    if (studentsInNiveau.length && !studentsInNiveau.some((s) => s.id === studentId)) {
      setStudentId(studentsInNiveau[0].id);
    }
  }, [niveau, students]);

  const student = students.find((s) => s.id === studentId);
  const subjectsForNiveau = subjects.filter((su) => !su.niveau || su.niveau === niveau);

  const lignes = subjectsForNiveau.map((su) => {
    const notes = (grades || []).filter((g) => g.student_id === studentId && g.subject_id === su.id && g.periode === periode);
    if (notes.length === 0) return { ...su, moyenne: null };
    const moyenne = notes.reduce((a, g) => a + (Number(g.note) / Number(g.sur)) * 20, 0) / notes.length;
    return { ...su, moyenne };
  });

  const avecNotes = lignes.filter((l) => l.moyenne != null);
  const sommeCoef = avecNotes.reduce((a, l) => a + Number(l.coefficient), 0);
  const moyenneGenerale = sommeCoef > 0
    ? avecNotes.reduce((a, l) => a + l.moyenne * Number(l.coefficient), 0) / sommeCoef
    : 0;

  return (
    <div>
      <SchoolTabs />
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Bulletins scolaires</p>

      {error && <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>}
      {!error && grades === null && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {grades !== null && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
            <select value={niveau} onChange={(e) => setNiveau(e.target.value)} style={selectStyle}>
              {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={selectStyle}>
              {studentsInNiveau.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
            <select value={periode} onChange={(e) => setPeriode(e.target.value)} style={selectStyle}>
              {['Trimestre 1', 'Trimestre 2', 'Trimestre 3'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button onClick={() => window.print()} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff' }}>
              <i className="ti ti-printer" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Imprimer / PDF
            </button>
          </div>

          {student ? (
            <div className="card-bold" style={{ padding: '26px 28px', maxWidth: 640 }}>
              <p style={{ margin: '0 0 2px', fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600 }}>{profile?.schools?.name || 'École'}</p>
              <p style={{ margin: '0 0 18px', fontSize: 12, color: 'var(--muted)' }}>Bulletin — {periode}</p>
              <p style={{ margin: '0 0 18px', fontSize: '13.5px', fontWeight: 600 }}>
                {student.full_name} {student.matricule ? `· ${student.matricule}` : ''} · {student.niveau}
              </p>

              <div style={{ borderTop: '1px solid var(--line)', marginBottom: 14 }} />

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.6fr 0.8fr 1fr', padding: '0 0 10px', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                <span>Matière</span><span>Coef.</span><span>Moyenne /20</span><span>Appréciation</span>
              </div>
              {lignes.map((l) => (
                <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '2fr 0.6fr 0.8fr 1fr', padding: '9px 0', borderTop: '1px solid var(--line)', fontSize: 13.5, alignItems: 'center' }}>
                  <span>{l.nom}</span>
                  <span style={{ color: 'var(--muted)' }}>×{l.coefficient}</span>
                  <span style={{ fontWeight: 600 }}>{l.moyenne != null ? l.moyenne.toFixed(2) : '—'}</span>
                  <span style={{ color: 'var(--muted)' }}>{l.moyenne != null ? appreciation(l.moyenne) : '—'}</span>
                </div>
              ))}
              {lignes.length === 0 && <p style={{ padding: '14px 0', color: 'var(--muted)', fontSize: 13 }}>Aucune matière pour ce niveau.</p>}
              {lignes.length > 0 && avecNotes.length === 0 && <p style={{ padding: '14px 0', color: 'var(--muted)', fontSize: 13 }}>Aucune note pour cette période.</p>}

              <div style={{ marginTop: 18, background: 'var(--forest-light)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600 }}>Moyenne générale</span>
                <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--forest-dark)' }}>{moyenneGenerale.toFixed(2)} / 20</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 30, fontSize: 12, color: 'var(--muted)' }}>
                <span>Signature de l'enseignant</span>
                <span>Le directeur</span>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucun élève dans ce niveau.</p>
          )}
        </>
      )}
    </div>
  );
}

const selectStyle = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--line-strong)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', background: 'var(--paper)' };
