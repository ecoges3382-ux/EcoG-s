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
import OfflineBanner from '../components/OfflineBanner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { guardedFetch } from '../lib/offlineCache.js';
import { SkeletonTableRows } from '../components/Skeleton.jsx';
import { usePageTour } from '../components/PageTour.jsx';

const PERIODE_OPTIONS = [...PERIODES_BULLETIN, 'annuel'];
function periodeLabel(p) {
  return p === 'annuel' ? 'Année complète' : p;
}

function UsersIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.3" /><path d="M2.8 20c0-3.4 2.8-6 6.2-6s6.2 2.6 6.2 6" /><circle cx="17" cy="8.5" r="2.4" /><path d="M15.5 14c2.4.2 4.2 2.4 4.4 4.7" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5.5c0-1 .8-1.5 2-1.5h6v15H6c-1.2 0-2 .5-2 1.5V5.5z" /><path d="M20 5.5c0-1-.8-1.5-2-1.5h-6v15h6c1.2 0 2 .5 2 1.5V5.5z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" />
    </svg>
  );
}

export default function Grades() {
  const { profile } = useAuth();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [grades, setGrades] = useState(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [niveau, setNiveau] = useState('');
  const [studentId, setStudentId] = useState('');
  const [periode, setPeriode] = useState('Trimestre 1');
  const tour = usePageTour('grades');

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    guardedFetch({
      cacheKey: `bulletins_${schoolYear.id}`,
      hasData: false,
      load: async () => {
        const [{ data: enr, error: enrError }, { data: su }, { data: gr }] = await Promise.all([
          supabase.from('enrollments').select('classes ( nom ), students ( id, full_name, matricule ) ').eq('school_year_id', schoolYear.id),
          supabase.from('subjects').select('id, nom, coefficient, niveau').order('nom'),
          supabase.from('grades').select('student_id, subject_id, type, note, sur, periode').eq('school_year_id', schoolYear.id),
        ]);
        if (enrError) return { error: enrError };
        const st = (enr || [])
          .map((e) => ({ id: e.students.id, full_name: e.students.full_name, matricule: e.students.matricule, niveau: e.classes?.nom || '—' }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name));
        return { data: { students: st, subjects: su || [], grades: gr || [] } };
      },
      setData: ({ students: st, subjects: su, grades: gr }) => {
        setStudents(st);
        setSubjects(su);
        setGrades(gr);
        if (st.length) setNiveau(st[0].niveau);
      },
      setOffline,
      onError: (err) => setError(err.message),
      isCancelled: () => cancelled,
    });
    return () => { cancelled = true; };
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
      {offline && <OfflineBanner />}
      {tour.Runner}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Bulletins scolaires</p>
        <tour.Button />
      </div>

      {error && <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>}
      {!error && grades === null && <div className="card-bold"><SkeletonTableRows count={5} columns={3} /></div>}

      {grades !== null && students.length === 0 && (
        <div className="card-bold">
          <EmptyState
            icon={<UsersIcon />}
            title="Aucun élève inscrit"
            subtitle="Les bulletins se génèrent à partir des élèves inscrits. Commence par inscrire tes premiers élèves."
            actionLabel="Aller vers Élèves"
            actionTo="/eleves"
          />
        </div>
      )}

      {grades !== null && students.length > 0 && (
        <>
          <div data-tour="grades-selectors" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 22, alignItems: 'flex-end' }}>
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
              data-tour="grades-print"
              onClick={() => printDocument(`bulletin-${slug(student?.full_name)}-${slug(periodeLabel(periode))}`)}
              disabled={!student}
              style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', opacity: student ? 1 : 0.6 }}
            >
              <i className="ti ti-printer" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Imprimer / PDF
            </button>
          </div>

          {student ? (
            <div data-tour="grades-sheet" className="card-bold print-sheet" style={{ padding: '26px 28px', maxWidth: 680 }}>
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

              {lignes.length === 0 && (
                <div style={{ marginTop: 6 }}>
                  <EmptyState
                    icon={<BookIcon />}
                    title="Aucune matière pour cette classe"
                    subtitle="Les bulletins ont besoin des matières enseignées. Ajoute-les d'abord dans « Matières »."
                    actionLabel="Aller vers Matières"
                    actionTo="/matieres"
                  />
                </div>
              )}

              {lignes.length > 0 && moyenneGenerale == null && (
                <div style={{ marginTop: 6 }}>
                  <EmptyState
                    icon={<PencilIcon />}
                    title="Aucune note enregistrée"
                    subtitle={`Aucune note pour ${annuel ? 'cette année' : 'cette période'} — impossible de calculer une moyenne. Saisis les notes de cet élève.`}
                    actionLabel="Aller vers Notes"
                    actionTo="/notes"
                  />
                </div>
              )}

              <div data-tour="grades-summary" style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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
            <div className="card-bold">
              <EmptyState
                icon={<UsersIcon />}
                title="Aucun élève dans cette classe"
                subtitle="Change de classe ou inscris des élèves dans celle-ci pour voir leurs bulletins."
                actionLabel="Aller vers Élèves"
                actionTo="/eleves"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

const selectStyle = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--line-strong)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', background: 'var(--paper)' };
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
