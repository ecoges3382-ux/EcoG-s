import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF, downloadCsv, todayIso, startOfWeekIso, endOfWeekIso, startOfMonthIso, endOfMonthIso } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import { useEnrollmentsForYear } from '../lib/enrollments.js';
import { printDocument, slug } from '../lib/print.js';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import DocumentHeader from '../components/DocumentHeader.jsx';

// Ordre = priorité demandée : effectifs, financier, impayés, présences,
// résultats, puis la synthèse qui les résume tous.
const REPORTS = [
  { id: 'effectifs', label: 'Effectifs' },
  { id: 'financier', label: 'Financier' },
  { id: 'impayes', label: 'Impayés' },
  { id: 'presences', label: 'Présences' },
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
  const { students, error } = useEnrollmentsForYear(schoolYear);
  const [reportId, setReportId] = useState('synthese');
  const [attendance, setAttendance] = useState(null);
  const [classResults, setClassResults] = useState(null);
  const [effectifsMouvement, setEffectifsMouvement] = useState(null);
  const [personnel, setPersonnel] = useState(null);

  // Présences de toute l'année, une seule requête groupée — les rapports
  // par période (jour/semaine/mois) filtrent ensuite ce même jeu de
  // données en mémoire plutôt que de refaire une requête par période.
  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    setAttendance(null);
    supabase.from('attendance_records').select('student_id, date, statut').eq('school_year_id', schoolYear.id)
      .then(({ data }) => { if (!cancelled) setAttendance(data || []); });
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  // Moyenne générale par classe — calculée côté serveur, voir
  // dashboard_class_results (supabase/schema.sql) : même fonction que le
  // rollover (student_annual_average), jamais une deuxième formule.
  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    setClassResults(null);
    supabase.rpc('dashboard_class_results', { p_school_year_id: schoolYear.id })
      .then(({ data }) => { if (!cancelled) setClassResults(data || []); });
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  // Nouveaux élèves / réinscriptions : une seule requête (pas une par
  // élève) qui liste, parmi les élèves de CETTE année, ceux qui ont aussi
  // une inscription sur une AUTRE année — les absents de ce résultat sont
  // donc nouveaux cette année.
  useEffect(() => {
    if (!schoolYear || !students) return;
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
  }, [schoolYear?.id, students]);

  // Masse salariale + avances + dépenses de l'année — mêmes tables/colonnes
  // que Dashboard.jsx (PersonnelSection) et StaffDetail.jsx, jamais une
  // deuxième formule, juste réagrégées ici pour les rapports financiers.
  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    setPersonnel(null);
    Promise.all([
      supabase.from('staff_salaries').select('montant').eq('school_year_id', schoolYear.id),
      supabase.from('salary_advances').select('solde').eq('school_year_id', schoolYear.id).eq('statut', 'approuvee'),
      supabase.from('expenses').select('montant').eq('school_year_id', schoolYear.id),
    ]).then(([{ data: salaries }, { data: advances }, { data: expenses }]) => {
      if (cancelled) return;
      setPersonnel({
        masseSalariale: (salaries || []).reduce((a, s) => a + Number(s.montant), 0),
        avancesEnCours: (advances || []).reduce((a, s) => a + Number(s.solde), 0),
        depenses: (expenses || []).reduce((a, s) => a + Number(s.montant), 0),
      });
    });
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!students || !schoolYear) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const commonProps = { school: profile.schools, schoolYear, students, attendance, classResults, effectifsMouvement, personnel };

  return (
    <div>
      <SchoolTabs />
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
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
      {reportId === 'presences' && <PresencesReport {...commonProps} />}
      {reportId === 'resultats' && <ResultatsReport {...commonProps} />}
      {reportId === 'synthese' && <SyntheseReport {...commonProps} />}
    </div>
  );
}

