import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { generateAccessCode, displayName } from '../lib/utils.js';
import PhotoPicker from './PhotoPicker.jsx';
import MoneyInput from './MoneyInput.jsx';
import PhoneInput, { COUNTRIES, composePhone } from './PhoneInput.jsx';
import NameInput from './NameInput.jsx';

export default function NewStudentModal({ schoolId, schoolYearId, classes, canManageParents, onClose, onCreated }) {
  const [studentNom, setStudentNom] = useState('');
  const [studentPrenom, setStudentPrenom] = useState('');
  const [classeId, setClasseId] = useState(classes[0]?.id || '');
  const [montantDu, setMontantDu] = useState(0);
  const [montantDuTouched, setMontantDuTouched] = useState(false);
  const [feeSchedules, setFeeSchedules] = useState({});
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedClasse = classes.find((c) => c.id === classeId);

  // Grille tarifaire (Argent → Grille tarifaire) : pré-remplit le montant dû
  // selon le niveau choisi, tant que l'utilisateur ne l'a pas modifié à la
  // main (bourse, réduction…).
  useEffect(() => {
    if (!schoolYearId) return;
    supabase.from('fee_schedules').select('niveau, montant_scolarite, montant_connexe').eq('school_year_id', schoolYearId).then(({ data }) => {
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

  // Parent : nouveau (avec code d'accès généré à l'inscription) ou
  // rattachement à un parent déjà présent dans l'école (fratrie).
  const [parentMode, setParentMode] = useState('new');
  const [existingParents, setExistingParents] = useState(null);
  const [existingParentId, setExistingParentId] = useState('');
  const [parentSearch, setParentSearch] = useState('');
  const [parentNom, setParentNom] = useState('');
  const [parentPrenom, setParentPrenom] = useState('');
  const [parentAccessDial, setParentAccessDial] = useState(COUNTRIES[0].dial);
  const [parentAccessLocal, setParentAccessLocal] = useState('');

  const [result, setResult] = useState(null); // { code } une fois un nouveau parent créé
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canManageParents) return;
    supabase.from('parent_access').select('id, full_name, nom, phone, code').order('full_name').then(({ data }) => {
      setExistingParents(data || []);
    });
  }, [canManageParents]);

  const filteredParents = (existingParents || []).filter((p) =>
    p.nom.toLowerCase().includes(parentSearch.trim().toLowerCase())
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!studentNom.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    if (canManageParents && parentMode === 'existing' && !existingParentId) {
      setError('Choisis un parent existant, ou choisis « Nouveau parent ».');
      return;
    }
    setSubmitting(true);
    setError('');

    // Le téléphone du parent (saisi une seule fois, dans la section Parent
    // ci-dessous) est repris sur la fiche élève — nouveau parent créé à
    // l'instant, ou parent existant déjà rattaché.
    let studentParentPhone = null;
    if (canManageParents && parentMode === 'new') {
      studentParentPhone = composePhone(parentAccessDial, parentAccessLocal) || null;
    } else if (canManageParents && parentMode === 'existing') {
      studentParentPhone = (existingParents || []).find((p) => p.id === existingParentId)?.phone || null;
    }

    // Élève + inscription (+ rattachement à un parent existant le cas
    // échéant) en une seule transaction côté base : si une étape échoue,
    // tout est annulé — jamais d'élève créé sans inscription. La fonction
    // tourne "security invoker", donc soumise à la même RLS qu'un insert
    // direct (aucune élévation de privilège), voir supabase/schema.sql.
    const isExistingParent = canManageParents && parentMode === 'existing' && !!existingParentId;
    const { data: studentId, error: rpcError } = await supabase.rpc('create_student_with_enrollment', {
      p_school_id: schoolId,
      p_nom: studentNom.trim(),
      p_prenom: studentPrenom.trim(),
      p_full_name: displayName(studentNom.trim(), studentPrenom.trim()),
      p_parent_phone: studentParentPhone,
      p_photo_url: photoUrl || null,
      p_matricule: null,
      p_school_year_id: schoolYearId,
      p_classe_id: classeId || null,
      p_montant_du: Number(montantDu) || 0,
      p_frais_connexe_du: Number(selectedClasse ? feeSchedules[selectedClasse.niveau]?.montant_connexe : 0) || 0,
      p_existing_parent_access_id: isExistingParent ? existingParentId : null,
    });
    if (rpcError) {
      setSubmitting(false);
      setError(rpcError.message);
      return;
    }

    if (!canManageParents || isExistingParent) {
      setSubmitting(false);
      onCreated();
      return;
    }

    // parentMode === 'new' : rien à créer si le nom du parent est resté vide
    // (l'accès parent pourra toujours être ajouté plus tard depuis Comptes).
    if (!parentNom.trim()) {
      setSubmitting(false);
      onCreated();
      return;
    }

    let created = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const { data, error: paError } = await supabase.from('parent_access').insert({
        school_id: schoolId,
        full_name: displayName(parentNom.trim(), parentPrenom.trim()),
        nom: parentNom.trim(),
        prenom: parentPrenom.trim(),
        phone: composePhone(parentAccessDial, parentAccessLocal) || null,
        code: generateAccessCode(),
      }).select().single();
      if (!paError) { created = data; break; }
      if (paError.code !== '23505') { setSubmitting(false); setError(paError.message); return; }
    }
    if (!created) { setSubmitting(false); setError('Impossible de générer un code unique, réessaie.'); return; }

    const { error: linkError } = await supabase.from('parent_access_students').insert({
      parent_access_id: created.id, student_id: studentId,
    });
    setSubmitting(false);
    if (linkError) { setError(linkError.message); return; }
    setResult({ code: created.code });
  }

  function copyLink() {
    const url = `${window.location.origin}/parent-access?code=${result.code}`;
    navigator.clipboard.writeText(url).then(() => setCopied(true));
  }

  if (classes.length === 0) {
    return (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 420, width: '100%', padding: 26, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600 }}>Aucune classe créée</p>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            Il faut d'abord créer au moins une classe (CI, CP, 6e A…) avant de pouvoir y inscrire un élève.
          </p>
          <Link
            to="/classes"
            onClick={onClose}
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '11px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', textDecoration: 'none', marginBottom: 10 }}
          >
            Aller créer une classe
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

  if (result) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 420, width: '100%', padding: 26, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600 }}>Élève inscrit</p>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            Code d'accès du parent — à lui transmettre pour qu'il consulte la fiche de son enfant.
          </p>
          <p style={{ margin: '0 0 18px', fontFamily: 'monospace', fontSize: 24, fontWeight: 700, letterSpacing: '0.1em', background: 'var(--forest-light)', color: 'var(--forest-dark)', padding: '12px', borderRadius: 10 }}>
            {result.code}
          </p>
          <button
            type="button"
            onClick={copyLink}
            style={{ width: '100%', padding: '11px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px', marginBottom: 10 }}
          >
            {copied ? 'Lien copié !' : 'Copier le lien à envoyer'}
          </button>
          <button
            type="button"
            onClick={onCreated}
            style={{ width: '100%', padding: '11px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px' }}
          >
            Terminé
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
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 480, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>Inscription d'un élève</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Nom</label>
            <NameInput mode="upper" value={studentNom} onChange={setStudentNom} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Prénom</label>
            <NameInput mode="title" value={studentPrenom} onChange={setStudentPrenom} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Classe</label>
            <select value={classeId} onChange={(e) => setClasseId(e.target.value)} style={inputStyle}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Écolage dû (F CFA)</label>
            <MoneyInput
              value={montantDu}
              onChange={(v) => { setMontantDuTouched(true); setMontantDu(v); }}
              style={inputStyle}
            />
          </div>
        </div>
        {selectedClasse && !feeSchedules[selectedClasse.niveau] && (
          <p style={{ margin: '-8px 0 12px', fontSize: 11.5, color: 'var(--muted)' }}>
            Aucun tarif configuré pour {selectedClasse.niveau} — configure la grille tarifaire dans
            Argent pour un pré-remplissage automatique la prochaine fois.
          </p>
        )}

        <label style={labelStyle}>Photo (facultatif)</label>
        <div style={{ marginBottom: 18 }}>
          <PhotoPicker schoolId={schoolId} value={photoUrl} onChange={setPhotoUrl} />
        </div>

        {canManageParents && (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18, marginBottom: 4 }}>
            <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>Parent</p>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)' }}>
              Pour que le parent puisse consulter la fiche de son enfant sans compte ni mot de passe.
            </p>

            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[{ id: 'new', label: 'Nouveau parent' }, { id: 'existing', label: 'Parent existant' }].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => {
                    setParentMode(m.id);
                    if (m.id === 'existing') setParentSearch(studentNom.trim());
                  }}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${parentMode === m.id ? 'var(--forest)' : 'var(--line-strong)'}`,
                    background: parentMode === m.id ? 'var(--forest)' : 'var(--paper)',
                    color: parentMode === m.id ? '#fff' : 'var(--ink)',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {parentMode === 'new' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Nom du parent</label>
                    <NameInput mode="upper" value={parentNom} onChange={setParentNom} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Prénom du parent</label>
                    <NameInput mode="title" value={parentPrenom} onChange={setParentPrenom} style={inputStyle} />
                  </div>
                </div>
                <p style={{ margin: '-8px 0 12px', fontSize: 11.5, color: 'var(--muted)' }}>Laisser vide pour ne pas créer d'accès maintenant.</p>

                <label style={labelStyle}>Téléphone du parent</label>
                <PhoneInput dial={parentAccessDial} local={parentAccessLocal} onDialChange={setParentAccessDial} onLocalChange={setParentAccessLocal} style={{ marginBottom: 18 }} />
              </>
            ) : (
              <>
                <label style={labelStyle}>Parent (fratrie déjà inscrite)</label>
                {existingParents === null && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0' }}>Chargement…</p>}
                {existingParents?.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0' }}>Aucun parent existant dans cette école pour l'instant.</p>}
                {existingParents?.length > 0 && (
                  <>
                    <input
                      value={parentSearch}
                      onChange={(e) => setParentSearch(e.target.value)}
                      placeholder="Rechercher par nom de famille…"
                      style={inputStyle}
                    />
                    <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--line-strong)', borderRadius: 9, marginBottom: 18 }}>
                      {filteredParents.length === 0 && (
                        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, padding: '10px 12px' }}>
                          Aucun parent ne correspond à « {parentSearch} ».
                        </p>
                      )}
                      {filteredParents.map((p, i) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => setExistingParentId(p.id)}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none',
                            borderBottom: i < filteredParents.length - 1 ? '1px solid var(--line)' : 'none',
                            cursor: 'pointer', fontSize: 13.5,
                            background: existingParentId === p.id ? 'var(--forest-light)' : 'transparent',
                            color: existingParentId === p.id ? 'var(--forest-dark)' : 'var(--ink)',
                            fontWeight: existingParentId === p.id ? 600 : 400,
                          }}
                        >
                          {p.full_name} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({p.code})</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
          <button type="submit" disabled={submitting} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Inscription…' : 'Inscrire'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
