import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { initials } from '../lib/utils.js';

export default function ParentDetail() {
  const { id } = useParams();
  const [access, setAccess] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('parent_access')
      .select('*, parent_access_students ( students ( id, full_name, niveau ) )')
      .eq('id', id)
      .single()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) setError(fetchError.message);
        else setAccess(data);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!access) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const children = (access.parent_access_students || []).map((row) => row.students).filter(Boolean);

  function copyLink() {
    const url = `${window.location.origin}/parent-access?code=${access.code}`;
    navigator.clipboard.writeText(url).then(() => setCopied(true));
  }

  return (
    <div>
      <Link to="/parents" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--forest)', fontWeight: 600, fontSize: 13, marginBottom: 18, textDecoration: 'none', width: 'fit-content' }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 15 }} aria-hidden="true"></i>Retour aux parents
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
        <div style={{ width: 58, height: 58, borderRadius: 14, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, color: 'var(--clay-dark)' }}>
          {initials(access.full_name)}
        </div>
        <div>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 600 }}>{access.full_name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>{access.phone || 'Pas de numéro enregistré'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 640, marginBottom: 20 }}>
        <div className="card-bold" style={{ padding: '18px 20px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Enfants dans l'école</p>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 700 }}>{children.length}</p>
        </div>
        <div className="card-bold" style={{ padding: '18px 20px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Code d'accès</p>
          <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: '0.06em' }}>{access.code}</p>
        </div>
      </div>

      <p style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Enfants</p>
      <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 640, marginBottom: 20 }}>
        {children.map((c, i) => (
          <Link
            key={c.id}
            to={`/eleves/${c.id}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: i < children.length - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--forest-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 11.5, fontWeight: 600, color: 'var(--forest)', flexShrink: 0 }}>
                {initials(c.full_name)}
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{c.full_name}</p>
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600 }}>{c.niveau}</span>
          </Link>
        ))}
        {children.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Aucun enfant rattaché.</p>}
      </div>

      <button
        type="button"
        onClick={copyLink}
        style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: '13.5px' }}
      >
        {copied ? 'Lien copié !' : 'Copier le lien à envoyer'}
      </button>
    </div>
  );
}
