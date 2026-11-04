import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { generateAccessCode, displayName, fmtF, MODES, NATIONALITES } from '../lib/utils.js';
import PhotoPicker from './PhotoPicker.jsx';
import MoneyInput from './MoneyInput.jsx';
import PhoneInput, { COUNTRIES, composePhone, decomposePhone } from './PhoneInput.jsx'; // Ajout de decomposePhone
import NameInput from './NameInput.jsx';
import { useToast } from './Toast.jsx';
import Dropdown from './Dropdown.jsx';
import DatePicker from './DatePicker.jsx';
import { SkeletonLine } from './Skeleton.jsx';
import HelpTooltip from './HelpTooltip.jsx';

const PAIEMENT_TRANCHES = [
  { id: 'tranche1', label: '1ère tranche' },
  { id: 'tranche2', label: '2ème tranche' },
  { id: 'tranche3', label: '3ème tranche' },
  { id: 'complet', label: 'Complet' },
  { id: 'autre', label: 'Autre' },
];

const LIENS_PARENTE = [
  { id: 'pere', label: 'Père' },
  { id: 'mere', label: 'Mère' },
  { id: 'tuteur', label: 'Tuteur' },
  { id: 'autre', label: 'Autre' },
];

export default function NewStudentModal({ schoolId, schoolYearId, classes, canManageParents, student = null, isHistorical = false, onClose, onCreated }) {
  const showToast = useToast();
  const isEditing = !!student;
  const canEditEnrollment = !isEditing || !isHistorical;
  
  // --- ÉTATS ÉLÈVE ---
  const [studentNom, setStudentNom] = useState(student?.nom || '');
  const [studentPrenom, setStudentPrenom] = useState(student?.prenom || '');
  const [matricule, setMatricule] = useState(student?.matricule || '');
  const [dateNaissance, setDateNaissance] = useState(student?.date_naissance || '');
  const [sexe, setSexe] = useState(student?.sexe || 'M');
  const [nationalite, setNationalite] = useState(student?.nationalite || 'Béninoise');
  const [adresse, setAdresse] = useState(student?.adresse || '');
  
  const [classeId, setClasseId] = useState(student?.classe_id || classes[0]?.id || '');
  const [typeInscription, setTypeInscription] = useState('nouveau');
  const [montantDu, setMontantDu] = useState(student?.montant_du ?? 0);
  const [montantDuTouched, setMontantDuTouched] = useState(!!student);
  const [feeSchedules, setFeeSchedules] = useState({});
  const [photoUrl, setPhotoUrl] = useState(student?.photo_url || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [paiementTranche, setPaiementTranche] = useState(PAIEMENT_TRANCHES[0].id);
  const [paiementMontant, setPaiementMontant] = useState(0);
  const [paiementMontantTouched, setPaiementMontantTouched] = useState(false);
  const [paiementMode, setPaiementMode] = useState(MODES[0].id);

  const selectedClasse = classes.find((c) => c.id === classeId);

  const fraisInscription = selectedClasse
    ? (typeInscription === 'reinscription'
        ? Number(feeSchedules[selectedClasse.niveau]?.montant_reinscription) || 0
        : Number(feeSchedules[selectedClasse.niveau]?.montant_inscription) || 0)
    : 0;

  const libelleFrais = typeInscription === 'reinscription' ? "Frais de réinscription" : "Frais d'inscription";

  // --- ÉTATS PARENTS (MODE ÉDITION) ---
  const [existingParents, setExistingParents] = useState([]); // Liste des parents déjà liés
  const [editingParentId, setEditingParentId] = useState(null); // Si on modifie un parent existant
  
  // Champs du parent en cours d'édition / création
  const [parentNom, setParentNom] = useState('');
  const [parentPrenom, setParentPrenom] = useState('');
  const [parentAccessDial, setParentAccessDial] = useState(COUNTRIES[0].dial);
  const [parentAccessLocal, setParentAccessLocal] = useState('');
  const [lienParente, setLienParente] = useState('pere');
  
  // Option pour ajouter un 2ème parent
  const [showAddParent, setShowAddParent] = useState(false);
  const [newParentNom, setNewParentNom] = useState('');
  const [newParentPrenom, setNewParentPrenom] = useState('');
  const [newParentDial, setNewParentDial] = useState(COUNTRIES[0].dial);
  const [newParentLocal, setNewParentLocal] = useState('');
  const [newLienParente, setNewLienParente] = useState('mere');

  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // --- CHARGEMENT DES PARENTS EN MODE ÉDITION ---
  useEffect(() => {
    if (isEditing && student?.id) {
      supabase.from('parent_access_students')
        .select('parent_access ( id, nom, prenom, phone, lien_parente )')
        .eq('student_id', student.id)
        .then(({ data }) => {
           const parents = (data || []).map(d => d.parent_access).filter(Boolean);
           setExistingParents(parents);
           if (parents.length > 0) {
              const p = parents[0];
              setEditingParentId(p.id);
              setParentNom(p.nom || '');
              setParentPrenom(p.prenom || '');
              const { dial, local } = decomposePhone(p.phone);
              setParentAccessDial(dial || COUNTRIES[0].dial);
              setParentAccessLocal(local || '');
              setLienParente(p.lien_parente || 'pere');
           }
        });
    }
  }, [isEditing, student?.id]);

  // Chargement des tarifs
  useEffect(() => {
    if (!schoolYearId) return;
    supabase.from('fee_schedules').select('niveau, montant_scolarite, montant_connexe, montant_inscription, montant_reinscription, montant_tranche1, montant_tranche2, montant_tranche3').eq('school_year_id', schoolYearId).then(({ data }) => {
      const map = {};
      (data || []).forEach((f) => { map[f.niveau] = f; });
      setFeeSchedules(map);
    });
  }, [schoolYearId]);

  useEffect(() => {
    if (montantDuTouched) return;
    const fee = selectedClasse ? feeSchedules[selectedClasse.niveau] : null;
    setMontantDu(fee ? fee.montant_scolarite : 0);
  }, [classeId, feeSchedules]);

  useEffect(() => {
    if (paiementMontantTouched) return;
    const fee = selectedClasse ? feeSchedules[selectedClasse.niveau] : null;
    if (paiementTranche === 'tranche1') setPaiementMontant(fee?.montant_tranche1 ?? 0);
    else if (paiementTranche === 'tranche2') setPaiementMontant(fee?.montant_tranche2 ?? 0);
    else if (paiementTranche === 'tranche3') setPaiementMontant(fee?.montant_tranche3 ?? 0);
    else if (paiementTranche === 'complet') setPaiementMontant(montantDu);
    else setPaiementMontant('');
  }, [paiementTranche, classeId, feeSchedules, montantDu]);

  function handleTrancheChange(value) {
    setPaiementTranche(value);
    setPaiementMontantTouched(false);
  }

  // --- SOUMISSION ---
  async function handleSubmit(e) {
    e.preventDefault();
    if (!studentNom.trim()) { setError('Le nom est obligatoire.'); return; }
    setSubmitting(true);
    setError('');

    let targetStudentId = student?.id || null;

    if (isEditing) {
      // 1. Mise à jour de l'élève
      const { error: studentError } = await supabase
        .from('students')
        .update({
          nom: studentNom.trim(),
          prenom: studentPrenom.trim(),
          full_name: displayName(studentNom.trim(), studentPrenom.trim()),
          matricule: matricule.trim() || null,
          date_naissance: dateNaissance || null,
          sexe,
          nationalite: nationalite || null,
          adresse: adresse.trim() || null,
          photo_url: photoUrl || null,
        })
        .eq('id', student.id)
        .eq('school_id', schoolId);
      
      if (studentError) { setSubmitting(false); setError(studentError.message); return; }

      // 2. Mise à jour de l'inscription
      if (canEditEnrollment) {
        const { error: enrollmentError } = await supabase
          .from('enrollments')
          .update({ classe_id: classeId || null, montant_du: Number(montantDu) || 0 })
          .eq('id', student.enrollment_id)
          .eq('school_year_id', schoolYearId);
        if (enrollmentError) { setSubmitting(false); setError(enrollmentError.message); return; }
      }

      // 3. Mise à jour du parent existant (si modifié)
      if (canManageParents && editingParentId) {
        const newPhone = composePhone(parentAccessDial, parentAccessLocal) || null;
        const { error: paError } = await supabase
          .from('parent_access')
          .update({
             nom: parentNom.trim(),
             prenom: parentPrenom.trim(),
             full_name: displayName(parentNom.trim(), parentPrenom.trim()),
             phone: newPhone,
             lien_parente: lienParente,
          })
          .eq('id', editingParentId);
        if (paError) { setSubmitting(false); setError(paError.message); return; }
      }

      // 4. Ajout d'un 2ème parent (si demandé et rempli)
      if (canManageParents && showAddParent && newParentNom.trim()) {
        let newParent = null;
        for (let attempt = 0; attempt < 5 && !newParent; attempt++) {
           const { data, error: paError } = await supabase.from('parent_access').insert({
             school_id: schoolId,
             nom: newParentNom.trim(),
             prenom: newParentPrenom.trim(),
             full_name: displayName(newParentNom.trim(), newParentPrenom.trim()),
             phone: composePhone(newParentDial, newParentLocal) || null,
             code: generateAccessCode(),
             lien_parente: newLienParente,
           }).select().single();
           if (!paError) { newParent = data; break; }
           if (paError.code !== '23505') { setSubmitting(false); setError(paError.message); return; }
        }
        if (!newParent) { setSubmitting(false); setError('Impossible de générer un code unique pour le 2ème parent.'); return; }

        const { error: linkError } = await supabase.from('parent_access_students').insert({
          parent_access_id: newParent.id, student_id: student.id,
        });
        if (linkError) { setSubmitting(false); setError(linkError.message); return; }
      }

      setSubmitting(false);
      showToast('Modifications enregistrées');
      onCreated();
      return;

    } else {
      // --- CRÉATION D'UN NOUVEL ÉLÈVE ---
      let studentParentPhone = null;
      if (canManageParents && parentNom.trim()) {
        studentParentPhone = composePhone(parentAccessDial, parentAccessLocal) || null;
      }

      const { data: newStudentId, error: rpcError } = await supabase.rpc('create_student_with_enrollment', {
        p_school_id: schoolId,
        p_nom: studentNom.trim(),
        p_prenom: studentPrenom.trim(),
        p_full_name: displayName(studentNom.trim(), studentPrenom.trim()),
        p_parent_phone: studentParentPhone,
        p_photo_url: photoUrl || null,
        p_matricule: matricule.trim() || null,
        p_school_year_id: schoolYearId,
        p_classe_id: classeId || null,
        p_montant_du: Number(montantDu) || 0,
        p_frais_connexe_du: Number(selectedClasse ? feeSchedules[selectedClasse.niveau]?.montant_connexe : 0) || 0,
        p_existing_parent_access_id: null,
        p_paiement_montant: Number(paiementMontant) || 0,
        p_paiement_tranche: paiementTranche,
        p_paiement_mode: paiementMode,
        p_frais_inscription_montant: fraisInscription,
        p_date_naissance: dateNaissance || null,
        p_solde_ecolage_anterieur: 0,
        p_solde_connexe_anterieur: 0,
        p_sexe: sexe,
        p_nationalite: nationalite || null,
        p_adresse: adresse.trim() || null,
        p_type_inscription: typeInscription,
      });
      
      if (rpcError) { setSubmitting(false); setError(rpcError.message); return; }
      targetStudentId = newStudentId;

      if (canManageParents && parentNom.trim()) {
        let created = null;
        for (let attempt = 0; attempt < 5 && !created; attempt++) {
          const { data, error: paError } = await supabase.from('parent_access').insert({
            school_id: schoolId,
            full_name: displayName(parentNom.trim(), parentPrenom.trim()),
            nom: parentNom.trim(),
            prenom: parentPrenom.trim(),
            phone: composePhone(parentAccessDial, parentAccessLocal) || null,
            code: generateAccessCode(),
            lien_parente: lienParente,
          }).select().single();
          if (!paError) { created = data; break; }
          if (paError.code !== '23505') { setSubmitting(false); setError(paError.message); return; }
        }
        if (!created) { setSubmitting(false); setError('Impossible de générer un code unique.'); return; }
        await supabase.from('parent_access_students').insert({ parent_access_id: created.id, student_id: targetStudentId });
        setResult({ code: created.code });
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
      showToast('Enregistré');
      onCreated();
    }
  }

  function copyLink() {
    const url = `${window.location.origin}/parent-access?code=${result.code}`;
    navigator.clipboard.writeText(url).then(() => setCopied(true));
  }

  if (classes.length === 0) {
     // (Code inchangé pour l'écran "Aucune classe")
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 420, width: '100%', padding: 26, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600 }}>Aucune classe créée</p>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>Il faut d'abord créer au moins une classe.</p>
          <Link to="/classes" onClick={onClose} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '11px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', textDecoration: 'none', marginBottom: 10 }}>Aller créer une classe</Link>
          <button type="button" onClick={onClose} style={{ width: '100%', padding: '11px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
        </div>
      </div>,
      document.body
    );
  }

  if (result) {
     // (Code inchangé pour l'écran "Résultat" avec le code)
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 420, width: '100%', padding: 26, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600 }}>Élève inscrit</p>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>Code d'accès du parent.</p>
          <p style={{ margin: '0 0 18px', fontFamily: 'monospace', fontSize: 24, fontWeight: 700, letterSpacing: '0.1em', background: 'var(--forest-light)', color: 'var(--forest-dark)', padding: '12px', borderRadius: 10 }}>{result.code}</p>
          <button type="button" onClick={copyLink} style={{ width: '100%', padding: '11px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px', marginBottom: 10 }}>{copied ? 'Lien copié !' : 'Copier le lien à envoyer'}</button>
          <button type="button" onClick={onCreated} style={{ width: '100%', padding: '11px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px' }}>Terminé</button>
        </div>
      </div>,
      document.body
    );
  }

  // Rendu principal
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 480, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 26 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>{isEditing ? 'Modifier les informations de l’élève' : "Inscription d'un élève"}</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {!isEditing && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {[{ id: 'nouveau', label: 'Nouvel élève' }, { id: 'reinscription', label: 'Réinscription' }].map((m) => (
              <button
                type="button" key={m.id} onClick={() => setTypeInscription(m.id)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${typeInscription === m.id ? 'var(--forest)' : 'var(--line-strong)'}`, background: typeInscription === m.id ? 'var(--forest)' : 'var(--paper)', color: typeInscription === m.id ? '#fff' : 'var(--ink)' }}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* --- CHAMPS ÉLÈVE --- */}
        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Nom</label>
            <NameInput mode="upper" value={studentNom} onChange={setStudentNom} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Prénom</label>
            <NameInput mode="title" value={studentPrenom} onChange={setStudentPrenom} style={inputStyle} />
          </div>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Matricule (facultatif)</label>
            <input value={matricule} onChange={(e) => setMatricule(e.target.value)} style={inputStyle} placeholder="Auto si vide" />
          </div>
          <div>
            <label style={labelStyle}>Sexe</label>
            <Dropdown value={sexe} onChange={setSexe} options={[{ value: 'M', label: 'Masculin' }, { value: 'F', label: 'Féminin' }]} style={inputStyle} />
          </div>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Date de naissance</label>
            <DatePicker value={dateNaissance} onChange={setDateNaissance} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Nationalité</label>
            <Dropdown value={nationalite} onChange={setNationalite} options={NATIONALITES} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Adresse (facultatif)</label>
          <input value={adresse} onChange={(e) => setAdresse(e.target.value)} style={inputStyle} placeholder="Ex: Cotonou, Akpakpa" />
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Classe</label>
            <Dropdown value={classeId} onChange={setClasseId} disabled={!canEditEnrollment} options={classes.map((c) => ({ value: c.id, label: c.nom }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Écolage dû</label>
            <MoneyInput value={montantDu} onChange={(v) => { setMontantDuTouched(true); setMontantDu(v); }} disabled={!canEditEnrollment} style={{ ...inputStyle, opacity: canEditEnrollment ? 1 : 0.6 }} suffix="F CFA" />
          </div>
        </div>

        {!isEditing && (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18, marginBottom: 18 }}>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>Paiement à l'inscription</p>
          <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: paiementMontant > 0 ? 12 : 0 }}>
            <div>
              <label style={labelStyle}>Pour</label>
              <Dropdown value={paiementTranche} onChange={handleTrancheChange} options={PAIEMENT_TRANCHES.map((t) => ({ value: t.id, label: t.label }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Montant versé</label>
              <MoneyInput value={paiementMontant} onChange={(v) => { setPaiementMontantTouched(true); setPaiementMontant(v); }} style={inputStyle} suffix="F CFA" />
            </div>
          </div>
        </div>
        )}

        <label style={labelStyle}>Photo (facultatif)</label>
        <div style={{ marginBottom: 18 }}>
          <PhotoPicker schoolId={schoolId} value={photoUrl} onChange={setPhotoUrl} />
        </div>

        {/* --- BLOC PARENT --- */}
        {canManageParents && (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18, marginBottom: 4 }}>
            <p style={{ margin: '0 0 12px', fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>
              {isEditing ? 'Parent existant' : 'Parent'}
            </p>

            {/* En édition, on affiche les champs du parent existant */}
            {isEditing && editingParentId && (
               <>
                <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Nom du parent</label>
                    <NameInput mode="upper" value={parentNom} onChange={setParentNom} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Prénom du parent</label>
                    <NameInput mode="title" value={parentPrenom} onChange={setParentPrenom} style={inputStyle} />
                  </div>
                </div>
                <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Lien de parenté</label>
                    <Dropdown value={lienParente} onChange={setLienParente} options={LIENS_PARENTE.map(l => ({ value: l.id, label: l.label }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Téléphone du parent</label>
                    <PhoneInput dial={parentAccessDial} local={parentAccessLocal} onDialChange={setParentAccessDial} onLocalChange={setParentAccessLocal} style={{ marginBottom: 0 }} />
                  </div>
                </div>

                {/* Option Ajouter un autre parent */}
                {!showAddParent && (
                  <button type="button" onClick={() => setShowAddParent(true)} style={{ background: 'none', border: 'none', color: 'var(--forest)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', padding: 0, marginTop: 4 }}>
                    + Ajouter un deuxième parent
                  </button>
                )}
               </>
            )}

            {/* En création, ou si on clique sur "Ajouter un 2ème parent", on affiche les champs vides */}
            {(!isEditing || showAddParent) && (
               <>
                {showAddParent && <p style={{ margin: '16px 0 12px', fontSize: 13, fontWeight: 600 }}>Nouveau parent</p>}
                
                <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Nom du parent</label>
                    <NameInput mode="upper" value={showAddParent ? newParentNom : parentNom} onChange={showAddParent ? setNewParentNom : setParentNom} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Prénom du parent</label>
                    <NameInput mode="title" value={showAddParent ? newParentPrenom : parentPrenom} onChange={showAddParent ? setNewParentPrenom : setParentPrenom} style={inputStyle} />
                  </div>
                </div>
                <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Lien de parenté</label>
                    <Dropdown value={showAddParent ? newLienParente : lienParente} onChange={showAddParent ? setNewLienParente : setLienParente} options={LIENS_PARENTE.map(l => ({ value: l.id, label: l.label }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Téléphone du parent</label>
                    <PhoneInput dial={showAddParent ? newParentDial : parentAccessDial} local={showAddParent ? newParentLocal : parentAccessLocal} onDialChange={showAddParent ? setNewParentDial : setParentAccessDial} onLocalChange={showAddParent ? setNewParentLocal : setParentAccessLocal} style={{ marginBottom: 0 }} />
                  </div>
                </div>
               </>
            )}

            {!isEditing && <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>Laisser le nom vide pour ne pas créer d'accès maintenant.</p>}
          </div>
        )}

        {error && <p style={{ margin: '14px 0', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
          <button type="submit" disabled={submitting} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enregistrement…' : (isEditing ? 'Enregistrer les modifications' : 'Inscrire')}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const labelStyle = { display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
