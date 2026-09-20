import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials } from '../lib/utils.js';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import SelectionBar from '../components/SelectionBar.jsx';

const MANAGER_ROLES = ['fondateur', 'directeur', 'secretaire'];

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7l16 0" />
      <path d="M10 11l0 6" />
      <path d="M14 11l0 6" />
      <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
      <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}

export default function Parents() {
  const { profile } = useAuth();
  const [parents, setParents] = useState(null);
  const [error, setError] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  async function reload() {
    const { data, error: fetchError } = await supabase
      .from('parent_access')
      .select('id, full_name, phone, parent_access_students ( students ( id ) )')
      .order('full_name');
    if (fetchError) setError(fetchError.message);
    else setParents(data);
  }

  useEffect(() => {
    if (!MANAGER_ROLES.includes(profile.role)) return;
    reload();
  }, [profile.role]);

  if (!MANAGER_ROLES.includes(profile.role)) {
    return (
      <div className="card-bold" style={{ padding: '16px 20px', maxWidth: 520, background: 'var(--gold-light)', borderColor: 'var(--gold)' }}>
        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--clay-dark)', lineHeight: 1.6 }}>
          Seuls le fondateur, le directeur et la secrétaire peuvent consulter les parents.
        </p>
      </div>
    );
  }

  function toggleOne(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const ids = parents.map((p) => p.id);
      return ids.every((id) => prev.includes(id)) ? [] : ids;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds([]);
  }

  async function handleDeleteOne(id, name) {
    if (!window.confirm(`Supprimer définitivement l'accès de ${name} ? Le lien qu'il a reçu cessera de fonctionner. Cette action est irréversible.`)) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('parent_access').delete().eq('id', id);
    setDeleting(false);
    if (deleteError) { setError(deleteError.message); return; }
    reload();
  }

  async function handleDeleteSelected() {
    if (!window.confirm(`Supprimer définitivement ${selectedIds.length} accès parent${selectedIds.length > 1 ? 's' : ''} ? Cette action est irréversible.`)) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('parent_access').delete().in('id', selectedIds);
    setDeleting(false);
    if (deleteError) { setError(deleteError.message); return; }
    exitSelectMode();
    reload();
  }

  return (
    <div>
      <SchoolTabs />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Parents</p>
        {!selectMode && (
          <button
            onClick={() => setSelectMode(true)}
            style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}
          >
            Sélectionner
          </button>
        )}
      </div>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}
      {!parents && !error && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {parents && (
        <div className="card-bold" style={{ overflow: 'hidden' }}>
          {parents.map((p, i) => {
            const childCount = (p.parent_access_students || []).length;
            return (
              <div
                key={p.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderBottom: i < parents.length - 1 ? '1px solid var(--line)' : 'none' }}
              >
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleOne(p.id)}
                    style={{ flexShrink: 0 }}
                  />
                )}
                <Link
                  to={selectMode ? '#' : `/parents/${p.id}`}
                  onClick={selectMode ? (e) => { e.preventDefault(); toggleOne(p.id); } : undefined}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: '12.5px', fontWeight: 600, color: 'var(--clay-dark)', flexShrink: 0 }}>
                      {initials(p.full_name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{p.full_name}</p>
                      <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)' }}>{p.phone || 'Pas de numéro'}</p>
                    </div>
                  </div>
                  <span style={{ background: 'var(--forest-light)', color: 'var(--forest-dark)', fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20, flexShrink: 0, marginLeft: 10 }}>
                    {childCount} enfant{childCount > 1 ? 's' : ''}
                  </span>
                </Link>
                {!selectMode && (
                  <button
                    type="button"
                    onClick={() => handleDeleteOne(p.id, p.full_name)}
                    title="Supprimer"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, padding: 0, borderRadius: 8, border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            );
          })}
          {parents.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun parent pour l'instant.</p>}
        </div>
      )}

      {selectMode && (
        <SelectionBar
          count={selectedIds.length}
          allSelected={!!parents && parents.length > 0 && parents.every((p) => selectedIds.includes(p.id))}
          onCancel={exitSelectMode}
          onToggleAll={toggleAllVisible}
          onDelete={handleDeleteSelected}
          deleting={deleting}
        />
      )}
    </div>
  );
}
