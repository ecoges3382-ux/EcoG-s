import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fmtF, initials, trancheLabel, sortClasses } from '../lib/utils.js';
import { useSelectedSchoolYear } from '../lib/schoolYear.jsx';
import { computeRelance, computeEcheances, resumeMoratoire } from '../lib/retard.js';
import { sendWhatsAppMessage } from '../lib/whatsapp.js';
import AmountAwareTextarea from '../components/AmountAwareTextarea.jsx';
import HistoricalYearBanner from '../components/HistoricalYearBanner.jsx';
import PaymentReceipt from '../components/PaymentReceipt.jsx';
import FinancialStatement from '../components/FinancialStatement.jsx';
import QuickPaymentModal from '../components/QuickPaymentModal.jsx';
import NewStudentModal from '../components/NewStudentModal.jsx'; // 🔥 NOUVEL IMPORT
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import { SkeletonRow } from '../components/Skeleton.jsx';
import { guardedFetch } from '../lib/offlineCache.js';
import { translateError } from '../lib/errors.js';
import Dropdown from '../components/Dropdown.jsx';
import DatePicker from '../components/DatePicker.jsx';
import MoneyInput from '../components/MoneyInput.jsx';

const CAN_DELETE_ROLES = ['fondateur', 'directeur', 'secretaire'];
const CAN_SEND_WHATSAPP_ROLES = ['fondateur', 'directeur', 'secretaire'];
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
  const [attendance, setAttendance] = useState(undefined);
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
  
  // 🔥 NOUVEAUX ETATS POUR L'EDITION
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [allClasses, setAllClasses] = useState([]);

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
    supabase
      .from('parent_access_students')
      .select('parent_access ( id, full_name, phone )')
      .eq('student_id', id)
      .then(({ data }) => {
        if (!cancelled) setParents((data || []).map((row) => row.parent_access).filter(Boolean));
      });
    return () => { cancelled = true; };
  }, [id]);

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
    
    supabase.from('fee_schedules').select('*').eq('school_year_id', schoolYear.id).then(({ data }) => {
      if (!cancelled) setFeeSchedules(data || []);
    });

    // 🔥 CHARGEMENT DES CLASSES POUR LA MODALE D'EDITION
    supabase.from('classes').select('id, nom, niveau, section').then(({ data }) => {
      if (!cancelled) setAllClasses(sortClasses(data || []));
    });

    supabase
      .from('payments')
      .select('id, montant, type_frais, mode, tranche, date, note')
      .eq('student_id', id)
      .eq('school_year_id', schoolYear.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (!cancelled) setPayments(data || []); });
    supabase
      .from('attendance_records')
      .select('date, statut')
      .eq('student_id', id)
      .eq('school_year_id', schoolYear.id)
      .order('date', { ascending: false })
      .then(({ data }) => { if (!cancelled) setAttendance(data || []); });
    return () => { cancelled = true; };
  }, [id, schoolYear?.id]);

  useEffect(() => {
    if (!enrollment?.id) { setMoratoireHistory([]); return; }
    let cancelled = false;
    supabase
      .from('moratoire_history')
      .select('id, action, ancien_resume, nouveau_resume, auteur, created_at')
      .eq('enrollment_id', enrollment.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (!cancelled) setMoratoireHistory(data || []); });
    return () => { cancelled = true; };
  }, [enrollment?.id]);

  useEffect(() => {
    if (!enrollment || !schoolYear) return;
    const relance = computeRelance(enrollment, schoolYear, null);
    if (relance?.moratoireRetireAuto) {
      (async () => {
        const ancienResume = resumeMoratoire(enrollment);
        await supabase.from('enrollments').update({
          moratoire_actif: false,
          note_arrangement: null,
        }).eq('id', enrollment.id);
        await supabase.from('moratoire_history').insert({
          enrollment_id: enrollment.id,
          school_id: profile.school_id,
          action: 'retrait_auto',
          ancien_resume: ancienResume,
          nouveau_resume: 'Retrait automatique — tout est soldé',
          auteur: 'Système',
        });
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

    await supabase.from('moratoire_history').insert({
      enrollment_id: enrollment.id,
      school_id: profile.school_id,
      action: dataMoratoire.actif ? action : 'retrait_manuel',
      ancien_resume: ancienResume,
      nouveau_resume: nouveauResume,
      auteur: profile.full_name || profile.role,
    });

    setEnrollment(nouvelEnrollment);
    const { data: hist } = await supabase
      .from('moratoire_history')
      .select('id, action, ancien_resume, nouveau_resume, auteur, created_at')
      .eq('enrollment_id', enrollment.id)
      .order('created_at', { ascending: false });
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
      setWhatsappResult(ok ? { ok: true, text: 'Relance WhatsApp envoyée.' } : { ok: false, text: fail?.erreur || "Échec de l'envoi." });
    } catch (err) {
      setWhatsappResult({ ok: false, text: err.message });
    }
    setWhatsappSending(false);
  }

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!student || enrollment === undefined) return <div className="card-bold"><SkeletonRow count={3} /></div>;

  const reste = Number(enrollment?.montant_du || 0) - Number(enrollment?.montant_paye || 0);
  const resteFrais = Number(enrollment?.frais_connexe_du || 0) - Number(enrollment?.frais_connexe_paye || 0);
  const relance = enrollment ? computeRelance(enrollment, schoolYear, null) : null;
  const echeances = enrollment ? computeEcheances(enrollment, schoolYear, null) : [];

  const nbAbsences = (attendance || []).filter((a) => a.statut === 'absent').length;
  const nbRetards = (attendance || []).filter((a) => a.statut === 'retard').length;
  const nbPresent = (attendance || []).filter((a) => a.statut === 'present').length;
  const totalAppels = (attendance || []).length;
  const tauxPresence = totalAppels > 0 ? Math.round(((nbPresent + nbRetards) / totalAppels) * 100) : null;
  const absencesEtRetards = (attendance || []).filter((a) => a.statut !== 'present').slice(0, 10);

  async function handleDelete() {
    if (!(await confirm(`Supprimer définitivement ${student.full_name} ? Ses paiements, notes et présences seront aussi supprimés. Attention, tu ne pourras pas revenir en arrière.`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('students').delete().eq('id', id);
    setDeleting(false);
    if (deleteError) { setError(translateError(deleteError)); return; }
    navigate('/eleves');
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <Link to="/eleves" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--forest)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
          <i className="ti ti-arrow-left" style={{ fontSize: 15 }} aria-hidden="true"></i>Retour aux élèves
        </Link>
        
        {enrollment && !isHistorical && (
          <div style={{ display: 'flex', gap: 10 }}>
            {/* 🔥 NOUVEAU BOUTON MODIFIER */}
            <button 
              onClick={() => setEditModalOpen(true)} 
              style={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--line-strong)', fontWeight: 600, fontSize: 13, padding: '9px 18px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <i className="ti ti-pencil" style={{ fontSize: 15 }} aria-hidden="true"></i>
              Modifier
            </button>
            <button 
              onClick={() => setQuickPayOpen(true)} 
              style={{ background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, padding: '9px 18px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <i className="ti ti-cash" style={{ fontSize: 15 }} aria-hidden="true"></i>
              Encaisser un paiement
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
            {relance?.moratoire && (
              <span style={{ background: '#F0EDE5', color: 'var(--muted)', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 }}>Moratoire</span>
            )}
            {relance?.moratoireExpirant && (
              <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 }}>
                Moratoire — {relance.joursRestantsMoratoire}j restants
              </span>
            )}
            {relance?.relance && (
              <span style={{ background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 }}>À relancer</span>
            )}
          </div>
        </div>
      </div>

      {enrollment ? (
        <>
          <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 640, marginBottom: 20 }}>
            <div className="card-bold" style={{ padding: '18px 20px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Droit d'écolage</p>
              <Row label="Dû" value={fmtF(enrollment.montant_du)} />
              <Row label="Payé" value={fmtF(enrollment.montant_paye)} color="var(--success)" />
              <Row label="Reste" value={fmtF(reste)} bold color="var(--danger)" topBorder />
            </div>
            <div className="card-bold" style={{ padding: '18px 20px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Frais connexes</p>
              <Row label="Dû" value={fmtF(enrollment.frais_connexe_du)} />
              <Row label="Payé" value={fmtF(enrollment.frais_connexe_paye)} color="var(--success)" />
              <Row label="Reste" value={fmtF(resteFrais)} bold color={resteFrais > 0 ? 'var(--danger)' : 'var(--success)'} topBorder />
            </div>
          </div>

          {echeances.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Échéancier — {schoolYear.label}</p>
              <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 640 }}>
                {echeances.map((ec, i) => (
                  <div key={ec.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < echeances.length - 1 ? '1px solid var(--line)' : 'none', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>{ec.label}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>
                        {fmtF(ec.montant)}{ec.dateLimite ? ` · avant le ${new Date(ec.dateLimite).toLocaleDateString('fr-FR')}` : ''}
                        {ec.enRetard ? ' · en retard' : ''}
                      </p>
                    </div>
                    <EcheanceBadge statut={ec.statut} montantPaye={ec.montantPaye} montantRestant={ec.montantRestant} />
                  </div>
                ))}
              </div>
              {!isHistorical && CAN_SEND_WHATSAPP_ROLES.includes(profile.role) && echeances.some((e) => e.enRetard) && (
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={sendRelance}
                    disabled={whatsappSending}
                    style={{ fontSize: 12.5, fontWeight: 600, padding: '9px 16px', borderRadius: 9, border: 'none', background: '#25D366', color: '#fff', opacity: whatsappSending ? 0.7 : 1, cursor: whatsappSending ? 'default' : 'pointer' }}
                  >
                    <i className="ti ti-brand-whatsapp" style={{ fontSize: 15, verticalAlign: '-3px', marginRight: 6 }} aria-hidden="true"></i>
                    {whatsappSending ? 'Envoi…' : 'Envoyer une relance WhatsApp'}
                  </button>
                  {whatsappResult && (
                    <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 600, color: whatsappResult.ok ? 'var(--success)' : 'var(--danger)' }}>{whatsappResult.text}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowStatement(true)}
            style={{ marginBottom: 20, fontSize: 12.5, fontWeight: 600, padding: '9px 16px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}
          >
            <i className="ti ti-file-invoice" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>
            Imprimer la situation financière
          </button>
        </>
      ) : (
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted)' }}>
          Pas d'inscription pour {isHistorical ? 'cette année scolaire' : "l'année scolaire en cours"}{schoolYear ? ` (${schoolYear.label})` : ''}.
        </p>
      )}

      {enrollment && (
        <MoratoireSection
          enrollment={enrollment}
          history={moratoireHistory}
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
                  <button
                    type="button"
                    onClick={() => setReceiptPayment(p)}
                    title="Imprimer le reçu"
                    style={{ background: 'none', border: 'none', color: 'var(--forest)', cursor: 'pointer', padding: 4, display: 'flex' }}
                  >
                    <i className="ti ti-receipt" style={{ fontSize: 17 }} aria-hidden="true"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {schoolYear && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
            Assiduité — {schoolYear.label}
          </p>
          {attendance === undefined ? (
            <SkeletonRow count={2} avatar={false} />
          ) : totalAppels === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucun appel enregistré pour cet élève cette année.</p>
          ) : (
            <>
              <div className="desktop-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14, maxWidth: 640 }}>
                <MiniStat label="Absences" value={nbAbsences} color="var(--danger)" />
                <MiniStat label="Retards" value={nbRetards} color="var(--amber)" />
                <MiniStat label="Taux de présence" value={`${tauxPresence}%`} color="var(--success)" />
              </div>
              {absencesEtRetards.length > 0 && (
                <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 640 }}>
                  {absencesEtRetards.map((a, i) => (
                    <div key={`${a.date}-${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: i < absencesEtRetards.length - 1 ? '1px solid var(--line)' : 'none' }}>
                      <span style={{ fontSize: 13 }}>{new Date(a.date).toLocaleDateString('fr-FR')}</span>
                      <span style={{ fontSize: '11.5px', fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: a.statut === 'absent' ? 'var(--danger-light)' : 'var(--amber-light)', color: a.statut === 'absent' ? 'var(--danger)' : 'var(--amber)' }}>
                        {a.statut === 'absent' ? 'Absent' : 'Retard'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 🔥 AJOUT DU LIEN POUR GERER LES PARENTS */}
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
          <Link
            key={p.id}
            to={`/parents/${p.id}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: i < parents.length - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{p.full_name}</p>
            <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>{p.phone || 'Pas de numéro'}</span>
          </Link>
        ))}
      </div>

      {CAN_DELETE_ROLES.includes(profile.role) && (
        isHistorical ? (
          <p style={{ marginTop: 24, fontSize: 12, color: 'var(--muted)' }}>
            Suppression désactivée en consultation d'un historique — reviens à l'année en cours pour supprimer cet élève.
          </p>
        ) : (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{ marginTop: 24, padding: '10px 18px', borderRadius: 9, border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}
          >
            {deleting ? 'Suppression…' : "Supprimer l'élève"}
          </button>
        )
      )}

      {receiptPayment && (
        <PaymentReceipt
          payment={receiptPayment}
          studentName={student.full_name}
          classeNom={enrollment?.classes?.nom}
          schoolYearLabel={schoolYear?.label}
          school={profile.schools}
          montantDu={enrollment?.montant_du}
          montantPaye={enrollment?.montant_paye}
          onClose={() => setReceiptPayment(null)}
        />
      )}

      {showStatement && enrollment && (
        <FinancialStatement
          studentName={student.full_name}
          classeNom={enrollment.classes?.nom}
          schoolYearLabel={schoolYear?.label}
          montantDu={Number(enrollment.montant_du || 0)}
          montantPaye={Number(enrollment.montant_paye || 0)}
          resteFrais={resteFrais}
          echeances={echeances}
          payments={payments}
          school={profile.schools}
          onClose={() => setShowStatement(false)}
        />
      )}

      {quickPayOpen && (
        <QuickPaymentModal
          student={{ 
            id: student.id, 
            full_name: student.full_name, 
            niveau: enrollment?.classes?.nom || '—',
            classeNiveau: enrollment?.classes?.niveau,
            school_year_id: schoolYear?.id,
            montant_du: enrollment?.montant_du || 0,
            montant_paye: enrollment?.montant_paye || 0,
            frais_connexe_du: enrollment?.frais_connexe_du || 0,
            frais_connexe_paye: enrollment?.frais_connexe_paye || 0
          }}
          feeSchedules={feeSchedules}
          onClose={() => setQuickPayOpen(false)}
          onSaved={() => { 
            setQuickPayOpen(false); 
            window.location.reload();
          }}
        />
      )}

      {/* 🔥 AFFICHAGE DE LA MODALE D'EDITION */}
      {editModalOpen && enrollment && (
        <NewStudentModal
          schoolId={profile.school_id}
          schoolYearId={schoolYear.id}
          classes={allClasses}
          canManageParents={['fondateur', 'directeur', 'secretaire'].includes(profile.role)}
          student={{
            id: student.id,
            enrollment_id: enrollment.id,
            nom: student.nom,
            prenom: student.prenom,
            matricule: student.matricule,
            sexe: student.sexe,
            date_naissance: student.date_naissance,
            nationalite: student.nationalite,
            adresse: student.adresse,
            photo_url: student.photo_url,
            classe_id: enrollment.classe_id,
            montant_du: enrollment.montant_du
          }}
          isHistorical={isHistorical}
          onClose={() => setEditModalOpen(false)}
          onCreated={() => { setEditModalOpen(false); window.location.reload(); }}
        />
      )}
    </div>
  );
}

function Row({ label, value, color, bold, topBorder }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: bold ? 14 : '13.5px', marginBottom: bold ? 0 : 8, paddingTop: topBorder ? 8 : 0, borderTop: topBorder ? '1px solid var(--line)' : 'none' }}>
      <span style={{ color: bold ? undefined : 'var(--muted)', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 600, color }}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="card-bold" style={{ padding: '14px 16px' }}>
      <p style={{ margin: '0 0 3px', fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

function EcheanceBadge({ statut, montantPaye, montantRestant }) {
  const map = {
    payee: { label: 'Payée', bg: 'var(--success-light)', fg: 'var(--success)' },
    partielle: { label: `Partielle · ${fmtF(montantPaye)}`, bg: 'var(--amber-light)', fg: 'var(--amber)' },
    impayee: { label: `Impayée · reste ${fmtF(montantRestant)}`, bg: 'var(--danger-light)', fg: 'var(--danger)' },
  };
  const s = map[statut] || map.impayee;
  return (
    <span style={{ background: s.bg, color: s.fg, fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

function MoratoireSection({ enrollment, history, canEdit, onSave }) {
  const estActif = !!(enrollment.moratoire_actif || (enrollment.note_arrangement && enrollment.note_arrangement.trim()));
  const [editing, setEditing] = useState(false);
  const [actif, setActif] = useState(estActif);
  const [motif, setMotif] = useState(enrollment.moratoire_motif || '');
  const [montantConvenu, setMontantConvenu] = useState(enrollment.moratoire_montant_convenu ?? '');
  const [nbMensualites, setNbMensualites] = useState(enrollment.moratoire_nb_mensualites ?? '');
  const [dateDebut, setDateDebut] = useState(enrollment.moratoire_date_debut || '');
  const [dateFin, setDateFin] = useState(enrollment.moratoire_date_fin || '');
  const [prochaineEcheance, setProchaineEcheance] = useState(enrollment.moratoire_prochaine_echeance || '');
  const [note, setNote] = useState(enrollment.note_arrangement || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({
      actif,
      motif,
      montantConvenu,
      nbMensualites,
      dateDebut,
      dateFin,
      prochaineEcheance,
      note,
    });
    setSaving(false);
    setEditing(false);
  }

  function handleCancel() {
    setActif(estActif);
    setMotif(enrollment.moratoire_motif || '');
    setMontantConvenu(enrollment.moratoire_montant_convenu ?? '');
    setNbMensualites(enrollment.moratoire_nb_mensualites ?? '');
    setDateDebut(enrollment.moratoire_date_debut || '');
    setDateFin(enrollment.moratoire_date_fin || '');
    setProchaineEcheance(enrollment.moratoire_prochaine_echeance || '');
    setNote(enrollment.note_arrangement || '');
    setEditing(false);
  }

  function handleOpenEdit() {
    setActif(estActif);
    setMotif(enrollment.moratoire_motif || '');
    setMontantConvenu(enrollment.moratoire_montant_convenu ?? '');
    setNbMensualites(enrollment.moratoire_nb_mensualites ?? '');
    setDateDebut(enrollment.moratoire_date_debut || '');
    setDateFin(enrollment.moratoire_date_fin || '');
    setProchaineEcheance(enrollment.moratoire_prochaine_echeance || '');
    setNote(enrollment.note_arrangement || '');
    setEditing(true);
  }

  if (!canEdit && !estActif) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
          Moratoire / Arrangement de paiement
        </p>
        {!editing && canEdit && (
          <button
            type="button"
            onClick={handleOpenEdit}
            style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}
          >
            {estActif ? 'Modifier le moratoire' : 'Créer un moratoire'}
          </button>
        )}
      </div>

      <div className="card-bold" style={{ padding: '16px 20px', maxWidth: 640 }}>
        {!editing ? (
          estActif ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ background: '#F0EDE5', color: 'var(--muted)', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>Moratoire actif</span>
                {enrollment.moratoire_date_fin && (
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>fin le {new Date(enrollment.moratoire_date_fin).toLocaleDateString('fr-FR')}</span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 12 }}>
                {enrollment.moratoire_motif && <InfoRow label="Motif" value={enrollment.moratoire_motif} />}
                {enrollment.moratoire_montant_convenu != null && <InfoRow label="Montant convenu" value={fmtF(enrollment.moratoire_montant_convenu)} />}
                {enrollment.moratoire_nb_mensualites != null && <InfoRow label="Mensualités" value={String(enrollment.moratoire_nb_mensualites)} />}
                {enrollment.moratoire_date_debut && <InfoRow label="Début" value={new Date(enrollment.moratoire_date_debut).toLocaleDateString('fr-FR')} />}
                {enrollment.moratoire_date_fin && <InfoRow label="Fin" value={new Date(enrollment.moratoire_date_fin).toLocaleDateString('fr-FR')} />}
                {enrollment.moratoire_prochaine_echeance && <InfoRow label="Prochaine échéance" value={new Date(enrollment.moratoire_prochaine_echeance).toLocaleDateString('fr-FR')} />}
              </div>
              {enrollment.note_arrangement && (
                <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>« {enrollment.note_arrangement} »</p>
              )}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
              Aucun moratoire. Les relances automatiques s'appliquent normalement.
            </p>
          )
        ) : (
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>
              <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
              Activer le moratoire pour cet élève
            </label>

            {actif && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Motif</label>
                  <input
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    placeholder="ex. Difficultés financières passagères, maladie, décès dans la famille…"
                    style={inputStyle}
                  />
                </div>

                <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Montant convenu</label>
                    <MoneyInput value={montantConvenu} onChange={setMontantConvenu} suffix="F CFA" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Nombre de mensualités</label>
                    <input
                      type="number"
                      min="1"
                      value={nbMensualites}
                      onChange={(e) => setNbMensualites(e.target.value)}
                      placeholder="ex. 5"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Date de début</label>
                    <DatePicker value={dateDebut} onChange={setDateDebut} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Date de fin</label>
                    <DatePicker value={dateFin} onChange={setDateFin} style={inputStyle} />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Prochaine échéance prévue</label>
                  <DatePicker value={prochaineEcheance} onChange={setProchaineEcheance} style={inputStyle} />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Note interne (facultatif)</label>
                  <AmountAwareTextarea
                    value={note}
                    onChange={setNote}
                    placeholder="Note visible uniquement par l'équipe administrative."
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13.5, boxSizing: 'border-box', color: 'var(--ink)', resize: 'vertical' }}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleCancel}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: 12.5, opacity: saving ? 0.7 : 1, cursor: saving ? 'default' : 'pointer' }}
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </div>

      {history && history.length > 0 && (
        <div style={{ marginTop: 16, maxWidth: 640 }}>
          <p style={{ margin: '0 0 8px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Historique du moratoire</p>
          <div className="card-bold" style={{ overflow: 'hidden' }}>
            {history.map((h, i) => (
              <div key={h.id} style={{ padding: '11px 16px', borderBottom: i < history.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: actionColor(h.action), textTransform: 'uppercase' }}>{actionLabel(h.action)}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(h.created_at).toLocaleDateString('fr-FR')} · {h.auteur || '—'}</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink)' }}>{h.nouveau_resume || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 13.5, fontWeight: 600 }}>{value}</p>
    </div>
  );
}

function actionLabel(action) {
  const map = {
    creation: 'Création',
    modification: 'Modification',
    retrait_auto: 'Retrait automatique',
    retrait_manuel: 'Retrait manuel',
  };
  return map[action] || action;
}

function actionColor(action) {
  if (action === 'creation') return 'var(--success)';
  if (action === 'modification') return 'var(--amber)';
  if (action === 'retrait_auto') return 'var(--muted)';
  if (action === 'retrait_manuel') return 'var(--danger)';
  return 'var(--muted)';
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)' };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
