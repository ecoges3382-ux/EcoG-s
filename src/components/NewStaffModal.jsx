import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

const ROLES = ['Enseignant', 'Secrétaire', 'Directeur', 'Fondateur'];
const PREFIXES = { Enseignant: 'ENS', Secrétaire: 'SEC', Directeur: 'DIR', Fondateur: 'FON' };

function nextMatricule(existingStaff, role) {
  const count = existingStaff.filter((p) => p.role === role).length + 1;
  return `${PREFIXES[role] || 'PER'}-${String(count).padStart(4, '0')}`;
}

export default function NewStaffModal({ schoolId, existingStaff, onClose, onCreated }) {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState(ROLES[0]);
  const [niveauEtudes, setNiveauEtudes] = useState('');
  const [classes, setClasses] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    setSubmitting(true);
    setError('');
    const { error: insertError } = await supabase.from('staff').insert({
      school_id: schoolId,
      matricule: nextMatricule(existingStaff, role),
      full_name: fullName.trim(),
      role,
      niveau_etudes: niveauEtudes.trim(),
      classes: classes.split(',').map((c) => c.trim()).filter(Boolean),
      phone: phone.trim(),
      email: email.trim(),
    });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onCreated();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 480, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>Nouveau membre du personnel</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <Field label="Nom complet">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
          <input value={classes} onChange={(e) => setClasses(e.target.value)} placeholder="ex. CM1, 3e (séparées par une virgule)" style={inputStyle} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Téléphone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01 XX XX XX XX" style={inputStyle} />
          </Field>
          <Field label="E-mail" last>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, marginBottom: 18 }} />
          </Field>
        </div>

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
