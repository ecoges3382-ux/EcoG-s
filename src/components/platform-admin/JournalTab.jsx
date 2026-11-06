import { useState, useEffect } from 'react';
import { SkeletonRow } from '../Skeleton.jsx';
import { callPlatformAdmin, ACTION_LABELS } from './PlatformAdminUI.jsx';

export default function JournalTab() {
  const [actions, setActions] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    callPlatformAdmin({ action: 'list_actions' }).then(({ data, error: err }) => {
      if (err) { setError(err); return; }
      setActions(data.actions);
    });
  }, []);

  if (error) return <p style={{ color: '#ffb4a8', fontWeight: 600, fontSize: 13.5 }}>{error}</p>;
  if (!actions) return <div style={{ background: 'var(--paper)', borderRadius: 12 }}><SkeletonRow count={5} avatar={false} /></div>;

  return (
    <div style={{ background: 'var(--paper)', borderRadius: 12, overflow: 'hidden' }}>
      {actions.map((a, i) => (
        <div key={a.id} style={{ padding: '12px 16px', borderBottom: i === actions.length - 1 ? 'none' : '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{ACTION_LABELS[a.action] || a.action}</p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)' }}>{new Date(a.created_at).toLocaleString('fr-FR')}</p>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            {a.admin_email} {a.school_name ? `· ${a.school_name}` : ''} {a.target_label ? `· ${a.target_label}` : ''}
          </p>
          {a.details && <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>{a.details}</p>}
        </div>
      ))}
      {actions.length === 0 && <p style={{ padding: 20, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>Aucune action enregistrée pour l'instant.</p>}
    </div>
  );
}
