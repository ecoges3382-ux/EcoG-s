import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { displayName } from '../lib/utils.js';
import PhotoPicker from './PhotoPicker.jsx';
import NameInput from './NameInput.jsx';

const ROLES = ['Enseignant', 'Secrétaire', 'Directeur', 'Fondateur'];
const PREFIXES = { Enseignant: 'ENS', Secrétaire: 'SEC', Directeur: 'DIR', Fondateur: 'FON' };

function nextMatricule(existingStaff, role) {
  const count = existingStaff.filter((p) => p.role === role).length + 1;
  return `${PREFIXES[role] || 'PER'}-${String(count).padStart(4, '0')}`;
}

export default function NewStaffModal({ schoolId, existingStaff, availableClasses, editing, onClose, onSaved }) {
  const [nom, setNom] = useState(editing?.nom || '');
  const [prenom, setPrenom] = useState(editing?.prenom || '');
  const [role, setRole] = useState(editing?.role || ROLES[0]);
  const [niveauEtudes, setNiveauEtudes] = useState(editing?.niveau_etudes || '');
  const [classNames, setClassNames] = useState(editing?.classes || []);
  const [phone, setPhone] = useState(editing?.phone || '');
  const [email, setEmail] = useState(editing?.email || '');
  const [photoUrl, setPhotoUrl] = useState(editing?.photo_url || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function toggleClass(nomClasse) {
    setClassNames((prev) => (prev.includes(nomClasse) ? prev.filter((c) => c !== nomClasse) : [...prev, nomClasse]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nom.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    setSubmitting(true);
    setError('');
    const payload = {
      full_name: displayName(nom.trim(), prenom.trim()),
      nom: nom.trim(),
      prenom: prenom.trim(),
      role,
      niveau_etudes: niveauEtudes.trim(),
      classes: classNames,
      phone: phone.trim(),
      email: email.trim(),
      photo_url: photoUrl || null,
    };
    // Le matricule identifie durablement la personne — on ne le recalcule
    // jamais après coup, seulement à la création.
    const { error: saveError } = editing
      ? await supabase.from('staff').update(payload).eq('id', editing.id)
      : await supabase.from('staff').insert({ school_id: schoolId, matricule: nextMatricule(existingStaff, role), ...payload });
    setSubmitting(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onSaved();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 480, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>{editing ? 'Modifier le membre du personnel' : 'Nouveau membre du personnel'}</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Nom">
            <NameInput mode="upper" value={nom} onChange={setNom} style={inputStyle} />
          </Field>
          <Field label="Prénom">
            <NameInput mode="title" value={prenom} onChange={setPrenom} style={inputStyle} />
          </Field>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Rôle">
            <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Niveau d'études">
            <input value={niveauEtudes} onChange={(e) => setNiveauEtudes(e.target.value)} placeholder="ex. Licence en Lettres" style={inputStyle} />
          </Field>
        </div>

        <Field label="Classe(s) attribuée(s)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
            {availableClasses.length === 0 && (
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>Aucune classe créée pour l'instant.</p>
            )}
            {availableClasses.map((c) => {
              const active = classNames.includes(c.nom);
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => toggleClass(c.nom)}
                  style={{
                    padding: '6px 13px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${active ? 'var(--forest)' : 'var(--line-strong)'}`,
                    background: active ? 'var(--forest)' : 'var(--paper)',
                    color: active ? '#fff' : 'var(--ink)',
                  }}
                >
                  {c.nom}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Téléphone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01 XX XX XX XX" style={inputStyle} />
          </Field>
          <Field label="E-mail" last>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <Field label="Photo (facultatif)">
          <div style={{ marginBottom: 18 }}>
            <PhotoPicker schoolId={schoolId} value={photoUrl} onChange={setPhotoUrl} />
          </div>
        </Field>

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
          <button type="submit" disabled={submitting} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)',
  fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12,
};

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}
