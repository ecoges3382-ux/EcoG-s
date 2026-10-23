import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

export default function Dashboard() {
  const { profile } = useAuth();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const { activeYear, selectableYears } = useSchoolYearSelector();
  const { students, error, offline } = useEnrollmentsForYear(schoolYear);
  const [attendance, setAttendance] = useState(null);
  const [classResults, setClassResults] = useState(null);
  const [offlineExtra, setOffline] = useState(false);

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, color: 'var(--ink)' }}>
          Tableau de bord
        </p>
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

      <TrendsSection schoolYear={schoolYear} attendance={attendance} />

      <ClassBreakdown students={students} attendance={attendance} classResults={classResults} />

      <PersonnelSection schoolYear={schoolYear} />

      {!isHistorical && activeYear && <TodaySection activeYear={activeYear} students={students} />}

      <ComparisonSection currentYear={schoolYear} previousYear={previousYear} currentStudents={students} currentAttendance={attendance} />
    </div>
  );
}

// Tous les blocs ci-dessous sont cliquables : chaque carte ouvre l'écran
// détail correspondant, avec un pré-filtre quand c'est pertinent (ex.
// "Reste à recouvrer" → Recouvrement déjà filtré sur les élèves avec solde).
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
          <div className="card-bold stat-in" style={{ padding: '22px 24px', background: 'var(--forest)', borderColor: 'var(--forest)', color: '#fff', cursor: 'pointer' }}>
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
          <div className="card-bold stat-in" style={{ padding: '22px 24px', cursor: 'pointer' }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Effectif</p>
            <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 700 }}>{students.length}</p>
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

