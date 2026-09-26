import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import { PERIODES_BULLETIN, subjectPeriodeMoyenne, periodeMoyenneGenerale, annualMoyenneGenerale, subjectAnnualMoyenne, appreciation, computeRang } from '../lib/bulletin.js';
import { printDocument, slug } from '../lib/print.js';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import DocumentHeader from '../components/DocumentHeader.jsx';
import Dropdown from '../components/Dropdown.jsx';

const PERIODE_OPTIONS = [...PERIODES_BULLETIN, 'annuel'];
function periodeLabel(p) {
  return p === 'annuel' ? 'Année complète' : p;
}

export default function Grades() {
  const { profile } = useAuth();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [grades, setGrades] = useState(null);
  const [error, setError] = useState('');
  const [niveau, setNiveau] = useState('');
  const [studentId, setStudentId] = useState('');
  const [periode, setPeriode] = useState('Trimestre 1');

  // La classe d'un élève est propre à l'année scolaire sélectionnée
  // (enrollments) — students ne garde que son identité. Les notes utilisées
  // pour ce bulletin sont filtrées sur cette même année (school_year_id) :
  // jamais de notes d'une autre année mélangées à celles-ci.
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
  const annuel = periode === 'annuel';

  // Une matière ou une période sans aucune note n'est jamais transformée en
  // 0 — les fonctions de lib/bulletin.js renvoient null, affiché "—" plus
  // bas, jamais une moyenne trompeuse.
  const lignes = subjectsForNiveau.map((su) => (
    annuel
      ? {
          ...su,
          t1: subjectPeriodeMoyenne(grades || [], studentId, su.id, 'Trimestre 1'),
          t2: subjectPeriodeMoyenne(grades || [], studentId, su.id, 'Trimestre 2'),
          t3: subjectPeriodeMoyenne(grades || [], studentId, su.id, 'Trimestre 3'),
          moyenne: subjectAnnualMoyenne(grades || [], studentId, su.id),
        }
      : { ...su, moyenne: subjectPeriodeMoyenne(grades || [], studentId, su.id, periode) }
  ));

  const moyenneGenerale = annuel
    ? annualMoyenneGenerale(subjectsForNiveau, grades || [], studentId)
    : periodeMoyenneGenerale(subjectsForNiveau, grades || [], studentId, periode);

  const rang = studentId
    ? computeRang(subjectsForNiveau, grades || [], studentsInNiveau.map((s) => s.id), studentId, annuel ? 'annuel' : periode)
    : null;

  return (
    <div>
      <SchoolTabs />
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Bulletins scolaires</p>

      {error && <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>}
      {!error && grades === null && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {grades !== null && (
        <>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 22, alignItems: 'flex-end' }}>
            <div>
              <label style={labelStyle}>Classe</label>
              <Dropdown value={niveau} onChange={setNiveau} options={niveaux} style={selectStyle} wrapperStyle={{ width: 'auto', minWidth: 140 }} />
            </div>
            <div>
              <label style={labelStyle}>Élève</label>
              <Dropdown
                value={studentId}
                onChange={setStudentId}
                options={studentsInNiveau.map((s) => ({ value: s.id, label: s.full_name }))}
                style={selectStyle}
                wrapperStyle={{ width: 'auto', minWidth: 180 }}
              />
            </div>
            <div>
              <label style={labelStyle}>Période</label>
              <Dropdown
                value={periode}
                onChange={setPeriode}
                options={PERIODE_OPTIONS.map((p) => ({ value: p, label: periodeLabel(p) }))}
                style={selectStyle}
                wrapperStyle={{ width: 'auto', minWidth: 160 }}
              />
            </div>
            <button
              onClick={() => printDocument(`bulletin-${slug(student?.full_name)}-${slug(periodeLabel(periode))}`)}
              disabled={!student}
              style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', opacity: student ? 1 : 0.6 }}
            >
              <i className="ti ti-printer" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Imprimer / PDF
            </button>
          </div>

          {student ? (
            <div className="card-bold print-sheet" style={{ padding: '26px 28px', maxWidth: 680 }}>
              <DocumentHeader
                school={profile?.schools}
                title="Bulletin scolaire"
                subtitle={`${periodeLabel(periode)} · Année scolaire ${schoolYear?.label || ''}`}
              />
              <p style={{ margin: '0 0 18px', fontSize: '13.5px', fontWeight: 600 }}>
                {student.full_name} {student.matricule ? `· ${student.matricule}` : ''} · {student.niveau}
              </p>

              <div style={{ borderTop: '1px solid var(--line)', marginBottom: 14 }} />

              {annuel ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 0.5fr 0.6fr 0.6fr 0.6fr 0.7fr 1fr', padding: '0 0 10px', fontSize: '10.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                    <span>Matière</span><span>Coef.</span><span>T1</span><span>T2</span><span>T3</span><span>Annuelle</span><span>Appréciation</span>
                  </div>
                  {lignes.map((l) => (
                    <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1.8fr 0.5fr 0.6fr 0.6fr 0.6fr 0.7fr 1fr', padding: '9px 0', borderTop: '1px solid var(--line)', fontSize: 13, alignItems: 'center' }}>
                      <span>{l.nom}</span>
                      <span style={{ color: 'var(--muted)' }}>×{l.coefficient}</span>
                      <span style={{ color: 'var(--muted)' }}>{l.t1 != null ? l.t1.toFixed(2) : '—'}</span>
                      <span style={{ color: 'var(--muted)' }}>{l.t2 != null ? l.t2.toFixed(2) : '—'}</span>
                      <span style={{ color: 'var(--muted)' }}>{l.t3 != null ? l.t3.toFixed(2) : '—'}</span>
                      <span style={{ fontWeight: 600 }}>{l.moyenne != null ? l.moyenne.toFixed(2) : '—'}</span>
                      <span style={{ color: 'var(--muted)' }}>{appreciation(l.moyenne) || '—'}</span>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.6fr 0.8fr 1fr', padding: '0 0 10px', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                    <span>Matière</span><span>Coef.</span><span>Moyenne /20</span><span>Appréciation</span>
                  </div>
                  {lignes.map((l) => (
                    <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '2fr 0.6fr 0.8fr 1fr', padding: '9px 0', borderTop: '1px solid var(--line)', fontSize: 13.5, alignItems: 'center' }}>
                      <span>{l.nom}</span>
                      <span style={{ color: 'var(--muted)' }}>×{l.coefficient}</span>
                      <span style={{ fontWeight: 600 }}>{l.moyenne != null ? l.moyenne.toFixed(2) : '—'}</span>
                      <span style={{ color: 'var(--muted)' }}>{appreciation(l.moyenne) || '—'}</span>
                    </div>
                  ))}
                </>
              )}
              {lignes.length === 0 && <p style={{ padding: '14px 0', color: 'var(--muted)', fontSize: 13 }}>Aucune matière pour ce niveau.</p>}
              {lignes.length > 0 && moyenneGenerale == null && (
                <p style={{ padding: '14px 0', color: 'var(--muted)', fontSize: 13 }}>
                  Aucune note enregistrée {annuel ? 'sur cette année' : 'pour cette période'} — aucune moyenne ne peut être calculée.
                </p>
              )}

              <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 220px', background: 'var(--forest-light)', borderRadius: 10, padding: '14px 18px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11.5px', fontWeight: 600, color: 'var(--forest-dark)' }}>Moyenne générale</p>
                  <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: 'var(--forest-dark)' }}>
                    {moyenneGenerale != null ? `${moyenneGenerale.toFixed(2)} / 20` : '—'}
                  </p>
                  {moyenneGenerale != null && (
                    <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: 'var(--forest-dark)' }}>{appreciation(moyenneGenerale)}</p>
                  )}
                </div>
                <div style={{ flex: '1 1 160px', background: 'var(--paper)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: '14px 18px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11.5px', fontWeight: 600, color: 'var(--muted)' }}>Rang</p>
                  <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: 'var(--ink)' }}>
                    {rang ? `${rang.rang}${rang.rang === 1 ? 'er' : 'e'} / ${rang.total}` : 'Non classé'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 30, fontSize: 12, color: 'var(--muted)' }}>
                <span>Signature de l'enseignant</span>
                <span>Cachet de l'école — Le directeur</span>
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
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
