import { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase.js';
import { useToast } from './Toast.jsx';
import Dropdown from './Dropdown.jsx';

export default function SubjectModal({ schoolId, teachers, classes, editing, onClose, onSaved }) {
  const showToast = useToast();
  const [nom, setNom] = useState(editing?.nom || '');
  const [coefficient, setCoefficient] = useState(editing?.coefficient ?? 1);
  const [enseignantId, setEnseignantId] = useState(editing?.enseignant_id || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // État pour gérer la sélection multiple
  const [selectedNiveaux, setSelectedNiveaux] = useState(() => {
    if (editing) return [editing.niveau || ''];
    return ['']; // Par défaut : "Tous niveaux"
  });

  function toggleNiveau(nomClasse) {
    if (nomClasse === '') {
      // Si on clique sur "Tous niveaux", on réinitialise tout
      setSelectedNiveaux(['']);
      return;
    }
    
    setSelectedNiveaux((prev) => {
      // Si "Tous niveaux" était sélectionné, on le retire
      const filtered = prev.filter(n => n !== '');
      
      if (filtered.includes(nomClasse)) {
        // Si on décoche le dernier élément, on revient à "Tous niveaux"
        const next = filtered.filter(n => n !== nomClasse);
        return next.length === 0 ? [''] : next;
      } else {
        return [...filtered, nomClasse];
      }
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nom.trim()) {
      setError('Le nom de la matière est obligatoire.');
      return;
    }
    
    setSubmitting(true);
    setError('');
    
    const basePayload = {
      nom: nom.trim(),
      coefficient: Number(coefficient) || 1,
      enseignant_id: enseignantId || null,
    };

    let saveError = null;

    if (editing) {
      // Modification : on met à jour la seule ligne existante
      const { error: err } = await supabase
        .from('subjects')
        .update({ ...basePayload, niveau: selectedNiveaux[0] || null })
        .eq('id', editing.id);
      saveError = err;
    } else {
      // Création : on insère une ligne pour chaque niveau sélectionné
      const payloads = selectedNiveaux.map((niv) => ({
        school_id: schoolId,
        ...basePayload,
        niveau: niv || null,
      }));
      
      const { error: err } = await supabase.from('subjects').insert(payloads);
      saveError = err;
    }

    setSubmitting(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    showToast(editing ? 'Enregistré' : `${selectedNiveaux.length} matière(s) créée(s)`);
    onSaved();
  }

  const isAllLevels = selectedNiveaux.includes('');

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form onSubmit={handleSubmit} style={{ background: 'var(--paper)', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>
            {editing ? 'Modifier la matière' : 'Nouvelle matière'}
          </p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <label style={labelStyle}>Nom de la matière</label>
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Mathématiques" style={inputStyle} />

        <div className="desktop-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Coefficient</label>
            <input type="number" min="1" step="1" value={coefficient} onChange={(e) => setCoefficient(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
          </div>
          <div>
            <label style={labelStyle}>Enseignant responsable</label>
            <Dropdown
              value={enseignantId}
              onChange={setEnseignantId}
              options={[{ value: '', label: '—' }, ...teachers.map((t) => ({ value: t.id, label: t.full_name }))]}
              style={{ ...inputStyle, marginBottom: 0, padding: '10px 12px' }}
            />
          </div>
        </div>

        {/* Sélection du niveau : soit simple (édition), soit multiple (création) */}
        <label style={labelStyle}>Niveau(x) concerné(s)</label>
        
        {editing ? (
          <Dropdown
            value={selectedNiveaux[0]}
            onChange={(v) => setSelectedNiveaux([v])}
            options={[{ value: '', label: 'Tous niveaux' }, ...classes.map((c) => ({ value: c.nom, label: c.nom }))]}
            style={{ ...inputStyle, marginBottom: 18 }}
          />
        ) : (
          <div style={{ border: '1px solid var(--line-strong)', borderRadius: 9, padding: '10px 12px', marginBottom: 18, maxHeight: 180, overflowY: 'auto' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontWeight: 600 }}>
              <input 
                type="checkbox" 
                checked={isAllLevels} 
                onChange={() => toggleNiveau('')} 
              />
              Tous niveaux
            </label>
            <div style={{ height: 1, background: 'var(--line)', margin: '6px 0' }} />
            {classes.map((c) => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={selectedNiveaux.includes(c.nom)} 
                  onChange={() => toggleNiveau(c.nom)}
                />
                {c.nom}
              </label>
            ))}
          </div>
        )}

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}>Annuler</button>
          <button type="submit" disabled={submitting} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: '13.5px', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enregistrement…' : (editing ? 'Enregistrer' : 'Créer la matière')}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 12 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
