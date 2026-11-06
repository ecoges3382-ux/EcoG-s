import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { generateAccessCode, copyText } from '../../lib/utils.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useToast } from '../Toast.jsx';
import { useConfirm } from '../ConfirmDialog.jsx';
import Dropdown from '../Dropdown.jsx';
import { SkeletonRow } from '../Skeleton.jsx';
import { PLAN_LABELS, PLAN_OPTIONS } from './PlatformAdminUI.jsx';

export default function SchoolInvitesTab({ onChanged }) {
  const { profile } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [invites, setInvites] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newInvite, setNewInvite] = useState(null);
  const [revokingId, setRevokingId] = useState(null);
  const [planDraft, setPlanDraft] = useState('essentiel');

  async function reload() {
    setError('');
    const { data, error: loadError } = await supabase
      .from('school_signup_invites')
      .select('id, code, created_at, expires_at, used_at, used_by, plan')
      .order('created_at', { ascending: false });
    if (loadError) { setError(loadError.message); return; }
    setInvites(data || []);
  }

  useEffect(() => { reload(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    setNewInvite(null);
    const code = generateAccessCode(12);
    const { error: insertError } = await supabase.from('school_signup_invites').insert({ code, created_by: profile?.id, plan: planDraft });
    setCreating(false);
    if (insertError) { setError(insertError.message); return; }
    setNewInvite({ code, plan: planDraft });
    await reload();
    onChanged?.();
  }

  async function handleRevoke(invite) {
    if (!(await confirm('Révoquer ce code ? Il ne pourra plus créer de compte.', { confirmLabel: 'Révoquer' }))) return;
    setRevokingId(invite.id);
    setError('');
    const { error: deleteError } = await supabase.from('school_signup_invites').delete().eq('id', invite.id).is('used_at', null);
    setRevokingId(null);
    if (deleteError) { setError(deleteError.message); return; }
    await reload();
    onChanged?.();
  }

  async function copyWithToast(text) {
    if (await copyText(text)) showToast('Copié');
    else showToast('Copie impossible', 'error');
  }

  return (
    <div>
      {error && <p style={{ color: '#ffb4a8', marginBottom: 14, fontWeight: 600, fontSize: 13.5 }}>{error}</p>}
      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#fff' }}>Invitations pour créer une école</p>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
        Chaque code est individuel, utilisable une seule fois et valable 7 jours. Choisis le plan commercial
        correspondant à l'école invitée. Communique-le directement à la personne.
      </p>
      {newInvite && (
        <div style={{ padding: '14px 16px', background: 'var(--gold-light)', border: '1px solid var(--gold)', borderRadius: 12, marginBottom: 14 }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--clay-dark)' }}>
            Code à transmettre — Plan : {PLAN_LABELS[newInvite.plan]?.label || newInvite.plan}
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink)' }}>{newInvite.code}</p>
            <button type="button" onClick={() => copyWithToast(newInvite.code)} style={{ padding: '6px 11px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: 11.5, cursor: 'pointer' }}>Copier</button>
          </div>
        </div>
      )}
      <form onSubmit={handleCreate} style={{ padding: '16px 18px', background: 'var(--paper)', borderRadius: 12, marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
          Plan commercial de l'école invitée
        </label>
        <Dropdown value={planDraft} onChange={setPlanDraft} options={PLAN_OPTIONS} style={{ marginBottom: 12, maxWidth: 400 }} />
        <button type="submit" disabled={creating} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1 }}>
          {creating ? 'Génération…' : 'Générer un code individuel'}
        </button>
      </form>
      {!invites && <div style={{ background: 'var(--paper)', borderRadius: 12 }}><SkeletonRow count={3} avatar={false} /></div>}
      {invites?.length === 0 && (
        <div style={{ background: 'var(--paper)', borderRadius: 12, padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 6px', fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Aucun code pour l'instant</p>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>Génère un code pour inviter une nouvelle école à s'inscrire.</p>
        </div>
      )}
      {invites && invites.length > 0 && (
        <div style={{ background: 'var(--paper)', borderRadius: 12, overflow: 'hidden' }}>
          {invites.map((inv, i) => {
            const expired = new Date(inv.expires_at) < new Date();
            const status = inv.used_at ? 'Utilisé' : expired ? 'Expiré' : 'Disponible';
            const pl = PLAN_LABELS[inv.plan] || PLAN_LABELS.decouverte;
            return (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i === invites.length - 1 ? 'none' : '1px solid var(--line)', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, fontFamily: 'var(--serif)', letterSpacing: '0.06em' }}>
                    {inv.code}
                    <span style={{ marginLeft: 10, fontFamily: 'inherit', letterSpacing: 0, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: pl.bg, color: pl.fg }}>{pl.label}</span>
                    <span style={{ marginLeft: 8, fontFamily: 'inherit', letterSpacing: 0, fontWeight: 400, color: 'var(--muted)' }}>· {status}</span>
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>Créé le {new Date(inv.created_at).toLocaleDateString('fr-FR')} · expire le {new Date(inv.expires_at).toLocaleDateString('fr-FR')}</p>
                </div>
                {!inv.used_at && !expired && <button type="button" onClick={() => handleRevoke(inv)} disabled={revokingId === inv.id} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Révoquer</button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
