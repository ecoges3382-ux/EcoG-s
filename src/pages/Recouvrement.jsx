import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF, downloadCsv, TYPES_FRAIS } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import { computeRelance } from '../lib/retard.js';
import { useEnrollmentsForYear } from '../lib/enrollments.js';
import { sendWhatsAppMessage } from '../lib/whatsapp.js';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import Dropdown from '../components/Dropdown.jsx';
import { SkeletonCard, SkeletonTableRows } from '../components/Skeleton.jsx';
import { usePageTour } from '../components/PageTour.jsx';
import { useToast } from '../components/Toast.jsx';

const STATUT_RECOUVREMENT = {
  a_jour: { label: 'À jour', bg: 'var(--success-light)', fg: 'var(--success)' },
  a_relancer: { label: 'À relancer', bg: 'var(--danger-light)', fg: 'var(--danger)' },
  dans_les_delais: { label: 'Dans les délais', bg: 'var(--amber-light)', fg: 'var(--amber)' },
  solde_restant: { label: 'Solde restant', bg: 'var(--amber-light)', fg: 'var(--amber)' },
  moratoire: { label: 'Moratoire', bg: '#F0EDE5', fg: 'var(--muted)' },
  moratoire_expirant: { label: 'Moratoire (fin proche)', bg: 'var(--amber-light)', fg: 'var(--amber)' },
};

const STATUT_FILTERS = [
  { id: 'tous', label: 'Tous' },
  { id: 'avec_solde', label: 'Avec solde' },
  { id: 'a_jour', label: 'À jour' },
  { id: 'a_relancer', label: 'À relancer' },
  { id: 'dans_les_delais', label: 'Dans les délais' },
  { id: 'solde_restant', label: 'Solde restant' },
  { id: 'moratoire', label: 'Moratoire' },
  { id: 'moratoire_expirant', label: 'Moratoire (fin proche)' },
];

