import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';
import PasswordInput from '../components/PasswordInput.jsx';

// Création d'un compte administrateur de la plateforme — jamais liée à une
// école, contrairement à SignUp.jsx (qui crée une école + un fondateur
// dans la même action). Protégée par un code à usage unique généré par un
// administrateur déjà en place (PlatformAdmin.jsx → Administrateurs), sur
// le même principe que les codes d'accès parent. L'Edge Function
// platform-admin-signup vérifie le code côté serveur avant de créer quoi
// que ce soit — ce formulaire ne fait aucune hypothèse de sécurité, il
// relaie juste l'erreur si le code est invalide/expiré/déjà utilisé.
export default function AdminSignUp() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    setSubmitting(true);
    setError('');

    const { data, error: fnError } = await supabase.functions.invoke('platform-admin-signup', {
      body: { email: email.trim(), code: code.trim(), password },
    });
    if (fnError || data?.error) {
      let message = data?.error;
      if (!message && fnError?.context) {
        try { message = (await fnError.context.json())?.error; } catch { /* corps non lisible */ }
      }
      setSubmitting(false);
      setError(message || fnError?.message || 'Une erreur est survenue.');
      return;
    }

    // Le compte existe côté serveur mais ce navigateur n'a pas de session
    // pour lui — connexion normale avec les identifiants qui viennent
    // d'être choisis, comme n'importe quel autre compte.
    const { error: signInError } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (signInError) {
      // Compte bien créé, seule la connexion automatique a échoué (rare) —
      // ne jamais faire croire à un échec de création dans ce cas.
      navigate('/connexion');
      return;
    }
    navigate('/');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--cream)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--forest-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 20, color: '#fff', margin: '0 auto 16px' }}>EG</div>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Compte administrateur</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Réservé aux administrateurs de la plateforme, avec un code d'invitation</p>
        </div>

        <form onSubmit={handleSubmit} className="card-bold" style={{ padding: '26px 24px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>E-mail</p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="toi@ecoges.bj"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line-strong)', fontSize: 16, marginBottom: 14, boxSizing: 'border-box', color: 'var(--ink)' }}
          />

          <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Code d'invitation</p>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Reçu d'un administrateur"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line-strong)', fontSize: 16, marginBottom: 14, boxSizing: 'border-box', color: 'var(--ink)', letterSpacing: '0.08em' }}
          />

          <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Mot de passe</p>
          <PasswordInput
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line-strong)', fontSize: 16, marginBottom: 8, boxSizing: 'border-box', color: 'var(--ink)' }}
          />

          {error && (
            <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            style={{ width: '100%', background: 'var(--forest-dark)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, padding: 13, borderRadius: 'var(--radius)', marginTop: 6, opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Création…' : 'Créer le compte'}
          </button>
        </form>

        <p style={{ margin: '18px 0 0', fontSize: '12.5px', color: 'var(--muted)', textAlign: 'center' }}>
          <Link to="/connexion" style={{ color: 'var(--forest)', fontWeight: 600 }}>Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}
