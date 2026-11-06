import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF, initials, TRANCHES, MODES, trancheLabel, TYPES_FRAIS, typeFraisLabel, modeLabel, stickyColStyle, stickyHeaderStyle } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import { computeRelance } from '../lib/retard.js';
import { useEnrollmentsForYear } from '../lib/enrollments.js';
import MoneyInput from '../components/MoneyInput.jsx';
import AmountAwareTextarea from '../components/AmountAwareTextarea.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import PaymentReceipt from '../components/PaymentReceipt.jsx';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import Dropdown from '../components/Dropdown.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { SkeletonCard, SkeletonTableRows, SkeletonRow } from '../components/Skeleton.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SelectionBar from '../components/SelectionBar.jsx';
import { guardedFetch } from '../lib/offlineCache.js';
import { translateError } from '../lib/errors.js';
import { usePageTour } from '../components/PageTour.jsx';

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" />
    </svg>
  );
}

function MoneyIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="12" rx="1.8" /><circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3.5v17l3-2 3 2 3-2 3 2 3-2v-15z" /><path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.3" /><path d="M2.8 20c0-3.4 2.8-6 6.2-6s6.2 2.6 6.2 6" /><circle cx="17" cy="8.5" r="2.4" /><path d="M15.5 14c2.4.2 4.2 2.4 4.4 4.7" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18v2.5" /><path d="M3 7.5v9A2.5 2.5 0 0 0 5.5 19H19a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H5.5A2.5 2.5 0 0 1 3 7.5z" /><circle cx="16.5" cy="13.5" r="1" />
    </svg>
  );
}

function generateMonthOptions() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    months.push({ value: `${year}-${month}`, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return months;
}

const TABS = [
  { id: 'vue', label: "Droit d'écolage" },
  { id: 'connexe', label: 'Frais connexes' },
  { id: 'paiements', label: 'Paiements' },
  { id: 'depenses', label: 'Dépenses' },
  { id: 'salaires', label: 'Salaires' },
  { id: 'avances', label: 'Avances sur salaire' },
  { id: 'bilan', label: 'Bilan financier' },
];

export default function Money() {
  const [tab, setTab] = useState('vue');
  const { schoolYear, isHistorical } = useSelectedSchoolYear();
  const tour = usePageTour('money');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Argent</p>
        <tour.Button />
      </div>
      {tour.Runner}
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      
      <div 
        data-tour="money-tabs" 
        className="hide-scrollbar"
        style={{ 
          display: 'flex', 
          gap: 8, 
          overflowX: 'auto', 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none', 
          margin: '0 -14px 22px', 
          padding: '0 14px 4px' 
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ flexShrink: 0, padding: '9px 18px', borderRadius: 10, fontSize: '13.5px', fontWeight: 600, whiteSpace: 'nowrap', border: `1px solid ${tab === t.id ? 'var(--forest)' : 'var(--line-strong)'}`, background: tab === t.id ? 'var(--forest)' : 'var(--paper)', color: tab === t.id ? '#fff' : 'var(--ink)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'vue' && <Overview />}
      {tab === 'connexe' && <FraisConnexes />}
      {tab === 'paiements' && <Payments />}
      {tab === 'depenses' && <Expenses />}
      {tab === 'salaires' && <SalairesSection />}
      {tab === 'avances' && <Advances />}
      {tab === 'bilan' && <BilanFinancier />}
    </div>
  );
}

function useEnrollments() {
  const { profile } = useAuth();
  const { schoolYear } = useSelectedSchoolYear(profile.school_id);
  const { students, error, offline } = useEnrollmentsForYear(schoolYear);
  return { students, error, offline, schoolYear };
}

function Overview() {
  const { students, error, offline, schoolYear } = useEnrollments();
  const [search, setSearch] = useState('');
  
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {translateError(error)}</p>;
  if (!students) {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }} className="desktop-grid-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div className="card-bold"><SkeletonTableRows count={5} columns={5} /></div>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="card-bold">
        <EmptyState
          icon={<UsersIcon />}
          title="Aucun élève inscrit cette année"
          subtitle="Pour suivre les paiements et les soldes, il faut d'abord inscrire des élèves dans l'année scolaire en cours."
          actionLabel="Aller vers Élèves"
          actionTo="/eleves"
        />
      </div>
    );
  }

  const totalDu = students.reduce((a, s) => a + Number(s.montant_du), 0);
  const totalPaye = students.reduce((a, s) => a + Number(s.montant_paye), 0);
  const totalReste = totalDu - totalPaye;
  const tauxRecouv = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;

  const totalConnexeDu = students.reduce((a, s) => a + Number(s.frais_connexe_du), 0);
  const totalConnexePaye = students.reduce((a, s) => a + Number(s.frais_connexe_paye), 0);

  const calendrierConfigure = !!(schoolYear && (schoolYear.date_tranche1 || schoolYear.date_tranche2 || schoolYear.date_tranche3));
  const enrichis = students.map((s) => ({
    ...s,
    reste: Number(s.montant_du) - Number(s.montant_paye),
    relance: computeRelance(s, schoolYear, s.feeSchedule),
  }));
  const avecReste = enrichis.filter((s) => s.reste > 0);
  const enRetard = avecReste.filter((s) => !calendrierConfigure || s.relance.relance);
  const nbAJour = enrichis.length - avecReste.length;

  const filtered = enrichis
    .filter((s) => !debouncedSearch.trim() || s.full_name.toLowerCase().includes(debouncedSearch.trim().toLowerCase()))
    .sort((a, b) => b.reste - a.reste);

  function statutOf(s) {
    if (s.relance.moratoire) return { label: 'Moratoire', color: null };
    if (s.reste <= 0) return { label: 'À jour', color: 'success' };
    if (calendrierConfigure) return s.relance.relance ? { label: 'À relancer', color: 'danger' } : { label: 'Dans les délais', color: 'amber' };
    return { label: 'Solde restant', color: 'amber' };
  }

  const chartData = [
    { name: "Droit d'écolage", Facturé: totalDu, Encaissé: totalPaye },
    { name: 'Frais connexes', Facturé: totalConnexeDu, Encaissé: totalConnexePaye },
  ];

  return (
    <div>
      {offline && <OfflineBanner />}
      <div data-tour="money-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }} className="desktop-grid-3">
        <Stat label="Attendu" value={fmtF(totalDu)} />
        <Stat label="Encaissé" value={fmtF(totalPaye)} color="var(--success)" />
        <Stat label="Reste à recouvrer" value={fmtF(totalReste)} color="var(--danger)" />
      </div>
      
      <div className="card-bold" style={{ padding: '20px 24px', marginBottom: 24 }}>
        <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Facturé vs Encaissé (Vue d'ensemble)</p>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickFormatter={(val) => `${val / 1000}k`} />
              <RechartsTooltip 
                formatter={(value) => fmtF(value)}
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Facturé" fill="#D4D4D4" radius={[4, 4, 0, 0]} maxBarSize={60} />
              <Bar dataKey="Encaissé" fill="var(--forest)" radius={[4, 4, 0, 0]} maxBarSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }} className="desktop-grid-3">
        <Stat label="Taux de recouvrement" value={`${tauxRecouv}%`} color="var(--success)" />
        <Stat label="Élèves à jour" value={nbAJour} color="var(--success)" />
        <Stat label="Élèves avec un solde" value={avecReste.length} color={enRetard.length > 0 ? 'var(--danger)' : undefined} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Élèves</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un élève…"
          style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13, width: 220, boxSizing: 'border-box', color: 'var(--ink)' }}
        />
      </div>
      <div className="card-bold" data-tour="money-list" style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto' }}>
        <div style={{ minWidth: 620 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 0.85fr 0.85fr 0.9fr 1.3fr', gap: 8, padding: '12px 20px 12px 0', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
            <span style={{ ...stickyColStyle('var(--forest-light)'), paddingLeft: 20 }}>Élève</span><span>Dû</span><span>Payé</span><span>Solde</span><span>Statut</span>
          </div>
          {filtered.slice(0, 200).map((s, i) => {
            const st = statutOf(s);
            return (
              <Link
                key={s.id}
                to={`/eleves/${s.id}`}
                className="row-link"
                style={{ display: 'grid', gridTemplateColumns: '1.7fr 0.85fr 0.85fr 0.9fr 1.3fr', gap: 8, padding: '12px 20px 12px 0', alignItems: 'center', borderBottom: i < Math.min(filtered.length, 200) - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ ...stickyColStyle('var(--row-bg)'), paddingLeft: 20 }}>
                  <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>{s.full_name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>{s.niveau}</p>
                </div>
                <span style={{ fontSize: 13 }}>{fmtF(s.montant_du)}</span>
                <span style={{ fontSize: 13 }}>{fmtF(s.montant_paye)}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: s.reste > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmtF(s.reste)}</span>
                <span style={{ background: st.color ? `var(--${st.color}-light)` : '#F0EDE5', color: st.color ? `var(--${st.color})` : 'var(--muted)', fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20, width: 'fit-content' }}>
                  {st.label}
                </span>
              </Link>
            );
          })}
          {filtered.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun élève ne correspond à « {search} ».</p>}
        </div>
        {filtered.length > 200 && (
          <p style={{ padding: '10px 20px', margin: 0, fontSize: 12, color: 'var(--muted)', borderTop: '1px solid var(--line)' }}>
            200 élèves affichés sur {filtered.length} — affine la recherche pour voir les autres.
          </p>
        )}
      </div>
    </div>
  );
}