function matchStatut(s, statut) {
  if (statut === 'tous') return true;
  if (statut === 'avec_solde') return s.resteEcolage > 0 || s.resteConnexe > 0;
  return s.statutKey === statut;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Recouvrement() {
  const showToast = useToast();
  const { profile } = useAuth();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  const { students, error, offline } = useEnrollmentsForYear(schoolYear);
  const [inscriptionByStudent, setInscriptionByStudent] = useState(null);
  const [remindersByStudent, setRemindersByStudent] = useState({});
  const [manualRemindersByStudent, setManualRemindersByStudent] = useState({});
  const [search, setSearch] = useState('');
  const [searchPriority, setSearchPriority] = useState('');
  const [filterClasse, setFilterClasse] = useState('toutes');

  const [selectedPriorityIds, setSelectedPriorityIds] = useState([]);
  const [selectedDetailIds, setSelectedDetailIds] = useState([]);

  const [sendingId, setSendingId] = useState(null);
  const [bulkSending, setBulkSending] = useState(false);
  const tour = usePageTour('recouvrement');

  const [searchParams, setSearchParams] = useSearchParams();
  const filterStatut = searchParams.get('statut') || 'tous';

  function setFilterStatut(next) {
    const newParams = new URLSearchParams(searchParams);
    if (next === 'tous') newParams.delete('statut');
    else newParams.set('statut', next);
    setSearchParams(newParams, { replace: true });
  }

  const inscriptionTypeId = TYPES_FRAIS.find(
    (t) => /inscription/i.test(t.id || '') || /inscription/i.test(t.label || ''),
  )?.id;

  useEffect(() => {
    if (!schoolYear) return;
    if (!inscriptionTypeId) { setInscriptionByStudent({}); return; }
    let cancelled = false;
    supabase
      .from('payments')
      .select('student_id, montant')
      .eq('school_year_id', schoolYear.id)
      .eq('type_frais', inscriptionTypeId)
      .then(({ data }) => {
        if (cancelled) return;
        const map = {};
        (data || []).forEach((p) => {
          map[p.student_id] = (map[p.student_id] || 0) + Number(p.montant);
        });
        setInscriptionByStudent(map);
      });
    return () => { cancelled = true; };
  }, [schoolYear?.id, inscriptionTypeId]);

  // On charge TOUTES les relances (auto + manuelles) en une seule requête
  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    supabase
      .from('whatsapp_messages')
      .select('student_id, template_name, created_at, statut')
      .eq('school_id', profile.school_id)
      .eq('type', 'relance_paiement')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        const autoMap = {};
        const manualMap = {};
        (data || []).forEach((m) => {
          const isAuto = m.template_name && m.template_name.startsWith('rappel_j');
          if (isAuto) {
            if (!autoMap[m.student_id]) autoMap[m.student_id] = [];
            autoMap[m.student_id].push(m);
          } else {
            // Relance manuelle : on ne garde que la plus récente et réussie
            if (!manualMap[m.student_id] && m.statut === 'envoye') {
              manualMap[m.student_id] = m;
            }
          }
        });
        setRemindersByStudent(autoMap);
        setManualRemindersByStudent(manualMap);
      });
    return () => { cancelled = true; };
  }, [schoolYear?.id, profile.school_id]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!students || inscriptionByStudent === null) {
    return (
      <div>
        {isHistorical && <HistoricalYearBanner year={schoolYear} />}
        <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div className="card-bold"><SkeletonTableRows count={6} columns={6} /></div>
      </div>
    );
  }

  const calendrierConfigure = !!(schoolYear && (
    schoolYear.date_tranche1 || schoolYear.date_tranche2 || schoolYear.date_tranche3 || schoolYear.date_connexe
  ));

  const enrichis = students.map((s) => {
    const resteEcolage = Number(s.montant_du) - Number(s.montant_paye);
    const resteConnexe = Number(s.frais_connexe_du) - Number(s.frais_connexe_paye);
    const inscriptionPaye = inscriptionByStudent[s.id] || 0;
    const relance = computeRelance(s, schoolYear, s.feeSchedule);
    let statutKey;
    if (relance.moratoireExpirant) statutKey = 'moratoire_expirant';
    else if (relance.moratoire) statutKey = 'moratoire';
    else if (resteEcolage <= 0 && resteConnexe <= 0) statutKey = 'a_jour';
    else if (calendrierConfigure) statutKey = (relance.relance || relance.relanceConnexe) ? 'a_relancer' : 'dans_les_delais';
    else statutKey = 'solde_restant';
    return { ...s, resteEcolage, resteConnexe, inscriptionPaye, relance, statutKey };
  });

  const totalEcolageDu = enrichis.reduce((a, s) => a + Number(s.montant_du), 0);
  const totalEcolagePaye = enrichis.reduce((a, s) => a + Number(s.montant_paye), 0);
  const totalEcolageReste = Math.max(totalEcolageDu - totalEcolagePaye, 0);
  const tauxEcolage = totalEcolageDu > 0 ? Math.round((totalEcolagePaye / totalEcolageDu) * 100) : 0;

  const totalConnexeDu = enrichis.reduce((a, s) => a + Number(s.frais_connexe_du), 0);
  const totalConnexePaye = enrichis.reduce((a, s) => a + Number(s.frais_connexe_paye), 0);
  const totalConnexeReste = Math.max(totalConnexeDu - totalConnexePaye, 0);
  const tauxConnexe = totalConnexeDu > 0 ? Math.round((totalConnexePaye / totalConnexeDu) * 100) : 0;

  const totalInscriptionPaye = enrichis.reduce((a, s) => a + s.inscriptionPaye, 0);
  const nbInscriptionPayes = enrichis.filter((s) => s.inscriptionPaye > 0).length;

  const totalAttendu = totalEcolageDu + totalConnexeDu;
  const totalEncaisse = totalEcolagePaye + totalConnexePaye;
  const totalReste = totalEcolageReste + totalConnexeReste;
  const tauxGlobal = totalAttendu > 0 ? Math.round((totalEncaisse / totalAttendu) * 100) : 0;
  const nbAJour = enrichis.filter((s) => s.statutKey === 'a_jour').length;
  const nbAvecSolde = enrichis.length - nbAJour;

  const elevesPrioritairesBase = enrichis
    .filter((s) => s.resteEcolage > 0 || s.resteConnexe > 0)
    .map((s) => {
      const enRetard = (calendrierConfigure && (s.relance.relance || s.relance.relanceConnexe)) || !calendrierConfigure;
      const derniereManuelle = manualRemindersByStudent[s.id] || null;
      return { ...s, enRetard, totalReste: s.resteEcolage + s.resteConnexe, derniereManuelle };
    })
    .filter((s) => s.enRetard)
    .sort((a, b) => b.totalReste - a.totalReste);

  const elevesPrioritaires = elevesPrioritairesBase.filter((s) =>
    !searchPriority.trim() || s.full_name.toLowerCase().includes(searchPriority.trim().toLowerCase())
  );

  const elevesEcheancesProches = enrichis
    .filter((s) => {
      if (s.resteEcolage <= 0 && s.resteConnexe <= 0) return false;

      const echeances = [];
      if (schoolYear?.date_tranche1 && s.resteEcolage > 0) echeances.push({ type: 'tranche1', date: schoolYear.date_tranche1 });
      if (schoolYear?.date_tranche2 && s.resteEcolage > 0) echeances.push({ type: 'tranche2', date: schoolYear.date_tranche2 });
      if (schoolYear?.date_tranche3 && s.resteEcolage > 0) echeances.push({ type: 'tranche3', date: schoolYear.date_tranche3 });
      if (schoolYear?.date_connexe && s.resteConnexe > 0) echeances.push({ type: 'connexe', date: schoolYear.date_connexe });

      return echeances.some(e => [15, 7, 3].includes(daysUntil(e.date)));
    })
    .map((s) => {
      const echeances = [];
      if (schoolYear?.date_tranche1 && s.resteEcolage > 0) echeances.push({ type: 'tranche1', date: schoolYear.date_tranche1, label: '1ère tranche' });
      if (schoolYear?.date_tranche2 && s.resteEcolage > 0) echeances.push({ type: 'tranche2', date: schoolYear.date_tranche2, label: '2ème tranche' });
      if (schoolYear?.date_tranche3 && s.resteEcolage > 0) echeances.push({ type: 'tranche3', date: schoolYear.date_tranche3, label: '3ème tranche' });
      if (schoolYear?.date_connexe && s.resteConnexe > 0) echeances.push({ type: 'connexe', date: schoolYear.date_connexe, label: 'Frais connexes' });

      const prochaine = echeances.find(e => [15, 7, 3].includes(daysUntil(e.date)));
      const jours = daysUntil(prochaine.date);

      const studentReminders = remindersByStudent[s.id] || [];
      const templateName = `rappel_j${jours}_${prochaine.type}`;
      const lastReminder = studentReminders.find(m => m.template_name === templateName);

      let relanceInfo = null;
      if (lastReminder) {
        relanceInfo = {
          label: `J-${jours} envoyé`,
          date: new Date(lastReminder.created_at).toLocaleDateString('fr-FR'),
        };
      }

      return { ...s, echeanceProche: prochaine, joursRestants: jours, relanceInfo };
    })
    .sort((a, b) => a.joursRestants - b.joursRestants);

  async function handleRelance(studentId) {
    setSendingId(studentId);
    try {
      await sendWhatsAppMessage({ type: 'relance_paiement', student_id: studentId });
      showToast('Relance envoyée !');
      // Recharger les relances manuelles pour mettre à jour le badge
      const { data } = await supabase
        .from('whatsapp_messages')
        .select('student_id, template_name, created_at, statut')
        .eq('school_id', profile.school_id)
        .eq('type', 'relance_paiement')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data && data.statut === 'envoye' && !data.template_name?.startsWith('rappel_j')) {
        setManualRemindersByStudent(prev => ({ ...prev, [studentId]: data }));
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
    setSendingId(null);
  }

  async function handleBulkRelance(ids, clearSelectionFn) {
    if (ids.length === 0) return;
    setBulkSending(true);
    let count = 0;
    for (const id of ids) {
      try {
        await sendWhatsAppMessage({ type: 'relance_paiement', student_id: id });
        count++;
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.error(err);
      }
    }
    setBulkSending(false);
    if (clearSelectionFn) clearSelectionFn();
    showToast(`${count} relance${count > 1 ? 's' : ''} envoyée${count > 1 ? 's' : ''} !`);
    // Recharger toutes les relances manuelles
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('student_id, template_name, created_at, statut')
      .eq('school_id', profile.school_id)
      .eq('type', 'relance_paiement')
      .order('created_at', { ascending: false });
    if (data) {
      const manualMap = {};
      data.forEach((m) => {
        const isAuto = m.template_name && m.template_name.startsWith('rappel_j');
        if (!isAuto && m.statut === 'envoye' && !manualMap[m.student_id]) {
          manualMap[m.student_id] = m;
        }
      });
      setManualRemindersByStudent(manualMap);
    }
  }

  function togglePrioritySelection(id) {
    setSelectedPriorityIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleDetailSelection(id) {
    setSelectedDetailIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleAllPrioritaires() {
    const allIds = elevesPrioritaires.map(s => s.id);
    setSelectedPriorityIds(prev => prev.length === allIds.length ? [] : allIds);
  }

  function toggleAllDetails() {
    const allIds = filtered.map(s => s.id);
    setSelectedDetailIds(prev => prev.length === allIds.length ? [] : allIds);
  }

  const classes = [...new Set(students.map((s) => s.niveau))].sort();
  const filtered = enrichis
    .filter((s) => !search.trim() || s.full_name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((s) => filterClasse === 'toutes' || s.niveau === filterClasse)
    .filter((s) => matchStatut(s, filterStatut))
    .sort((a, b) => (b.resteEcolage + b.resteConnexe) - (a.resteEcolage + a.resteConnexe));

  function exportCsv() {
    const header = [
      'Élève', 'Classe',
      'Écolage dû', 'Écolage payé', 'Écolage reste',
      'Inscription payée',
      'Connexes dû', 'Connexes payé', 'Connexes reste',
      'Statut',
    ];
    const lines = filtered.map((s) => [
      s.full_name, s.niveau,
      Number(s.montant_du), Number(s.montant_paye), s.resteEcolage,
      s.inscriptionPaye,
      Number(s.frais_connexe_du), Number(s.frais_connexe_paye), s.resteConnexe,
      STATUT_RECOUVREMENT[s.statutKey].label,
    ]);
    downloadCsv(`recouvrement-${schoolYear.label.replace(/\s+/g, '_')}.csv`, [header, ...lines]);
  }

  const pieData = [
    { name: 'Payé en totalité', value: nbAJour, color: 'var(--success)' },
    { name: 'Paiement partiel', value: enrichis.filter(s => s.statutKey === 'dans_les_delais' || s.statutKey === 'solde_restant' || s.statutKey === 'moratoire' || s.statutKey === 'moratoire_expirant').length, color: 'var(--amber)' },
    { name: 'Impayé / En retard', value: enrichis.filter(s => s.statutKey === 'a_relancer').length, color: 'var(--danger)' },
  ].filter(d => d.value > 0);

  return (
    <div>
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      {offline && <OfflineBanner />}
      {tour.Runner}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>
            Recouvrement
          </p>
          <tour.Button />
        </div>
        <span style={{ fontSize: '12.5px', fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: 'var(--forest-light)', color: 'var(--forest-dark)' }}>
          Année scolaire {schoolYear.label}
        </span>
      </div>

      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 18, marginBottom: 24 }}>
        <div className="card-bold" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Répartition des élèves</p>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  labelLine={false}
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value} élèves`, name]}
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ textAlign: 'center', marginTop: -110, pointerEvents: 'none' }}>
              <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 700, color: 'var(--ink)' }}>{enrichis.length}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Élèves</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 20 }}>
            {pieData.map((d) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{d.name}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-bold" style={{ padding: '20px' }}>
          <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Aperçu des montants</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            
            <div style={{ background: 'var(--paper)', border: '1px solid var(--line-strong)', padding: '16px', borderRadius: 12 }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Taux de recouvrement global</p>
              <p style={{ margin: '4px 0 0', fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 700, color: tauxGlobal >= 75 ? 'var(--success)' : tauxGlobal >= 50 ? 'var(--amber)' : 'var(--danger)' }}>{tauxGlobal}%</p>
            </div>
            <div style={{ background: 'var(--danger-light)', padding: '16px', borderRadius: 12 }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Reste à recouvrer</p>
              <p style={{ margin: '4px 0 0', fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 700, color: 'var(--danger)' }}>{fmtF(totalReste)}</p>
            </div>
            <div style={{ background: 'var(--success-light)', padding: '16px', borderRadius: 12 }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Total encaissé</p>
              <p style={{ margin: '4px 0 0', fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>{fmtF(totalEncaisse)}</p>
            </div>
            
            <div style={{ background: 'var(--paper)', border: '1px solid var(--line-strong)', padding: '16px', borderRadius: 12 }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Total attendu</p>
              <p style={{ margin: '4px 0 0', fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 700, color: 'var(--ink)' }}>{fmtF(totalAttendu)}</p>
            </div>

          </div>
        </div>
      </div>

      <div data-tour="recouvrement-kpis" className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
        <TypeCard label="Droit d'écolage" du={totalEcolageDu} paye={totalEcolagePaye} reste={totalEcolageReste} taux={tauxEcolage} />
        <TypeCard label="Frais d'inscription" inscription paye={totalInscriptionPaye} count={nbInscriptionPayes} />
        <TypeCard label="Frais connexes" du={totalConnexeDu} paye={totalConnexePaye} reste={totalConnexeReste} taux={tauxConnexe} />
      </div>

      {/* ===================== CARTE 1 : PRIORITÉ ===================== */}
      <div data-tour="recouvrement-priority" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
            Priorité (Relance manuelle)
          </p>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={searchPriority}
              onChange={(e) => setSearchPriority(e.target.value)}
              placeholder="Rechercher un élève…"
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line-strong)', fontSize: 12.5, width: 220, boxSizing: 'border-box', color: 'var(--ink)' }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', background: 'var(--danger-light)', padding: '4px 10px', borderRadius: 20 }}>
              {elevesPrioritaires.length} élève{elevesPrioritaires.length > 1 ? 's' : ''} en retard
            </span>

            <button
              onClick={() => handleBulkRelance(selectedPriorityIds, () => setSelectedPriorityIds([]))}
              disabled={selectedPriorityIds.length === 0 || bulkSending}
              style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', background: selectedPriorityIds.length > 0 ? '#ff8c00' : 'var(--line)', color: selectedPriorityIds.length > 0 ? '#fff' : 'var(--muted)', cursor: (selectedPriorityIds.length === 0 || bulkSending) ? 'not-allowed' : 'pointer', opacity: (selectedPriorityIds.length === 0 || bulkSending) ? 0.7 : 1 }}
            >
              <i className="ti ti-brand-whatsapp" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>
              {bulkSending ? 'Envoi…' : `Relancer la sélection (${selectedPriorityIds.length})`}
            </button>

            {elevesPrioritaires.length > 0 && (
              <button
                onClick={() => handleBulkRelance(elevesPrioritaires.map(s => s.id), () => setSelectedPriorityIds([]))}
                disabled={bulkSending}
                style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', background: '#25D366', color: '#fff', cursor: bulkSending ? 'default' : 'pointer', opacity: bulkSending ? 0.6 : 1 }}
              >
                <i className="ti ti-brand-whatsapp" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>
                {bulkSending ? 'Envoi…' : 'Tout relancer'}
              </button>
            )}
          </div>
        </div>

        <div className="card-bold" style={{ overflowX: 'auto', maxHeight: 350, overflowY: 'auto' }}>
          <div style={{ minWidth: 980 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '50px 1.6fr 1fr 1fr 1fr 1.2fr 90px', gap: 8, padding: '12px 20px 12px 0', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 20 }}>
              <span className="sticky-header" style={{ position: 'sticky', left: 0, zIndex: 21, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedPriorityIds.length > 0 && selectedPriorityIds.length === elevesPrioritaires.length}
                  onChange={toggleAllPrioritaires}
                  style={{ cursor: 'pointer' }}
                />
              </span>
              <span className="sticky-header" style={{ position: 'sticky', left: 50, zIndex: 21, display: 'block', width: '100%' }}>Élève</span>
              <span>Reste Écolage</span>
              <span>Reste Connexes</span>
              <span>Total Dû</span>
              <span>Dernière relance</span>
              <span></span>
            </div>
            {elevesPrioritaires.map((s, i) => (
              <div
                key={s.id}
                className="row-link"
                style={{ display: 'grid', gridTemplateColumns: '50px 1.6fr 1fr 1fr 1fr 1.2fr 90px', gap: 8, padding: '12px 20px 12px 0', alignItems: 'center', borderBottom: i < elevesPrioritaires.length - 1 ? '1px solid var(--line)' : 'none' }}
              >
                <span className="sticky-col" style={{ position: 'sticky', left: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedPriorityIds.includes(s.id)}
                    onChange={() => togglePrioritySelection(s.id)}
                    style={{ cursor: 'pointer' }}
                  />
                </span>
                <div className="sticky-col" style={{ position: 'sticky', left: 50, zIndex: 10, boxShadow: '4px 0 8px -2px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                  <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>{s.full_name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>{s.niveau}</p>
                </div>
                <span style={{ fontSize: 13, fontWeight: s.resteEcolage > 0 ? 600 : 400, color: s.resteEcolage > 0 ? 'var(--danger)' : 'var(--muted)' }}>
                  {s.resteEcolage > 0 ? fmtF(s.resteEcolage) : '—'}
                </span>
                <span style={{ fontSize: 13, fontWeight: s.resteConnexe > 0 ? 600 : 400, color: s.resteConnexe > 0 ? 'var(--danger)' : 'var(--muted)' }}>
                  {s.resteConnexe > 0 ? fmtF(s.resteConnexe) : '—'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{fmtF(s.totalReste)}</span>

                <div>
                  {s.derniereManuelle ? (
                    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ background: 'var(--success-light)', color: 'var(--success)', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: 20, width: 'fit-content' }}>
                        ✅ Relancé
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--muted)', paddingLeft: 4 }}>
                        le {new Date(s.derniereManuelle.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </span>
                  ) : (
                    <span style={{ background: '#F0EDE5', color: 'var(--muted)', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: 20, width: 'fit-content' }}>
                      ⏳ Jamais relancé
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => handleRelance(s.id)}
                    disabled={sendingId === s.id || bulkSending}
                    style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 6, border: '1px solid #25D366', background: 'var(--paper)', color: '#0A7A4F', cursor: (sendingId === s.id || bulkSending) ? 'default' : 'pointer', opacity: (sendingId === s.id || bulkSending) ? 0.5 : 1 }}
                  >
                    {sendingId === s.id ? '…' : (s.derniereManuelle ? 'Relancer à nouveau' : 'Relancer')}
                  </button>
                </div>
              </div>
            ))}
            {elevesPrioritaires.length === 0 && (
              <p style={{ padding: 20, color: 'var(--success)', fontSize: 13, textAlign: 'center', fontWeight: 600 }}>
                <i className="ti ti-check" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>
                Aucun élève en retard ! Tout est à jour.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ===================== CARTE 2 : ÉCHÉANCES PROCHES ===================== */}
      {elevesEcheancesProches.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
              Échéances proches (Relance Auto)
            </p>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)', background: 'var(--amber-light)', padding: '4px 10px', borderRadius: 20 }}>
              {elevesEcheancesProches.length} élève{elevesEcheancesProches.length > 1 ? 's' : ''} · Échéance dans 15, 7 ou 3 jours
            </span>
          </div>

          <div className="card-bold" style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto' }}>
            <div style={{ minWidth: 860 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1.2fr 1.2fr', gap: 8, padding: '12px 20px 12px 20px', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 20 }}>
                <span className="sticky-header" style={{ position: 'sticky', left: 0, zIndex: 21, display: 'block', width: '100%' }}>Élève</span>
                <span>Total Dû</span>
                <span>Échéance</span>
                <span>Statut Relance Auto</span>
                <span></span>
              </div>
              {elevesEcheancesProches.map((s, i) => (
                <div
                  key={s.id}
                  style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1.2fr 1.2fr', gap: 8, padding: '12px 20px', alignItems: 'center', borderBottom: i < elevesEcheancesProches.length - 1 ? '1px solid var(--line)' : 'none' }}
                >
                  <div className="sticky-col" style={{ position: 'sticky', left: 0, zIndex: 10, boxShadow: '4px 0 8px -2px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                    <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>{s.full_name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>{s.niveau}</p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                    {fmtF(s.resteEcolage + s.resteConnexe)}
                  </span>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--clay-dark)' }}>
                      {s.echeanceProche.label}
                    </span>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>
                      dans {s.joursRestants} jours
                    </p>
                  </div>
                  <div>
                    {s.relanceInfo ? (
                      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ background: 'var(--success-light)', color: 'var(--success)', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: 20, width: 'fit-content' }}>
                          ✅ {s.relanceInfo.label}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--muted)', paddingLeft: 4 }}>le {s.relanceInfo.date}</span>
                      </span>
                    ) : (
                      <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: 20, width: 'fit-content' }}>
                        ⏳ En attente
                      </span>
                    )}
                  </div>
                  <div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================== CARTE 3 : DÉTAIL PAR ÉLÈVE ===================== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
          Détail par élève (Tous)
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => handleBulkRelance(selectedDetailIds, () => setSelectedDetailIds([]))}
            disabled={selectedDetailIds.length === 0 || bulkSending}
            style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', background: selectedDetailIds.length > 0 ? '#ff8c00' : 'var(--line)', color: selectedDetailIds.length > 0 ? '#fff' : 'var(--muted)', cursor: (selectedDetailIds.length === 0 || bulkSending) ? 'not-allowed' : 'pointer', opacity: (selectedDetailIds.length === 0 || bulkSending) ? 0.7 : 1 }}
          >
            <i className="ti ti-brand-whatsapp" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>
            {bulkSending ? 'Envoi…' : `Relancer la sélection (${selectedDetailIds.length})`}
          </button>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un élève…"
            style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13, width: 200, boxSizing: 'border-box', color: 'var(--ink)' }}
          />
          <Dropdown
            value={filterClasse === 'toutes' ? '' : filterClasse}
            onChange={(v) => setFilterClasse(v || 'toutes')}
            options={[
              { value: '', label: 'Toutes classes' },
              ...classes.map((c) => ({ value: c, label: c })),
            ]}
            style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13 }}
            wrapperStyle={{ width: 'auto', minWidth: 150 }}
          />
          <button
            onClick={exportCsv}
            style={{ fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}
          >
            <i className="ti ti-upload" style={{ fontSize: 13, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>Export CSV
          </button>
        </div>
      </div>

      <div data-tour="recouvrement-filters" className="hide-scrollbar" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {STATUT_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterStatut(f.id)}
            style={{
              padding: '7px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${filterStatut === f.id ? 'var(--forest)' : 'var(--line-strong)'}`,
              background: filterStatut === f.id ? 'var(--forest)' : 'var(--paper)',
              color: filterStatut === f.id ? '#fff' : 'var(--ink)',
            }}
          >
            {f.label}
            {f.id !== 'tous' && (
              <span style={{ opacity: 0.7, marginLeft: 5 }}>
                {enrichis.filter((s) => matchStatut(s, f.id)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card-bold" style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
        <div style={{ minWidth: 860 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '50px 1.6fr 1fr 0.9fr 1fr 1.1fr', gap: 8, padding: '12px 20px 12px 0', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 20 }}>
            <span className="sticky-header" style={{ position: 'sticky', left: 0, zIndex: 21, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input
                type="checkbox"
                checked={selectedDetailIds.length > 0 && selectedDetailIds.length === filtered.length}
                onChange={toggleAllDetails}
                style={{ cursor: 'pointer' }}
              />
            </span>
            <span className="sticky-header" style={{ position: 'sticky', left: 50, zIndex: 21, display: 'block', width: '100%' }}>Élève</span>
            <span>Écolage</span>
            <span>Inscription</span>
            <span>Connexes</span>
            <span>Statut</span>
          </div>
          {filtered.map((s, i) => {
            const st = STATUT_RECOUVREMENT[s.statutKey];
            return (
              <div
                key={s.id}
                className="row-link"
                style={{ display: 'grid', gridTemplateColumns: '50px 1.6fr 1fr 0.9fr 1fr 1.1fr', gap: 8, padding: '12px 20px 12px 0', alignItems: 'center', borderBottom: i < filtered.length - 1 ? '1px solid var(--line)' : 'none' }}
              >
                <span className="sticky-col" style={{ position: 'sticky', left: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedDetailIds.includes(s.id)}
                    onChange={() => toggleDetailSelection(s.id)}
                    style={{ cursor: 'pointer' }}
                  />
                </span>

                {/* CORRECTION ICI : La balise Link elle-même est maintenant "sticky" */}
                <Link to={`/eleves/${s.id}`} className="sticky-col" style={{ position: 'sticky', left: 50, zIndex: 10, boxShadow: '4px 0 8px -2px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', textDecoration: 'none', color: 'inherit' }}>
                  <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>{s.full_name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>{s.niveau}</p>
                </Link>

                <Link to={`/eleves/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <MoneyCell paye={Number(s.montant_paye)} du={Number(s.montant_du)} reste={s.resteEcolage} />
                </Link>

                <Link to={`/eleves/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {s.inscriptionPaye > 0 ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 600, color: 'var(--success)' }}>
                      <i className="ti ti-check" style={{ fontSize: 12 }} aria-hidden="true"></i>
                      {fmtF(s.inscriptionPaye)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>—</span>
                  )}
                </Link>

                <Link to={`/eleves/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <MoneyCell paye={Number(s.frais_connexe_paye)} du={Number(s.frais_connexe_du)} reste={s.resteConnexe} />
                </Link>

                <Link to={`/eleves/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span style={{ background: st.bg, color: st.fg, fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20, width: 'fit-content', display: 'inline-block' }}>
                    {st.label}
                  </span>
                </Link>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun élève ne correspond à ces filtres.</p>
          )}
        </div>
      </div>

      <div data-tour="recouvrement-synthese" className="card-bold" style={{ padding: '20px 22px', marginTop: 24, background: 'linear-gradient(135deg, var(--forest-light), #FAF6EC)', borderColor: 'var(--forest)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <i className="ti ti-sum" style={{ fontSize: 20, color: 'var(--forest)' }} aria-hidden="true"></i>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 700, color: 'var(--forest-dark)' }}>
            Synthèse globale — écolage + connexes
          </p>
        </div>
        <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
          <SynthesisStat label="Attendu total" value={fmtF(totalAttendu)} />
          <SynthesisStat label="Encaissé total" value={fmtF(totalEncaisse)} color="var(--success)" />
          <SynthesisStat label="Reste total à recouvrer" value={fmtF(totalReste)} color="var(--danger)" />
        </div>
        <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          <SynthesisStat label="Taux global de recouvrement" value={`${tauxGlobal}%`} color="var(--success)" />
          <SynthesisStat label="Élèves à jour (tout confondu)" value={nbAJour} color="var(--success)" />
          <SynthesisStat label="Élèves avec au moins un solde" value={nbAvecSolde} color={nbAvecSolde > 0 ? 'var(--danger)' : undefined} />
        </div>
      </div>

      <p style={{ margin: '12px 0 0', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        Les frais d'inscription sont payés à l'inscription — aucun reste à recouvrer. La colonne « Inscription »
        affiche uniquement ce qui a été encaissé sous ce type de frais. Les blocs « Écolage » et « Connexes »
        sont toujours séparés ; seule la synthèse en bas les additionne, pour la vue comptable.
      </p>
    </div>
  );
}

function TypeCard({ label, du, paye, reste, taux, inscription, count }) {
  return (
    <div className="card-bold" style={{ padding: '16px 18px' }}>
      <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </p>
      {inscription ? (
        <>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>
            {fmtF(paye)}
          </p>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>
            {count} élève{count > 1 ? 's' : ''} · payé à l'inscription
          </p>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Attendu</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{fmtF(du)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Encaissé</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>{fmtF(paye)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Reste</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: reste > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmtF(reste)}</span>
          </div>
          <div style={{ height: 6, background: 'var(--line)', borderRadius: 4, overflow: 'hidden', margin: '8px 0 6px' }}>
            <div style={{ height: '100%', width: `${taux}%`, background: reste > 0 ? 'var(--amber)' : 'var(--success)' }} />
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>
            {taux}% recouvré
          </p>
        </>
      )}
    </div>
  );
}

function MoneyCell({ paye, du, reste }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>{fmtF(paye)}</p>
      <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--muted)' }}>
        / {fmtF(du)}{reste > 0 ? ` · reste ${fmtF(reste)}` : ''}
      </p>
    </div>
  );
}

function SynthesisStat({ label, value, color }) {
  return (
    <div style={{ background: 'var(--paper)', borderRadius: 10, padding: '12px 14px' }}>
      <p style={{ margin: '0 0 3px', fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}
