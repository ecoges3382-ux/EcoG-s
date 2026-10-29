import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF, initials, TRANCHES, MODES, trancheLabel, TYPES_FRAIS, typeFraisLabel, modeLabel, stickyColStyle } from '../lib/utils.js';
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

const TABS = [
  { id: 'vue', label: "Droit d'écolage" },
  { id: 'connexe', label: 'Frais connexes' },
  { id: 'paiements', label: 'Paiements' },
  { id: 'depenses', label: 'Dépenses' },
  { id: 'avances', label: 'Avances sur salaire' },
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
      <div data-tour="money-tabs" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -14px 22px', padding: '0 14px 4px' }}>
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
      {tab === 'avances' && <Advances />}
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

  // Données pour le graphique
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
      
      {/* --- Nouveau Graphique Facturé vs Encaissé --- */}
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
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
    const { data: enr } = await supabase.from('enrollments').select('montant_du, montant_paye, classes ( nom ), students ( id, full_name )').eq('school_year_id', schoolYear.id);
    setStudents((enr || [])
      .map((e) => ({ id: e.students.id, full_name: e.students.full_name, niveau: e.classes?.nom || '—', montant_du: e.montant_du, montant_paye: e.montant_paye }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name)));
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

      {canManage && (
        <button onClick={() => setModalOpen(true)} disabled={!schoolYear} style={{ marginBottom: 18, fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', opacity: schoolYear ? 1 : 0.7 }}>
          <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Enregistrer un paiement
        </button>
      )}

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
              <div>
                <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 600 }}>{p.students?.full_name || '—'}</p>
                <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)' }}>
                  {TYPES_FRAIS.find((t) => t.id === p.type_frais)?.label} · {MODES.find((m) => m.id === p.mode)?.label} · {new Date(p.date).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 700 }}>{fmtF(p.montant)}</p>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: p.tranche === 'complet' ? 'var(--success-light)' : 'var(--amber-light)', color: p.tranche === 'complet' ? 'var(--success)' : 'var(--amber)' }}>
                    {trancheLabel(p.tranche)}
                  </span>
                </div>
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
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && schoolYear && (
        <NewPaymentModal
          schoolId={profile.school_id}
          schoolYearId={schoolYear.id}
          students={students}
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); reload(); }}
        />
      )}

      {receiptPayment && (
        <PaymentReceipt
          payment={receiptPayment}
          studentName={receiptPayment.students?.full_name || '—'}
          classeNom={students.find((s) => s.id === receiptPayment.student_id)?.niveau}
          schoolYearLabel={schoolYear?.label}
          school={profile.schools}
          montantDu={students.find((s) => s.id === receiptPayment.student_id)?.montant_du}
          montantPaye={students.find((s) => s.id === receiptPayment.student_id)?.montant_paye}
          onClose={() => setReceiptPayment(null)}
        />
      )}
    </div>
  );
}

function NewPaymentModal({ schoolId, schoolYearId, students, onClose, onCreated }) {
  const showToast = useToast();
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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!studentId || !montant) {
      setError("L'élève et le montant sont obligatoires.");
      return;
    }
    setSubmitting(true);
    setError('');
    const payload = {
      school_id: schoolId, school_year_id: schoolYearId, student_id: studentId, type_frais: typeFrais, montant: Number(montant), mode, tranche, date, note: note.trim() || null,
      idempotency_key: idempotencyKey,
    };
    const { error: insertError } = await supabase.from('payments').insert(payload);

    if (insertError && insertError.code === '23505') {
      const { data: existing, error: fetchError } = await supabase
        .from('payments')
        .select('student_id, type_frais, montant, mode, tranche, date')
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
        showToast('Enregistré');
        onCreated();
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
    onCreated();
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

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={modalLabelStyle}>Type de frais</label>
            <Dropdown value={typeFrais} onChange={setTypeFrais} options={TYPES_FRAIS.filter((t) => !t.hidden).map((t) => ({ value: t.id, label: t.label }))} style={modalInputStyle} />
          </div>
          <div>
            <label style={modalLabelStyle}>Montant</label>
            <MoneyInput value={montant} onChange={setMontant} style={modalInputStyle} suffix="F CFA" />
          </div>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={modalLabelStyle}>Mode</label>
            <Dropdown value={mode} onChange={setMode} options={MODES.map((m) => ({ value: m.id, label: m.label }))} style={modalInputStyle} />
          </div>
          <div>
            <label style={modalLabelStyle}>Tranche</label>
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
          <button type="submit" disabled={submitting || students.length === 0} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: submitting ? 0.7 : 1 }}>
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

      <p className="page-title" style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Dépenses récentes</p>
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
              <div>
                <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 600 }}>{d.libelle}</p>
                <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)' }}>{d.categorie}</p>
              </div>
              <div style
