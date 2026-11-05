import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { generateAccessCode, displayName, fmtF, MODES, NATIONALITES } from '../lib/utils.js';
import PhotoPicker from './PhotoPicker.jsx';
import MoneyInput from './MoneyInput.jsx';
import PhoneInput, { COUNTRIES, composePhone, decomposePhone } from './PhoneInput.jsx';
import NameInput from './NameInput.jsx';
import { useToast } from './Toast.jsx';
import Dropdown from './Dropdown.jsx';
import DatePicker from './DatePicker.jsx';
import { SkeletonLine } from './Skeleton.jsx';
import HelpTooltip from './HelpTooltip.jsx';
import PaymentReceipt from './PaymentReceipt.jsx';

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

function ParentFields({
  label, nom, setNom, prenom, setPrenom,
  dial, setDial, local, setLocal,
  lien, setLien,
  useExisting, setUseExisting,
  selectedExistingId, setSelectedExistingId,
  search, setSearch,
  existingParents, studentNom,
  excludeIds = [], isEditing = false, onRemove,
}) {
  const filteredParents = useMemo(() => {
    if (!existingParents) return [];
    let filtered = existingParents;
    if (excludeIds.length > 0) filtered = filtered.filter((p) => !excludeIds.includes(p.id));
    const s = search.trim().toLowerCase();
    if (s) {
      filtered = filtered.filter((p) =>
        (p.full_name || '').toLowerCase().includes(s) ||
        (p.nom || '').toLowerCase().includes(s) ||
        (p.prenom || '').toLowerCase().includes(s)
      );
    } else {
      const nomEleve = studentNom.trim().toUpperCase();
      if (nomEleve) filtered = filtered.filter((p) => (p.nom || '').toUpperCase() === nomEleve);
    }
    return filtered;
  }, [existingParents, excludeIds, search, studentNom]);

  return (
    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px dashed var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--forest-dark)' }}>{label}</p>
        {onRemove && (
          <button type="button" onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Retirer</button>
        )}
      </div>

      {!useExisting ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <label style={{ ...labelStyle, marginBottom: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>Lien de parenté</label>
            <Dropdown value={lien} onChange={setLien} options={LIENS_PARENTE.map(l => ({ value: l.id, label: l.label }))} style={{ ...inputStyle, marginBottom: 0 }} wrapperStyle={{ flex: 1, minWidth: 0, width: 'auto' }} />
          </div>

          <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Nom du parent</label>
              <NameInput mode="upper" value={nom} onChange={setNom} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Prénom du parent</label>
              <NameInput mode="title" value={prenom} onChange={setPrenom} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Téléphone du parent</label>
            <PhoneInput dial={dial} local={local} onDialChange={setDial} onLocalChange={setLocal} style={{ marginBottom: 0 }} />
          </div>
        </>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
            {search.trim() ? 'Résultats de recherche :' : studentNom.trim() ? `Parents portant le nom « ${studentNom.trim()} » :` : 'Tous les parents enregistrés :'}
          </p>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tapez un nom pour rechercher…" style={{ ...inputStyle, marginBottom: 8 }} />
          {existingParents === null && <SkeletonLine width="70%" />}
          {existingParents?.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0' }}>Aucun parent enregistré dans cette école.</p>}
          {existingParents?.length > 0 && filteredParents.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0', padding: '10px 12px', background: 'var(--line)', borderRadius: 8 }}>
              {search.trim() ? 'Aucun parent ne correspond à cette recherche.' : studentNom.trim() ? `Aucun parent avec le nom « ${studentNom.trim()} ». Tape dans la recherche pour en trouver un autre.` : 'Aucun résultat.'}
            </p>
          )}
          {filteredParents.length > 0 && (
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--line-strong)', borderRadius: 9 }}>
              {filteredParents.map((p, i) => (
                <button type="button" key={p.id} onClick={() => setSelectedExistingId(p.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', borderBottom: i < filteredParents.length - 1 ? '1px solid var(--line)' : 'none', cursor: 'pointer', fontSize: 13.5, background: selectedExistingId === p.id ? 'var(--forest-light)' : 'transparent', color: selectedExistingId === p.id ? 'var(--forest-dark)' : 'var(--ink)', fontWeight: selectedExistingId === p.id ? 600 : 400 }}>
                  {p.full_name}
                  {p.phone && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {p.phone}</span>}
                  {p.code && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {p.code}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ background: 'var(--line)', padding: 10, borderRadius: 8 }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, lineHeight: 1.5 }}>
          <input type="checkbox" checked={useExisting} onChange={(e) => { setUseExisting(e.target.checked); if (!e.target.checked) { setSelectedExistingId(null); setSearch(''); } }} style={{ marginTop: 2 }} />
          <span>
            {isEditing && !onRemove ? "Remplacer par un autre parent déjà enregistré" : "Utiliser un parent déjà enregistré"}
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
              {isEditing && !onRemove ? "L'ancien lien sera retiré, le nouveau créé." : "Évite de ressaisir les infos. Le parent comptera tous ses enfants dans l'école."}
            </span>
          </span>
        </label>
      </div>

      {useExisting && !selectedExistingId && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>Choisis un parent dans la liste ci-dessus.</p>}
      {!isEditing && !useExisting && !onRemove && <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>Laisser le nom vide pour ne pas créer d'accès maintenant.</p>}
    </div>
  );
}

export default function NewStudentModal({ schoolId, schoolYearId, classes, canManageParents, student = null, isHistorical = false, onClose, onCreated }) {
  const showToast = useToast();
  const { profile } = useAuth();
  const isEditing = !!student;
  const canEditEnrollment = !isEditing || !isHistorical;

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

  const [parentNom, setParentNom] = useState('');
  const [parentPrenom, setParentPrenom] = useState('');
  const [parentAccessDial, setParentAccessDial] = useState(COUNTRIES[0].dial);
  const [parentAccessLocal, setParentAccessLocal] = useState('');
  const [lienParente, setLienParente] = useState('pere');
  const [useExistingParent, setUseExistingParent] = useState(false);
  const [selectedExistingParentId, setSelectedExistingParentId] = useState(null);
  const [parentSearch, setParentSearch] = useState('');

  const [hasSecondParent, setHasSecondParent] = useState(false);
  const [parent2Nom, setParent2Nom] = useState('');
  const [parent2Prenom, setParent2Prenom] = useState('');
  const [parent2Dial, setParent2Dial] = useState(COUNTRIES[0].dial);
  const [parent2Local, setParent2Local] = useState('');
  const [parent2Lien, setParent2Lien] = useState('mere');
  const [useExistingParent2, setUseExistingParent2] = useState(false);
  const [selectedExistingParentId2, setSelectedExistingParentId2] = useState(null);
  const [parent2Search, setParent2Search] = useState('');

  const [editingParentId, setEditingParentId] = useState(null);
  const [editingParent2Id, setEditingParent2Id] = useState(null);
  const [parentLoaded, setParentLoaded] = useState(!isEditing);

  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // 🔥 Nouveaux states pour l'auto-print
  const [createdPayment, setCreatedPayment] = useState(null);
  const [schoolYearInfo, setSchoolYearInfo] = useState(null);

  const selectedClasse = classes.find((c) => c.id === classeId);

  const fraisInscription = selectedClasse
    ? (typeInscription === 'reinscription'
        ? Number(feeSchedules[selectedClasse.niveau]?.montant_reinscription) || 0
        : Number(feeSchedules[selectedClasse.niveau]?.montant_inscription) || 0)
    : 0;

  const libelleFrais = typeInscription === 'reinscription' ? "Frais de réinscription" : "Frais d'inscription";

  // 🔥 Charge l'année scolaire (une seule fois)
  useEffect(() => {
    if (!schoolYearId) return;
    supabase.from('school_years')
      .select('id, label, date_tranche1, date_tranche2, date_tranche3, date_connexe')
      .eq('id', schoolYearId)
      .maybeSingle()
      .then(({ data }) => setSchoolYearInfo(data));
  }, [schoolYearId]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeId, feeSchedules]);

  useEffect(() => {
    if (paiementMontantTouched) return;
    const fee = selectedClasse ? feeSchedules[selectedClasse.niveau] : null;
    if (paiementTranche === 'tranche1') setPaiementMontant(fee?.montant_tranche1 ?? 0);
    else if (paiementTranche === 'tranche2') setPaiementMontant(fee?.montant_tranche2 ?? 0);
    else if (paiementTranche === 'tranche3') setPaiementMontant(fee?.montant_tranche3 ?? 0);
    else if (paiementTranche === 'complet') setPaiementMontant(montantDu);
    else setPaiementMontant('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paiementTranche, classeId, feeSchedules, montantDu]);

  function handleTrancheChange(value) {
    setPaiementTranche(value);
    setPaiementMontantTouched(false);
  }

  useEffect(() => {
    if (!isEditing || !student?.id) return;
    let cancelled = false;
    supabase.from('parent_access_students')
      .select('parent_access ( id, nom, prenom, full_name, phone, lien_parente )')
      .eq('student_id', student.id)
      .then(({ data }) => {
        if (cancelled) return;
        const parents = (data || []).map((d) => d.parent_access).filter(Boolean);
        if (parents.length >= 1) {
          const p = parents[0];
          setEditingParentId(p.id);
          setParentNom(p.nom || '');
          setParentPrenom(p.prenom || '');
          const { dial, local } = decomposePhone(p.phone);
          setParentAccessDial(dial || COUNTRIES[0].dial);
          setParentAccessLocal(local || '');
          setLienParente(p.lien_parente || 'pere');
        }
        if (parents.length >= 2) {
          const p2 = parents[1];
          setHasSecondParent(true);
          setEditingParent2Id(p2.id);
          setParent2Nom(p2.nom || '');
          setParent2Prenom(p2.prenom || '');
          const { dial, local } = decomposePhone(p2.phone);
          setParent2Dial(dial || COUNTRIES[0].dial);
          setParent2Local(local || '');
          setParent2Lien(p2.lien_parente || 'mere');
        }
        setParentLoaded(true);
      });
    return () => { cancelled = true; };
  }, [isEditing, student?.id]);

  const [existingParents, setExistingParents] = useState(null);

  useEffect(() => {
    if (!canManageParents) return;
    supabase.from('parent_access').select('id, nom, prenom, full_name, phone, code').order('nom').then(({ data }) => {
      setExistingParents(data || []);
    });
  }, [canManageParents]);

  const parent2ExcludeIds = useMemo(() => {
    const ids = [];
    if (editingParentId) ids.push(editingParentId);
    if (selectedExistingParentId) ids.push(selectedExistingParentId);
    if (editingParent2Id) ids.push(editingParent2Id);
    return ids.filter((id, i, arr) => arr.indexOf(id) === i);
  }, [editingParentId, selectedExistingParentId, editingParent2Id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!studentNom.trim()) { setError('Le nom est obligatoire.'); return; }
    setSubmitting(true);
    setError('');

    let targetStudentId = student?.id || null;

    // ===== MODE MODIFICATION =====
    if (isEditing) {
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

      if (canEditEnrollment) {
        const { error: enrollmentError } = await supabase
          .from('enrollments')
          .update({ classe_id: classeId || null, montant_du: Number(montantDu) || 0 })
          .eq('id', student.enrollment_id)
          .eq('school_year_id', schoolYearId);
        if (enrollmentError) { setSubmitting(false); setError(enrollmentError.message); return; }
      }

      // PARENT 1
      if (canManageParents) {
        if (useExistingParent && selectedExistingParentId) {
          if (editingParentId && editingParentId !== selectedExistingParentId) {
            const { error: delErr } = await supabase.from('parent_access_students').delete().eq('student_id', student.id).eq('parent_access_id', editingParentId);
            if (delErr) { setSubmitting(false); setError(delErr.message); return; }
          }
          const { error: insErr } = await supabase.from('parent_access_students').insert({ parent_access_id: selectedExistingParentId, student_id: student.id });
          if (insErr && insErr.code !== '23505') { setSubmitting(false); setError(insErr.message); return; }
        } else if (editingParentId && parentNom.trim()) {
          const { error: paError } = await supabase.from('parent_access').update({
            nom: parentNom.trim(), prenom: parentPrenom.trim(),
            full_name: displayName(parentNom.trim(), parentPrenom.trim()),
            phone: composePhone(parentAccessDial, parentAccessLocal) || null,
            lien_parente: lienParente,
          }).eq('id', editingParentId);
          if (paError) { setSubmitting(false); setError(paError.message); return; }
        } else if (!editingParentId && parentNom.trim()) {
          let created = null;
          for (let attempt = 0; attempt < 5 && !created; attempt++) {
            const { data, error: paError } = await supabase.from('parent_access').insert({
              school_id: schoolId, nom: parentNom.trim(), prenom: parentPrenom.trim(),
              full_name: displayName(parentNom.trim(), parentPrenom.trim()),
              phone: composePhone(parentAccessDial, parentAccessLocal) || null,
              code: generateAccessCode(), lien_parente: lienParente,
            }).select().single();
            if (!paError) { created = data; break; }
            if (paError.code !== '23505') { setSubmitting(false); setError(paError.message); return; }
          }
          if (!created) { setSubmitting(false); setError('Impossible de générer un code unique.'); return; }
          await supabase.from('parent_access_students').insert({ parent_access_id: created.id, student_id: student.id });
        }
      }

      // PARENT 2
      if (canManageParents && hasSecondParent) {
        if (useExistingParent2 && selectedExistingParentId2) {
          if (editingParent2Id && editingParent2Id !== selectedExistingParentId2) {
            const { error: delErr } = await supabase.from('parent_access_students').delete().eq('student_id', student.id).eq('parent_access_id', editingParent2Id);
            if (delErr) { setSubmitting(false); setError(delErr.message); return; }
          }
          const { error: insErr } = await supabase.from('parent_access_students').insert({ parent_access_id: selectedExistingParentId2, student_id: student.id });
          if (insErr && insErr.code !== '23505') { setSubmitting(false); setError(insErr.message); return; }
        } else if (editingParent2Id && parent2Nom.trim()) {
          const { error: paError } = await supabase.from('parent_access').update({
            nom: parent2Nom.trim(), prenom: parent2Prenom.trim(),
            full_name: displayName(parent2Nom.trim(), parent2Prenom.trim()),
            phone: composePhone(parent2Dial, parent2Local) || null,
            lien_parente: parent2Lien,
          }).eq('id', editingParent2Id);
          if (paError) { setSubmitting(false); setError(paError.message); return; }
        } else if (!editingParent2Id && parent2Nom.trim()) {
          let created2 = null;
          for (let attempt = 0; attempt < 5 && !created2; attempt++) {
            const { data, error: paError } = await supabase.from('parent_access').insert({
              school_id: schoolId, nom: parent2Nom.trim(), prenom: parent2Prenom.trim(),
              full_name: displayName(parent2Nom.trim(), parent2Prenom.trim()),
              phone: composePhone(parent2Dial, parent2Local) || null,
              code: generateAccessCode(), lien_parente: parent2Lien,
            }).select().single();
            if (!paError) { created2 = data; break; }
            if (paError.code !== '23505') { setSubmitting(false); setError(paError.message); return; }
          }
          if (!created2) { setSubmitting(false); setError('Impossible de générer un code unique pour le 2ème parent.'); return; }
          await supabase.from('parent_access_students').insert({ parent_access_id: created2.id, student_id: student.id });
        }
      } else if (canManageParents && !hasSecondParent && editingParent2Id) {
        const { delErr } = await supabase.from('parent_access_students').delete().eq('student_id', student.id).eq('parent_access_id', editingParent2Id);
        if (delErr) { setSubmitting(false); setError(delErr.message); return; }
      }

      setSubmitting(false);
      showToast('Modifications enregistrées');
      onCreated();
      return;
    }

    // ===== MODE CRÉATION =====
    const studentParentPhone = (canManageParents && !useExistingParent && parentNom.trim())
      ? composePhone(parentAccessDial, parentAccessLocal) || null
      : null;

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
      p_existing_parent_access_id: useExistingParent && selectedExistingParentId ? selectedExistingParentId : null,
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

    let newParentCode = null;
    let newParent2Code = null;

    if (canManageParents && !useExistingParent && parentNom.trim()) {
      let created = null;
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        const { data, error: paError } = await supabase.from('parent_access').insert({
          school_id: schoolId, nom: parentNom.trim(), prenom: parentPrenom.trim(),
          full_name: displayName(parentNom.trim(), parentPrenom.trim()),
          phone: composePhone(parentAccessDial, parentAccessLocal) || null,
          code: generateAccessCode(), lien_parente: lienParente,
        }).select().single();
        if (!paError) { created = data; break; }
        if (paError.code !== '23505') { setSubmitting(false); setError(paError.message); return; }
      }
      if (!created) { setSubmitting(false); setError('Impossible de générer un code unique.'); return; }
      await supabase.from('parent_access_students').insert({ parent_access_id: created.id, student_id: targetStudentId });
      newParentCode = created.code;
    }

    if (canManageParents && hasSecondParent) {
      if (useExistingParent2 && selectedExistingParentId2) {
        const { error: insErr } = await supabase.from('parent_access_students').insert({ parent_access_id: selectedExistingParentId2, student_id: targetStudentId });
        if (insErr && insErr.code !== '23505') { setSubmitting(false); setError(insErr.message); return; }
      } else if (parent2Nom.trim()) {
        let created2 = null;
        for (let attempt = 0; attempt < 5 && !created2; attempt++) {
          const { data, error: paError } = await supabase.from('parent_access').insert({
            school_id: schoolId, nom: parent2Nom.trim(), prenom: parent2Prenom.trim(),
            full_name: displayName(parent2Nom.trim(), parent2Prenom.trim()),
            phone: composePhone(parent2Dial, parent2Local) || null,
            code: generateAccessCode(), lien_parente: parent2Lien,
          }).select().single();
          if (!paError) { created2 = data; break; }
          if (paError.code !== '23505') { setSubmitting(false); setError(paError.message); return; }
        }
        if (!created2) { setSubmitting(false); setError('Impossible de générer un code unique pour le 2ème parent.'); return; }
        await supabase.from('parent_access_students').insert({ parent_access_id: created2.id, student_id: targetStudentId });
        newParent2Code = created2.code;
      }
    }

    // 🔥 Si un paiement à l'inscription a été saisi, on récupère le paiement créé par le RPC
    if (Number(paiementMontant) > 0 && targetStudentId) {
      const { data: newPayment } = await supabase.from('payments')
        .select('id, montant, type_frais, mode, tranche, date, note')
        .eq('student_id', targetStudentId)
        .eq('school_year_id', schoolYearId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (newPayment) {
        // On stocke les codes pour l'affichage après fermeture du reçu
        setResult({ code: newParentCode, secondCode: newParent2Code });
        setCreatedPayment(newPayment);
        setSubmitting(false);
        return;
      }
    }

    if (newParentCode || newParent2Code) {
      setResult({ code: newParentCode, secondCode: newParent2Code });
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    showToast('Enregistré');
    onCreated();
  }

  function copyLink() {
    const url = `${window.location.origin}/parent-access?code=${result.code}`;
    navigator.clipboard.writeText(url).then(() => setCopied(true));
  }

  // 🔥 Rendu du reçu après inscription avec paiement
  if (createdPayment && schoolYearInfo) {
    const enrollmentData = {
      montant_du: Number(montantDu) || 0,
      montant_paye: Number(paiementMontant) || 0,
      frais_connexe_du: Number(selectedClasse ? feeSchedules[selectedClasse.niveau]?.montant_connexe : 0) || 0,
      frais_connexe_paye: 0,
    };
    return (
      <PaymentReceipt
        payment={createdPayment}
        studentName={displayName(studentNom.trim(), studentPrenom.trim())}
        classeNom={selectedClasse?.nom}
        studentMatricule={matricule}
        schoolYearLabel={schoolYearInfo.label}
        school={profile?.schools}
        montantDu={enrollmentData.montant_du}
        montantPaye={enrollmentData.montant_paye}
        enrollment={enrollmentData}
        schoolYear={schoolYearInfo}
        feeSchedule={selectedClasse ? feeSchedules[selectedClasse.niveau] : null}
        autoPrint={true}
        onClose={onCreated}
      />
    );
  }

  if (classes.length === 0) {
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

  if (result && !createdPayment) {
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 440, width: '100%', padding: 26, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600 }}>Élève inscrit</p>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            {result.secondCode ? 'Deux codes d\'accès parent ont été générés.' : 'Code d\'accès du parent — à lui transmettre.'}
          </p>
          {result.code && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 4px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parent 1</p>
              <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 22, fontWeight: 700, letterSpacing: '0.1em', background: 'var(--forest-light)', color: 'var(--forest-dark)', padding: '10px', borderRadius: 10 }}>{result.code}</p>
            </div>
          )}
          {result.secondCode && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 4px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parent 2</p>
              <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 22, fontWeight: 700, letterSpacing: '0.1em', background: 'var(--forest-light)', color: 'var(--forest-dark)', padding: '10px', borderRadius: 10 }}>{result.secondCode}</p>
            </div>
          )}
          {result.code && (
            <button type="button" onClick={copyLink} style={{ width: '100%', padding: '11px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px', marginBottom: 10 }}>{copied ? 'Lien copié !' : 'Copier le lien du parent 1'}</button>
          )}
          <button type="button" onClick={onCreated} style={{ width: '100%', padding: '11px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px' }}>Terminé</button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 500, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 26 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>{isEditing ? 'Modifier les informations de l\'élève' : "Inscription d'un élève"}</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {!isEditing && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {[{ id: 'nouveau', label: 'Nouvel élève' }, { id: 'reinscription', label: 'Réinscription' }].map((m) => (
              <button type="button" key={m.id} onClick={() => setTypeInscription(m.id)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${typeInscription === m.id ? 'var(--forest)' : 'var(--line-strong)'}`, background: typeInscription === m.id ? 'var(--forest)' : 'var(--paper)', color: typeInscription === m.id ? '#fff' : 'var(--ink)' }}>
                {m.label}
              </button>
            ))}
          </div>
        )}

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
            <label style={labelStyle}>Matricule (facultatif)<HelpTooltip text="Laisse ce champ vide. EcoGès générera automatiquement un matricule unique pour cet élève." /></label>
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
            <label style={labelStyle}>Écolage dû<HelpTooltip text="C'est le montant total annuel que ce parent doit payer pour cette classe." /></label>
            <MoneyInput value={montantDu} onChange={(v) => { setMontantDuTouched(true); setMontantDu(v); }} disabled={!canEditEnrollment} style={{ ...inputStyle, opacity: canEditEnrollment ? 1 : 0.6 }} suffix="F CFA" />
          </div>
        </div>

        {!isEditing && (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18, marginBottom: 18 }}>
            <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>Paiement à l'inscription<HelpTooltip text="Enregistre ici l'argent que le parent te donne physiquement aujourd'hui." /></p>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)' }}>Facultatif — laisse à 0 si le parent ne paie rien aujourd'hui.</p>

            {fraisInscription > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 9, background: 'var(--forest-light)', marginBottom: 14 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--forest-dark)' }}>{libelleFrais}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--forest-dark)' }}>Montant fixe, encaissé avec l'inscription</p>
                </div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--forest-dark)' }}>{fmtF(fraisInscription)}</p>
              </div>
            )}

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

            {paiementMontant > 0 && (
              <div>
                <label style={labelStyle}>Mode de paiement</label>
                <Dropdown value={paiementMode} onChange={setPaiementMode} options={MODES.map((m) => ({ value: m.id, label: m.label }))} style={inputStyle} />
              </div>
            )}
          </div>
        )}

        <label style={labelStyle}>Photo (facultatif)</label>
        <div style={{ marginBottom: 18 }}>
          <PhotoPicker schoolId={schoolId} value={photoUrl} onChange={setPhotoUrl} />
        </div>

        {canManageParents && parentLoaded && (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18, marginBottom: 4 }}>
            <p style={{ margin: '0 0 14px', fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>
              {hasSecondParent ? 'Parents' : 'Parent'}
              <HelpTooltip text="Chaque parent reçoit son propre code d'accès." />
            </p>

            <ParentFields
              label={hasSecondParent ? 'Parent 1' : ''}
              nom={parentNom} setNom={setParentNom}
              prenom={parentPrenom} setPrenom={setParentPrenom}
              dial={parentAccessDial} setDial={setParentAccessDial}
              local={parentAccessLocal} setLocal={setParentAccessLocal}
              lien={lienParente} setLien={setLienParente}
              useExisting={useExistingParent} setUseExisting={setUseExistingParent}
              selectedExistingId={selectedExistingParentId} setSelectedExistingId={setSelectedExistingParentId}
              search={parentSearch} setSearch={setParentSearch}
              existingParents={existingParents}
              studentNom={studentNom}
              isEditing={isEditing}
            />

            {hasSecondParent && (
              <ParentFields
                label="Parent 2"
                nom={parent2Nom} setNom={setParent2Nom}
                prenom={parent2Prenom} setPrenom={setParent2Prenom}
                dial={parent2Dial} setDial={setParent2Dial}
                local={parent2Local} setLocal={setParent2Local}
                lien={parent2Lien} setLien={setParent2Lien}
                useExisting={useExistingParent2} setUseExisting={setUseExistingParent2}
                selectedExistingId={selectedExistingParentId2} setSelectedExistingId={setSelectedExistingParentId2}
                search={parent2Search} setSearch={setParent2Search}
                existingParents={existingParents}
                studentNom={studentNom}
                excludeIds={parent2ExcludeIds}
                onRemove={() => {
                  setHasSecondParent(false); setEditingParent2Id(null);
                  setParent2Nom(''); setParent2Prenom(''); setParent2Local('');
                  setUseExistingParent2(false); setSelectedExistingParentId2(null); setParent2Search('');
                }}
              />
            )}

            {!hasSecondParent && (
              <button type="button" onClick={() => setHasSecondParent(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, padding: '9px 14px', borderRadius: 8, border: '1px dashed var(--forest)', background: 'transparent', color: 'var(--forest)', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true"></i>
                Ajouter un 2ème parent (père + mère)
              </button>
            )}
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
