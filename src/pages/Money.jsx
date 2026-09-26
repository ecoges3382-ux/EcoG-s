import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF, initials, TRANCHES, MODES, trancheLabel, TYPES_FRAIS, typeFraisLabel, modeLabel } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import { computeRelance } from '../lib/retard.js';
import { useEnrollmentsForYear } from '../lib/enrollments.js';
import MoneyInput from '../components/MoneyInput.jsx';
import AmountAwareTextarea from '../components/AmountAwareTextarea.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import PaymentReceipt from '../components/PaymentReceipt.jsx';
import { useToast } from '../components/Toast.jsx';
import Dropdown from '../components/Dropdown.jsx';

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

  return (
    <div>
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Argent</p>
      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -14px 22px', padding: '0 14px 4px' }}>
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

// Thin wrapper autour du hook partagé (src/lib/enrollments.js, aussi
// utilisé par Dashboard.jsx et Reports.jsx) — garde la même interface
// qu'avant (students/error/schoolYear) pour ne rien changer aux composants
// qui l'appellent ci-dessous.
function useEnrollments() {
  const { profile } = useAuth();
  const { schoolYear } = useSelectedSchoolYear(profile.school_id);
  const { students, error } = useEnrollmentsForYear(schoolYear);
  return { students, error, schoolYear };
}

function Overview() {
  const { students, error, schoolYear } = useEnrollments();
  const [search, setSearch] = useState('');
  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!students) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const totalDu = students.reduce((a, s) => a + Number(s.montant_du), 0);
  const totalPaye = students.reduce((a, s) => a + Number(s.montant_paye), 0);
  const totalReste = totalDu - totalPaye;
  const tauxRecouv = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;

  // Une fois un calendrier de paiement configuré, "en retard" veut dire
  // un délai dépassé (voir computeRelance) plutôt que juste "reste à
  // payer" — et exclut les élèves avec un moratoire actif. computeRelance
  // n'est calculé qu'une fois par élève, jamais recalculé pour les stats
  // puis à nouveau pour le tableau.
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
    .filter((s) => !search.trim() || s.full_name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => b.reste - a.reste);

  function statutOf(s) {
    if (s.relance.moratoire) return { label: 'Moratoire', color: null };
    if (s.reste <= 0) return { label: 'À jour', color: 'success' };
    if (calendrierConfigure) return s.relance.relance ? { label: 'À relancer', color: 'danger' } : { label: 'Dans les délais', color: 'amber' };
    return { label: 'Solde restant', color: 'amber' };
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }} className="desktop-grid-3">
        <Stat label="Attendu" value={fmtF(totalDu)} />
        <Stat label="Encaissé" value={fmtF(totalPaye)} color="var(--success)" />
        <Stat label="Reste à recouvrer" value={fmtF(totalReste)} color="var(--danger)" />
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
      <div className="card-bold" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 620 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 20px', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
            <span>Élève</span><span>Dû</span><span>Payé</span><span>Solde</span><span>Statut</span>
          </div>
          {filtered.slice(0, 200).map((s, i) => {
            const st = statutOf(s);
            return (
              <Link
                key={s.id}
                to={`/eleves/${s.id}`}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 20px', alignItems: 'center', borderBottom: i < Math.min(filtered.length, 200) - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}
              >
                <div>
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
  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!students) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

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
      <div className="card-bold" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 560 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 20px', background: 'var(--forest-light)', fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark)', textTransform: 'uppercase' }}>
            <span>Élève</span><span>Classe</span><span>Dû</span><span>Payé</span><span>Statut</span>
          </div>
          {students.map((s, i) => {
            const reste = Number(s.frais_connexe_du) - Number(s.frais_connexe_paye);
            const relance = computeRelance(s, schoolYear, s.feeSchedule);
            const label = reste <= 0 ? 'À jour' : relance.moratoire ? 'Moratoire' : relance.relanceConnexe ? 'À relancer' : 'Retard';
            const color = reste <= 0 ? 'success' : relance.moratoire ? null : relance.relanceConnexe ? 'danger' : 'amber';
            return (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 20px', alignItems: 'center', borderBottom: i < students.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{s.full_name}</span>
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
  const { schoolYear } = useSelectedSchoolYear(profile.school_id);
  const canManage = ['fondateur', 'directeur', 'secretaire'].includes(profile.role);
  const [payments, setPayments] = useState(null);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Un paiement ne se corrige jamais par édition — c'est un registre
  // append-only voulu ainsi (voir supabase/schema.sql, pas de policy
  // update sur "payments") : une erreur de montant se corrige en
  // supprimant la ligne fautive puis en en enregistrant une bonne. Le
  // trigger recompute_enrollment_paye recalcule automatiquement le payé
  // de l'inscription dès la suppression, donc rien d'autre à faire ici.
  async function handleDelete(p) {
    if (!window.confirm(`Supprimer ce paiement de ${fmtF(p.montant)} pour ${p.students?.full_name || 'cet élève'} ? Cette action est irréversible.`)) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('payments').delete().eq('id', p.id);
    setDeleting(false);
    if (deleteError) { setError(deleteError.message); return; }
    showToast('Supprimé');
    reload();
  }

  async function reload() {
    if (!schoolYear) return;
    const [{ data: pay, error: payError }, { data: enr }] = await Promise.all([
      supabase.from('payments').select('*, students ( full_name )').eq('school_year_id', schoolYear.id).order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('enrollments').select('montant_du, montant_paye, classes ( nom ), students ( id, full_name )').eq('school_year_id', schoolYear.id),
    ]);
    if (payError) setError(payError.message); else setPayments(pay);
    setStudents((enr || [])
      .map((e) => ({ id: e.students.id, full_name: e.students.full_name, niveau: e.classes?.nom || '—', montant_du: e.montant_du, montant_paye: e.montant_paye }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name)));
  }
  useEffect(() => { reload(); }, [schoolYear?.id]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!payments) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const totalEncaisse = payments.reduce((a, p) => a + Number(p.montant), 0);
  const partiels = payments.filter((p) => p.tranche !== 'complet').length;

  return (
    <div>
      <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 22 }}>
        <Stat label="Total encaissé" value={fmtF(totalEncaisse)} color="var(--success)" />
        <Stat label="Nb paiements" value={payments.length} />
        <Stat label="Paiements partiels" value={partiels} color="var(--amber)" />
      </div>

      {canManage && (
        <button onClick={() => setModalOpen(true)} disabled={!schoolYear} style={{ marginBottom: 18, fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff', opacity: schoolYear ? 1 : 0.7 }}>
          <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Enregistrer un paiement
        </button>
      )}

      <div className="card-bold" style={{ overflow: 'hidden' }}>
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
                  <i className="ti ti-trash" style={{ fontSize: 17 }} aria-hidden="true"></i>
                </button>
              )}
            </div>
          </div>
        ))}
        {payments.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun paiement enregistré.</p>}
      </div>

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
  // Filtre en deux temps (classe puis élève) plutôt qu'un seul menu avec
  // tous les élèves de l'école mélangés — plus rapide à trouver quand il y
  // en a beaucoup.
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
  // Générée une seule fois à l'ouverture de ce formulaire (pas à chaque
  // frappe ni à chaque tentative d'envoi) : si la même soumission part deux
  // fois (double-clic qui passe outre le bouton désactivé, retry réseau),
  // les deux requêtes portent la même clé. La contrainte unique côté base
  // (voir supabase/schema.sql) rejette la 2e avec l'erreur 23505.
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
      // Cette clé existe déjà en base : une tentative précédente (retry
      // réseau, double envoi) a réussi côté serveur sans que ce client le
      // sache. On ne traite jamais ça comme un succès silencieux — on
      // relit la ligne déjà enregistrée pour confirmer qu'elle correspond
      // bien à cette soumission avant de fermer le formulaire.
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
        // Même paiement, déjà enregistré par la tentative précédente : rien à refaire.
        showToast('Enregistré');
        onCreated();
        return;
      }
      // La ligne déjà enregistrée ne correspond pas à ce qui vient d'être
      // soumis (ex. montant modifié entre deux essais) : on ne referme pas
      // silencieusement, pour ne pas laisser croire que CETTE saisie a été
      // prise en compte alors que c'est l'ancienne qui reste en base.
      setError(`Un paiement a déjà été enregistré pour cette même saisie, mais avec des données différentes (${fmtF(existing.montant)} au lieu de ${fmtF(payload.montant)}). Vérifie la liste des paiements plutôt que de réessayer.`);
      return;
    }

    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    showToast('Enregistré');
    onCreated();
  }

  if (students.length === 0) {
    return (
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
      </div>
    );
  }

  return (
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
            <Dropdown value={typeFrais} onChange={setTypeFrais} options={TYPES_FRAIS.map((t) => ({ value: t.id, label: t.label }))} style={modalInputStyle} />
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
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={modalInputStyle} />
          </div>
          <div>
            <label style={modalLabelStyle}>Note</label>
            <AmountAwareTextarea value={note} onChange={setNote} multiline={false} style={modalInputStyle} />
          </div>
        </div>

        {students.length === 0 && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)' }}>Aucun élève inscrit.</p>}
        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
          <button type="submit" disabled={submitting || students.length === 0} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

const modalInputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const modalLabelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };

