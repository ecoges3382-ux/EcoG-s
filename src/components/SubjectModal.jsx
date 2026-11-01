import { useState, useRef, useEffect } from 'react';
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

  // États pour la sélection multiple
  const [selectedNiveaux, setSelectedNiveaux] = useState(() => {
    if (editing) return [editing.niveau || ''];
    return ['']; // Par défaut : "Tous niveaux"
  });
  
  // États pour le menu déroulant
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  // 1. Calculer la position du menu quand on l'ouvre (toujours vers le bas)
  function toggleDropdown() {
    if (!dropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuStyle({
        position: 'fixed',
        top: rect.bottom + 4, // Toujours vers le bas
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        background: 'var(--paper)', 
        border: '1px solid var(--line-strong)', 
        borderRadius: 9, 
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)', 
        display: 'flex', 
        flexDirection: 'column'
      });
    }
    setDropdownOpen(!dropdownOpen);
  }

  // 2. Fermer le menu si on clique en dehors
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        menuRef.current && !menuRef.current.contains(event.target) &&
        buttonRef.current && !buttonRef.current.contains(event.target)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // (J'ai supprimé le useEffect qui fermait le menu au scroll)

  function toggleNiveau(nomClasse) {
    if (nomClasse === '') {
      setSelectedNiveaux(['']);
      return;
    }
    setSelectedNiveaux((prev) => {
      const filtered = prev.filter(n => n !== '');
      if (filtered.includes(nomClasse)) {
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
      const { error: err } = await supabase
        .from('subjects')
        .update({ ...basePayload, niveau: selectedNiveaux[0] || null })
        .eq('id', editing.id);
      saveError = err;
    } else {
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
  
  // 3. Affichage des noms de classes sélectionnées dans le bouton
  const labelAffichage = isAllLevels 
    ? 'Tous niveaux' 
    : selectedNiveaux.join(', ');

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

        <label style={labelStyle}>Niveau(x) concerné(s)</label>
        
        {editing ? (
          <Dropdown
            value={selectedNiveaux[0]}
            onChange={(v) => setSelectedNiveaux([v])}
            options={[{ value: '', label: 'Tous niveaux' }, ...classes.map((c) => ({ value: c.nom, label: c.nom }))]}
            style={{ ...inputStyle, marginBottom: 18 }}
          />
        ) : (
          <div style={{ marginBottom: 18 }}>
            {/* Bouton déclencheur */}
            <button
              type="button"
              ref={buttonRef}
              onClick={toggleDropdown}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)',
                background: 'var(--paper)', color: 'var(--ink)', fontSize: 14, textAlign: 'left',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
              }}
            >
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {labelAffichage}
              </span>
              <i className="ti ti-chevron-down" style={{ fontSize: 14 }} aria-hidden="true"></i>
            </button>

            {/* Menu déroulant via Portal pour ne pas être coupé */}
            {dropdownOpen && createPortal(
              <div ref={menuRef} style={menuStyle}>
                <div style={{ maxHeight: 200, overflowY: 'auto', padding: '8px 12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontWeight: 600 }}>
                    <input type="checkbox" checked={isAllLevels} onChange={() => toggleNiveau('')} />
                    Tous niveaux
                  </label>
                  <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
                  {classes.map((c) => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedNiveaux.includes(c.nom)} 
                        onChange={() => toggleNiveau(c.nom)}
                      />
                      {c.nom}
                    </label>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid var(--line)', padding: 8, textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(false)}
                    style={{ background: 'var(--forest)', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    OK
                  </button>
                </div>
              </div>,
              document.body
            )}
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
