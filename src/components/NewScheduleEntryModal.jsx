import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
const CRENEAUX = ['8h-9h', '9h-10h', '10h-11h', '11h-12h', '15h-16h'];

export default function NewScheduleEntryModal({ schoolId, niveaux, enseignants, onClose, onCreated }) {
  const [jour, setJour] = useState(JOURS[0]);
  const [creneau, setCreneau] = useState(CRENEAUX[0]);
  const [classe, setClasse] = useState(niveaux[0]);
  const [matiere, setMatiere] = useState('');
  const [enseignant, setEnseignant] = useState(enseignants[0] || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!matiere.trim()) {
      setError('La matière est obligatoire.');
      return;
    }
    setSubmitting(true);
    setError('');
    const { error: insertError } = await supabase.from('schedule_entries').insert({
      school_id: schoolId, jour, creneau, classe, matiere: matiere.trim(), enseignant,
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
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 440, width: '100%', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>Ajouter un créneau</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Jour</label>
            <select value={jour} onChange={(e) => setJour(e.target.value)} style={inputStyle}>
              {JOURS.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Créneau</label>
            <select value={creneau} onChange={(e) => setCreneau(e.target.value)} style={inputStyle}>
              {CRENEAUX.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Classe</label>
            <select value={classe} onChange={(e) => setClasse(e.target.value)} style={inputStyle}>
              {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Enseignant</label>
            {enseignants.length > 0 ? (
              <select value={enseignant} onChange={(e) => setEnseignant(e.target.value)} style={inputStyle}>
                {enseignants.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            ) : (
              <input value={enseignant} onChange={(e) => setEnseignant(e.target.value)} style={inputStyle} placeholder="Nom de l'enseignant" />
            )}
          </div>
        </div>

        <label style={labelStyle}>Matière</label>
        <input value={matiere} onChange={(e) => setMatiere(e.target.value)} style={{ ...inputStyle, marginBottom: 18 }} />

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
          <button type="submit" disabled={submitting} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)' };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
