import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF, downloadCsv, todayIso, startOfWeekIso, endOfWeekIso, startOfMonthIso, endOfMonthIso } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import { useEnrollmentsForYear } from '../lib/enrollments.js';
import { hasFeature, getPlanLabel, featurePlanRequired } from '../lib/plan.js';
import { printDocument, slug } from '../lib/print.js';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import DocumentHeader from '../components/DocumentHeader.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import PlanLocked from '../components/PlanLocked.jsx';
import AbsencesReport from '../components/AbsencesReport.jsx';
import { guardedFetch } from '../lib/offlineCache.js';
import { SkeletonCard, SkeletonTableRows } from '../components/Skeleton.jsx';

// Ordre = priorité demandée : effectifs, financier, impayés, absences,
// présences (appel rapide), résultats, puis la synthèse qui les résume tous.
const REPORTS = [
  { id: 'effectifs', label: 'Effectifs' },
  { id: 'financier', label: 'Financier' },
  { id: 'impayes', label: 'Impayés' },
  { id: 'absences', label: 'Absences & retards' },
  { id: 'presences', label: 'Présences (appel)' },
  { id: 'resultats', label: 'Résultats scolaires' },
  { id: 'synthese', label: 'Synthèse générale' },
];

function groupByClasse(students) {
  const map = new Map();
  students.forEach((s) => {
    const key = s.classeId || s.niveau;
    if (!map.has(key)) map.set(key, { nom: s.niveau, classeId: s.classeId, items: [] });
    map.get(key).items.push(s);
  });
  return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom));
}

export default function Reports() {
  const { profile } = useAuth();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const plan = profile?.schools?.plan || 'decouverte';
  const hasReports = hasFeature(plan, 'rapports_avances');

  const { students, error, offline: offlineStudents } = useEnrollmentsForYear(hasReports ? schoolYear : null);
  const [reportId, setReportId] = useState('synthese');
  const [attendance, setAttendance] = useState(null);
  const [classResults, setClassResults] = useState(null);
  const [effectifsMouvement, setEffectifsMouvement] = useState(null);
  const [personnel, setPersonnel] = useState(null);
  const [offlineExtra, setOffline] = useState(false);

  useEffect(() => {
    if (!schoolYear || !hasReports) return;
    let cancelled = false;
    guardedFetch({
      cacheKey: `reports_attendance_${schoolYear.id}`,
      hasData: false,
      load: async () => {
        const { data, error: e } = await supabase.from('attendance_records').select('student_id, date, statut').eq('school_year_id', schoolYear.id);
        return e ? { error: e } : { data: data || [] };
      },
      setData: setAttendance,
      setOffline,
      isCancelled: () => cancelled,
    });
    return () => { cancelled = true; };
  }, [schoolYear?.id, hasReports]);

  useEffect(() => {
    if (!schoolYear || !hasReports) return;
    let cancelled = false;
    guardedFetch({
      cacheKey: `reports_class_results_${schoolYear.id}`,
      hasData: false,
      load: async () => {
        const { data, error: e } = await supabase.rpc('dashboard_class_results', { p_school_year_id: schoolYear.id });
        return e ? { error: e } : { data: data || [] };
      },
      setData: setClassResults,
      setOffline,
      isCancelled: () => cancelled,
    });
    return () => { cancelled = true; };
  }, [schoolYear?.id, hasReports]);

  useEffect(() => {
    if (!schoolYear || !students || !hasReports) return;
    let cancelled = false;
    const ids = students.map((s) => s.id);
    if (ids.length === 0) { setEffectifsMouvement({ nouveaux: [], reinscrits: [] }); return; }
    supabase.from('enrollments').select('student_id').in('student_id', ids).neq('school_year_id', schoolYear.id)
      .then(({ data }) => {
        if (cancelled) return;
        const withPrior = new Set((data || []).map((r) => r.student_id));
        setEffectifsMouvement({
          nouveaux: students.filter((s) => !withPrior.has(s.id)),
          reinscrits: students.filter((s) => withPrior.has(s.id)),
        });
      });
    return () => { cancelled = true; };
  }, [schoolYear?.id, students, hasReports]);

  useEffect(() => {
    if (!schoolYear || !hasReports) return;
    let cancelled = false;
    guardedFetch({
      cacheKey: `reports_personnel_${schoolYear.id}`,
      hasData: false,
      load: async () => {
        const [{ data: salaries, error: e1 }, { data: advances, error: e2 }, { data: expenses, error: e3 }] = await Promise.all([
          supabase.from('staff_salaries').select('montant').eq('school_year_id', schoolYear.id),
          supabase.from('salary_advances').select('solde').eq('school_year_id', schoolYear.id).eq('statut', 'approuvee'),
          supabase.from('expenses').select('montant').eq('school_year_id', schoolYear.id),
        ]);
        const e = e1 || e2 || e3;
        if (e) return { error: e };
        return {
          data: {
            masseSalariale: (salaries || []).reduce((a, s) => a + Number(s.montant), 0),
            avancesEnCours: (advances || []).reduce((a, s) => a + Number(s.solde), 0),
            depenses: (expenses || []).reduce((a, s) => a + Number(s.montant), 0),
          },
        };
      },
      setData: setPersonnel,
      setOffline,
      isCancelled: () => cancelled,
    });
    return () => { cancelled = true; };
  }, [schoolYear?.id, hasReports]);

  if (!hasReports) {
    return (
      <div>
        <SchoolTabs />
        <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Rapports de direction</p>
        <PlanLocked currentPlanLabel={getPlanLabel(plan)} requiredPlanLabel={featurePlanRequired('rapports_avances')} featureDescription="les rapports avancés (effectifs, financier, impayés, absences, présences, résultats, synthèse générale)" />
      </div>
    );
  }

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!students || !schoolYear) {
    return (
      <div>
        <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div className="card-bold"><SkeletonTableRows count={4} columns={4} /></div>
      </div>
    );
  }

  const commonProps = { school: profile.schools, schoolYear, students, attendance, classResults, effectifsMouvement, personnel };

  return (
    <div>
      <SchoolTabs />
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      {(offlineStudents || offlineExtra) && <OfflineBanner />}
      <p className="page-title" style={{ margin: '0 0 18px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Rapports de direction</p>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -14px 22px', padding: '0 14px 4px' }}>
        {REPORTS.map((r) => (
          <button
            key={r.id}
            onClick={() => setReportId(r.id)}
            style={{ flexShrink: 0, padding: '9px 16px', borderRadius: 10, fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', border: `1px solid ${reportId === r.id ? 'var(--forest)' : 'var(--line-strong)'}`, background: reportId === r.id ? 'var(--forest)' : 'var(--paper)', color: reportId === r.id ? '#fff' : 'var(--ink)', cursor: 'pointer' }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {reportId === 'effectifs' && <EffectifsReport {...commonProps} />}
      {reportId === 'financier' && <FinancierReport {...commonProps} />}
      {reportId === 'impayes' && <ImpayesReport {...commonProps} />}
      {reportId === 'absences' && <AbsencesReport school={profile.schools} schoolYear={schoolYear} />}
      {reportId === 'presences' && <PresencesReport {...commonProps} />}
      {reportId === 'resultats' && <ResultatsReport {...commonProps} />}
      {reportId === 'synthese' && <SyntheseReport {...commonProps} />}
    </div>
  );
}
