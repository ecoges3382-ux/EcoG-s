import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  PieChart, Pie, Cell 
} from 'recharts';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF, initials, todayIso, downloadCsv, stickyColStyle } from '../lib/utils.js';
import { useSelectedSchoolYear, useSchoolYearSelector } from '../lib/schoolYear.jsx';
import { computeRelance } from '../lib/retard.js';
import { useEnrollmentsForYear } from '../lib/enrollments.js';
import { guardedFetch } from '../lib/offlineCache.js';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import OnboardingBanner from '../components/OnboardingBanner.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import { SkeletonCard, SkeletonTableRows, SkeletonRow } from '../components/Skeleton.jsx';
import { usePageTour } from '../components/PageTour.jsx';

export default function Dashboard() {
  const { profile } = useAuth();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const { activeYear, selectableYears } = useSchoolYearSelector();
  const { students, error, offline } = useEnrollmentsForYear(schoolYear);
  const [attendance, setAttendance] = useState(null);
  const [classResults, setClassResults] = useState(null);
  const [offlineExtra, setOffline] = useState(false);

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
        <span style={{ fontSize: '12.5px', fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: 'var(--forest-light)', color: 'var(--forest-dark)' }}>
          Année scolaire {schoolYear.label}
        </span>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)' }}>
        Tous les indicateurs ci-dessous concernent l'année {schoolYear.label} — change d'année depuis le sélecteur en haut de page.
      </p>
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      {(offline || offlineExtra) && <OfflineBanner />}
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

// ... (Je garde YearKpis identique) ...
function YearKpis({ students, attendance, classResults }) {
  const totalDu = students.reduce((a, s) => a + Number(s.montant_du), 0);
  const totalPaye = students.reduce((a, s) => a + Number(s.montant_paye), 0);
  const totalReste = totalDu - totalPaye;
  const tauxRecouv = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;
  const nbAJour = students.filter((s) => Number(s.montant_du) - Number(s.montant_paye) <= 0).length;
  const nbAvecSolde = students.length - nbAJour;

  const counts = { present: 0, absent: 0, retard: 0 };
  (attendance || []).forEach((r) => { counts[r.statut] = (counts[r.statut] || 0) + 1; });
  const totalAppels = (attendance || []).length;
  const tauxPresence = totalAppels > 0 ? Math.round(((counts.present + counts.retard) / totalAppels) * 100) : null;

  const avecNotes = (classResults || []).reduce((a, c) => a + Number(c.nb_avec_notes || 0), 0);
  const moyennesPonderees = (classResults || []).filter((c) => c.moyenne_generale != null);
  const moyenneEcole = moyennesPonderees.length > 0
    ? moyennesPonderees.reduce((a, c) => a + Number(c.moyenne_generale) * Number(c.nb_avec_notes), 0) / moyennesPonderees.reduce((a, c) => a + Number(c.nb_avec_notes), 0)
    : null;

  return (
    <>
      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 18 }}>
        <Link to="/recouvrement" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }} title="Voir le recouvrement détaillé">
          <div className="card-bold stat-in" style={{ padding: '22px 24px', background: 'var(--forest)', borderColor: 'var(--forest)', color: '#fff', cursor: 'pointer', height: '100%' }}>
            <p style={{ margin: '0 0 6px', fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: 600 }}>Taux de recouvrement</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
              <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 46, fontWeight: 700, lineHeight: 1 }}>{tauxRecouv}%</p>
              <p style={{ margin: 0, fontSize: '13.5px', color: 'rgba(255,255,255,0.65)' }}>de {fmtF(totalDu)} attendus</p>
            </div>
            <div style={{ height: 9, background: 'rgba(255,255,255,0.18)', borderRadius: 8, overflow: 'hidden' }}>
              <div className="fill-bar" style={{ height: '100%', width: `${tauxRecouv}%`, background: 'var(--gold)' }}></div>
            </div>
          </div>
        </Link>
        <Link to="/eleves" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }} title="Voir la liste des élèves">
          <div className="card-bold stat-in" style={{ padding: '22px 24px', cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Effectif global</p>
            <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 38, fontWeight: 700 }}>{students.length}</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>élève{students.length > 1 ? 's' : ''} inscrit{students.length > 1 ? 's' : ''}</p>
          </div>
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }} className="desktop-grid-3">
        <Stat label="Encaissé" value={fmtF(totalPaye)} color="var(--success)" to="/recouvrement" />
        <Stat label="Reste à recouvrer" value={fmtF(totalReste)} color="var(--danger)" to="/recouvrement?statut=avec_solde" />
        <Stat label="Élèves à jour / avec solde" value={`${nbAJour} / ${nbAvecSolde}`} to="/recouvrement" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 26 }} className="desktop-grid-3">
        <Stat label="Taux de présence" value={tauxPresence != null ? `${tauxPresence}%` : '—'} color="var(--success)" to="/presences" />
        <Stat label="Absences / retards" value={`${counts.absent} / ${counts.retard}`} color={counts.absent > 0 ? 'var(--danger)' : undefined} to="/presences" />
        <Stat
          label="Moyenne générale de l'école"
          value={moyenneEcole != null ? `${moyenneEcole.toFixed(2)}/20` : '—'}
          sub={classResults ? `${avecNotes} élève${avecNotes > 1 ? 's' : ''} avec notes` : undefined}
          to="/bulletins"
        />
      </div>
    </>
  );
}

