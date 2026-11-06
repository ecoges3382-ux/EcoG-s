import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { createPortal } from 'react-dom';

export default function GlobalSearch({ onClose }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ students: [], staff: [], classes: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  // Focus sur l'input à l'ouverture
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Recherche avec un léger délai (debounce) pour ne pas spammer la base de données
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ students: [], staff: [], classes: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const searchTerm = `%${query.trim()}%`;

      const [studentsRes, staffRes, classesRes] = await Promise.all([
        supabase.from('students').select('id, full_name, matricule').ilike('full_name', searchTerm).limit(5),
        supabase.from('staff').select('id, full_name, role').ilike('full_name', searchTerm).limit(3),
        supabase.from('classes').select('id, nom').ilike('nom', searchTerm).limit(3),
      ]);

      setResults({
        students: studentsRes.data || [],
        staff: staffRes.data || [],
        classes: classesRes.data || [],
      });
      setLoading(false);
      setSelectedIndex(0); // Réinitialise la sélection
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Aplatir les résultats pour faciliter la navigation au clavier
  const flatResults = [
    ...results.students.map(s => ({ ...s, type: 'student', path: `/eleves/${s.id}`, label: s.full_name, sub: s.matricule || 'Élève' })),
    ...results.staff.map(s => ({ ...s, type: 'staff', path: `/personnel/${s.id}`, label: s.full_name, sub: s.role })),
    ...results.classes.map(c => ({ ...c, type: 'class', path: `/classes`, label: c.nom, sub: 'Classe' })),
  ];

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(flatResults.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatResults.length) % Math.max(flatResults.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatResults[selectedIndex]) {
        navigate(flatResults[selectedIndex].path);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{ background: 'var(--paper)', borderRadius: 16, width: '100%', maxWidth: 600, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        onKeyDown={handleKeyDown}
      >
        {/* Barre de recherche */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <i className="ti ti-search" style={{ fontSize: 20, color: 'var(--muted)', marginRight: 12 }} aria-hidden="true"></i>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un élève, un prof, une classe..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 18, background: 'transparent', color: 'var(--ink)' }}
          />
          <button onClick={onClose} style={{ background: 'var(--line)', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer' }}>ESC</button>
        </div>

        {/* Résultats */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '10px 0' }}>
          {loading && <p style={{ padding: '10px 20px', fontSize: 13, color: 'var(--muted)' }}>Recherche en cours…</p>}
          
          {!loading && query.length >= 2 && flatResults.length === 0 && (
            <p style={{ padding: '20px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>Aucun résultat pour « {query} »</p>
          )}

          {flatResults.map((item, index) => (
            <div
              key={`${item.type}-${item.id}`}
              onClick={() => { navigate(item.path); onClose(); }}
              onMouseEnter={() => setSelectedIndex(index)}
              style={{
                padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                background: selectedIndex === index ? 'var(--forest-light)' : 'transparent',
                color: selectedIndex === index ? 'var(--forest-dark)' : 'var(--ink)'
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {item.type === 'student' && <i className="ti ti-user" style={{ fontSize: 16 }} aria-hidden="true"></i>}
                {item.type === 'staff' && <i className="ti ti-id-badge-2" style={{ fontSize: 16 }} aria-hidden="true"></i>}
                {item.type === 'class' && <i className="ti ti-building" style={{ fontSize: 16 }} aria-hidden="true"></i>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</p>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>{item.sub}</p>
              </div>
              {selectedIndex === index && <i className="ti ti-corner-down-left" style={{ fontSize: 16, color: 'var(--forest)' }} aria-hidden="true"></i>}
            </div>
          ))}
        </div>
        
        {/* Footer d'aide */}
        <div style={{ background: 'var(--cream)', padding: '8px 20px', borderTop: '1px solid var(--line)', display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}><kbd style={kbdStyle}>↑</kbd> <kbd style={kbdStyle}>↓</kbd> pour naviguer</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}><kbd style={kbdStyle}>↵</kbd> pour ouvrir</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

const kbdStyle = { background: 'var(--paper)', border: '1px solid var(--line-strong)', borderRadius: 4, padding: '2px 5px', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' };
