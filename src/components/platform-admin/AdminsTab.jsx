import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { generateAccessCode, copyText } from '../../lib/utils.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useToast } from '../Toast.jsx';
import { useConfirm } from '../ConfirmDialog.jsx';
import { SkeletonRow } from '../Skeleton.jsx';
import { callPlatformAdmin } from './PlatformAdminUI.jsx';

export default function AdminsTab({ onChanged }) {
  const showToast = useToast();
  const confirm = useConfirm();
  const { profile } = useAuth();
  const [admins, setAdmins] = useState(null);
  const [invites, setInvites] = useState(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [newInvite, setNewInvite] = useState(null);
  const [revokingId, setRevokingId] = useState(null);

  async function reload() {
    setError('');
    const { data, error: err } = await callPlatformAdmin({ action: 'list_admins' });
    if (err) { setError(err); return; }
    setAdmins(data.admins);
  }

  async function reloadInvites() {
    const { data, error: err } = await supabase
      .from('platform_admin_invites')
      .select('id, email, code, used_at, expires_at, created_at')
      .is('used_at', null)
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); return; }
    setInvites(data || []);
  }

  useEffect(() => { reload(); reloadInvites(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError('');
    const { error: err } = await callPlatformAdmin({ action: 'add_admin', email: email.trim() });
    setSubmitting(false);
    if (err) { setError(err); return; }
    setEmail('');
    showToast('Enregistré');
    reload();
    onChanged?.();
  }

  async function handleRemove(a) {
    if (!(await confirm(`Retirer ${a.email || a.user_id} des administrateurs de la plateforme ?`, { confirmLabel: 'Retirer' }))) return;
    setRemovingId(a.user_id);
    setError('');
    const { error: err } = await callPlatformAdmin({ action: 'remove_admin', userId: a.user_id });
    setRemovingId(null);
    if (err) { setError(err); return; }
    reload();
    onChanged?.();
  }

  async function handleCreateInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setCreatingInvite(true);
    setError('');
    setNewInvite(null);
    const code = generateAccessCode();
    const cleanEmail = inviteEmail.trim().toLowerCase();
    const { error: insertError } = await supabase.from('platform_admin_invites').insert({ email: cleanEmail, code, created_by: profile?.id });
    setCreatingInvite(false);
    if (insertError) { setError(insertError.message); return; }
    setNewInvite({ email: cleanEmail, code });
    setInviteEmail('');
    reloadInvites();
  }

  async function handleRevoke(invite) {
    if (!(await confirm(`Révoquer l'invitation pour ${invite.email} ?`, { confirmLabel: 'Révoquer' }))) return;
    setRevokingId(invite.id);
    setError('');
    const { error: deleteError } = await supabase.from('platform_admin_invites').delete().eq('id', invite.id);
    setRevokingId(null);
    if (deleteError) { setError(deleteError.message); return; }
    reloadInvites();
  }

  async function copyWithToast(text) {
    if (await copyText(text)) showToast('Copié');
    else showToast('Copie impossible', 'error');
  }

  return (
    <div>
      {error && <p style={{ color: '#ffb4a8', marginBottom: 14, fontWeight: 600, fontSize: 13.5 }}>{error}</p>}

      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#fff' }}>Administrateurs actuels</p>
      {!admins && <div style={{ background: 'var(--paper)', borderRadius: 12 }}><SkeletonRow count={3} avatar={false} /></div>}
      {admins && (
        <div style={{ background: 'var(--paper)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
          {admins.map((a, i) => (
            <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i === admins.length - 1 ? 'none' : '1px solid var(--line)' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{a.email || a.user_id}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>Depuis le {new Date(a.created_at).toLocaleDateString('fr-FR')}</p>
              </div>
              <button type="button" onClick={() => handleRemove(a)} disabled={removingId === a.user_id || admins.length <= 1} title={admins.length <= 1 ? 'Impossible de retirer le dernier administrateur' : undefined} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', fontWeight: 600, fontSize: 12.5, cursor: admins.length <= 1 ? 'not-allowed' : 'pointer', opacity: admins.length <= 1 ? 0.4 : 1 }}>Retirer</button>
            </div>
          ))}
          {admins.length === 0 && <p style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>Aucun administrateur.</p>}
        </div>
      )}

      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#fff' }}>Inviter un nouvel administrateur</p>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
        Génère un code à usage unique, à communiquer toi-même à la personne. Elle crée son compte
        sur l'écran "Créer un compte administrateur" avec ce code.
      </p>

      {newInvite && (
        <div style={{ padding: '14px 16px', background: 'var(--gold-light)', border: '1px solid var(--gold)', borderRadius: 12, marginBottom: 14 }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--clay-dark)' }}>
            Code pour {newInvite.email} — à communiquer, ne le laisse pas affiché à l'écran.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink)' }}>{newInvite.code}</p>
            <button type="button" onClick={() => copyWithToast(newInvite.code)} style={{ padding: '6px 11px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: 11.5, cursor: 'pointer' }}>Copier</button>
          </div>
        </div>
      )}

      <form onSubmit={handleCreateInvite} style={{ padding: '16px 18px', background: 'var(--paper)', borderRadius: 12, display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="E-mail de la personne à inviter" style={{ flex: '1 1 220px', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13, color: 'var(--ink)' }} />
        <button type="submit" disabled={creatingInvite} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: creatingInvite ? 'not-allowed' : 'pointer', opacity: creatingInvite ? 0.7 : 1 }}>
          {creatingInvite ? 'Génération…' : 'Générer un code'}
        </button>
      </form>

      {invites && invites.length > 0 && (
        <div style={{ background: 'var(--paper)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
          {invites.map((inv, i) => {
            const expired = new Date(inv.expires_at) < new Date();
            return (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i === invites.length - 1 ? 'none' : '1px solid var(--line)', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{inv.email} <span style={{ fontWeight: 400, color: 'var(--muted)', fontFamily: 'var(--serif)', letterSpacing: '0.06em' }}>· {inv.code}</span></p>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: expired ? 'var(--danger)' : 'var(--muted)' }}>
                    {expired ? 'Expirée' : `Expire le ${new Date(inv.expires_at).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
                <button type="button" onClick={() => handleRevoke(inv)} disabled={revokingId === inv.id} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Révoquer</button>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#fff' }}>Promouvoir un compte existant</p>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
        Pour donner le statut d'administrateur à un compte qui a déjà un profil d'école (ex. un fondateur) — sans passer par une invitation.
      </p>
      <form onSubmit={handleAdd} style={{ padding: '16px 18px', background: 'var(--paper)', borderRadius: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail d'un compte EcoGès existant" style={{ flex: '1 1 220px', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 13, color: 'var(--ink)' }} />
        <button type="submit" disabled={submitting} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
          {submitting ? 'Ajout…' : 'Ajouter'}
        </button>
      </form>
    </div>
  );
}