const MONTH_LABELS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

function buildMonthsForChart(schoolYear) {
  const today = new Date();
  let startDate;
  
  if (schoolYear?.date_debut) {
    startDate = new Date(schoolYear.date_debut);
  } else {
    const match = schoolYear?.label?.match(/^(\d{4})-(\d{4})$/);
    const startYear = match ? Number(match[1]) : today.getFullYear();
    startDate = new Date(startYear, 8, 1); // Septembre
  }

  const endDate = today;
  const months = [];
  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const endCursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  
  while (cursor <= endCursor) {
    months.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      label: MONTH_LABELS_FR[cursor.getMonth()],
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  
  return months;
}

function TrendsSection({ schoolYear, attendance }) {
  const [payments, setPayments] = useState(null);

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    guardedFetch({
      cacheKey: `dashboard_monthly_payments_${schoolYear.id}`,
      hasData: false,
      load: async () => {
        const { data, error: e } = await supabase
          .from('payments')
          .select('date, montant')
          .eq('school_year_id', schoolYear.id);
        return e ? { error: e } : { data: data || [] };
      },
      setData: setPayments,
      isCancelled: () => cancelled,
    });
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  if (!schoolYear) return null;

  const months = buildMonthsForChart(schoolYear);

  // 🎯 On utilise UNIQUEMENT les vrais paiements
  const dataToUse = payments || [];

  const paymentsData = months.map((m) => ({
    name: m.label,
    value: dataToUse
      .filter((p) => p.date && p.date.startsWith(m.key))
      .reduce((a, p) => a + Number(p.montant), 0),
  }));

  const totalPayments = paymentsData.reduce((a, d) => a + d.value, 0);

  const presenceData = months.map((m) => {
    const records = (attendance || []).filter((r) => r.date && r.date.startsWith(m.key));
    if (records.length === 0) return { name: m.label, value: 0, hasData: false };
    const presents = records.filter((r) => r.statut === 'present' || r.statut === 'retard').length;
    return { name: m.label, value: Math.round((presents / records.length) * 100), hasData: true };
  });
  const monthsWithData = presenceData.filter((d) => d.hasData);

  const CustomTooltip = ({ active, payload, label, isCurrency }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--ink)', padding: '8px 12px', borderRadius: 8, color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{label}</p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
            {isCurrency ? fmtF(payload[0].value) : `${payload[0].value}%`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card-bold" style={{ padding: '20px 24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Tendances mensuelles</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            Encaissements et présences · {months.length} mois affichés
          </p>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        
        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--forest)' }}>
            Encaissements {totalPayments > 0 ? `· total ${fmtF(totalPayments)}` : ''}
          </p>
          
          {totalPayments === 0 ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--line)', borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic' }}>Aucun paiement enregistré sur cette période.</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer>
                <AreaChart data={paymentsData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPayments" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--forest)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--forest)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted)' }} tickFormatter={(val) => val > 1000 ? `${val / 1000}k` : val} />
                  <Tooltip content={<CustomTooltip isCurrency={true} />} />
                  <Area type="monotone" dataKey="value" stroke="var(--forest)" strokeWidth={3} fillOpacity={1} fill="url(#colorPayments)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>
            Taux de présence (%)
          </p>
          {monthsWithData.length === 0 ? (
            <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--line)', borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic' }}>Aucun appel enregistré sur cette période.</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: 150 }}>
              <ResponsiveContainer>
                <AreaChart data={presenceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPresence" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--gold)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--gold)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted)' }} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip isCurrency={false} />} />
                  <Area type="monotone" dataKey="value" stroke="var(--gold)" strokeWidth={3} fillOpacity={1} fill="url(#colorPresence)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ... (Le reste des composants est identique : DemographicsSection, ClassBreakdown, PersonnelSection, TodaySection, ComparisonSection, CompareTable, Stat) ...
// Je te laisse copier le reste du fichier depuis ta version précédente pour gagner de la place,
// car seule la fonction TrendsSection et le composant Dashboard (qui n'a plus besoin de passer "students" à TrendsSection) ont changé.
