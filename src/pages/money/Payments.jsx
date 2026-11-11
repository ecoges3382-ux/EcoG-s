import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom'; // 👈 NOUVEL IMPORT
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { fmtF, TRANCHES, MODES, trancheLabel, TYPES_FRAIS } from '../../lib/utils.js';
import { useSelectedSchoolYear } from '../../lib/schoolYear.jsx';
import MoneyInput from '../../components/MoneyInput.jsx';
import AmountAwareTextarea from '../../components/AmountAwareTextarea.jsx';
import PaymentReceipt from '../../components/PaymentReceipt.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/ConfirmDialog.jsx';
import Dropdown from '../../components/Dropdown.jsx';
import DatePicker from '../../components/DatePicker.jsx';
import { SkeletonCard, SkeletonRow } from '../../components/Skeleton.jsx';
import OfflineBanner from '../../components/OfflineBanner.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import SelectionBar from '../../components/SelectionBar.jsx';
import { guardedFetch } from '../../lib/offlineCache.js';
import { translateError } from '../../lib/errors.js';
import { TrashIcon, UsersIcon, ReceiptIcon } from './icons.jsx';

export default function Payments() {
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
  const navigate = useNavigate(); // 👈 INITIALISATION DE useNavigate

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
      setError("La suppression n'a pas été effectuée (probablement bloquée par une policy RLS).");
      return;
    }
    showToast(`${selectedIds.length} supprimé(s)`);

    try {
      await supabase.functions.invoke('send-admin-push', {
        body: {
          school_id: profile.school_id,
          title: "⚠️ Suppression de paiements",
          message: `${profile.full_name} a supprimé ${selectedIds.length} paiement(s).`,
          url: "/argent"
        }
      });
    } catch (err) { console.warn(err); }

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
      setError("La suppression n'a pas été effectuée (probablement bloquée par une policy RLS).");
      return;
    }
    showToast('Supprimé');

    try {
      await supabase.functions.invoke('send-admin-push', {
        body: {
          school_id: profile.school_id,
          title: "⚠️ Suppression de paiement",
          message: `${profile.full_name} a supprimé un paiement de ${fmtF(p.montant)} pour ${p.students?.full_name || 'un élève'}.`,
          url: "/argent"
        }
      });
    } catch (err) { console.warn(err); }

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

  const paymentsScolarite = payments.filter((p) => p.type_frais === 'scolarite');
  const paymentsAutres = payments.filter((p) => p.type_frais !== 'scolarite');

  const totalScolarite = paymentsScolarite.reduce((a, p) => a + Number(p.montant), 0);
  const totalAutres = paymentsAutres.reduce((a, p) => a + Number(p.montant), 0);

  // 👇 MODIFICATION DE LA LIGNE ICI 👇
  const renderPaymentRow = (p, i, arrayLength) => (
    <div
      key={p.id}
      onClick={() => { if (!selectMode) navigate(`/eleves/${p.student_id}`); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '13px 20px',
        borderBottom: i < arrayLength - 1 ? '1px solid var(--line)' : 'none',
        gap: 10,
        flexWrap: 'wrap',
        cursor: selectMode ? 'default' : 'pointer',
        transition: 'background 0.15s'
      }}
      onMouseEnter={(e) => { if (!selectMode) e.currentTarget.style.backgroundColor = 'var(--cream)'; }}
      onMouseLeave={(e) => { if (!selectMode) e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {selectMode && (
          <input
            type="checkbox"
            checked={selectedIds.includes(p.id)}
            onChange={() => toggleOne(p.id)}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
        )}
        <div>
          <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 600, color: selectMode ? 'inherit' : 'var(--forest)' }}>
            {p.students?.full_name || '—'}
          </p>
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
            <button type="button" onClick={(e) => { e.stopPropagation(); setReceiptPayment(p); }} title="Imprimer le reçu" style={{ background: 'none', border: 'none', color: 'var(--forest)', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <i className="ti ti-receipt" style={{ fontSize: 17 }} aria-hidden="true"></i>
            </button>
            {canManage && (
              <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(p); }} disabled={deleting} title="Supprimer" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, display: 'flex', opacity: deleting ? 0.6 : 1 }}>
                <TrashIcon />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

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
            <EmptyState icon={<UsersIcon />} title="Aucun élève inscrit cette année" subtitle="Il faut d'abord inscrire au moins un élève." actionLabel="Aller vers Élèves" actionTo="/eleves" />
          ) : (
            <EmptyState icon={<ReceiptIcon />} title="Aucun paiement enregistré" subtitle="Dès qu'un parent paie, enregistre-le ici." actionLabel={canManage ? 'Enregistrer un paiement' : undefined} onAction={canManage ? () => setModalOpen(true) : undefined} />
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16, alignItems: 'start' }}>

          <div className="card-bold" style={{ display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--cream)', borderRadius: '12px 12px 0 0' }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Scolarité</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{paymentsScolarite.length} paiement(s)</p>
              </div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--success)' }}>{fmtF(totalScolarite)}</p>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {paymentsScolarite.length > 0 ? (
                paymentsScolarite.map((p, i) => renderPaymentRow(p, i, paymentsScolarite.length))
              ) : (
                <p style={{ padding: 20, textAlign: 'center', fontSize: 12.5, color: 'var(--muted)' }}>Aucun paiement de scolarité.</p>
              )}
            </div>
          </div>

          <div className="card-bold" style={{ display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--cream)', borderRadius: '12px 12px 0 0' }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Frais connexes & autres</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{paymentsAutres.length} paiement(s)</p>
              </div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--amber)' }}>{fmtF(totalAutres)}</p>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {paymentsAutres.length > 0 ? (
                paymentsAutres.map((p, i) => renderPaymentRow(p, i, paymentsAutres.length))
              ) : (
                <p style={{ padding: 20, textAlign: 'center', fontSize: 12.5, color: 'var(--muted)' }}>Aucun frais connexe.</p>
              )}
            </div>
          </div>

        </div>
      )}

      {selectMode && (
        <SelectionBar count={selectedIds.length} allSelected={payments.length > 0 && payments.every((p) => selectedIds.includes(p.id))} onCancel={exitSelectMode} onToggleAll={toggleAllVisible} onDelete={handleDeleteSelected} deleting={deleting} />
      )}

      {modalOpen && schoolYear && (
        <NewPaymentModal schoolId={profile.school_id} schoolYearId={schoolYear.id} students={students} feeSchedules={feeSchedules} onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); reload(); }} />
      )}

      {receiptPayment && (() => {
        const st = students.find((s) => s.id === receiptPayment.student_id);
        const enrollment = st ? { montant_du: st.montant_du, montant_paye: st.montant_paye, frais_connexe_du: st.frais_connexe_du, frais_connexe_paye: st.frais_connexe_paye } : null;
        const fs = st ? feeSchedules.find((f) => f.niveau === st.classeNiveau) : null;
        return (
          <PaymentReceipt payment={receiptPayment} studentName={receiptPayment.students?.full_name || st?.full_name || '—'} classeNom={st?.niveau} studentMatricule={st?.matricule} schoolYearLabel={schoolYear?.label} school={profile.schools} montantDu={st?.montant_du} montantPaye={st?.montant_paye} enrollment={enrollment} schoolYear={schoolYearInfo} feeSchedule={fs} autoPrint={false} onClose={() => setReceiptPayment(null)} />
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
    const scolarite = Number(currentStudent?.montant_du) || Number(currentFeeSchedule?.montant_scolarite) || 0;
    const connexe = Number(currentStudent?.frais_connexe_du) || Number(currentFeeSchedule?.montant_connexe) || 0;
    const inscription = Number(currentFeeSchedule?.montant_inscription || currentFeeSchedule?.montant_reinscription) || 0;

    let amount = null;
    
    if (typeFrais === 'scolarite') {
      if (tranche === 'tranche1') amount = Number(currentFeeSchedule?.montant_tranche1) || 0;
      else if (tranche === 'tranche2') amount = Number(currentFeeSchedule?.montant_tranche2) || 0;
      else if (tranche === 'tranche3') amount = Number(currentFeeSchedule?.montant_tranche3) || 0;
      else if (tranche === 'complet') amount = scolarite;
      else if (tranche === 'moitie') amount = scolarite / 2;
    } else if (typeFrais === 'connexe') {
      if (tranche === 'complet') amount = connexe;
      else if (tranche === 'moitie') amount = connexe / 2;
    } else if (typeFrais === 'inscription') {
      if (tranche === 'complet') amount = inscription;
      else if (tranche === 'moitie') amount = inscription / 2;
    }

    if (amount !== null && !isNaN(amount) && amount > 0) {
      setMontant(String(Math.round(amount)));
    } else if (tranche === 'autre' || typeFrais === 'autre') {
      setMontant('');
    }
  }, [typeFrais, tranche, currentStudent?.montant_du, currentStudent?.frais_connexe_du, currentFeeSchedule]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!studentId || !montant) { setError("L'élève et le montant sont obligatoires."); return; }
    if (dejaPaye) { setError("Impossible d'enregistrer : cet élève a déjà tout payé pour ce type de frais."); return; }
    
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
      const { data: existing, error: fetchError } = await supabase.from('payments').select('*').eq('idempotency_key', idempotencyKey).maybeSingle();
      setSubmitting(false);
      if (fetchError || !existing) { setError("Ce paiement semble déjà avoir été enregistré."); return; }
      setCreatedPayment(existing);
      return;
    }

    setSubmitting(false);
    if (insertError) { setError(translateError(insertError)); return; }
    showToast('Enregistré');

    try {
      await supabase.functions.invoke('send-payment-push', {
        body: {
          school_id: schoolId,
          student_id: studentId,
          student_name: currentStudent?.full_name || 'Un élève',
          amount: Number(payload.montant),
          type_frais: TYPES_FRAIS.find((t) => t.id === typeFrais)?.label || 'Frais',
          date: date,
        }
      });
    } catch (err) {
      console.warn("La notification push/WhatsApp n'a pas pu être envoyée :", err);
    }

    if (inserted) { setCreatedPayment(inserted); return; }
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
      <PaymentReceipt payment={createdPayment} studentName={currentStudent.full_name} classeNom={currentStudent.niveau} studentMatricule={currentStudent.matricule} schoolYearLabel={schoolYearInfo.label} school={profile?.schools} montantDu={updatedEnrollment.montant_du} montantPaye={updatedEnrollment.montant_paye} enrollment={updatedEnrollment} schoolYear={schoolYearInfo} feeSchedule={currentFeeSchedule} autoPrint={false} onClose={onCreated} />
    );
  }

  if (students.length === 0) {
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 420, width: '100%', padding: 26, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600 }}>Aucun élève inscrit</p>
          <Link to="/eleves" onClick={onClose} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '11px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', textDecoration: 'none', marginBottom: 10 }}>Aller inscrire un élève</Link>
          <button type="button" onClick={onClose} style={{ width: '100%', padding: '11px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>Nouveau paiement</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={modalLabelStyle}>Classe</label><Dropdown value={classeFilter} onChange={handleClasseChange} options={classes} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>Élève</label><Dropdown value={studentId} onChange={setStudentId} options={studentsInClasse.map((s) => ({ value: s.id, label: s.full_name }))} style={modalInputStyle} /></div>
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
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--clay-dark)' }}>Cet élève a déjà tout payé pour ce type de frais.</p>
          </div>
        )}

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={modalLabelStyle}>Type de frais</label><Dropdown value={typeFrais} onChange={setTypeFrais} options={TYPES_FRAIS.filter((t) => !t.hidden).map((t) => ({ value: t.id, label: t.label }))} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>Tranche / Type</label><Dropdown value={tranche} onChange={setTranche} options={TRANCHES.map((t) => ({ value: t.id, label: t.label }))} style={modalInputStyle} /></div>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={modalLabelStyle}>Montant</label>
            <MoneyInput value={montant} onChange={setMontant} style={{ ...modalInputStyle, backgroundColor: isMontantEditable ? 'var(--paper)' : 'var(--line)' }} suffix="F CFA" disabled={!isMontantEditable} />
          </div>
          <div><label style={modalLabelStyle}>Mode</label><Dropdown value={mode} onChange={setMode} options={MODES.map((m) => ({ value: m.id, label: m.label }))} style={modalInputStyle} /></div>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={modalLabelStyle}>Date</label><DatePicker value={date} onChange={setDate} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>Note</label><AmountAwareTextarea value={note} onChange={setNote} multiline={false} style={modalInputStyle} /></div>
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

function Stat({ label, value, color }) {
  return (
    <div className="card-bold" style={{ padding: '18px 20px' }}>
      <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

const modalInputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const modalLabelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
