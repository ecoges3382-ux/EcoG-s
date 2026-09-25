import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { NIVEAUX } from '../lib/utils.js';

// Extrait de Classes.jsx pour être réutilisable ailleurs (voir
// src/pages/FirstTimeSetup.jsx, l'assistant de configuration initiale
// d'une nouvelle école) sans dupliquer le formulaire de création/édition.
export default function ClassModal({ schoolId, teachers, editing, onClose, onSaved }) {
  const [niveau, setNiveau] = useState(editing?.niveau || NIVEAUX[0]);
  const [section, setSection] = useState(editing?.section || '');
  const [salle, setSalle] = useState(editing?.salle || '');
  const [capacite, setCapacite] = useState(editing?.capacite ?? '');
  const [profPrincipalId, setProfPrincipalId] = useState(editing?.prof_principal_id || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const payload = {
      nom: section.trim() ? `${niveau} ${section.trim()}` : niveau,
      niveau,
      section: section.trim() || null,
      salle: salle.trim() || null,
      capacite: capacite === '' ? null : Number(capacite),
      prof_principal_id: profPrincipalId || null,
    };
    const { error: saveError } = editing
      ? await supabase.from('classes').update(payload).eq('id', editing.id)
      : await supabase.from('classes').insert({ school_id: schoolId, ...payload });
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
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>{editing ? 'Modifier la classe' : 'Nouvelle classe'}</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Niveau</label>
            <select value={niveau} onChange={(e) => setNiveau(e.target.value)} style={inputStyle}>
              {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Section (optionnel)</label>
            <input value={section} onChange={(e) => setSection(e.target.value)} placeholder="A" style={inputStyle} />
          </div>
        </div>
        <p style={{ margin: '-6px 0 12px', fontSize: '11.5px', color: 'var(--muted)' }}>
          Nom de la classe : <strong>{section.trim() ? `${niveau} ${section.trim()}` : niveau}</strong>
        </p>

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Salle</label>
            <input value={salle} onChange={(e) => setSalle(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Capacité</label>
            <input type="number" min="0" value={capacite} onChange={(e) => setCapacite(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <label style={labelStyle}>Professeur principal</label>
        <select value={profPrincipalId} onChange={(e) => setProfPrincipalId(e.target.value)} style={{ ...inputStyle, marginBottom: 18 }}>
          <option value="">—</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select>

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

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