// En-tête commun à tous les rapports : école/année/date de génération/
// période couverte/données utilisées — jamais laissé implicite.
function ReportShell({ school, title, periode, donnees, children, onPrint, onExportCsv }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={onPrint} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', cursor: 'pointer' }}>
          <i className="ti ti-printer" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Imprimer / PDF
        </button>
        {onExportCsv && (
          <button onClick={onExportCsv} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}>
            <i className="ti ti-upload" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Export CSV
          </button>
        )}
      </div>
      <div className="card-bold print-sheet" style={{ padding: '24px 26px', maxWidth: 760 }}>
        <DocumentHeader school={school} title={title} subtitle={`Généré le ${new Date().toLocaleDateString('fr-FR')}`} />
        <p style={{ margin: '0 0 18px', fontSize: 11.5, color: 'var(--muted)' }}>
          Période couverte : {periode} — Données utilisées : {donnees}
        </p>
        {children}
      </div>
    </div>
  );
}

function EffectifsReport({ school, schoolYear, students, effectifsMouvement }) {
  const parClasse = groupByClasse(students);
  return (
    <ReportShell
      school={school}
      title="Rapport des effectifs"
      periode={`Année scolaire ${schoolYear.label}`}
      donnees="Inscriptions (enrollments) de l'année sélectionnée"
      onPrint={() => printDocument(`rapport-effectifs-${slug(schoolYear.label)}`)}
      onExportCsv={() => downloadCsv(`effectifs-${slug(schoolYear.label)}.csv`, [
        ['Classe', 'Effectif'],
        ...parClasse.map((c) => [c.nom, c.items.length]),
      ])}
    >
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <MiniStat label="Effectif total" value={students.length} />
        <MiniStat label="Nouveaux élèves" value={effectifsMouvement ? effectifsMouvement.nouveaux.length : '…'} color="var(--success)" />
        <MiniStat label="Réinscriptions" value={effectifsMouvement ? effectifsMouvement.reinscrits.length : '…'} />
      </div>
      <SimpleTable
        columns={['Classe', 'Effectif']}
        rows={parClasse.map((c) => [c.nom, c.items.length])}
      />
    </ReportShell>
  );
}

function FinancierReport({ school, schoolYear, students, personnel }) {
  const parClasse = groupByClasse(students);
  const totalDu = students.reduce((a, s) => a + Number(s.montant_du), 0);
  const totalPaye = students.reduce((a, s) => a + Number(s.montant_paye), 0);
  const totalReste = totalDu - totalPaye;
  const tauxRecouv = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;

  return (
    <ReportShell
      school={school}
      title="Rapport financier"
      periode={`Année scolaire ${schoolYear.label}`}
      donnees="Montants dus/payés des inscriptions (enrollments) — même calcul que l'onglet Argent"
      onPrint={() => printDocument(`rapport-financier-${slug(schoolYear.label)}`)}
      onExportCsv={() => downloadCsv(`financier-${slug(schoolYear.label)}.csv`, [
        ['Classe', 'Dû', 'Payé', 'Reste', 'Taux de recouvrement'],
        ...parClasse.map((c) => {
          const du = c.items.reduce((a, s) => a + Number(s.montant_du), 0);
          const paye = c.items.reduce((a, s) => a + Number(s.montant_paye), 0);
          return [c.nom, du, paye, du - paye, du > 0 ? `${Math.round((paye / du) * 100)}%` : '0%'];
        }),
        [],
        ['Masse salariale versée', personnel ? personnel.masseSalariale : ''],
        ['Avances sur salaire en cours', personnel ? personnel.avancesEnCours : ''],
        ['Dépenses', personnel ? personnel.depenses : ''],
      ])}
    >
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 10 }}>
        <MiniStat label="Attendu" value={fmtF(totalDu)} />
        <MiniStat label="Encaissé" value={fmtF(totalPaye)} color="var(--success)" />
        <MiniStat label="Reste à recouvrer" value={fmtF(totalReste)} color="var(--danger)" />
      </div>
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <MiniStat label="Taux de recouvrement" value={`${tauxRecouv}%`} color="var(--success)" />
      </div>

      <SectionTitle>Personnel</SectionTitle>
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <MiniStat label="Masse salariale versée" value={personnel ? fmtF(personnel.masseSalariale) : '…'} color="var(--success)" />
        <MiniStat label="Avances en cours" value={personnel ? fmtF(personnel.avancesEnCours) : '…'} color={personnel && personnel.avancesEnCours > 0 ? 'var(--amber)' : undefined} />
        <MiniStat label="Dépenses" value={personnel ? fmtF(personnel.depenses) : '…'} color="var(--danger)" />
      </div>

      <SectionTitle>Recouvrement par classe</SectionTitle>
      <SimpleTable
        columns={['Classe', 'Dû', 'Payé', 'Reste', 'Taux']}
        rows={parClasse.map((c) => {
          const du = c.items.reduce((a, s) => a + Number(s.montant_du), 0);
          const paye = c.items.reduce((a, s) => a + Number(s.montant_paye), 0);
          const taux = du > 0 ? Math.round((paye / du) * 100) : 0;
          return [c.nom, fmtF(du), fmtF(paye), fmtF(du - paye), `${taux}%`];
        })}
      />
    </ReportShell>
  );
}

