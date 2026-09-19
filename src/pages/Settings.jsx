import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';

export default function Settings() {
  const { profile, refreshProfile } = useAuth();
  const school = profile.schools;
  const isFondateur = profile.role === 'fondateur';

  const [name, setName] = useState(school?.name || '');
  const [color, setColor] = useState(school?.color || '#0F4C3A');
  const [logoUrl, setLogoUrl] = useState(school?.logo_url || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Le nom de l'école ne peut pas être vide.");
      return;
    }
    setSaving(true);
    setError('');
    setSaved(false);
    const { error: updateError } = await supabase
      .from('schools')
      .update({ name: name.trim(), color, logo_url: logoUrl.trim() || null })
      .eq('id', profile.school_id);
    setSaving(false);
    if (updateError) {
      setError(isFondateur ? updateError.message : "Seul le fondateur peut modifier les paramètres de l'école.");
      return;
    }
    await refreshProfile();
    setSaved(true);
  }

  return (
    <div>
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Paramètres</p>

      {!isFondateur && (
        <div className="card-bold" style={{ padding: '16px 20px', marginBottom: 22, background: 'var(--gold-light)', borderColor: 'var(--gold)', maxWidth: 520 }}>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--clay-dark)', lineHeight: 1.6 }}>
            Seul le fondateur peut modifier ces réglages. Tu peux les consulter mais pas les enregistrer.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card-bold" style={{ padding: 22, maxWidth: 520 }}>
        <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Identité de l'établissement</p>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Nom de l'école</label>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={!isFondateur} style={inputStyle} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Couleur principale de l'application</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} disabled={!isFondateur} style={{ width: 48, height: 40, borderRadius: 9, border: '1px solid var(--line-strong)', padding: 2, cursor: isFondateur ? 'pointer' : 'default' }} />
            <input value={color} onChange={(e) => setColor(e.target.value)} disabled={!isFondateur} style={{ ...inputStyle, flex: 1 }} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>URL du logo (facultatif)</label>
          <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} disabled={!isFondateur} placeholder="https://…" style={inputStyle} />
          <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: 'var(--muted)' }}>Sans logo, les initiales de l'école restent affichées.</p>
        </div>

        {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}
        {saved && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--success)', fontWeight: 600 }}>Enregistré.</p>}

        {isFondateur && (
          <button type="submit" disabled={saving} style={{ width: '100%', background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, padding: 13, borderRadius: 'var(--radius)', opacity: saving ? 0.7 : 1 }}>
            <i className="ti ti-check" style={{ fontSize: 16, verticalAlign: '-3px', marginRight: 6 }} aria-hidden="true"></i>
            {saving ? 'Enregistrement…' : 'Enregistrer et appliquer'}
          </button>
        )}
      </form>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)' };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
