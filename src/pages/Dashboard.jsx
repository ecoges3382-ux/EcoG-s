import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useSelectedSchoolYear, useSchoolYearSelector } from '../lib/schoolYear.jsx';
import { useEnrollmentsForYear } from '../lib/enrollments.js';
import { supabase } from '../lib/supabase.js';
import { guardedFetch } from '../lib/offlineCache.js';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import OnboardingBanner from '../components/OnboardingBanner.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import { SkeletonCard, SkeletonTableRows } from '../components/Skeleton.jsx';
import { usePageTour } from '../components/PageTour.jsx';

// Sous-composants
import YearKpis from '../components/dashboard/YearKpis.jsx';
import TrendsSection from '../components/dashboard/TrendsSection.jsx';
import DemographicsSection from '../components/dashboard/DemographicsSection.jsx';
import ClassBreakdown from '../components/dashboard/ClassBreakdown.jsx';
import PersonnelSection from '../components/dashboard/PersonnelSection.jsx';
import TodaySection from '../components/dashboard/TodaySection.jsx';
import ComparisonSection from '../components/dashboard/ComparisonSection.jsx';

export default function Dashboard() {
  const { profile } = useAuth();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const { activeYear, selectableYears } = useSchoolYearSelector();
  const { students, error, offline } = useEnrollmentsForYear(schoolYear);
  const [attendance, setAttendance] = useState(null);
  const [classResults, setClassResults] = useState(null);
  const [offlineExtra, setOffline] = useState(false);
  const [extraError, setExtraError] = useState('');

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const tour = usePageTour(isMobile ? 'welcome_mobile' : 'welcome_desktop');

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    guardedFetch({
      cacheKey: `dashboard_attendance_${schoolYear.id}`,
      hasData: false,
      load: async () => {
        const { data, error: e } = await supabase.from('attendance_records').select('student_id, date, statut').eq('school_year_id', schoolYear.id);
        return e ? { error: e } : { data: data || [] };
      },
      setData: setAttendance,
      setOffline,
      isCancelled: () => cancelled,
      onError: (err) => { if (!cancelled) setExtraError(err.message || "Erreur de chargement des présences"); },
      onSuccess: () => { if (!cancelled) setExtraError(''); }
    });
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    guardedFetch({
      cacheKey: `dashboard_class_results_${schoolYear.id}`,
      hasData: false,
      load: async () => {
        const { data, error: e } = await supabase.rpc('dashboard_class_results', { p_school_year_id: schoolYear.id });
        return e ? { error: e } : { data: data || [] };
      },
      setData: setClassResults,
      setOffline,
      isCancelled: () => cancelled,
      onError: (err) => { if (!cancelled) setExtraError(err.message || "Erreur de chargement des résultats"); },
      onSuccess: () => { if (!cancelled) setExtraError(''); }
    });
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur de chargement : {error}</p>;
  if (!students || !schoolYear) {
    return (
      <div>
        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 18 }}>
          <SkeletonCard big />
          <SkeletonCard big />
        </div>
        <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 26 }}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div className="card-bold">
          <SkeletonTableRows count={5} columns={6} />
        </div>
      </div>
    );
  }

  const previousYear = [...selectableYears]
    .filter((y) => y.id !== schoolYear.id && y.label < schoolYear.label)
    .sort((a, b) => b.label.localeCompare(a.label))[0] || null;

  return (
    <div>
      {tour.Runner}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, color: 'var(--ink)' }}>
            Tableau de bord
          </p>
          <tour.Button />
        </div>
        {/* 👇 LE BADGE "ANNÉE SCOLAIRE" A ÉTÉ SUPPRIMÉ ICI 👇 */}
      </div>
      <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)' }}>
        Tous les indicateurs ci-dessous concernent l'année {schoolYear.label} — change d'année depuis le sélecteur en haut de page.
      </p>
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      {(offline || offlineExtra) && <OfflineBanner />}
      {extraError && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{extraError}</p>}
      {!isHistorical && <OnboardingBanner />}

      <YearKpis students={students} attendance={attendance} classResults={classResults} />
      
      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 18, marginBottom: 28 }}>
        <TrendsSection schoolYear={schoolYear} attendance={attendance} />
        <DemographicsSection students={students} />
      </div>

      <ClassBreakdown students={students} attendance={attendance} classResults={classResults} />
      <PersonnelSection schoolYear={schoolYear} />

      {!isHistorical && activeYear && <TodaySection activeYear={activeYear} students={students} />}

      <ComparisonSection currentYear={schoolYear} previousYear={previousYear} currentStudents={students} currentAttendance={attendance} />
    </div>
  );
}