function ImpayesReport({ school, schoolYear, students }) {
  const impayes = students
    .map((s) => ({ ...s, reste: Number(s.montant_du) - Number(s.montant_paye) }))
    .filter((s) => s.reste > 0)
    .sort((a, b) => b.reste - a.reste);
  const totalImpaye = impayes.reduce((a, s) => a + s.reste, 0);

  return (
    <ReportShell
      school={school}
      title="Rapport des impayés"
      periode={`Année scolaire ${schoolYear.label}`}
      donnees="Élèves dont le solde (dû - payé) est positif"
      onPrint={() => printDocument(`rapport-impayes-${slug(schoolYear.label)}`)}
      onExportCsv={() => downloadCsv(`impayes-${slug(schoolYear.label)}.csv`, [
        ['Élève', 'Classe', 'Solde'],
        ...impayes.map((s) => [s.full_name, s.niveau, s.reste]),
      ])}
    >
      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 20 }}>
        <MiniStat label="Élèves avec un solde" value={impayes.length} color={impayes.length > 0 ? 'var(--danger)' : undefined} />
        <MiniStat label="Total impayé" value={fmtF(totalImpaye)} color="var(--danger)" />
      </div>
      <SimpleTable
        columns={['Élève', 'Classe', 'Solde']}
        rows={impayes.slice(0, 100).map((s) => [s.full_name, s.niveau, fmtF(s.reste)])}
      />
      {impayes.length > 100 && (
        <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>
          100 élèves affichés sur {impayes.length} — voir l'export CSV pour la liste complète.
        </p>
      )}
    </ReportShell>
  );
}

const PERIODES = [
  { id: 'annee', label: 'Année complète' },
  { id: 'mois', label: 'Ce mois' },
  { id: 'semaine', label: 'Cette semaine' },
  { id: 'jour', label: "Aujourd'hui" },
];