function FraisConnexes() {
  const { students, error, schoolYear } = useEnrollments();
  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {translateError(error)}</p>;
  if (!students) return <div className="card-bold"><SkeletonTableRows count={5} columns={5} /></div>;

  if (students.length === 0) {
    return (
      <div className="card-bold">
        <EmptyState
          icon={<UsersIcon />}
          title="Aucun élève inscrit cette année"
          subtitle="Les frais connexes s'affichent à partir des inscriptions. Commence par inscrire des élèves."
          actionLabel="Aller vers Élèves"
          actionTo="/eleves"
        />
      </div>
    );
  }

  const totalDu = students.reduce((a, s) => a + Number(s.frais_connexe_du), 0);
  const totalPaye = students.reduce((a, s) => a + Number(s.frais_connexe_paye), 0);
  const taux = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }} className="desktop-grid-3">
        <Stat label="Attendu" value={fmtF(totalDu)} />
        <Stat label="Encaissé" value={fmtF(totalPaye)} color="var(--success)" />
        <Stat label="Taux" value={`${taux}%`} />
      </div>
      <div className="card-bold" style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto' }}>
        <div style={{ minWidth: 560 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.9fr 0.9fr 1.1fr', gap: 8, padding: '12px 20px 12px 0', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
            <span style={{ ...stickyColStyle('var(--forest-light)'), paddingLeft: 20 }}>Élève</span><span>Classe</span><span>Dû</span><span>Payé</span><span>Statut</span>
          </div>
          {students.map((s, i) => {
            const reste = Number(s.frais_connexe_du) - Number(s.frais_connexe_paye);
            const relance = computeRelance(s, schoolYear, s.feeSchedule);
            const label = reste <= 0 ? 'À jour' : relance.moratoire ? 'Moratoire' : relance.relanceConnexe ? 'À relancer' : 'Retard';
            const color = reste <= 0 ? 'success' : relance.moratoire ? null : relance.relanceConnexe ? 'danger' : 'amber';
            return (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.9fr 0.9fr 1.1fr', gap: 8, padding: '12px 20px 12px 0', alignItems: 'center', borderBottom: i < students.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600, ...stickyColStyle('var(--paper)'), paddingLeft: 20 }}>{s.full_name}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{s.niveau}</span>
                <span style={{ fontSize: 13 }}>{fmtF(s.frais_connexe_du)}</span>
                <span style={{ fontSize: 13 }}>{fmtF(s.frais_connexe_paye)}</span>
                <span style={{ background: color ? `var(--${color}-light)` : '#F0EDE5', color: color ? `var(--${color})` : 'var(--muted)', fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20, width: 'fit-content' }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Payments() {
  const { profile } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const { schoolYear } = useSelectedSchoolYear(profile.school_id);
  const canManage = ['fondateur', 'directeur', 'secretaire'].includes(profile.role);
  const [payments, setPayments] = useState(null);
  const [students, setStudents] = useState([]);
  const [feeSchedules, setFeeSchedules] = useState([]);
  const [schoolYearInfo, setSchoolYearInfo] = useState(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  function toggleOne(id) { setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); }
  function toggleAllVisible() { setSelectedIds((prev) => { const ids = payments.map((p) => p.id); return ids.every((id) => prev.includes(id)) ? [] : ids; }); }
  function exitSelectMode() { setSelectMode(false); setSelectedIds([]); }

  useEffect(() => {
    if (!schoolYear?.id) return;
    supabase.from('school_years')
      .select('id, label, date_tranche1, date_tranche2, date_tranche3, date_connexe')
      .eq('id', schoolYear.id)
      .maybeSingle()
      .then(({ data }) => setSchoolYearInfo(data));
  }, [schoolYear?.id]);

  async function handleDeleteSelected() {
    if (!(await confirm(`Supprimer définitivement ${selectedIds.length} paiement${selectedIds.length > 1 ? 's' : ''} ? Attention, tu ne pourras pas revenir en arrière.`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { data: deleted, error: deleteError } = await supabase.from('payments').delete().in('id', selectedIds).select('id');
    setDeleting(false);
    if (deleteError) { setError(translateError(deleteError)); return; }
    if (!deleted || deleted.length === 0) {
      setError("La suppression n'a pas été effectuée (probablement bloquée par une policy RLS sur la table payments).");
      return;
    }
    showToast(`${selectedIds.length} supprimé(s)`);
    exitSelectMode();
    reload();
  }

  async function handleDelete(p) {
    if (!(await confirm(`Supprimer ce paiement de ${fmtF(p.montant)} pour ${p.students?.full_name || 'cet élève'} ? Attention, tu ne pourras pas revenir en arrière.`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { data: deleted, error: deleteError } = await supabase.from('payments').delete().eq('id', p.id).select('id');
    setDeleting(false);
    if (deleteError) { setError(translateError(deleteError)); return; }
    if (!deleted || deleted.length === 0) {
      setError("La suppression n'a pas été effectuée (probablement bloquée par une policy RLS sur la table payments).");
      return;
    }
    showToast('Supprimé');
    reload();
  }

  async function reload() {
    if (!schoolYear) return;
    await guardedFetch({
      cacheKey: `payments_${schoolYear.id}`,
      hasData: payments !== null,
      load: async () => {
        const { data, error: payError } = await supabase
          .from('payments')
          .select('*, students ( full_name )')
          .eq('school_year_id', schoolYear.id)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(100);
        return payError ? { error: payError } : { data };
      },
      setData: setPayments,
      setOffline,
      onError: (e) => setError(translateError(e)),
      onSuccess: () => setError(''),
    });
    
    const { data: enr } = await supabase.from('enrollments').select('montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, classes ( nom, niveau ), students ( id, full_name, matricule )').eq('school_year_id', schoolYear.id);
    setStudents((enr || [])
      .map((e) => ({
        id: e.students.id,
        full_name: e.students.full_name,
        matricule: e.students.matricule,
        niveau: e.classes?.nom || '—',
        classeNiveau: e.classes?.niveau,
        montant_du: e.montant_du,
        montant_paye: e.montant_paye,
        frais_connexe_du: e.frais_connexe_du,
        frais_connexe_paye: e.frais_connexe_paye,
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name)));

    const { data: fs } = await supabase.from('fee_schedules').select('*').eq('school_year_id', schoolYear.id);
    setFeeSchedules(fs || []);
  }
  useEffect(() => { reload(); }, [schoolYear?.id]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!payments) {
    return (
      <div>
        <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 22 }}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div className="card-bold"><SkeletonRow count={5} avatar={false} /></div>
      </div>
    );
  }

  const totalEncaisse = payments.reduce((a, p) => a + Number(p.montant), 0);
  const partiels = payments.filter((p) => p.tranche !== 'complet').length;

  return (
    <div>
      {offline && <OfflineBanner />}
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 22 }}>
        <Stat label="Total encaissé (100 derniers)" value={fmtF(totalEncaisse)} color="var(--success)" />
        <Stat label="Nb paiements (affichés)" value={payments.length} />
        <Stat label="Paiements partiels" value={partiels} color="var(--amber)" />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        {canManage && !selectMode && (
          <button onClick={() => setModalOpen(true)} disabled={!schoolYear} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', opacity: schoolYear ? 1 : 0.7 }}>
            <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Enregistrer un paiement
          </button>
        )}
        {canManage && payments.length > 0 && !selectMode && (
          <button onClick={() => setSelectMode(true)} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
            Sélectionner
          </button>
        )}
      </div>

      {payments.length === 0 ? (
        <div className="card-bold">
          {students.length === 0 ? (
            <EmptyState
              icon={<UsersIcon />}
              title="Aucun élève inscrit cette année"
              subtitle="Il faut d'abord inscrire au moins un élève avant de pouvoir enregistrer un paiement."
              actionLabel="Aller vers Élèves"
              actionTo="/eleves"
            />
          ) : (
            <EmptyState
              icon={<ReceiptIcon />}
              title="Aucun paiement enregistré"
              subtitle="Dès qu'un parent paie, enregistre-le ici — un reçu imprimable est généré automatiquement."
              actionLabel={canManage ? 'Enregistrer un paiement' : undefined}
              onAction={canManage ? () => setModalOpen(true) : undefined}
            />
          )}
        </div>
      ) : (
        <div className="card-bold" style={{ overflow: 'hidden', maxHeight: '70vh', overflowY: 'auto' }}>
          {payments.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: i < payments.length - 1 ? '1px solid var(--line)' : 'none', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {selectMode && (
                  <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleOne(p.id)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                )}
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 600 }}>{p.students?.full_name || '—'}</p>
                  <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)' }}>
                    {TYPES_FRAIS.find((t) => t.id === p.type_frais)?.label} · {MODES.find((m) => m.id === p.mode)?.label} · {new Date(p.date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 700 }}>{fmtF(p.montant)}</p>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: p.tranche === 'complet' ? 'var(--success-light)' : 'var(--amber-light)', color: p.tranche === 'complet' ? 'var(--success)' : 'var(--amber)' }}>
                    {trancheLabel(p.tranche)}
                  </span>
                </div>
                {!selectMode && (
                  <>
                    <button
                      type="button"
                      onClick={() => setReceiptPayment(p)}
                      title="Imprimer le reçu"
                      style={{ background: 'none', border: 'none', color: 'var(--forest)', cursor: 'pointer', padding: 4, display: 'flex' }}
                    >
                      <i className="ti ti-receipt" style={{ fontSize: 17 }} aria-hidden="true"></i>
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        disabled={deleting}
                        title="Supprimer ce paiement"
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, display: 'flex', opacity: deleting ? 0.6 : 1 }}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectMode && (
        <SelectionBar
          count={selectedIds.length}
          allSelected={payments.length > 0 && payments.every((p) => selectedIds.includes(p.id))}
          onCancel={exitSelectMode}
          onToggleAll={toggleAllVisible}
          onDelete={handleDeleteSelected}
          deleting={deleting}
        />
      )}

      {modalOpen && schoolYear && (
        <NewPaymentModal
          schoolId={profile.school_id}
          schoolYearId={schoolYear.id}
          students={students}
          feeSchedules={feeSchedules}
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); reload(); }}
        />
      )}

      {receiptPayment && (() => {
        const st = students.find((s) => s.id === receiptPayment.student_id);
        const enrollment = st ? {
          montant_du: st.montant_du,
          montant_paye: st.montant_paye,
          frais_connexe_du: st.frais_connexe_du,
          frais_connexe_paye: st.frais_connexe_paye,
        } : null;
        const fs = st ? feeSchedules.find((f) => f.niveau === st.classeNiveau) : null;
        return (
          <PaymentReceipt
            payment={receiptPayment}
            studentName={receiptPayment.students?.full_name || st?.full_name || '—'}
            classeNom={st?.niveau}
            studentMatricule={st?.matricule}
            schoolYearLabel={schoolYear?.label}
            school={profile.schools}
            montantDu={st?.montant_du}
            montantPaye={st?.montant_paye}
            enrollment={enrollment}
            schoolYear={schoolYearInfo}
            feeSchedule={fs}
            autoPrint={false}
            onClose={() => setReceiptPayment(null)}
          />
        );
      })()}
    </div>
  );
}

function NewPaymentModal({ schoolId, schoolYearId, students, feeSchedules, onClose, onCreated }) {
  const showToast = useToast();
  const { profile } = useAuth();
  const classes = [...new Set(students.map((s) => s.niveau))].sort();
  const [classeFilter, setClasseFilter] = useState(classes[0] || '');
  const studentsInClasse = students.filter((s) => s.niveau === classeFilter);
  const [studentId, setStudentId] = useState(studentsInClasse[0]?.id || '');

  function handleClasseChange(niveau) {
    setClasseFilter(niveau);
    const first = students.find((s) => s.niveau === niveau);
    setStudentId(first?.id || '');
  }
  
  const [typeFrais, setTypeFrais] = useState('scolarite');
  const [montant, setMontant] = useState('');
  const [mode, setMode] = useState('especes');
  const [tranche, setTranche] = useState('complet');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const [createdPayment, setCreatedPayment] = useState(null);
  const [schoolYearInfo, setSchoolYearInfo] = useState(null);

  const currentStudent = students.find((s) => s.id === studentId);
  const currentFeeSchedule = currentStudent && feeSchedules ? feeSchedules.find((f) => f.niveau === currentStudent.classeNiveau) : null;
  
  const resteEcolage = currentStudent ? (Number(currentStudent.montant_du) - Number(currentStudent.montant_paye)) : 0;
  const resteConnexe = currentStudent ? (Number(currentStudent.frais_connexe_du) - Number(currentStudent.frais_connexe_paye)) : 0;

  let dejaPaye = false;
  if (typeFrais === 'scolarite' && resteEcolage <= 0) dejaPaye = true;
  if (typeFrais === 'connexe' && resteConnexe <= 0) dejaPaye = true;

  useEffect(() => {
    if (!schoolYearId) return;
    supabase.from('school_years')
      .select('id, label, date_tranche1, date_tranche2, date_tranche3, date_connexe')
      .eq('id', schoolYearId)
      .maybeSingle()
      .then(({ data }) => setSchoolYearInfo(data));
  }, [schoolYearId]);

  useEffect(() => {
    if (!currentFeeSchedule) return;

    let amount = '';
    if (typeFrais === 'scolarite') {
      if (tranche === 'tranche1') amount = currentFeeSchedule.montant_tranche1;
      else if (tranche === 'tranche2') amount = currentFeeSchedule.montant_tranche2;
      else if (tranche === 'tranche3') amount = currentFeeSchedule.montant_tranche3;
      else if (tranche === 'complet') amount = currentFeeSchedule.montant_scolarite;
    } else if (typeFrais === 'connexe') {
      if (tranche === 'complet') amount = currentFeeSchedule.montant_connexe;
    } else if (typeFrais === 'inscription') {
      if (tranche === 'complet') amount = currentFeeSchedule.montant_inscription || currentFeeSchedule.montant_reinscription;
    }

    if (amount !== '' && amount !== null && amount !== undefined && tranche !== 'autre') {
      setMontant(String(amount));
    } else if (tranche === 'autre' || typeFrais === 'autre') {
      setMontant('');
    }
  }, [typeFrais, tranche, currentFeeSchedule]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!studentId || !montant) {
      setError("L'élève et le montant sont obligatoires.");
      return;
    }
    if (dejaPaye) {
      setError("Impossible d'enregistrer : cet élève a déjà tout payé pour ce type de frais. Choisis « Autre » pour un paiement exceptionnel.");
      return;
    }
    setSubmitting(true);
    setError('');
    const payload = {
      school_id: schoolId, school_year_id: schoolYearId, student_id: studentId, type_frais: typeFrais, montant: Number(montant), mode, tranche, date, note: note.trim() || null,
      idempotency_key: idempotencyKey,
    };
    const { data: inserted, error: insertError } = await supabase.from('payments')
      .insert(payload)
      .select('id, student_id, montant, type_frais, mode, tranche, date, note')
      .single();

    if (insertError && insertError.code === '23505') {
      const { data: existing, error: fetchError } = await supabase
        .from('payments')
        .select('id, student_id, type_frais, montant, mode, tranche, date, note')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      setSubmitting(false);
      if (fetchError || !existing) {
        setError("Ce paiement semble déjà avoir été enregistré, mais impossible de le confirmer. Vérifie la liste des paiements avant de réessayer.");
        return;
      }
      const matches = existing.student_id === payload.student_id
        && existing.type_frais === payload.type_frais
        && Number(existing.montant) === payload.montant
        && existing.mode === payload.mode
        && existing.tranche === payload.tranche
        && existing.date === payload.date;
      if (matches) {
        setCreatedPayment(existing);
        return;
      }
      setError(`Un paiement a déjà été enregistré pour cette même saisie, mais avec des données différentes (${fmtF(existing.montant)} au lieu de ${fmtF(payload.montant)}). Vérifie la liste des paiements plutôt que de réessayer.`);
      return;
    }

    setSubmitting(false);
    if (insertError) {
      setError(translateError(insertError));
      return;
    }
    showToast('Enregistré');
    if (inserted) {
      setCreatedPayment(inserted);
      return;
    }
    onCreated();
  }

  const isMontantEditable = tranche === 'autre' || typeFrais === 'autre';
  const canSubmit = !dejaPaye && !submitting && students.length > 0 && montant !== '';

  if (createdPayment && schoolYearInfo && currentStudent) {
    const updatedEnrollment = {
      montant_du: Number(currentStudent.montant_du) || 0,
      montant_paye: Number(currentStudent.montant_paye) + Number(createdPayment.montant),
      frais_connexe_du: Number(currentStudent.frais_connexe_du) || 0,
      frais_connexe_paye: Number(currentStudent.frais_connexe_paye) || 0,
    };
    return (
      <PaymentReceipt
        payment={createdPayment}
        studentName={currentStudent.full_name}
        classeNom={currentStudent.niveau}
        studentMatricule={currentStudent.matricule}
        schoolYearLabel={schoolYearInfo.label}
        school={profile?.schools}
        montantDu={updatedEnrollment.montant_du}
        montantPaye={updatedEnrollment.montant_paye}
        enrollment={updatedEnrollment}
        schoolYear={schoolYearInfo}
        feeSchedule={currentFeeSchedule}
        autoPrint={true}
        onClose={onCreated}
      />
    );
  }

  if (students.length === 0) {
    return createPortal(
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 420, width: '100%', padding: 26, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600 }}>Aucun élève inscrit</p>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            Il faut d'abord inscrire au moins un élève avant de pouvoir enregistrer un paiement.
          </p>
          <Link
            to="/eleves"
            onClick={onClose}
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '11px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', textDecoration: 'none', marginBottom: 10 }}
          >
            Aller inscrire un élève
          </Link>
          <button
            type="button"
            onClick={onClose}
            style={{ width: '100%', padding: '11px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}
          >
            Annuler
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>Nouveau paiement</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={modalLabelStyle}>Classe</label>
            <Dropdown value={classeFilter} onChange={handleClasseChange} options={classes} style={modalInputStyle} />
          </div>
          <div>
            <label style={modalLabelStyle}>Élève</label>
            <Dropdown value={studentId} onChange={setStudentId} options={studentsInClasse.map((s) => ({ value: s.id, label: s.full_name }))} style={modalInputStyle} />
          </div>
        </div>

        {currentStudent && (
          <div style={{ background: 'var(--forest-light)', padding: '10px 14px', borderRadius: 9, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--forest-dark)', fontWeight: 600 }}>Écolage dû : {fmtF(currentStudent.montant_du)}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--forest-dark)' }}>Déjà payé : {fmtF(currentStudent.montant_paye)}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--forest-dark)' }}>Connexes : {fmtF(currentStudent.frais_connexe_du)} / {fmtF(currentStudent.frais_connexe_paye)}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--forest-dark)', fontWeight: 600 }}>Reste écolage</p>
              <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: resteEcolage > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmtF(resteEcolage)}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--forest-dark)' }}>Reste connexes : {fmtF(resteConnexe)}</p>
            </div>
          </div>
        )}

        {dejaPaye && (
          <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 9, padding: '10px 14px', marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--clay-dark)' }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>
              Cet élève a déjà tout payé pour ce type de frais.
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--clay-dark)', lineHeight: 1.5 }}>
              Si tu veux quand même enregistrer un paiement (avance, remboursement, frais exceptionnel), choisis le type de frais « Autre ».
            </p>
          </div>
        )}

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={modalLabelStyle}>Type de frais</label>
            <Dropdown value={typeFrais} onChange={setTypeFrais} options={TYPES_FRAIS.filter((t) => !t.hidden).map((t) => ({ value: t.id, label: t.label }))} style={modalInputStyle} />
          </div>
          <div>
            <label style={modalLabelStyle}>Montant</label>
            <div style={{ position: 'relative' }}>
              <MoneyInput 
                value={montant} 
                onChange={setMontant} 
                style={{ ...modalInputStyle, backgroundColor: isMontantEditable ? 'var(--paper)' : 'var(--line)' }} 
                suffix="F CFA" 
                disabled={!isMontantEditable} 
              />
            </div>
            {!isMontantEditable && <p style={{ margin: '-8px 0 10px', fontSize: 10.5, color: 'var(--muted)' }}>Calculé automatiquement selon la grille tarifaire</p>}
          </div>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={modalLabelStyle}>Mode</label>
            <Dropdown value={mode} onChange={setMode} options={MODES.map((m) => ({ value: m.id, label: m.label }))} style={modalInputStyle} />
          </div>
          <div>
            <label style={modalLabelStyle}>Tranche / Type</label>
            <Dropdown value={tranche} onChange={setTranche} options={TRANCHES.map((t) => ({ value: t.id, label: t.label }))} style={modalInputStyle} />
          </div>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={modalLabelStyle}>Date</label>
            <DatePicker value={date} onChange={setDate} style={modalInputStyle} />
          </div>
          <div>
            <label style={modalLabelStyle}>Note</label>
            <AmountAwareTextarea value={note} onChange={setNote} multiline={false} style={modalInputStyle} />
          </div>
        </div>

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
          <button type="submit" disabled={!canSubmit} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

const modalInputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const modalLabelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };

function Expenses() {
  const showToast = useToast();
  const confirm = useConfirm();
  const { profile } = useAuth();
  const canManage = ['fondateur', 'directeur', 'secretaire'].includes(profile.role);
  const { schoolYear } = useSelectedSchoolYear(profile.school_id);
  const [expenses, setExpenses] = useState(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [libelle, setLibelle] = useState('');
  const [categorie, setCategorie] = useState('');
  const [montant, setMontant] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  function toggleOne(id) { setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); }
  function toggleAllVisible() { setSelectedIds((prev) => { const ids = expenses.map((d) => d.id); return ids.every((id) => prev.includes(id)) ? [] : ids; }); }
  function exitSelectMode() { setSelectMode(false); setSelectedIds([]); }

  async function handleDeleteSelected() {
    if (!(await confirm(`Supprimer définitivement ${selectedIds.length} dépense${selectedIds.length > 1 ? 's' : ''} ? Attention, tu ne pourras pas revenir en arrière.`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { data: deleted, error: deleteError } = await supabase.from('expenses').delete().in('id', selectedIds).select('id');
    setDeleting(false);
    if (deleteError) { setError(translateError(deleteError)); return; }
    if (!deleted || deleted.length === 0) {
      setError("La suppression n'a pas été effectuée (probablement bloquée par une policy RLS sur la table expenses).");
      return;
    }
    showToast(`${selectedIds.length} supprimée(s)`);
    exitSelectMode();
    reload();
  }

  function reload() {
    if (!schoolYear) return;
    guardedFetch({
      cacheKey: `expenses_${schoolYear.id}`,
      hasData: expenses !== null,
      load: async () => {
        const { data, error: e } = await supabase.from('expenses').select('*').eq('school_year_id', schoolYear.id).order('created_at', { ascending: false });
        return e ? { error: e } : { data };
      },
      setData: setExpenses,
      setOffline,
      onError: (e) => setError(translateError(e)),
      onSuccess: () => setError(''),
    });
  }
  useEffect(() => { reload(); }, [schoolYear?.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!libelle.trim() || !montant) return;
    setSubmitting(true);
    const { error: insertError } = await supabase.from('expenses').insert({
      school_id: profile.school_id, school_year_id: schoolYear.id, libelle: libelle.trim(), categorie: categorie.trim() || 'Autre', montant: Number(montant),
    });
    setSubmitting(false);
    if (insertError) { setError(translateError(insertError)); return; }
    setLibelle(''); setCategorie(''); setMontant('');
    showToast('Enregistré');
    reload();
  }

  async function handleDelete(d) {
    if (!(await confirm(`Supprimer la dépense « ${d.libelle} » (${fmtF(d.montant)}) ? Attention, tu ne pourras pas revenir en arrière.`, { confirmLabel: 'Supprimer' }))) return;
    const { data: deleted, error: deleteError } = await supabase.from('expenses').delete().eq('id', d.id).select('id');
    if (deleteError) { setError(translateError(deleteError)); return; }
    if (!deleted || deleted.length === 0) {
      setError("La suppression n'a pas été effectuée (probablement bloquée par une policy RLS sur la table expenses).");
      return;
    }
    showToast('Supprimé');
    reload();
  }

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!expenses || !schoolYear) return <div className="card-bold"><SkeletonRow count={4} avatar={false} /></div>;

  const total = expenses.reduce((a, d) => a + Number(d.montant), 0);

  return (
    <div>
      {offline && <OfflineBanner />}
      <div className="card-bold" style={{ padding: '18px 20px', marginBottom: 24, maxWidth: 320 }}>
        <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>Total des dépenses — {schoolYear.label}</p>
        <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color: 'var(--danger)' }}>{fmtF(total)}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Dépenses récentes</p>
        {canManage && expenses.length > 0 && !selectMode && (
          <button onClick={() => setSelectMode(true)} style={{ fontSize: '11.5px', fontWeight: 600, padding: '7px 13px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
            Sélectionner
          </button>
        )}
      </div>

      {expenses.length === 0 ? (
        <div className="card-bold" style={{ marginBottom: 24, maxWidth: 640 }}>
          <EmptyState
            icon={<WalletIcon />}
            title="Aucune dépense enregistrée"
            subtitle="Utilise le formulaire ci-dessous pour enregistrer ta première dépense (fournitures, loyer, électricité…)."
          />
        </div>
      ) : (
        <div className="card-bold" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 400px)', marginBottom: 24, maxWidth: 640 }}>
          {expenses.map((d, i) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < expenses.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {selectMode && (
                  <input type="checkbox" checked={selectedIds.includes(d.id)} onChange={() => toggleOne(d.id)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                )}
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 600 }}>{d.libelle}</p>
                  <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)' }}>{d.categorie}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{fmtF(d.montant)}</p>
                {canManage && !selectMode && (
                  <button
                    type="button"
                    onClick={() => handleDelete(d)}
                    title="Supprimer"
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, display: 'flex' }}
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectMode && expenses.length > 0 && (
        <SelectionBar
          count={selectedIds.length}
          allSelected={expenses.every((d) => selectedIds.includes(d.id))}
          onCancel={exitSelectMode}
          onToggleAll={toggleAllVisible}
          onDelete={handleDeleteSelected}
          deleting={deleting}
        />
      )}

      <form onSubmit={handleSubmit} className="card-bold" style={{ padding: '18px 20px', maxWidth: 480, display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
        <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Libellé" style={{ ...smallInput, flex: '2 1 160px' }} />
        <input value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="Catégorie" style={{ ...smallInput, flex: '1 1 120px' }} />
        <MoneyInput value={montant} onChange={setMontant} suffix="F CFA" style={{ ...smallInput, flex: '1 1 120px' }} />
        <button type="submit" disabled={submitting} style={{ background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, padding: '10px 18px', borderRadius: 9, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? 'Ajout…' : 'Ajouter'}
        </button>
      </form>
    </div>
  );
}

function SalairesSection() {
  const { profile } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm(); 
  const [mois, setMois] = useState(generateMonthOptions()[0].value);
  const [salaries, setSalaries] = useState(null);
  const [advances, setAdvances] = useState([]);
  const [staff, setStaff] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [error, setError] = useState('');

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  function toggleOne(id) { setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); }
  function toggleAllVisible() { setSelectedIds((prev) => { const ids = salaries.map((s) => s.id); return ids.every((id) => prev.includes(id)) ? [] : ids; }); }
  function exitSelectMode() { setSelectMode(false); setSelectedIds([]); }

  async function handleDeleteSelected() {
    if (!(await confirm(`Supprimer définitivement ${selectedIds.length} paiement${selectedIds.length > 1 ? 's' : ''} de salaire ? Attention, tu ne pourras pas revenir en arrière.`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { data: deleted, error: deleteError } = await supabase.from('staff_salaries').delete().in('id', selectedIds).select('id');
    setDeleting(false);
    if (deleteError) { setError(deleteError.message); return; }
    if (!deleted || deleted.length === 0) {
      setError("La suppression n'a pas été effectuée — probablement bloquée par une policy RLS sur la table staff_salaries.");
      return;
    }
    showToast(`${selectedIds.length} supprimé(s)`);
    exitSelectMode();
    reloadSalaries();
  }

  const monthOptions = generateMonthOptions();
  const COLONNES_SALAIRES = '1.5fr 1.2fr 1.2fr 1.2fr 1.2fr 110px';

  async function reloadSalaries() {
    setSalaries(null);
    
    const { data: sal, error: salErr } = await supabase
      .from('staff_salaries')
      .select('*, staff (full_name, role)')
      .eq('school_id', profile.school_id)
      .eq('mois', mois)
      .order('created_at', { ascending: false });
      
    if (salErr) {
      setError(salErr.message);
    } else {
      setSalaries(sal || []);
    }

    const { data: adv, error: advErr } = await supabase
      .from('salary_advances')
      .select('staff_id, solde')
      .eq('school_id', profile.school_id)
      .eq('statut', 'approuvee')
      .gt('solde', 0);
      
    if (advErr) {
      setError(advErr.message);
    } else {
      setAdvances(adv || []);
    }

    const { data: st } = await supabase.from('staff').select('*').eq('statut', 'actif').order('full_name');
    setStaff(st || []);
  }

  async function handleDeleteSalaire(id, nomMembre, montant) {
    if (!(await confirm(`Supprimer le paiement de ${fmtF(montant)} pour ${nomMembre} ? Cette action est irréversible.`, { confirmLabel: 'Supprimer' }))) return;

    const { data: deleted, error: deleteError } = await supabase
      .from('staff_salaries')
      .delete()
      .eq('id', id)
      .select('id');

    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (!deleted || deleted.length === 0) {
      setError("La suppression n'a pas été effectuée — probablement bloquée par une policy RLS sur la table staff_salaries.");
      return;
    }
    showToast('Supprimé');
    reloadSalaries();
  }

  useEffect(() => {
    reloadSalaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mois]);

  if (!staff) return <div className="card-bold"><SkeletonRow count={5} /></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Gestion des salaires</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>Les avances approuvées sont automatiquement déduites du reste à payer.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Mois :</label>
          <Dropdown value={mois} onChange={setMois} options={monthOptions} style={{ width: 200 }} />
        </div>
      </div>

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="card-bold" style={{ overflowX: 'auto', marginBottom: 24 }}>
        <div style={{ minWidth: 900 }}>
          <div style={{ display: 'grid', gridTemplateColumns: COLONNES_SALAIRES, gap: 12, padding: '12px 20px 12px 0', ...stickyHeaderStyle('var(--forest-light)'), fontSize: 11, fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase', alignItems: 'center' }}>
            <span style={{ ...stickyColStyle('var(--forest-light)'), paddingLeft: 20 }}>Membre</span>
            <span>Salaire prévu</span>
            <span>Avance à déduire</span>
            <span>Déjà payé</span>
            <span>Reste net à payer</span>
            <span></span>
          </div>
          
          {salaries === null ? (
            <SkeletonRow count={3} />
          ) : staff.length === 0 ? (
            <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun membre du personnel actif.</p>
          ) : (
            staff.map((p, i) => {
              const paye = (salaries || []).filter(s => s.staff_id === p.id).reduce((acc, s) => acc + Number(s.montant), 0);
              const avanceDeduire = (advances || []).filter(a => a.staff_id === p.id).reduce((acc, a) => acc + Number(a.solde), 0);
              const prevu = Number(p.salaire_mensuel) || 0;
              const reste = prevu - paye - avanceDeduire;
              
              const estPaye = prevu > 0 && reste <= 0;

              return (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: COLONNES_SALAIRES, gap: 12, padding: '14px 20px 14px 0', alignItems: 'center', borderTop: i > 0 ? '1px solid var(--line)' : 'none', fontSize: 13 }}>
                  <div style={{ ...stickyColStyle('var(--paper)'), paddingLeft: 20 }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{p.full_name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)' }}>{p.role}</p>
                  </div>
                  
                  <span>{prevu > 0 ? fmtF(prevu) : '—'}</span>
                  
                  <span style={{ color: avanceDeduire > 0 ? 'var(--amber)' : 'var(--muted)' }}>
                    {avanceDeduire > 0 ? fmtF(avanceDeduire) : '—'}
                  </span>
                  
                  <span style={{ color: paye > 0 ? 'var(--success)' : 'var(--muted)', fontWeight: paye > 0 ? 600 : 400 }}>
                    {fmtF(paye)}
                  </span>
                  
                  <span style={{ color: reste > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                    {prevu > 0 ? fmtF(reste) : '—'}
                  </span>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 20 }}>
                    <button
                      onClick={() => { setSelectedStaff(p); setModalOpen(true); }}
                      disabled={prevu <= 0 || estPaye}
                      style={{ 
                        fontSize: 11.5, 
                        fontWeight: 600, 
                        padding: '6px 12px', 
                        borderRadius: 8, 
                        border: 'none', 
                        background: estPaye ? 'var(--line)' : 'var(--forest)', 
                        color: estPaye ? 'var(--muted)' : '#fff', 
                        cursor: (prevu <= 0 || estPaye) ? 'default' : 'pointer', 
                        opacity: (prevu <= 0 || estPaye) ? 0.7 : 1 
                      }}
                    >
                      {estPaye ? 'Payé' : 'Payer'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Paiements enregistrés pour {monthOptions.find(m => m.value === mois)?.label}</p>
        {salaries && salaries.length > 0 && !selectMode && (
          <button onClick={() => setSelectMode(true)} style={{ fontSize: '11.5px', fontWeight: 600, padding: '7px 13px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
            Sélectionner
          </button>
        )}
      </div>

      <div className="card-bold" style={{ overflow: 'hidden', marginBottom: 24 }}>
        {salaries === null && <SkeletonRow count={2} />}
        {salaries && salaries.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun paiement de salaire ce mois-ci.</p>}
        {salaries && salaries.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {selectMode && (
                <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleOne(s.id)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              )}
              <div>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{s.staff?.full_name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>
                  {new Date(s.date).toLocaleDateString('fr-FR')} · {s.mode}{s.note ? ` · ${s.note}` : ''}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>{fmtF(s.montant)}</span>
              {!selectMode && (
                <button
                  type="button"
                  onClick={() => handleDeleteSalaire(s.id, s.staff?.full_name || 'ce membre', s.montant)}
                  title="Supprimer ce paiement"
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, display: 'flex' }}
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectMode && salaries && salaries.length > 0 && (
        <SelectionBar
          count={selectedIds.length}
          allSelected={salaries.every((s) => selectedIds.includes(s.id))}
          onCancel={exitSelectMode}
          onToggleAll={toggleAllVisible}
          onDelete={handleDeleteSelected}
          deleting={deleting}
        />
      )}

      {modalOpen && selectedStaff && (
        <PayerSalaireModal
          staffMember={selectedStaff}
          mois={mois}
          avance={advances.filter(a => a.staff_id === selectedStaff.id).reduce((acc, a) => acc + Number(a.solde), 0)}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); reloadSalaries(); showToast('Salaire enregistré'); }}
        />
      )}
    </div>
  );
}

function PayerSalaireModal({ staffMember, mois, avance, onClose, onSaved }) {
  const { profile } = useAuth();
  const prevu = Number(staffMember.salaire_mensuel || 0);
  const [montant, setMontant] = useState(String(Math.max(0, prevu - avance)));
  const [mode, setMode] = useState('especes');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!montant || Number(montant) <= 0) { setError('Le montant doit être supérieur à 0.'); return; }
    setSubmitting(true);
    setError('');

    // NOUVEAU : solder l'avance déduite AVANT d'enregistrer le salaire, pour
    // garantir qu'aucun salaire n'est enregistré avec des avances encore
    // actives (double déduction le mois suivant sinon). Le trigger SQL
    // trg_recompute_advance_solde recalcule "solde" à partir de
    // "montant_rembourse" (solde = montant - montant_rembourse).
    if (avance > 0) {
      const { data: openAdv, error: advFetchErr } = await supabase
        .from('salary_advances')
        .select('id, montant, montant_rembourse, solde')
        .eq('staff_id', staffMember.id)
        .eq('statut', 'approuvee')
        .gt('solde', 0)
        .order('created_at', { ascending: true });

      if (advFetchErr) { setSubmitting(false); setError(advFetchErr.message); return; }

      let reste = Number(avance);
      for (const a of (openAdv || [])) {
        if (reste <= 0) break;
        const soldeActuel = Number(a.solde) || 0;
        const aRembourser = Math.min(reste, soldeActuel);
        if (aRembourser <= 0) continue;
        const nouveauMontantRembourse = (Number(a.montant_rembourse) || 0) + aRembourser;
        const { error: advUpdErr } = await supabase
          .from('salary_advances')
          .update({ montant_rembourse: nouveauMontantRembourse })
          .eq('id', a.id);
        if (advUpdErr) { setSubmitting(false); setError(advUpdErr.message); return; }
        reste -= aRembourser;
      }
    }

    const { error: insertError } = await supabase.from('staff_salaries').insert({
      school_id: profile.school_id,
      staff_id: staffMember.id,
      montant: Number(montant),
      mois: mois,
      date: date,
      mode: mode,
      note: note.trim() || null,
      created_by: profile.id,
    });
    setSubmitting(false);
    if (insertError) setError(insertError.message);
    else onSaved();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 400, width: '100%', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>Payer le salaire</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--muted)' }}>×</button>
        </div>
        <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--muted)' }}>Membre : <strong>{staffMember.full_name}</strong> ({staffMember.role})</p>
        
        {avance > 0 && (
          <div style={{ background: 'var(--amber-light)', padding: '8px 12px', borderRadius: 8, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--clay-dark)', fontWeight: 600 }}>Avance approuvée à déduire : {fmtF(avance)}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--clay-dark)' }}>Le montant par défaut a été ajusté (Salaire prévu - Avance). L'avance sera soldée automatiquement.</p>
          </div>
        )}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Montant à payer</label>
        <MoneyInput value={montant} onChange={setMontant} suffix="F CFA" style={{ marginBottom: 12 }} />

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Mode</label>
            <Dropdown value={mode} onChange={setMode} options={[{ value: 'especes', label: 'Espèces' }, { value: 'virement', label: 'Virement' }, { value: 'mobile_money', label: 'Mobile Money' }, { value: 'cheque', label: 'Chèque' }]} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Date</label>
            <DatePicker value={date} onChange={setDate} style={{ width: '100%' }} />
          </div>
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Note (facultatif)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ex: Acompte, prime..." style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13.5, marginBottom: 16, boxSizing: 'border-box' }} />

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: 13 }}>Annuler</button>
          <button type="submit" disabled={submitting} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: 13, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Advances() {
  const showToast = useToast();
  const confirm = useConfirm();
  const { profile } = useAuth();
  const { schoolYear } = useSelectedSchoolYear(profile.school_id);
  const [advances, setAdvances] = useState(null);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [montant, setMontant] = useState('');
  const [motif, setMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  function toggleOne(id) { setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); }
  function toggleAllVisible() { setSelectedIds((prev) => { const ids = advances.map((a) => a.id); return ids.every((id) => prev.includes(id)) ? [] : ids; }); }
  function exitSelectMode() { setSelectMode(false); setSelectedIds([]); }

  async function handleDeleteSelected() {
    if (!(await confirm(`Supprimer définitivement ${selectedIds.length} avance${selectedIds.length > 1 ? 's' : ''} ? Attention, tu ne pourras pas revenir en arrière.`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { data: deleted, error: deleteError } = await supabase.from('salary_advances').delete().in('id', selectedIds).select('id');
    setDeleting(false);
    if (deleteError) { setError(translateError(deleteError)); return; }
    if (!deleted || deleted.length === 0) {
      setError("La suppression n'a pas été effectuée — probablement bloquée par une policy RLS sur la table salary_advances.");
      return;
    }
    showToast(`${selectedIds.length} supprimée(s)`);
    exitSelectMode();
    reload();
  }

  async function reload() {
    if (!schoolYear) return;
    await guardedFetch({
      cacheKey: `advances_${schoolYear.id}`,
      hasData: advances !== null,
      load: async () => {
        const { data, error: e } = await supabase.from('salary_advances').select('*, staff ( full_name, role )').eq('school_year_id', schoolYear.id).order('created_at', { ascending: false });
        return e ? { error: e } : { data };
      },
      setData: setAdvances,
      setOffline,
      onError: (e) => setError(translateError(e)),
      onSuccess: () => setError(''),
    });
    const { data: st } = await supabase.from('staff').select('id, full_name, role').eq('statut', 'actif').order('full_name');
    setStaff(st || []);
    if (st?.length && !staffId) setStaffId(st[0].id);
  }
  useEffect(() => { reload(); }, [schoolYear?.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!staffId || !montant) return;
    setSubmitting(true);
    const amount = Number(montant);
    const { error: insertError } = await supabase.from('salary_advances').insert({
      school_id: profile.school_id, school_year_id: schoolYear.id, staff_id: staffId, montant: amount, solde: amount, statut: 'attente_fondateur', motif: motif.trim() || null,
    });
    setSubmitting(false);
    if (insertError) { setError(translateError(insertError)); return; }
    setMontant(''); setMotif('');
    showToast('Enregistré');
    reload();
  }

  async function decide(id, statut) {
    const { error: updateError } = await supabase.from('salary_advances').update({ statut }).eq('id', id);
    if (updateError) setError(translateError(updateError));
    else { showToast('Enregistré'); reload(); }
  }

  async function markPaid(a) {
    if (!(await confirm(`Marquer cette avance de ${fmtF(a.montant)} pour ${a.staff?.full_name || 'ce membre du personnel'} comme payée ? Cette action solde intégralement l'avance.`, { confirmLabel: 'Marquer comme payé' }))) return;
    const { error: updateError } = await supabase.from('salary_advances').update({ montant_rembourse: a.montant }).eq('id', a.id);
    if (updateError) setError(translateError(updateError));
    else { showToast('Avance marquée comme payée'); reload(); }
  }

  async function handleDelete(a) {
    const rembourse = Number(a.montant_rembourse) || 0;
    const message = rembourse > 0
      ? `Cette avance a déjà été remboursée à hauteur de ${fmtF(rembourse)}. La supprimer effacera aussi cet historique. Continuer ?`
      : `Supprimer cette demande d'avance de ${fmtF(a.montant)} pour ${a.staff?.full_name || 'ce membre du personnel'} ? Attention, tu ne pourras pas revenir en arrière.`;
    if (!(await confirm(message, { confirmLabel: 'Supprimer' }))) return;
    const { data: deleted, error: deleteError } = await supabase.from('salary_advances').delete().eq('id', a.id).select('id');
    if (deleteError) { setError(translateError(deleteError)); return; }
    if (!deleted || deleted.length === 0) {
      setError("La suppression n'a pas été effectuée — probablement bloquée par une policy RLS sur la table salary_advances.");
      return;
    }
    showToast('Supprimé');
    reload();
  }

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!advances || !schoolYear) return <div className="card-bold"><SkeletonRow count={4} avatar={false} /></div>;

  const canDecide = profile.role === 'fondateur' || profile.role === 'directeur';

  return (
    <div>
      {offline && <OfflineBanner />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: 600 }}>
          Le fondateur et le directeur peuvent approuver, refuser, modifier ou supprimer une demande. Les autres rôles peuvent
          seulement en soumettre une nouvelle. Demandes de l'année {schoolYear.label}.
        </p>
        {canDecide && advances.length > 0 && !selectMode && (
          <button onClick={() => setSelectMode(true)} style={{ fontSize: '11.5px', fontWeight: 600, padding: '7px 13px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
            Sélectionner
          </button>
        )}
      </div>

      {advances.length === 0 ? (
        <div className="card-bold" style={{ marginBottom: 20 }}>
          {staff.length === 0 ? (
            <EmptyState
              icon={<UsersIcon />}
              title="Aucun membre du personnel enregistré"
              subtitle="Les avances sur salaire se font pour les membres du personnel. Ajoute d'abord ton équipe."
              actionLabel="Aller vers Personnel"
              actionTo="/personnel"
            />
          ) : (
            <EmptyState
              icon={<MoneyIcon />}
              title="Aucune demande d'avance"
              subtitle="Les demandes d'avance sur salaire de ton équipe apparaîtront ici."
            />
          )}
        </div>
      ) : (
        <div className="card-bold" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 400px)', marginBottom: 20 }}>
          {advances.map((a, i) => (
            <div key={a.id} style={{ padding: '13px 20px', borderBottom: i < advances.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {canDecide && selectMode && (
                    <input type="checkbox" checked={selectedIds.includes(a.id)} onChange={() => toggleOne(a.id)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  )}
                  <div>
                    <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{a.staff?.full_name || '—'}</span>
                    <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}> · {a.staff?.role}</span>
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtF(a.montant)}{a.statut === 'approuvee' && Number(a.solde) > 0 ? ` (reste ${fmtF(a.solde)})` : ''}</span>
              </div>
              {a.motif && <p style={{ margin: '0 0 6px', fontSize: '11.5px', color: 'var(--muted)', paddingLeft: selectMode ? 28 : 0 }}>{a.motif}</p>}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingLeft: selectMode ? 28 : 0 }}>
                <StatusBadge statut={a.statut} solde={a.solde} montant={a.montant} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {!selectMode && canDecide && a.statut !== 'approuvee' && a.statut !== 'refusee' && (
                    <>
                      <button onClick={() => decide(a.id, 'approuvee')} style={{ fontSize: '11.5px', fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff' }}>Approuver</button>
                      <button onClick={() => decide(a.id, 'refusee')} style={{ fontSize: '11.5px', fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>Refuser</button>
                    </>
                  )}
                  {!selectMode && canDecide && a.statut === 'approuvee' && Number(a.solde ?? a.montant) > 0 && (
                    <button onClick={() => markPaid(a)} style={{ fontSize: '11.5px', fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff' }}>
                      <i className="ti ti-check" style={{ fontSize: 13, verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"></i>Marquer comme payé
                    </button>
                  )}
                  
                  {!selectMode && canDecide && (
                    <>
                      <button onClick={() => setEditingAdvance(a)} title="Modifier cette avance" style={{ background: 'none', border: 'none', color: 'var(--forest)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                        <PencilIcon />
                      </button>
                      <button onClick={() => handleDelete(a)} title="Supprimer cette avance" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                        <TrashIcon />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectMode && advances.length > 0 && (
        <SelectionBar
          count={selectedIds.length}
          allSelected={advances.every((a) => selectedIds.includes(a.id))}
          onCancel={exitSelectMode}
          onToggleAll={toggleAllVisible}
          onDelete={handleDeleteSelected}
          deleting={deleting}
        />
      )}

      {staff.length > 0 ? (
        <form onSubmit={handleSubmit} className="card-bold" style={{ padding: '18px 20px', maxWidth: 480, display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
          <Dropdown
            value={staffId}
            onChange={setStaffId}
            options={staff.map((p) => ({ value: p.id, label: `${p.full_name} (${p.role})` }))}
            style={smallInput}
            wrapperStyle={{ flex: '2 1 180px', width: 'auto' }}
          />
          <MoneyInput value={montant} onChange={setMontant} suffix="F CFA" style={{ ...smallInput, flex: '1 1 120px' }} />
          <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif (facultatif)" style={{ ...smallInput, flex: '2 1 160px' }} />
          <button type="submit" disabled={submitting} style={{ background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, padding: '10px 18px', borderRadius: 9, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Envoi…' : 'Nouvelle demande'}
          </button>
        </form>
      ) : (
        <p className="card-bold" style={{ padding: '18px 20px', margin: 0, fontSize: 13, color: 'var(--muted)', marginTop: 24 }}>
          Aucun membre du personnel enregistré pour l'instant. Ajoute d'abord des membres dans l'onglet{' '}
          <Link to="/personnel" style={{ color: 'var(--forest)', fontWeight: 600, textDecoration: 'none' }}>Personnel</Link>{' '}
          pour pouvoir soumettre une demande d'avance sur salaire.
        </p>
      )}

      {editingAdvance && (
        <EditAdvanceModal
          advance={editingAdvance}
          staff={staff}
          onClose={() => setEditingAdvance(null)}
          onSaved={() => { setEditingAdvance(null); showToast('Modifié'); reload(); }}
        />
      )}
    </div>
  );
}

function EditAdvanceModal({ advance, staff, onClose, onSaved }) {
  const [staffId, setStaffId] = useState(advance.staff_id);
  const [montant, setMontant] = useState(String(advance.montant));
  const [motif, setMotif] = useState(advance.motif || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const rembourse = Number(advance.montant_rembourse) || 0;

  const staffOptions = (() => {
    const opts = staff.map((p) => ({ value: p.id, label: `${p.full_name} (${p.role})` }));
    if (advance.staff_id && !opts.find((o) => o.value === advance.staff_id)) {
      opts.unshift({
        value: advance.staff_id,
        label: `${advance.staff?.full_name || '—'}${advance.staff?.role ? ` (${advance.staff.role})` : ''} — inactif`,
      });
    }
    return opts;
  })();

  async function handleSubmit(e) {
    e.preventDefault();
    const amount = Number(montant);
    if (!staffId) { setError('Sélectionne un membre du personnel.'); return; }
    if (!amount || amount <= 0) { setError('Le montant doit être supérieur à 0.'); return; }
    if (rembourse > 0 && amount < rembourse) {
      setError(`Le montant ne peut pas être inférieur au montant déjà remboursé (${fmtF(rembourse)}).`);
      return;
    }
    setSubmitting(true);
    setError('');
    const newSolde = Math.max(amount - rembourse, 0);
    const { error: updateError } = await supabase
      .from('salary_advances')
      .update({ staff_id: staffId, montant: amount, solde: newSolde, motif: motif.trim() || null })
      .eq('id', advance.id);
    setSubmitting(false);
    if (updateError) { setError(translateError(updateError)); return; }
    onSaved();
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 440, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>Modifier l'avance</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <label style={modalLabelStyle}>Membre du personnel</label>
        <Dropdown value={staffId} onChange={setStaffId} options={staffOptions} style={modalInputStyle} />

        <label style={modalLabelStyle}>Montant</label>
        <MoneyInput value={montant} onChange={setMontant} style={modalInputStyle} suffix="F CFA" />

        <label style={modalLabelStyle}>Motif</label>
        <AmountAwareTextarea value={motif} onChange={setMotif} multiline={false} style={modalInputStyle} />

        {rembourse > 0 && (
          <p style={{ margin: '0 0 12px', fontSize: '11.5px', color: 'var(--muted)' }}>
            Déjà remboursé : {fmtF(rembourse)} — le solde restant sera recalculé automatiquement.
          </p>
        )}
        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
          <button type="submit" disabled={submitting} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function StatusBadge({ statut, solde, montant }) {
  if (statut === 'approuvee' && Number(solde ?? montant) <= 0) {
    return <span style={{ background: 'var(--forest-light)', color: 'var(--forest)', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20 }}>Payée</span>;
  }
  const map = {
    approuvee: { label: 'Approuvée', bg: 'var(--success-light)', fg: 'var(--success)' },
    refusee: { label: 'Refusée', bg: 'var(--danger-light)', fg: 'var(--danger)' },
    attente_directeur: { label: 'Attente directeur', bg: 'var(--gold-light)', fg: 'var(--clay-dark)' },
    attente_fondateur: { label: 'Attente fondateur', bg: 'var(--amber-light)', fg: 'var(--amber)' },
  };
  const s = map[statut] || map.attente_fondateur;
  return <span style={{ background: s.bg, color: s.fg, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20 }}>{s.label}</span>;
}

function Stat({ label, value, color }) {
  return (
    <div className="card-bold" style={{ padding: '18px 20px' }}>
      <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

const smallInput = { padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13, boxSizing: 'border-box', color: 'var(--ink)' };

// ==========================================
// COMPOSANT : BILAN FINANCIER (avec Donuts)
// ==========================================
function BilanFinancier() {
  const { profile } = useAuth();
  const { schoolYear } = useSelectedSchoolYear(profile.school_id);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;

    async function load() {
      try {
        const [
          { data: payments, error: pErr },
          { data: salaries, error: sErr },
          { data: advances, error: aErr },
          { data: expenses, error: eErr }
        ] = await Promise.all([
          supabase.from('payments').select('type_frais, montant').eq('school_year_id', schoolYear.id),
          supabase.from('staff_salaries').select('montant').eq('school_year_id', schoolYear.id),
          supabase.from('salary_advances').select('montant').eq('school_year_id', schoolYear.id).eq('statut', 'approuvee'),
          supabase.from('expenses').select('montant').eq('school_year_id', schoolYear.id)
        ]);

        if (pErr) throw pErr;
        if (sErr) throw sErr;
        if (aErr) throw aErr;
        if (eErr) throw eErr;

        const ecolage = (payments || []).filter(p => p.type_frais === 'scolarite').reduce((acc, p) => acc + Number(p.montant), 0);
        const connexe = (payments || []).filter(p => p.type_frais === 'connexe').reduce((acc, p) => acc + Number(p.montant), 0);
        const inscription = (payments || []).filter(p => p.type_frais === 'inscription').reduce((acc, p) => acc + Number(p.montant), 0);
        const totalRevenus = ecolage + connexe + inscription;

        const salairesPayes = (salaries || []).reduce((acc, item) => acc + Number(item.montant), 0);
        const avancesPayees = (advances || []).reduce((acc, item) => acc + Number(item.montant), 0);
        const autresDepenses = (expenses || []).reduce((acc, item) => acc + Number(item.montant), 0);
        const totalCharges = salairesPayes + avancesPayees + autresDepenses;

        const resultatNet = totalRevenus - totalCharges;

        if (!cancelled) {
          setData({
            ecolage, connexe, inscription, totalRevenus,
            salairesPayes, avancesPayees, autresDepenses, totalCharges,
            resultatNet
          });
        }
      } catch (err) {
        if (!cancelled) setError(translateError(err));
      }
    }

    load();
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!data || !schoolYear) {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }} className="desktop-grid-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div className="card-bold"><SkeletonTableRows count={5} columns={4} /></div>
      </div>
    );
  }

  const pieRevenusData = [
    { name: 'Écolage', value: data.ecolage, color: 'var(--forest)' },
    { name: 'Connexes', value: data.connexe, color: 'var(--clay)' },
    { name: 'Inscriptions', value: data.inscription, color: 'var(--gold)' },
  ].filter(d => d.value > 0);

  const pieChargesData = [
    { name: 'Salaires', value: data.salairesPayes, color: '#4A90E2' },
    { name: 'Avances', value: data.avancesPayees, color: '#E26D8A' },
    { name: 'Autres dépenses', value: data.autresDepenses, color: 'var(--muted)' },
  ].filter(d => d.value > 0);

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (percent < 0.05) return null;
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div>
      <div className="card-bold" style={{ padding: '20px 24px', marginBottom: 24, background: 'var(--forest)', color: '#fff', borderColor: 'var(--forest)' }}>
        <p style={{ margin: '0 0 6px', fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Résultat net de l'école — {schoolYear.label}</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 46, fontWeight: 700, color: data.resultatNet >= 0 ? '#fff' : '#FFC0C0' }}>
            {fmtF(data.resultatNet)}
          </p>
          <span style={{ fontSize: 14, fontWeight: 600, color: data.resultatNet >= 0 ? 'var(--gold)' : '#FFC0C0' }}>
            {data.resultatNet >= 0 ? 'Bénéfice' : 'Déficit'}
          </span>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.6)' }}>
          Revenus totaux : {fmtF(data.totalRevenus)} — Charges totales : {fmtF(data.totalCharges)}
        </p>
      </div>

      <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 24 }}>
        <div className="card-bold" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <i className="ti ti-trending-up" style={{ fontSize: 20, color: 'var(--success)' }} aria-hidden="true"></i>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Revenus encaissés</p>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Droit d'écolage</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{fmtF(data.ecolage)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Frais connexes</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{fmtF(data.connexe)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Inscriptions / Réinscriptions</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{fmtF(data.inscription)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>TOTAL REVENUS</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>{fmtF(data.totalRevenus)}</span>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 10, position: 'relative' }}>
            {pieRevenusData.length > 0 && (
              <>
                <div style={{ height: 200, width: '100%' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie 
                        data={pieRevenusData} 
                        dataKey="value" 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={60} 
                        outerRadius={85} 
                        paddingAngle={2} 
                        stroke="#ffffff" 
                        strokeWidth={2}
                        labelLine={false}
                        label={renderCustomizedLabel}
                      >
                        {pieRevenusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value) => fmtF(value)} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>
                    {fmtF(data.totalRevenus).replace(' F CFA', '')}
                  </p>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>F CFA</p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 16 }}>
                  {pieRevenusData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color }} />
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)' }}>{d.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card-bold" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <i className="ti ti-trending-down" style={{ fontSize: 20, color: 'var(--danger)' }} aria-hidden="true"></i>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Charges décaissées</p>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Salaires versés</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{fmtF(data.salairesPayes)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Avances sur salaire</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{fmtF(data.avancesPayees)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Autres dépenses</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{fmtF(data.autresDepenses)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)' }}>TOTAL CHARGES</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger)' }}>{fmtF(data.totalCharges)}</span>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 10, position: 'relative' }}>
            {pieChargesData.length > 0 && (
              <>
                <div style={{ height: 200, width: '100%' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie 
                        data={pieChargesData} 
                        dataKey="value" 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={60} 
                        outerRadius={85} 
                        paddingAngle={2} 
                        stroke="#ffffff" 
                        strokeWidth={2}
                        labelLine={false}
                        label={renderCustomizedLabel}
                      >
                        {pieChargesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value) => fmtF(value)} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>
                    {fmtF(data.totalCharges).replace(' F CFA', '')}
                  </p>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>F CFA</p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 16 }}>
                  {pieChargesData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color }} />
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)' }}>{d.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
