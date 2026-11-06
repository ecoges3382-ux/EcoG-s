import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF, initials, trancheLabel, sortClasses } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import { computeRelance, computeEcheances, resumeMoratoire } from '../lib/retard.js';
import { sendWhatsAppMessage } from '../lib/whatsapp.js';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import PaymentReceipt from '../components/PaymentReceipt.jsx';
import FinancialStatement from '../components/FinancialStatement.jsx';
import QuickPaymentModal from '../components/QuickPaymentModal.jsx';
import NewStudentModal from '../components/NewStudentModal.jsx';
import AbsencesPanel from '../components/AbsencesPanel.jsx';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import { SkeletonRow } from '../components/Skeleton.jsx';
import { guardedFetch } from '../lib/offlineCache.js';
import { translateError } from '../lib/errors.js';

// Importation des composants isolés
import MoratoireSection from '../components/students/MoratoireSection.jsx';
import StudentFinancials from '../components/students/StudentFinancials.jsx';

const CAN_DELETE_ROLES = ['fondateur', 'directeur', 'secretaire'];
const CAN_MANAGE_MORATOIRE_ROLES = ['fondateur', 'directeur', 'censeur', 'secretaire'];

export default function StudentDetail() {
  const showToast = useToast();
  const confirm = useConfirm();
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { schoolYear, isHistorical } = useSelectedSchoolYear(profile.school_id);
  
  const [student, setStudent] = useState(null);
  const [enrollment, setEnrollment] = useState(undefined);
  const [feeSchedules, setFeeSchedules] = useState([]); 
  const [payments, setPayments] = useState(undefined);
  const [parents, setParents] = useState(null);
  const [moratoireHistory, setMoratoireHistory] = useState(undefined);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const [whatsappSending, setWhatsappSending] = useState(false);
  const [whatsappResult, setWhatsappResult] = useState(null);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [showStatement, setShowStatement] = useState(false);
  const [quickPayOpen, setQuickPayOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [allClasses, setAllClasses] = useState([]);

  // FETCH STUDENT & PARENTS
  useEffect(() => {
    let cancelled = false;
    guardedFetch({
      cacheKey: `student_${id}`,
      hasData: false,
      load: async () => {
        const { data, error: fetchError } = await supabase.from('students').select('*').eq('id', id).single();
        return fetchError ? { error: fetchError } : { data };
      },
      setData: setStudent,
      setOffline,
      onError: (err) => setError(translateError(err)),
      isCancelled: () => cancelled,
    });
    supabase.from('parent_access_students').select('parent_access ( id, full_name, phone )').eq('student_id', id).then(({ data }) => {
      if (!cancelled) setParents((data || []).map((row) => row.parent_access).filter(Boolean));
    });
    return () => { cancelled = true; };
  }, [id]);

  // FETCH ENROLLMENT, PAYMENTS, FEES, CLASSES
  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    setPayments(undefined);
    
    guardedFetch({
      cacheKey: `enrollment_${id}_${schoolYear.id}`,
      hasData: false,
      load: async () => {
        const { data, error: fetchError } = await supabase
          .from('enrollments')
          .select('id, classe_id, montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, note_arrangement, moratoire_actif, moratoire_montant_convenu, moratoire_nb_mensualites, moratoire_date_debut, moratoire_date_fin, moratoire_motif, moratoire_prochaine_echeance, classes ( nom, niveau )')
          .eq('student_id', id)
          .eq('school_year_id', schoolYear.id)
          .maybeSingle();
        return fetchError ? { error: fetchError } : { data: data || null };
      },
      setData: setEnrollment,
      setOffline,
      isCancelled: () => cancelled,
    });
    
    supabase.from('fee_schedules').select('*').eq('school_year_id', schoolYear.id).then(({ data }) => { if (!cancelled) setFeeSchedules(data || []); });
    supabase.from('classes').select('id, nom, niveau, section').then(({ data }) => { if (!cancelled) setAllClasses(sortClasses(data || [])); });
    supabase.from('payments').select('id, montant, type_frais, mode, tranche, date, note').eq('student_id', id).eq('school_year_id', schoolYear.id).order('date', { ascending: false }).order('created_at', { ascending: false }).then(({ data }) => { if (!cancelled) setPayments(data || []); });
    
    return () => { cancelled = true; };
  }, [id, schoolYear?.id]);

  // FETCH MORATOIRE HISTORY
  useEffect(() => {
    if (!enrollment?.id) { setMoratoireHistory([]); return; }
    let cancelled = false;
    supabase.from('moratoire_history').select('id, action, ancien_resume, nouveau_resume, auteur, created_at').eq('enrollment_id', enrollment.id).order('created_at', { ascending: false }).then(({ data }) => { if (!cancelled) setMoratoireHistory(data || []); });
    return () => { cancelled = true; };
  }, [enrollment?.id]);

  // AUTO-RETRAIT MORATOIRE SI TOUT PAYÉ
  useEffect(() => {
    if (!enrollment || !schoolYear) return;
    const relance = computeRelance(enrollment, schoolYear, null);
    if (relance?.moratoireRetireAuto) {
      (async () => {
        const ancienResume = resumeMoratoire(enrollment);
        await supabase.from('enrollments').update({ moratoire_actif: false, note_arrangement: null }).eq('id', enrollment.id);
        await supabase.from('moratoire_history').insert({ enrollment_id: enrollment.id, school_id: profile.school_id, action: 'retrait_auto', ancien_resume: ancienResume, nouveau_resume: 'Retrait automatique — tout est soldé', auteur: 'Système' });
        setEnrollment((prev) => ({ ...prev, moratoire_actif: false, note_arrangement: null }));
      })();
    }
  }, [enrollment?.id, enrollment?.montant_paye, enrollment?.frais_connexe_paye, schoolYear?.id]);

  async function saveMoratoire(dataMoratoire) {
    if (!enrollment) return;
    const ancienResume = resumeMoratoire(enrollment);
    const action = (enrollment.moratoire_actif || enrollment.note_arrangement) ? 'modification' : 'creation';

    const updatePayload = {
      moratoire_actif: dataMoratoire.actif,
      note_arrangement: dataMoratoire.actif ? (dataMoratoire.note || null) : null,
      moratoire_montant_convenu: dataMoratoire.actif ? (Number(dataMoratoire.montantConvenu) || null) : null,
      moratoire_nb_mensualites: dataMoratoire.actif ? (Number(dataMoratoire.nbMensualites) || null) : null,
      moratoire_date_debut: dataMoratoire.actif ? (dataMoratoire.dateDebut || null) : null,
      moratoire_date_fin: dataMoratoire.actif ? (dataMoratoire.dateFin || null) : null,
      moratoire_motif: dataMoratoire.actif ? (dataMoratoire.motif || null) : null,
      moratoire_prochaine_echeance: dataMoratoire.actif ? (dataMoratoire.prochaineEcheance || null) : null,
    };

    const { error: saveError } = await supabase.from('enrollments').update(updatePayload).eq('id', enrollment.id);
    if (saveError) { setError(translateError(saveError)); return; }

    const nouvelEnrollment = { ...enrollment, ...updatePayload };
    const nouveauResume = resumeMoratoire(nouvelEnrollment);

    await supabase.from('moratoire_history').insert({ enrollment_id: enrollment.id, school_id: profile.school_id, action: dataMoratoire.actif ? action : 'retrait_manuel', ancien_resume: ancienResume, nouveau_resume: nouveauResume, auteur: profile.full_name || profile.role });

    setEnrollment(nouvelEnrollment);
    const { data: hist } = await supabase.from('moratoire_history').select('*').eq('enrollment_id', enrollment.id).order('created_at', { ascending: false });
    setMoratoireHistory(hist || []);
    showToast('Moratoire enregistré');
  }

  async function sendRelance() {
    setWhatsappSending(true);
    setWhatsappResult(null);
    try {
      const data = await sendWhatsAppMessage({ type: 'relance_paiement', student_id: id });
      const ok = data.results?.some((r) => r.statut === 'envoye');
      const fail = data.results?.find((r) => r.statut === 'echec');
      if (ok) { showToast('Relance WhatsApp envoyée'); setWhatsappResult(null); }
      else { setWhatsappResult({ ok: false, text: fail?.erreur || "Échec de l'envoi." }); }
    } catch (err) {
      setWhatsappResult({ ok: false, text: err.message });
    }
    setWhatsappSending(false);
  }

  async function handleDelete() {
    if (!(await confirm(`Supprimer définitivement ${student.full_name} ? Ses paiements, notes et présences seront aussi supprimés. Attention, tu ne pourras pas revenir en arrière.`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('students').delete().eq('id', id);
    setDeleting(false);
    if (deleteError) { setError(translateError(deleteError)); return; }
    navigate('/eleves');
  }

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!student || enrollment === undefined) return <div className="card-bold"><SkeletonRow count={3} /></div>;

  const reste = Number(enrollment?.montant_du || 0) - Number(enrollment?.montant_paye || 0);
  const resteFrais = Number(enrollment?.frais_connexe_du || 0) - Number(enrollment?.frais_connexe_paye || 0);
  const relance = enrollment ? computeRelance(enrollment, schoolYear, null) : null;
  const echeances = enrollment ? computeEcheances(enrollment, schoolYear, null) : [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <Link to="/eleves" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--forest)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
          <i className="ti ti-arrow-left" style={{ fontSize: 15 }} aria-hidden="true"></i>Retour aux élèves
        </Link>
        
        {enrollment && !isHistorical && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setEditModalOpen(true)} style={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--line-strong)', fontWeight: 600, fontSize: 13, padding: '9px 18px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <i className="ti ti-pencil" style={{ fontSize: 15 }} aria-hidden="true"></i>Modifier
            </button>
            <button onClick={() => setQuickPayOpen(true)} style={{ background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, padding: '9px 18px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <i className="ti ti-cash" style={{ fontSize: 15 }} aria-hidden="true"></i>Encaisser un paiement
            </button>
          </div>
        )}
      </div>

      {isHistorical && <HistoricalYearBanner year={schoolYear} />}
      {offline && <OfflineBanner />}
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
        <div style={{ width: 58, height: 58, borderRadius: 14, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--clay-dark)', overflow: 'hidden' }}>
          {student.photo_url ? <img src={student.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(student.full_name)}
        </div>
        <div>
          <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 600, color: 'var(--ink)' }}>{student.full_name}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{enrollment?.classes?.nom || 'Aucune classe cette année'}</span>
            {relance?.moratoire && <span style={{ background: '#F0EDE5', color: 'var(--muted)', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 }}>Moratoire</span>}
            {relance?.moratoireExpirant && <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 }}>Moratoire — {relance.joursRestantsMoratoire}j restants</span>}
            {relance?.relance && <span style={{ background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 }}>À relancer</span>}
          </div>
        </div>
      </div>

      {enrollment ? (
        <StudentFinancials 
          enrollment={enrollment} reste={reste} resteFrais={resteFrais} echeances={echeances} 
          isHistorical={isHistorical} sendRelance={sendRelance} whatsappSending={whatsappSending} 
          whatsappResult={whatsappResult} setShowStatement={setShowStatement} 
        />
      ) : (
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted)' }}>
          Pas d'inscription pour {isHistorical ? 'cette année scolaire' : "l'année scolaire en cours"}{schoolYear ? ` (${schoolYear.label})` : ''}.
        </p>
      )}

      {enrollment && (
        <MoratoireSection 
          enrollment={enrollment} history={moratoireHistory} 
          canEdit={CAN_MANAGE_MORATOIRE_ROLES.includes(profile.role) && !isHistorical} 
          onSave={saveMoratoire} 
        />
      )}

      {schoolYear && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
            Historique des paiements — {schoolYear.label}
          </p>
          <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 640 }}>
            {payments === undefined && <SkeletonRow count={2} avatar={false} />}
            {payments?.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun paiement enregistré pour cette année.</p>}
            {payments?.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < payments.length - 1 ? '1px solid var(--line)' : 'none', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{fmtF(p.montant)}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>
                    {trancheLabel(p.tranche)} · {new Date(p.date).toLocaleDateString('fr-FR')}{p.note ? ` · ${p.note}` : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{p.mode}</span>
                  <button type="button" onClick={() => setReceiptPayment(p)} title="Imprimer le reçu" style={{ background: 'none', border: 'none', color: 'var(--forest)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                    <i className="ti ti-receipt" style={{ fontSize: 17 }} aria-hidden="true"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {schoolYear && (
        <AbsencesPanel 
          studentId={student.id} studentName={student.full_name} 
          classeNom={enrollment?.classes?.nom} studentMatricule={student.matricule} 
          dateNaissance={student.date_naissance} 
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Parent{parents?.length > 1 ? 's' : ''}</p>
        <Link to="/comptes" style={{ fontSize: 12, fontWeight: 600, color: 'var(--forest)', textDecoration: 'none' }}>
          + Gérer les parents
        </Link>
      </div>
      <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 640 }}>
        {parents === null && <SkeletonRow count={2} />}
        {parents?.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun parent relié pour l'instant.</p>}
        {parents?.map((p, i) => (
          <Link key={p.id} to={`/parents/${p.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: i < parents.length - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{p.full_name}</p>
            <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>{p.phone || 'Pas de numéro'}</span>
          </Link>
        ))}
      </div>

      {CAN_DELETE_ROLES.includes(profile.role) && (
        isHistorical ? (
          <p style={{ marginTop: 24, fontSize: 12, color: 'var(--muted)' }}>Suppression désactivée en consultation d'un historique — reviens à l'année en cours pour supprimer cet élève.</p>
        ) : (
          <button type="button" onClick={handleDelete} disabled={deleting} style={{ marginTop: 24, padding: '10px 18px', borderRadius: 9, border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}>
            {deleting ? 'Suppression…' : "Supprimer l'élève"}
          </button>
        )
      )}

      {receiptPayment && (
        <PaymentReceipt payment={receiptPayment} studentName={student.full_name} classeNom={enrollment?.classes?.nom} schoolYearLabel={schoolYear?.label} school={profile.schools} montantDu={enrollment?.montant_du} montantPaye={enrollment?.montant_paye} onClose={() => setReceiptPayment(null)} />
      )}

      {showStatement && enrollment && (
        <FinancialStatement studentName={student.full_name} classeNom={enrollment.classes?.nom} schoolYearLabel={schoolYear?.label} montantDu={Number(enrollment.montant_du || 0)} montantPaye={Number(enrollment.montant_paye || 0)} resteFrais={resteFrais} echeances={echeances} payments={payments} school={profile.schools} onClose={() => setShowStatement(false)} />
      )}

      {quickPayOpen && (
        <QuickPaymentModal 
          student={{ id: student.id, full_name: student.full_name, niveau: enrollment?.classes?.nom || '—', classeNiveau: enrollment?.classes?.niveau, school_year_id: schoolYear?.id, montant_du: enrollment?.montant_du || 0, montant_paye: enrollment?.montant_paye || 0, frais_connexe_du: enrollment?.frais_connexe_du || 0, frais_connexe_paye: enrollment?.frais_connexe_paye || 0 }} 
          feeSchedules={feeSchedules} onClose={() => setQuickPayOpen(false)} onSaved={() => { setQuickPayOpen(false); window.location.reload(); }} 
        />
      )}

      {editModalOpen && enrollment && (
        <NewStudentModal 
          schoolId={profile.school_id} schoolYearId={schoolYear.id} classes={allClasses} 
          canManageParents={['fondateur', 'directeur', 'secretaire'].includes(profile.role)} 
          student={{ id: student.id, enrollment_id: enrollment.id, nom: student.nom, prenom: student.prenom, matricule: student.matricule, sexe: student.sexe, date_naissance: student.date_naissance, nationalite: student.nationalite, adresse: student.adresse, photo_url: student.photo_url, classe_id: enrollment.classe_id, montant_du: enrollment.montant_du }} 
          isHistorical={isHistorical} onClose={() => setEditModalOpen(false)} onCreated={() => { setEditModalOpen(false); window.location.reload(); }} 
        />
      )}
    </div>
  );
}