function PresencesReport({ school, schoolYear, students, attendance }) {
  const [periode, setPeriode] = useState('annee');
  const today = todayIso();
  const bounds = periode === 'jour' ? [today, today]
    : periode === 'semaine' ? [startOfWeekIso(today), endOfWeekIso(today)]
    : periode === 'mois' ? [startOfMonthIso(today), endOfMonthIso(today)]
    : null;

  const filtered = bounds ? (attendance || []).filter((a) => a.date >= bounds[0] && a.date <= bounds[1]) : (attendance || []);
  const counts = { present: 0, absent: 0, retard: 0 };
  filtered.forEach((a) => { counts[a.statut] = (counts[a.statut] || 0) + 1; });
  const total = filtered.length;
  const tauxPresence = total > 0 ? Math.round(((counts.present + counts.retard) / total) * 100) : null;

  const byStudent = new Map();
  filtered.forEach((a) => {
    const c = byStudent.get(a.student_id) || { absent: 0, retard: 0 };
    if (a.statut === 'absent') c.absent += 1; else if (a.statut === 'retard') c.retard += 1;
    byStudent.set(a.student_id, c);
  });
  const parClasse = groupByClasse(students).map((c) => {
    const absent = c.items.reduce((a, s) => a + (byStudent.get(s.id)?.absent || 0), 0);
    const retard = c.items.reduce((a, s) => a + (byStudent.get(s.id)?.retard || 0), 0);
    return { nom: c.nom, absent, retard };
  });

  return (
    <ReportShell
      school={school}
      title="Rapport des présences"
      periode={bounds ? `du ${new Date(bounds[0]).toLocaleDateString('fr-FR')} au ${new Date(bounds[1]).toLocaleDateString('fr-FR')}` : `Année scolaire ${schoolYear.label} (complète)`}
      donnees="Appels enregistrés (attendance_records)"
      onPrint={() => printDocument(`rapport-presences-${slug(schoolYear.label)}`)}
      onExportCsv={() => downloadCsv(`presences-${slug(schoolYear.label)}.csv`, [
        ['Classe', 'Absences', 'Retards'],
        ...parClasse.map((c) => [c.nom, c.absent, c.retard]),
      ])}
    >
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {PERIODES.map((p) => (
          <button
            key={p.id} onClick={() => setPeriode(p.id)}
            style={{ padding: '6px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${periode === p.id ? 'var(--forest)' : 'var(--line-strong)'}`, background: periode === p.id ? 'var(--forest)' : 'var(--paper)', color: periode === p.id ? '#fff' : 'var(--ink)' }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <MiniStat label="Taux de présence" value={tauxPresence != null ? `${tauxPresence}%` : '—'} color="var(--success)" />
        <MiniStat label="Absences" value={counts.absent} color="var(--danger)" />
        <MiniStat label="Retards" value={counts.retard} color="var(--amber)" />
      </div>
      {total === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucun appel enregistré sur cette période.</p>
      ) : (
        <SimpleTable columns={['Classe', 'Absences', 'Retards']} rows={parClasse.map((c) => [c.nom, c.absent, c.retard])} />
      )}
    </ReportShell>
  );
}

function ResultatsReport({ school, schoolYear, classResults }) {
  if (!classResults) {
    return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;
  }
  const avecNotes = classResults.reduce((a, c) => a + Number(c.nb_avec_notes || 0), 0);
  const ponderees = classResults.filter((c) => c.moyenne_generale != null);
  const moyenneEcole = ponderees.length > 0
    ? ponderees.reduce((a, c) => a + Number(c.moyenne_generale) * Number(c.nb_avec_notes), 0) / ponderees.reduce((a, c) => a + Number(c.nb_avec_notes), 0)
    : null;

  return (
    <ReportShell
      school={school}
      title="Rapport des résultats scolaires"
      periode={`Année scolaire ${schoolYear.label} (moyenne annuelle)`}
      donnees="Notes (grades), moyenne annuelle calculée avec la même formule que le bulletin et le rollover"
      onPrint={() => printDocument(`rapport-resultats-${slug(schoolYear.label)}`)}
      onExportCsv={() => downloadCsv(`resultats-${slug(schoolYear.label)}.csv`, [
        ['Classe', 'Effectif', 'Élèves avec notes', 'Moyenne générale'],
        ...classResults.map((c) => [c.classe_nom, c.effectif, c.nb_avec_notes, c.moyenne_generale != null ? Number(c.moyenne_generale).toFixed(2) : '']),
      ])}
    >
      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 20 }}>
        <MiniStat label="Moyenne générale de l'école" value={moyenneEcole != null ? `${moyenneEcole.toFixed(2)}/20` : '—'} />
        <MiniStat label="Élèves avec des notes" value={avecNotes} />
      </div>
      {classResults.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucune classe avec des élèves inscrits cette année.</p>
      ) : (
        <SimpleTable
          columns={['Classe', 'Effectif', 'Avec notes', 'Moyenne']}
          rows={classResults.map((c) => [c.classe_nom, c.effectif, c.nb_avec_notes, c.moyenne_generale != null ? `${Number(c.moyenne_generale).toFixed(2)}/20` : '—'])}
        />
      )}
    </ReportShell>
  );
}

function SyntheseReport({ school, schoolYear, students, attendance, classResults, effectifsMouvement, personnel }) {
  const totalDu = students.reduce((a, s) => a + Number(s.montant_du), 0);
  const totalPaye = students.reduce((a, s) => a + Number(s.montant_paye), 0);
  const tauxRecouv = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;
  const impayes = students.filter((s) => Number(s.montant_du) - Number(s.montant_paye) > 0).length;

  const counts = { present: 0, absent: 0, retard: 0 };
  (attendance || []).forEach((a) => { counts[a.statut] = (counts[a.statut] || 0) + 1; });
  const totalAppels = (attendance || []).length;
  const tauxPresence = totalAppels > 0 ? Math.round(((counts.present + counts.retard) / totalAppels) * 100) : null;

  const ponderees = (classResults || []).filter((c) => c.moyenne_generale != null);
  const moyenneEcole = ponderees.length > 0
    ? ponderees.reduce((a, c) => a + Number(c.moyenne_generale) * Number(c.nb_avec_notes), 0) / ponderees.reduce((a, c) => a + Number(c.nb_avec_notes), 0)
    : null;

  return (
    <ReportShell
      school={school}
      title="Synthèse générale de l'année"
      periode={`Année scolaire ${schoolYear.label}`}
      donnees="Résumé des rapports effectifs, financier, présences et résultats"
      onPrint={() => printDocument(`synthese-${slug(schoolYear.label)}`)}
    >
      <SectionTitle>Effectifs</SectionTitle>
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
        <MiniStat label="Total inscrits" value={students.length} />
        <MiniStat label="Nouveaux" value={effectifsMouvement ? effectifsMouvement.nouveaux.length : '…'} />
        <MiniStat label="Réinscriptions" value={effectifsMouvement ? effectifsMouvement.reinscrits.length : '…'} />
      </div>

      <SectionTitle>Finances</SectionTitle>
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
        <MiniStat label="Taux de recouvrement" value={`${tauxRecouv}%`} color="var(--success)" />
        <MiniStat label="Reste à recouvrer" value={fmtF(totalDu - totalPaye)} color="var(--danger)" />
        <MiniStat label="Élèves avec un solde" value={impayes} color={impayes > 0 ? 'var(--danger)' : undefined} />
      </div>

      <SectionTitle>Présences</SectionTitle>
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
        <MiniStat label="Taux de présence" value={tauxPresence != null ? `${tauxPresence}%` : '—'} color="var(--success)" />
        <MiniStat label="Absences" value={counts.absent} color="var(--danger)" />
        <MiniStat label="Retards" value={counts.retard} color="var(--amber)" />
      </div>

      <SectionTitle>Résultats scolaires</SectionTitle>
      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 18 }}>
        <MiniStat label="Moyenne générale" value={moyenneEcole != null ? `${moyenneEcole.toFixed(2)}/20` : '—'} />
        <MiniStat label="Élèves avec des notes" value={(classResults || []).reduce((a, c) => a + Number(c.nb_avec_notes || 0), 0)} />
      </div>

      <SectionTitle>Personnel</SectionTitle>
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <MiniStat label="Masse salariale versée" value={personnel ? fmtF(personnel.masseSalariale) : '…'} color="var(--success)" />
        <MiniStat label="Avances en cours" value={personnel ? fmtF(personnel.avancesEnCours) : '…'} color={personnel && personnel.avancesEnCours > 0 ? 'var(--amber)' : undefined} />
        <MiniStat label="Dépenses" value={personnel ? fmtF(personnel.depenses) : '…'} color="var(--danger)" />
      </div>
    </ReportShell>
  );
}

function SectionTitle({ children }) {
  return <p style={{ margin: '0 0 10px', fontFamily: 'var(--serif)', fontSize: 14.5, fontWeight: 600 }}>{children}</p>;
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: 'var(--forest-light)', borderRadius: 10, padding: '12px 14px' }}>
      <p style={{ margin: '0 0 3px', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

function SimpleTable({ columns, rows }) {
  const template = columns.map((_, i) => (i === 0 ? '1.6fr' : '1fr')).join(' ');
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: template, padding: '9px 14px', background: 'var(--forest-light)', fontSize: 10.5, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
        {columns.map((c) => <span key={c}>{c}</span>)}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: template, padding: '9px 14px', borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
          {row.map((v, j) => <span key={j} style={j === 0 ? { fontWeight: 600 } : undefined}>{v}</span>)}
        </div>
      ))}
      {rows.length === 0 && <p style={{ padding: 16, color: 'var(--muted)', fontSize: 12.5 }}>Aucune donnée.</p>}
    </div>
  );
}
