import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { generateAccessCode } from '../lib/utils.js';
import PhotoPicker from './PhotoPicker.jsx';
import PhoneInput, { COUNTRIES, composePhone } from './PhoneInput.jsx';

export default function NewStudentModal({ schoolId, niveaux, canManageParents, onClose, onCreated }) {
  const [fullName, setFullName] = useState('');
  const [niveau, setNiveau] = useState(niveaux[0]);
  const [parentPhone, setParentPhone] = useState('');
  const [montantDu, setMontantDu] = useState(90000);
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Parent : nouveau (avec code d'accès généré à l'inscription) ou
  // rattachement à un parent déjà présent dans l'école (fratrie).
  const [parentMode, setParentMode] = useState('new');
  const [existingParents, setExistingParents] = useState(null);
  const [existingParentId, setExistingParentId] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentAccessDial, setParentAccessDial] = useState(COUNTRIES[0].dial);
  const [parentAccessLocal, setParentAccessLocal] = useState('');

  const [result, setResult] = useState(null); // { code } une fois un nouveau parent créé
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canManageParents) return;
    supabase.from('parent_access').select('id, full_name, code').order('full_name').then(({ data }) => {
      setExistingParents(data || []);
      if (data?.length) setExistingParentId(data[0].id);
    });
  }, [canManageParents]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    if (canManageParents && parentMode === 'existing' && !existingParentId) {
      setError('Choisis un parent existant, ou choisis « Nouveau parent ».');
      return;
    }
    setSubmitting(true);
    setError('');

    const { data: student, error: insertError } = await supabase.from('students').insert({
      school_id: schoolId,
      full_name: fullName.trim(),
      niveau,
      parent_phone: parentPhone.trim(),
      montant_du: Number(montantDu) || 0,
      montant_paye: 0,
      frais_connexe_du: 0,
      frais_connexe_paye: 0,
      photo_url: photoUrl || null,
    }).select().single();
    if (insertError) {
      setSubmitting(false);
      setError(insertError.message);
      return;
    }

    if (!canManageParents) {
      setSubmitting(false);
      onCreated();
      return;
    }

    if (parentMode === 'existing') {
      const { error: linkError } = await supabase.from('parent_access_students').insert({
        parent_access_id: existingParentId, student_id: student.id,
      });
      setSubmitting(false);
      if (linkError) { setError(linkError.message); return; }
      onCreated();
      return;
    }

    // parentMode === 'new' : rien à créer si le nom du parent est resté vide
    // (l'accès parent pourra toujours être ajouté plus tard depuis Comptes).
    if (!parentName.trim()) {
      setSubmitting(false);
      onCreated();
      return;
    }

    let created = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const { data, error: paError } = await supabase.from('parent_access').insert({
        school_id: schoolId,
        full_name: parentName.trim(),
        phone: composePhone(parentAccessDial, parentAccessLocal) || null,
        code: generateAccessCode(),
      }).select().single();
      if (!paError) { created = data; break; }
      if (paError.code !== '23505') { setSubmitting(false); setError(paError.message); return; }
    }
    if (!created) { setSubmitting(false); setError('Impossible de générer un code unique, réessaie.'); return; }

    const { error: linkError } = await supabase.from('parent_access_students').insert({
      parent_access_id: created.id, student_id: student.id,
    });
    setSubmitting(false);
    if (linkError) { setError(linkError.message); return; }
    setResult({ code: created.code });
  }

  function copyLink() {
    const url = `${window.location.origin}/parent-access?code=${result.code}`;
    navigator.clipboard.writeText(url).then(() => setCopied(true));
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

        <label style={labelStyle}>Nom complet</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={inputStyle}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Classe</label>
            <select value={niveau} onChange={(e) => setNiveau(e.target.value)} style={inputStyle}>
              {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Écolage dû (F)</label>
            <input
              type="number"
              value={montantDu}
              onChange={(e) => setMontantDu(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <label style={labelStyle}>Photo (facultatif)</label>
        <div style={{ marginBottom: 18 }}>
          <PhotoPicker schoolId={schoolId} value={photoUrl} onChange={setPhotoUrl} />
        </div>

        <label style={labelStyle}>Téléphone parent (information libre, affichée sur la fiche)</label>
        <input
          value={parentPhone}
          onChange={(e) => setParentPhone(e.target.value)}
          placeholder="01 XX XX XX XX"
          style={{ ...inputStyle, marginBottom: 18 }}
        />

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
                  onClick={() => setParentMode(m.id)}
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
                <label style={labelStyle}>Nom du parent (laisser vide pour ne pas créer d'accès maintenant)</label>
                <input value={parentName} onChange={(e) => setParentName(e.target.value)} style={inputStyle} />

                <label style={labelStyle}>Téléphone du parent</label>
                <PhoneInput dial={parentAccessDial} local={parentAccessLocal} onDialChange={setParentAccessDial} onLocalChange={setParentAccessLocal} style={{ marginBottom: 18 }} />
              </>
            ) : (
              <>
                <label style={labelStyle}>Parent (fratrie déjà inscrite)</label>
                {existingParents === null && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0' }}>Chargement…</p>}
                {existingParents?.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0' }}>Aucun parent existant dans cette école pour l'instant.</p>}
                {existingParents?.length > 0 && (
                  <select value={existingParentId} onChange={(e) => setExistingParentId(e.target.value)} style={{ ...inputStyle, marginBottom: 18 }}>
                    {existingParents.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.code})</option>)}
                  </select>
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