function Expenses() {
  const showToast = useToast();
  const { profile } = useAuth();
  const canManage = ['fondateur', 'directeur', 'secretaire'].includes(profile.role);
  const { schoolYear } = useSelectedSchoolYear(profile.school_id);
  const [expenses, setExpenses] = useState(null);
  const [error, setError] = useState('');
  const [libelle, setLibelle] = useState('');
  const [categorie, setCategorie] = useState('');
  const [montant, setMontant] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function reload() {
    if (!schoolYear) return;
    setExpenses(null);
    supabase.from('expenses').select('*').eq('school_year_id', schoolYear.id).order('created_at', { ascending: false })
      .then(({ data, error: e }) => { if (e) setError(e.message); else setExpenses(data); });
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
    if (insertError) { setError(insertError.message); return; }
    setLibelle(''); setCategorie(''); setMontant('');
    showToast('Enregistré');
    reload();
  }

  // Comme "payments"/"staff_salaries" : registre append-only, une erreur
  // se corrige en supprimant la ligne fautive puis en en ajoutant une bonne.
  async function handleDelete(d) {
    if (!window.confirm(`Supprimer la dépense « ${d.libelle} » (${fmtF(d.montant)}) ? Cette action est irréversible.`)) return;
    const { error: deleteError } = await supabase.from('expenses').delete().eq('id', d.id);
    if (deleteError) { setError(deleteError.message); return; }
    showToast('Supprimé');
    reload();
  }

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!expenses || !schoolYear) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const total = expenses.reduce((a, d) => a + Number(d.montant), 0);

  return (
    <div>
      <div className="card-bold" style={{ padding: '18px 20px', marginBottom: 24, maxWidth: 320 }}>
        <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>Total des dépenses — {schoolYear.label}</p>
        <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color: 'var(--danger)' }}>{fmtF(total)}</p>
      </div>

      <p className="page-title" style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Dépenses récentes</p>
      <div className="card-bold" style={{ overflow: 'hidden', marginBottom: 24, maxWidth: 640 }}>
        {expenses.map((d, i) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < expenses.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <div>
              <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 600 }}>{d.libelle}</p>
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)' }}>{d.categorie}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{fmtF(d.montant)}</p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleDelete(d)}
                  title="Supprimer"
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, display: 'flex' }}
                >
                  <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true"></i>
                </button>
              )}
            </div>
          </div>
        ))}
        {expenses.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucune dépense enregistrée.</p>}
      </div>

      <form onSubmit={handleSubmit} className="card-bold" style={{ padding: '18px 20px', maxWidth: 480, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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

function Advances() {
  const showToast = useToast();
  const { profile } = useAuth();
  const { schoolYear } = useSelectedSchoolYear(profile.school_id);
  const [advances, setAdvances] = useState(null);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState('');
  const [staffId, setStaffId] = useState('');
  const [montant, setMontant] = useState('');
  const [motif, setMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    if (!schoolYear) return;
    const [{ data: adv, error: e }, { data: st }] = await Promise.all([
      supabase.from('salary_advances').select('*, staff ( full_name, role )').eq('school_year_id', schoolYear.id).order('created_at', { ascending: false }),
      // Une demande ne peut concerner qu'un membre actif — un archivé n'est
      // plus proposé à la saisie, mais reste visible dans son propre
      // historique (StaffDetail) et dans la liste ci-dessus.
      supabase.from('staff').select('id, full_name, role').eq('statut', 'actif').order('full_name'),
    ]);
    if (e) setError(e.message); else setAdvances(adv);
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
    if (insertError) { setError(insertError.message); return; }
    setMontant(''); setMotif('');
    showToast('Enregistré');
    reload();
  }

  async function decide(id, statut) {
    const { error: updateError } = await supabase.from('salary_advances').update({ statut }).eq('id', id);
    if (updateError) setError(updateError.message);
    else { showToast('Enregistré'); reload(); }
  }

  // Uniquement tant que la demande n'a pas encore été statuée — une fois
  // approuvée ou refusée (potentiellement déjà partiellement remboursée),
  // elle reste dans l'historique, comme les autres registres financiers.
  async function handleDelete(a) {
    if (!window.confirm(`Supprimer cette demande d'avance de ${fmtF(a.montant)} pour ${a.staff?.full_name || 'ce membre du personnel'} ?`)) return;
    const { error: deleteError } = await supabase.from('salary_advances').delete().eq('id', a.id);
    if (deleteError) { setError(deleteError.message); return; }
    showToast('Supprimé');
    reload();
  }

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!advances || !schoolYear) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const canDecide = profile.role === 'fondateur' || profile.role === 'directeur';

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.6 }}>
        Le fondateur et le directeur peuvent approuver ou refuser une demande. Les autres rôles peuvent
        seulement en soumettre une nouvelle. Demandes de l'année {schoolYear.label}.
      </p>

      <div className="card-bold" style={{ overflow: 'hidden', marginBottom: 20 }}>
        {advances.map((a, i) => (
          <div key={a.id} style={{ padding: '13px 20px', borderBottom: i < advances.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{a.staff?.full_name || '—'}</span>
                <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}> · {a.staff?.role}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtF(a.montant)}{a.statut === 'approuvee' && Number(a.solde) > 0 ? ` (reste ${fmtF(a.solde)})` : ''}</span>
            </div>
            {a.motif && <p style={{ margin: '0 0 6px', fontSize: '11.5px', color: 'var(--muted)' }}>{a.motif}</p>}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <StatusBadge statut={a.statut} />
              {canDecide && a.statut !== 'approuvee' && a.statut !== 'refusee' && (
                <div>
                  <button onClick={() => decide(a.id, 'approuvee')} style={{ fontSize: '11.5px', fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff', marginRight: 6 }}>Approuver</button>
                  <button onClick={() => decide(a.id, 'refusee')} style={{ fontSize: '11.5px', fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', marginRight: 6 }}>Refuser</button>
                  <button onClick={() => handleDelete(a)} title="Supprimer cette demande" style={{ fontSize: '11.5px', fontWeight: 600, padding: '6px 10px', borderRadius: 8, border: 'none', background: 'none', color: 'var(--danger)' }}>
                    <i className="ti ti-trash" style={{ fontSize: 14, verticalAlign: '-2px' }} aria-hidden="true"></i>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {advances.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucune demande.</p>}
      </div>

      {staff.length > 0 ? (
        <form onSubmit={handleSubmit} className="card-bold" style={{ padding: '18px 20px', maxWidth: 480, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
        <p className="card-bold" style={{ padding: '18px 20px', margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          Aucun membre du personnel enregistré pour l'instant. Ajoute d'abord des membres dans l'onglet{' '}
          <Link to="/personnel" style={{ color: 'var(--forest)', fontWeight: 600, textDecoration: 'none' }}>Personnel</Link>{' '}
          pour pouvoir soumettre une demande d'avance sur salaire.
        </p>
      )}
    </div>
  );
}

function StatusBadge({ statut }) {
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
