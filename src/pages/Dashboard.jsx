import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF, initials, todayIso, downloadCsv } from '../lib/utils.js';
import { useSelectedSchoolYear, useSchoolYearSelector } from '../lib/schoolYear.jsx';
import { computeRelance } from '../lib/retard.js';
import { useEnrollmentsForYear } from '../lib/enrollments.js';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import OnboardingBanner from '../components/OnboardingBanner.jsx';

// Tous les indicateurs annuels (effectifs, finances, présences, résultats)
// suivent l'année SÉLECTIONNÉE — jamais is_current directement — pour
// pouvoir consulter 2024-2025 sans que le dashboard bascule tout seul sur
// l'année en cours. Seule la section "Aujourd'hui" (ci-dessous) est un cas
// à part : "absents aujourd'hui" ou "revenus du mois" n'ont de sens que
// pour l'année réellement en cours, donc elle utilise explicitement
// activeYear et disparaît en consultation d'historique plutôt que
// d'afficher des zéros trompeurs pour une année révolue.
export default function Dashboard() {
  const { profile } = useAuth();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const { activeYear, selectableYears } = useSchoolYearSelector();
  const { students, error } = useEnrollmentsForYear(schoolYear);
  const [attendance, setAttendance] = useState(null);
  const [classResults, setClassResults] = useState(null);

  // Présences agrégées pour toute l'année en une seule requête groupée
  // (jamais un appel par élève ni par classe) — la classe de chaque élève
  // est déjà connue via `students` (issu d'enrollments), donc le
  // regroupement par classe se fait ensuite en mémoire à partir de ces
  // deux petits jeux de données, sans requête supplémentaire.
  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    setAttendance(null);
    supabase.from('attendance_records').select('student_id, statut').eq('school_year_id', schoolYear.id)
      .then(({ data }) => { if (!cancelled) setAttendance(data || []); });
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  // Moyenne générale par classe : calculée côté serveur (dashboard_class_results,
  // supabase/schema.sql) à partir de student_annual_average — la même
  // fonction que le rollover, jamais une deuxième formule de moyenne, et
  // jamais toutes les notes de l'école rapatriées pour un simple total.
  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    setClassResults(null);
    supabase.rpc('dashboard_class_results', { p_school_year_id: schoolYear.id })
      .then(({ data }) => { if (!cancelled) setClassResults(data || []); });
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur de chargement : {error}</p>;
  if (!students || !schoolYear) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

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
      {!isHistorical && <OnboardingBanner />}

      <YearKpis students={students} attendance={attendance} classResults={classResults} />

      <ClassBreakdown students={students} attendance={attendance} classResults={classResults} />

      <PersonnelSection schoolYear={schoolYear} />

      {/* isHistorical implique selectedYear !== activeYear : quand cette
          section est visible, l'année sélectionnée EST l'année active, donc
          `students` (déjà chargé plus haut pour schoolYear) est directement
          réutilisable ici sans nouvelle requête. */}
      {!isHistorical && activeYear && <TodaySection activeYear={activeYear} students={students} />}

      <ComparisonSection currentYear={schoolYear} previousYear={previousYear} currentStudents={students} currentAttendance={attendance} />
    </div>
  );
}

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
        <div className="card-bold" style={{ padding: '22px 24px', background: 'var(--forest)', borderColor: 'var(--forest)', color: '#fff' }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: 600 }}>Taux de recouvrement</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
            <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 46, fontWeight: 700, lineHeight: 1 }}>{tauxRecouv}%</p>
            <p style={{ margin: 0, fontSize: '13.5px', color: 'rgba(255,255,255,0.65)' }}>de {fmtF(totalDu)} attendus</p>
          </div>
          <div style={{ height: 9, background: 'rgba(255,255,255,0.18)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${tauxRecouv}%`, background: 'var(--gold)' }}></div>
          </div>
        </div>
        <div className="card-bold" style={{ padding: '22px 24px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Effectif</p>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 700 }}>{students.length}</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>élève{students.length > 1 ? 's' : ''} inscrit{students.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }} className="desktop-grid-3">
        <Stat label="Encaissé" value={fmtF(totalPaye)} color="var(--success)" />
        <Stat label="Reste à recouvrer" value={fmtF(totalReste)} color="var(--danger)" />
        <Stat label="Élèves à jour / avec solde" value={`${nbAJour} / ${nbAvecSolde}`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 26 }} className="desktop-grid-3">
        <Stat label="Taux de présence" value={tauxPresence != null ? `${tauxPresence}%` : '—'} color="var(--success)" />
        <Stat label="Absences / retards" value={`${counts.absent} / ${counts.retard}`} color={counts.absent > 0 ? 'var(--danger)' : undefined} />
        <Stat
          label="Moyenne générale de l'école"
          value={moyenneEcole != null ? `${moyenneEcole.toFixed(2)}/20` : '—'}
          sub={classResults ? `${avecNotes} élève${avecNotes > 1 ? 's' : ''} avec notes` : undefined}
        />
      </div>
    </>
  );
}

// Les classes affichées sont celles réellement concernées par l'année
// sélectionnée (regroupement par classe_id des inscriptions de CETTE
// année) — jamais la liste permanente de "classes", qui existe
// indépendamment des années et peut contenir des classes sans aucun élève
// inscrit cette année-là, ou ne plus refléter qui y était les années passées.
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
          <i className="ti ti-download" style={{ fontSize: 13, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>Export CSV
        </button>
      </div>
      <div className="card-bold" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 680 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 1fr 1fr 0.9fr 1fr', padding: '11px 18px', background: 'var(--forest-light)', fontSize: 11, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
            <span>Classe</span><span>Effectif</span><span>Reste dû</span><span>Recouvrement</span><span>Absences/retards</span><span>Moyenne</span>
          </div>
          {rows.map((r, i) => {
            const reste = r.du - r.paye;
            const taux = r.du > 0 ? Math.round((r.paye / r.du) * 100) : 0;
            const cr = resultsByClasse.get(r.classeId);
            return (
              <Link
                key={r.nom}
                to="/eleves"
                style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 1fr 1fr 0.9fr 1fr', padding: '11px 18px', alignItems: 'center', borderTop: i > 0 ? '1px solid var(--line)' : 'none', fontSize: 13, textDecoration: 'none', color: 'inherit' }}
              >
                <span style={{ fontWeight: 600 }}>{r.nom}</span>
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

// Trois totaux simples (masse salariale versée, avances en attente de
// remboursement, dépenses) sur l'année sélectionnée — jamais une deuxième
// formule : mêmes tables et mêmes colonnes que StaffDetail/Argent, juste
// agrégées ici en une somme par école plutôt que par personne.
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
        <Stat label="Membres actifs" value={data ? data.effectifPersonnel : '…'} />
        <Stat label="Masse salariale versée" value={data ? fmtF(data.masseSalariale) : '…'} color="var(--success)" />
        <Stat label="Avances en cours" value={data ? fmtF(data.avancesEnCours) : '…'} color={data && data.avancesEnCours > 0 ? 'var(--amber)' : undefined} />
        <Stat label="Dépenses" value={data ? fmtF(data.depenses) : '…'} color="var(--danger)" />
      </div>
    </div>
  );
}

// Section volontairement liée à activeYear (jamais l'année consultée) et
// masquée en consultation d'historique — "aujourd'hui"/"ce mois-ci" n'a de
// sens que pour l'année réellement en cours de l'école.
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
        <p style={{ color: 'var(--muted)' }}>Chargement…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }} className="desktop-grid-3">
          <Stat label="Absents aujourd'hui" value={data.absentsAujourdhui} color={data.absentsAujourdhui > 0 ? 'var(--danger)' : undefined} />
          <Stat label="Paiements du jour" value={fmtF(data.paiementsDuJour.montant)} sub={`${data.paiementsDuJour.count} paiement${data.paiementsDuJour.count > 1 ? 's' : ''}`} />
          <Stat label="Revenus du mois" value={fmtF(data.revenusDuMois)} color="var(--success)" />
        </div>
      )}

      <div className="card-bold" style={{ padding: '20px 22px', maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>Priorité du jour</p>
          <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>{enRetard.length} élèves</span>
        </div>
        {!students ? <p style={{ fontSize: 13, color: 'var(--muted)' }}>Chargement…</p> : null}
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

// Comparaison explicitement présentée comme deux années distinctes,
// jamais fusionnées dans un seul chiffre — et clairement marquée
// "non disponible" si l'année précédente n'a aucune inscription réelle
// (typiquement la toute première année d'usage d'EcoGès par l'école).
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

// Reçoit les données de l'année en cours déjà chargées par Dashboard (une
// seule requête par ressource pour toute la page) — seules les données de
// l'année précédente sont chargées séparément, par ComparisonSection.
function CompareTable({ currentYear, previousYear, currStudents, currAttendance, prevStudents, prevAttendance }) {
  if (!currStudents || !currAttendance || !prevAttendance) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

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

function Stat({ label, value, color, sub }) {
  return (
    <div className="card-bold" style={{ padding: '16px 18px' }}>
      <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 700, color }}>{value}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>{sub}</p>}
    </div>
  );
}