function buildSchoolYearMonths(schoolYear) {
  let startYear;
  let startMonthIndex = 8;
  if (schoolYear?.date_debut) {
    const d = new Date(schoolYear.date_debut);
    startYear = d.getFullYear();
    startMonthIndex = d.getMonth();
  } else {
    const match = schoolYear?.label?.match(/^(\d{4})-(\d{4})$/);
    startYear = match ? Number(match[1]) : new Date().getFullYear();
  }
  const today = new Date();
  const months = [];
  for (let i = 0; i < 12; i++) {
    const idx = (startMonthIndex + i) % 12;
    const year = startYear + Math.floor((startMonthIndex + i) / 12);
    const firstOfMonth = new Date(year, idx, 1);
    if (firstOfMonth > today) break;
    months.push({
      key: `${year}-${String(idx + 1).padStart(2, '0')}`,
      label: MONTH_LABELS_FR[idx],
    });
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

  const months = buildSchoolYearMonths(schoolYear);

  const paymentsData = months.map((m) => ({
    label: m.label,
    value: (payments || [])
      .filter((p) => p.date && p.date.startsWith(m.key))
      .reduce((a, p) => a + Number(p.montant), 0),
  }));
  const totalPayments = paymentsData.reduce((a, d) => a + d.value, 0);
  const avgPayments = months.length > 0 ? totalPayments / months.length : 0;

  const presenceData = months.map((m) => {
    const records = (attendance || []).filter((r) => r.date && r.date.startsWith(m.key));
    if (records.length === 0) return { label: m.label, value: 0, hasData: false };
    const presents = records.filter((r) => r.statut === 'present' || r.statut === 'retard').length;
    return { label: m.label, value: Math.round((presents / records.length) * 100), hasData: true };
  });
  const monthsWithData = presenceData.filter((d) => d.hasData);
  const avgPresence = monthsWithData.length > 0
    ? Math.round(monthsWithData.reduce((a, d) => a + d.value, 0) / monthsWithData.length)
    : 0;

  return (
    <div style={{ marginBottom: 28 }}>
      <p className="page-title" style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>
        Tendances mensuelles
      </p>
      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TrendChart
          title="Encaissements par mois"
          subtitle={totalPayments > 0
            ? `Total ${fmtF(totalPayments)} · moyenne ${fmtF(Math.round(avgPayments))}/mois`
            : 'Aucun paiement sur cette période'}
          icon="ti-trending-up"
          color="#0F4C3A"
          colorLight="#1F8A62"
          data={paymentsData}
          formatValue={(v) => fmtF(v)}
          emptyMessage="Aucun paiement enregistré pour cette année."
        />
        <TrendChart
          title="Taux de présence par mois"
          subtitle={monthsWithData.length > 0
            ? `Moyenne ${avgPresence}% sur ${monthsWithData.length} mois`
            : 'Aucun appel enregistré sur cette période'}
          icon="ti-chart-line"
          color="#D4A849"
          colorLight="#EBCB82"
          data={presenceData.map((d) => ({ label: d.label, value: d.value }))}
          formatValue={(v) => (v > 0 ? `${v}%` : '—')}
          emptyMessage="Aucun appel enregistré pour cette année."
          maxValue={100}
        />
      </div>
    </div>
  );
}

function TrendChart({ title, subtitle, icon, color, colorLight, data, formatValue, emptyMessage, maxValue }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const hasAny = (data || []).some((d) => d.value > 0);

  if (!hasAny) {
    return (
      <div className="card-bold" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{title}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>{subtitle}</p>
          </div>
          <i className={`ti ${icon}`} style={{ fontSize: 22, color }} aria-hidden="true"></i>
        </div>
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic' }}>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  const max = maxValue || Math.max(...(data || []).map((d) => d.value), 1);
  const count = (data || []).length || 1;
  const chartHeight = 130;

  return (
    <div className="card-bold" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{title}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>{subtitle}</p>
        </div>
        <i className={`ti ${icon}`} style={{ fontSize: 22, color, flexShrink: 0 }} aria-hidden="true"></i>
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: Math.max(4, 24 / count), height: chartHeight + 24 }}>
        {(data || []).map((d, i) => {
          const pct = max > 0 ? Math.min(d.value / max, 1) : 0;
          const barHeight = Math.max(pct * chartHeight, d.value > 0 ? 4 : 2);
          const isHover = hoverIdx === i;
          const isFuture = d.value === 0 && max > 0;
          return (
            <div
              key={`${d.label}-${i}`}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onTouchStart={() => setHoverIdx(i)}
              style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', position: 'relative', cursor: 'pointer' }}
            >
              {isHover && (
                <div style={{
                  position: 'absolute',
                  bottom: barHeight + 12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--ink)',
                  color: '#fff',
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: 10.5,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  zIndex: 5,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}>
                  {formatValue(d.value)}
                </div>
              )}
              <div style={{
                width: '100%',
                height: barHeight,
                background: isHover
                  ? `linear-gradient(180deg, ${colorLight} 0%, ${color} 100%)`
                  : isFuture
                    ? 'var(--line)'
                    : `linear-gradient(180deg, ${color} 0%, ${colorLight} 100%)`,
                borderRadius: '6px 6px 2px 2px',
                minHeight: 2,
                transition: 'height 0.4s ease, background 0.15s',
              }} />
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: Math.max(4, 24 / count), marginTop: 6 }}>
        {(data || []).map((d, i) => (
          <p
            key={`lbl-${d.label}-${i}`}
            style={{
              flex: 1,
              margin: 0,
              textAlign: 'center',
              fontSize: 10,
              fontWeight: 600,
              color: hoverIdx === i ? 'var(--ink)' : 'var(--muted)',
              transition: 'color 0.15s',
            }}
          >
            {d.label}
          </p>
        ))}
      </div>
    </div>
  );
}

function ClassBreakdown({ students, attendance, classResults }) {
  const attendanceByStudent = new Map();
  (attendance || []).forEach((r) => {
    const c = attendanceByStudent.get(r.student_id) || { absent: 0, retard: 0, present: 0 };
    c[r.statut] = (c[r.statut] || 0) + 1;
    attendanceByStudent.set(r.student_id, c);
  });

  const resultsByClasse = new Map((classResults || []).map((c) => [c.classe_id, c]));

  const byClasse = new Map();
  students.forEach((s) => {
    const key = s.classeId || s.niveau;
    if (!byClasse.has(key)) byClasse.set(key, { nom: s.niveau, effectif: 0, du: 0, paye: 0, absent: 0, retard: 0, present: 0, classeId: s.classeId });
    const c = byClasse.get(key);
    c.effectif += 1;
    c.du += Number(s.montant_du);
    c.paye += Number(s.montant_paye);
    const att = attendanceByStudent.get(s.id);
    if (att) { c.absent += att.absent || 0; c.retard += att.retard || 0; c.present += att.present || 0; }
  });

  const rows = [...byClasse.values()].sort((a, b) => a.nom.localeCompare(b.nom));

  function exportCsv() {
    const header = ['Classe', 'Effectif', 'Dû', 'Payé', 'Reste', 'Taux de recouvrement', 'Absences', 'Retards', 'Moyenne générale'];
    const lines = rows.map((r) => {
      const reste = r.du - r.paye;
      const taux = r.du > 0 ? Math.round((r.paye / r.du) * 100) : 0;
      const moyenne = resultsByClasse.get(r.classeId)?.moyenne_generale;
      return [r.nom, r.effectif, r.du, r.paye, reste, `${taux}%`, r.absent, r.retard, moyenne != null ? Number(moyenne).toFixed(2) : ''];
    });
    downloadCsv('repartition-par-classe.csv', [header, ...lines]);
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>Répartition par classe</p>
        <button onClick={exportCsv} style={{ fontSize: '11.5px', fontWeight: 600, padding: '7px 13px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}>
          <i className="ti ti-upload" style={{ fontSize: 13, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>Export CSV
        </button>
      </div>
      <div className="card-bold" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 680 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.7fr 1.1fr 0.9fr 1fr 0.9fr', gap: 10, padding: '11px 18px 11px 0', background: 'var(--forest-light)', fontSize: 11, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
            <span style={{ ...stickyColStyle('var(--forest-light)'), paddingLeft: 18 }}>Classe</span><span>Effectif</span><span>Reste dû</span><span>Recouvrement</span><span style={{ overflowWrap: 'break-word' }}>Absences/retards</span><span>Moyenne</span>
          </div>
          {rows.map((r, i) => {
            const reste = r.du - r.paye;
            const taux = r.du > 0 ? Math.round((r.paye / r.du) * 100) : 0;
            const cr = resultsByClasse.get(r.classeId);
            return (
              <Link
                key={r.nom}
                to="/eleves"
                className="row-link"
                style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.7fr 1.1fr 0.9fr 1fr 0.9fr', gap: 10, padding: '11px 18px 11px 0', alignItems: 'center', borderTop: i > 0 ? '1px solid var(--line)' : 'none', fontSize: 13, textDecoration: 'none', color: 'inherit' }}
              >
                <span style={{ fontWeight: 600, ...stickyColStyle('var(--row-bg)'), paddingLeft: 18 }}>{r.nom}</span>
                <span>{r.effectif}</span>
                <span style={{ color: reste > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{fmtF(reste)}</span>
                <span>{taux}%</span>
                <span>{r.absent} / {r.retard}</span>
                <span>{cr?.moyenne_generale != null ? `${Number(cr.moyenne_generale).toFixed(2)}/20` : '—'}</span>
              </Link>
            );
          })}
          {rows.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucune classe avec des élèves inscrits cette année.</p>}
        </div>
      </div>
    </div>
  );
}

function PersonnelSection({ schoolYear }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    setData(null);
    Promise.all([
      supabase.from('staff').select('id').eq('statut', 'actif'),
      supabase.from('staff_salaries').select('montant').eq('school_year_id', schoolYear.id),
      supabase.from('salary_advances').select('solde').eq('school_year_id', schoolYear.id).eq('statut', 'approuvee'),
      supabase.from('expenses').select('montant').eq('school_year_id', schoolYear.id),
    ]).then(([{ data: staff }, { data: salaries }, { data: advances }, { data: expenses }]) => {
      if (cancelled) return;
      setData({
        effectifPersonnel: (staff || []).length,
        masseSalariale: (salaries || []).reduce((a, s) => a + Number(s.montant), 0),
        avancesEnCours: (advances || []).reduce((a, s) => a + Number(s.solde), 0),
        depenses: (expenses || []).reduce((a, s) => a + Number(s.montant), 0),
      });
    });
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  return (
    <div style={{ marginBottom: 28 }}>
      <p className="page-title" style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>Personnel</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }} className="desktop-grid-4">
        <Stat label="Membres actifs" value={data ? data.effectifPersonnel : '…'} to="/personnel" />
        <Stat label="Masse salariale versée" value={data ? fmtF(data.masseSalariale) : '…'} color="var(--success)" to="/personnel" />
        <Stat label="Avances en cours" value={data ? fmtF(data.avancesEnCours) : '…'} color={data && data.avancesEnCours > 0 ? 'var(--amber)' : undefined} to="/argent" />
        <Stat label="Dépenses" value={data ? fmtF(data.depenses) : '…'} color="var(--danger)" to="/argent" />
      </div>
    </div>
  );
}

function TodaySection({ activeYear, students }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const today = todayIso();
    const debutMois = `${today.slice(0, 7)}-01`;
    Promise.all([
      supabase.from('attendance_records').select('id', { count: 'exact', head: true }).eq('school_year_id', activeYear.id).eq('date', today).eq('statut', 'absent'),
      supabase.from('payments').select('montant').eq('school_year_id', activeYear.id).eq('date', today),
      supabase.from('payments').select('montant').eq('school_year_id', activeYear.id).gte('date', debutMois),
    ]).then(([absentsRes, todayPayRes, monthPayRes]) => {
      if (cancelled) return;
      const todayRows = todayPayRes.data || [];
      setData({
        absentsAujourdhui: absentsRes.count || 0,
        paiementsDuJour: { montant: todayRows.reduce((a, p) => a + Number(p.montant), 0), count: todayRows.length },
        revenusDuMois: (monthPayRes.data || []).reduce((a, p) => a + Number(p.montant), 0),
      });
    });
    return () => { cancelled = true; };
  }, [activeYear.id]);

  const calendrierConfigure = !!(activeYear.date_tranche1 || activeYear.date_tranche2 || activeYear.date_tranche3);
  const enRetard = (students || [])
    .map((s) => ({ ...s, reste: Number(s.montant_du) - Number(s.montant_paye) }))
    .filter((s) => s.reste > 0)
    .filter((s) => !calendrierConfigure || computeRelance(s, activeYear, s.feeSchedule).relance)
    .sort((a, b) => b.reste - a.reste)
    .slice(0, 5);

  return (
    <div style={{ marginBottom: 28 }}>
      <p className="page-title" style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>Aujourd'hui — {activeYear.label}</p>
      {!data ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }} className="desktop-grid-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }} className="desktop-grid-3">
          <Stat label="Absents aujourd'hui" value={data.absentsAujourdhui} color={data.absentsAujourdhui > 0 ? 'var(--danger)' : undefined} to="/presences" />
          <Stat label="Paiements du jour" value={fmtF(data.paiementsDuJour.montant)} sub={`${data.paiementsDuJour.count} paiement${data.paiementsDuJour.count > 1 ? 's' : ''}`} to="/argent" />
          <Stat label="Revenus du mois" value={fmtF(data.revenusDuMois)} color="var(--success)" to="/argent" />
        </div>
      )}

      <div className="card-bold" style={{ padding: '20px 22px', maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>Priorité du jour</p>
          <Link to="/recouvrement?statut=avec_solde" style={{ fontSize: '12.5px', color: 'var(--forest)', fontWeight: 600, textDecoration: 'none' }}>{enRetard.length} élèves →</Link>
        </div>
        {!students ? <SkeletonRow count={3} /> : null}
        {students && enRetard.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Aucun retard de paiement.</p>}
        {enRetard.map((s, i) => (
          <Link
            key={s.id}
            to={`/eleves/${s.id}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: i < enRetard.length - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 600, color: 'var(--clay-dark)', flexShrink: 0 }}>
                {initials(s.full_name)}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>{s.full_name}</p>
                <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)' }}>{s.niveau}</p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--danger)', fontWeight: 700 }}>{fmtF(s.reste)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ComparisonSection({ currentYear, previousYear, currentStudents, currentAttendance }) {
  const { students: prevStudents } = useEnrollmentsForYear(previousYear);
  const [prevAttendance, setPrevAttendance] = useState(null);

  useEffect(() => {
    if (!previousYear) { setPrevAttendance(null); return; }
    let cancelled = false;
    supabase.from('attendance_records').select('statut').eq('school_year_id', previousYear.id)
      .then(({ data }) => { if (!cancelled) setPrevAttendance(data || []); });
    return () => { cancelled = true; };
  }, [previousYear?.id]);

  if (!previousYear) {
    return (
      <div style={{ marginBottom: 10 }}>
        <p className="page-title" style={{ margin: '0 0 10px', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>Comparaison avec l'année précédente</p>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Aucune année antérieure disponible pour comparer.</p>
      </div>
    );
  }

  const hasPrevData = !!(prevStudents && prevStudents.length > 0);

  return (
    <div style={{ marginBottom: 10 }}>
      <p className="page-title" style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>
        Comparaison {currentYear.label} vs {previousYear.label}
      </p>
      {!hasPrevData ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Données insuffisantes pour {previousYear.label} — comparaison non disponible.
        </p>
      ) : (
        <CompareTable
          currentYear={currentYear} previousYear={previousYear}
          currStudents={currentStudents} currAttendance={currentAttendance}
          prevStudents={prevStudents} prevAttendance={prevAttendance}
        />
      )}
    </div>
  );
}

function CompareTable({ currentYear, previousYear, currStudents, currAttendance, prevStudents, prevAttendance }) {
  if (!currStudents || !currAttendance || !prevAttendance) return <div className="card-bold"><SkeletonTableRows count={4} columns={3} /></div>;

  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  const tauxPresenceOf = (records) => {
    const c = { present: 0, retard: 0 };
    records.forEach((r) => { if (r.statut === 'present') c.present++; else if (r.statut === 'retard') c.retard++; });
    return records.length > 0 ? Math.round(((c.present + c.retard) / records.length) * 100) : null;
  };

  const rows = [
    { label: 'Effectif', cur: currStudents.length, prev: prevStudents.length, fmt: (v) => String(v) },
    { label: 'Total encaissé', cur: sum(currStudents, (s) => Number(s.montant_paye)), prev: sum(prevStudents, (s) => Number(s.montant_paye)), fmt: fmtF },
    {
      label: 'Taux de recouvrement',
      cur: sum(currStudents, (s) => Number(s.montant_du)) > 0 ? Math.round((sum(currStudents, (s) => Number(s.montant_paye)) / sum(currStudents, (s) => Number(s.montant_du))) * 100) : 0,
      prev: sum(prevStudents, (s) => Number(s.montant_du)) > 0 ? Math.round((sum(prevStudents, (s) => Number(s.montant_paye)) / sum(prevStudents, (s) => Number(s.montant_du))) * 100) : 0,
      fmt: (v) => `${v}%`,
    },
    { label: 'Taux de présence', cur: tauxPresenceOf(currAttendance), prev: tauxPresenceOf(prevAttendance), fmt: (v) => (v != null ? `${v}%` : '—') },
  ];

  return (
    <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 640 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', padding: '11px 18px', background: 'var(--forest-light)', fontSize: 11, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
        <span>Indicateur</span><span>{currentYear.label}</span><span>{previousYear.label}</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', padding: '11px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none', fontSize: 13.5 }}>
          <span style={{ color: 'var(--muted)' }}>{r.label}</span>
          <span style={{ fontWeight: 700 }}>{r.fmt(r.cur)}</span>
          <span>{r.fmt(r.prev)}</span>
        </div>
      ))}
    </div>
  );
}

// Stat accepte un `to` optionnel : si fourni, la carte devient un lien vers
// l'écran détail correspondant. Sans `to`, elle reste une carte statique.
function Stat({ label, value, color, sub, to }) {
  const content = (
    <>
      <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 700, color }}>{value}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>{sub}</p>}
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        className="card-bold stat-in"
        style={{ padding: '16px 18px', textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }}
        title="Voir le détail"
      >
        {content}
      </Link>
    );
  }
  return (
    <div className="card-bold stat-in" style={{ padding: '16px 18px' }}>
      {content}
    </div>
  );
}
