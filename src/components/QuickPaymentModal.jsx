import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF, MODES, TYPES_FRAIS } from '../lib/utils.js';
import { optionsPaiement, montantPropose, choisirTranche, depassement, trancheApresChangementDeType } from '../lib/paymentForm.js';
import PaymentProgress from './PaymentProgress.jsx';
import MoneyInput from './MoneyInput.jsx';
import AmountAwareTextarea from './AmountAwareTextarea.jsx';
import Dropdown from './Dropdown.jsx';
import DatePicker from './DatePicker.jsx';
import { useToast } from './Toast.jsx';
import { useConfirm } from './ConfirmDialog.jsx';
import { translateError } from '../lib/errors.js';
import ModalContainer from './ModalContainer.jsx';
import PaymentReceipt from './PaymentReceipt.jsx';

export default function QuickPaymentModal({ student, feeSchedules, onClose, onSaved }) {
  const showToast = useToast();
  const confirm = useConfirm();
  const { profile } = useAuth();

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

  const currentFeeSchedule = feeSchedules ? feeSchedules.find((f) => f.niveau === student.classeNiveau) : null;

  const resteEcolage = Number(student.montant_du) - Number(student.montant_paye);
  const resteConnexe = Number(student.frais_connexe_du) - Number(student.frais_connexe_paye);

  let dejaPaye = false;
  if (typeFrais === 'scolarite' && resteEcolage <= 0) dejaPaye = true;
  if (typeFrais === 'connexe' && resteConnexe <= 0) dejaPaye = true;

  useEffect(() => {
    if (!student.school_year_id) return;
    supabase.from('school_years')
      .select('id, label, date_tranche1, date_tranche2, date_tranche3, date_connexe')
      .eq('id', student.school_year_id)
      .maybeSingle()
      .then(({ data }) => setSchoolYearInfo(data));
  }, [student.school_year_id]);

  // Choix de « Tranche / Type » d'après ce que l'élève a déjà payé (voir src/lib/paymentForm.js).
  const choixTranche = optionsPaiement(typeFrais, student, schoolYearInfo, currentFeeSchedule);
  const clesChoix = choixTranche.map((c) => c.id).join();

  // Le choix sélectionné doit rester dans la liste (une tranche soldée disparaît, « Complet » devient « Solde »…).
  useEffect(() => {
    const valide = choisirTranche(choixTranche, tranche);
    if (valide !== tranche) setTranche(valide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clesChoix]);

  // Montant pré-rempli : celui du choix sélectionné (le reste d'une tranche, le solde, la moitié…).
  useEffect(() => {
    const propose = montantPropose(choixTranche, tranche);
    if (propose !== null) setMontant(String(propose));
    else if (tranche === 'autre' || typeFrais === 'autre') setMontant('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFrais, tranche, clesChoix, student?.montant_du, student?.montant_paye, student?.frais_connexe_du, student?.frais_connexe_paye, currentFeeSchedule, schoolYearInfo]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!montant) { setError('Le montant est obligatoire.'); return; }
    if (dejaPaye) {
      setError("Impossible d'enregistrer : cet élève a déjà tout payé pour ce type de frais. Choisis « Autre » pour un paiement exceptionnel.");
      return;
    }
    // Paiement plus grand que ce qui reste dû : on ne bloque pas (un parent peut avancer de l'argent), mais on demande confirmation.
    const trop = depassement(typeFrais, montant, student);
    if (trop > 0 && !(await confirm(`Ce paiement de ${fmtF(Number(montant))} dépasse de ${fmtF(trop)} ce qui reste dû. L'élève aura un crédit de ${fmtF(trop)}. Enregistrer quand même ?`, { confirmLabel: 'Enregistrer quand même' }))) return;

    setSubmitting(true);
    setError('');

    const payload = {
      school_id: profile.school_id,
      school_year_id: student.school_year_id,
      student_id: student.id,
      type_frais: typeFrais,
      montant: Number(montant),
      mode, tranche, date,
      note: note.trim() || null,
      idempotency_key: idempotencyKey,
    };

    const { data: inserted, error: insertError } = await supabase.from('payments')
      .insert(payload)
      .select('id, montant, type_frais, mode, tranche, date, note')
      .single();

    if (insertError && insertError.code === '23505') {
      const { data: existing, error: fetchError } = await supabase
        .from('payments')
        .select('id, student_id, type_frais, montant, mode, tranche, date, note')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      setSubmitting(false);
      if (fetchError || !existing) {
        setError("Ce paiement semble déjà avoir été enregistré.");
        return;
      }
      const matches = existing.student_id === payload.student_id
        && existing.type_frais === payload.type_frais
        && Number(existing.montant) === payload.montant
        && existing.mode === payload.mode
        && existing.tranche === payload.tranche
        && existing.date === payload.date;
      if (matches) { setCreatedPayment(existing); return; }
      setError(`Un paiement a déjà été enregistré pour cette même saisie, mais avec des données différentes.`);
      return;
    }

    setSubmitting(false);
    if (insertError) { setError(translateError(insertError)); return; }

    showToast('Paiement enregistré');

    // 🚀 Envoi du push + WhatsApp (Sécurisé sans clé API)
    if (inserted) {
      try {
        await supabase.functions.invoke('send-payment-push', {
          body: {
            school_id: profile.school_id,
            student_id: student.id,
            student_name: student.full_name,
            amount: Number(payload.montant),
            type_frais: TYPES_FRAIS.find((t) => t.id === typeFrais)?.label || 'Frais',
            date: date,
          }
        });
      } catch (err) {
        console.warn("La notification push/WhatsApp n'a pas pu être envoyée :", err);
      }
    }

    if (inserted) {
      setCreatedPayment(inserted);
      return;
    }
    onSaved();
  }

  // Seul l'écolage a des tranches : en passant aux frais connexes, à l'inscription ou aux autres frais, on ne garde que
  // « Complet » et « Autre ».
  function changerTypeFrais(nouveauType) {
    setTypeFrais(nouveauType);
    setTranche((t) => trancheApresChangementDeType(nouveauType, t));
  }

  const isMontantEditable = tranche === 'autre' || typeFrais === 'autre';
  const canSubmit = !dejaPaye && !submitting && montant !== '';

  if (createdPayment && schoolYearInfo) {
    const updatedEnrollment = {
      montant_du: Number(student.montant_du) || 0,
      montant_paye: Number(student.montant_paye) + Number(createdPayment.montant),
      frais_connexe_du: Number(student.frais_connexe_du) || 0,
      frais_connexe_paye: Number(student.frais_connexe_paye) || 0,
    };
    return (
      <PaymentReceipt
        payment={createdPayment}
        studentName={student.full_name}
        classeNom={student.niveau}
        studentMatricule={student.matricule}
        schoolYearLabel={schoolYearInfo.label}
        school={profile.schools}
        montantDu={Number(student.montant_du) || 0}
        montantPaye={updatedEnrollment.montant_paye}
        enrollment={updatedEnrollment}
        schoolYear={schoolYearInfo}
        feeSchedule={currentFeeSchedule}
        autoPrint={false}
        onClose={onSaved}
      />
    );
  }

  return (
    <ModalContainer onClose={onClose} maxWidth={460}>
      <form onSubmit={handleSubmit} style={{ padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>Encaisser un paiement</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Classe</label>
            <div style={{ ...inputStyle, backgroundColor: 'var(--line)', opacity: 0.8 }}>{student.niveau}</div>
          </div>
          <div>
            <label style={labelStyle}>Élève</label>
            <div style={{ ...inputStyle, backgroundColor: 'var(--line)', opacity: 0.8 }}>{student.full_name}</div>
          </div>
        </div>

        <PaymentProgress eleve={student} anneeScolaire={schoolYearInfo} grilleFrais={currentFeeSchedule} />

        {dejaPaye && (
          <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 9, padding: '10px 14px', marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--clay-text)' }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>
              Cet élève a déjà tout payé pour ce type de frais.
            </p>
          </div>
        )}

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Type de frais</label>
            <Dropdown value={typeFrais} onChange={changerTypeFrais} options={TYPES_FRAIS.filter((t) => !t.hidden).map((t) => ({ value: t.id, label: t.label }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Tranche / Type</label>
            <Dropdown value={tranche} onChange={setTranche} options={choixTranche.map((t) => ({ value: t.id, label: t.label }))} style={inputStyle} />
          </div>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Montant</label>
            <div style={{ position: 'relative' }}>
              <MoneyInput
                value={montant}
                onChange={setMontant}
                style={{ ...inputStyle, backgroundColor: isMontantEditable ? 'var(--paper)' : 'var(--line)' }}
                suffix="F CFA"
                disabled={!isMontantEditable}
              />
            </div>
            {!isMontantEditable && <p style={{ margin: '-8px 0 10px', fontSize: 10.5, color: 'var(--muted)' }}>Calculé selon la grille</p>}
            {depassement(typeFrais, montant, student) > 0 && (
              <p style={{ margin: '-8px 0 10px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)' }}>Ce montant dépasse de {fmtF(depassement(typeFrais, montant, student))} ce qui reste dû.</p>
            )}
          </div>
          <div>
            <label style={labelStyle}>Mode</label>
            <Dropdown value={mode} onChange={setMode} options={MODES.map((m) => ({ value: m.id, label: m.label }))} style={inputStyle} />
          </div>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Date</label>
            <DatePicker value={date} onChange={setDate} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Note</label>
            <AmountAwareTextarea value={note} onChange={setNote} multiline={false} style={inputStyle} />
          </div>
        </div>

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
          <button type="submit" disabled={!canSubmit} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </ModalContainer>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
