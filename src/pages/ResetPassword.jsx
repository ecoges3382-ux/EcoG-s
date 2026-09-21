import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';
import PasswordInput from '../components/PasswordInput.jsx';

// Page atteinte en cliquant le lien reçu par e-mail (ForgotPassword.jsx) —
// Supabase pose alors automatiquement une session "recovery" (gérée par
// AuthProvider, comme toute session normale) avant même que ce composant ne
// s'affiche. C'est pour ça que cette route N'EST PAS enveloppée par
// RedirectIfAuthed dans App.jsx, contrairement à /connexion et /inscription
// : cette session "déjà connectée" est précisément ce qui permet à
// updateUser() de fonctionner ici, la rediriger ailleurs casserait le flux.
//
// Fonctionne aussi, accessoirement, pour un compte déjà connecté
// normalement qui veut juste changer son mot de passe — même formulaire,
// même appel, aucune raison de le distinguer du cas "lien reçu par e-mail".
export default function ResetPassword() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--cream)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 20, color: '#fff', margin: '0 auto 16px' }}>EG</div>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Nouveau mot de passe</p>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>Chargement…</p>
        ) : done ? (
          <div className="card-bold" style={{ padding: '26px 24px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--ink)' }}>Mot de passe mis à jour.</p>
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{ width: '100%', background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, padding: 13, borderRadius: 'var(--radius)' }}
            >
              Continuer
            </button>
          </div>
        ) : !session ? (
          <div className="card-bold" style={{ padding: '26px 24px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--danger)', fontWeight: 600 }}>
              Ce lien de réinitialisation est invalide ou a expiré.
            </p>
            <Link to="/mot-de-passe-oublie" style={{ color: 'var(--forest)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>Redemander un lien</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card-bold" style={{ padding: '26px 24px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Nouveau mot de passe</p>
            <PasswordInput
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line-strong)', fontSize: 16, marginBottom: 14, boxSizing: 'border-box', color: 'var(--ink)' }}
            />
            <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Confirmer le mot de passe</p>
            <PasswordInput
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line-strong)', fontSize: 16, marginBottom: 8, boxSizing: 'border-box', color: 'var(--ink)' }}
            />
            {error && (
              <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              style={{ width: '100%', background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, padding: 13, borderRadius: 'var(--radius)', marginTop: 6, opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
