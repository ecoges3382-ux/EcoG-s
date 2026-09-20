import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials } from '../lib/utils.js';
import SchoolTabs from '../layout/SchoolTabs.jsx';

const MANAGER_ROLES = ['fondateur', 'directeur', 'secretaire'];

export default function Parents() {
  const { profile } = useAuth();
  const [parents, setParents] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!MANAGER_ROLES.includes(profile.role)) return;
    supabase
      .from('parent_access')
      .select('id, full_name, phone, parent_access_students ( students ( id ) )')
      .order('full_name')
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message);
        else setParents(data);
      });
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

  return (
    <div>
      <SchoolTabs />
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Parents</p>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}
      {!parents && !error && <p style={{ color: 'var(--muted)' }}>Chargement…</p>}

      {parents && (
        <div className="card-bold" style={{ overflow: 'hidden' }}>
          {parents.map((p, i) => {
            const childCount = (p.parent_access_students || []).length;
            return (
              <Link
                key={p.id}
                to={`/parents/${p.id}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: i < parents.length - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}
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
                <span style={{ background: 'var(--forest-light)', color: 'var(--forest-dark)', fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20, flexShrink: 0 }}>
                  {childCount} enfant{childCount > 1 ? 's' : ''}
                </span>
              </Link>
            );
          })}
          {parents.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun parent pour l'instant.</p>}
        </div>
      )}
    </div>
  );
}
