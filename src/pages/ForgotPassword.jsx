import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

// Auto-service, réservé aux comptes e-mail — le mot de passe oublié d'un
// compte téléphone seul ne peut pas être réinitialisé par ce mécanisme
// (Supabase Auth n'a pas d'équivalent OTP SMS branché ici). Ces comptes
// restent dépannables via l'administrateur de la plateforme (PlatformAdmin.jsx,
// "Mot de passe" dans la fiche d'une école), qui lui génère le lien
// directement via l'API Admin.
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) {
      setError("L'e-mail est obligatoire.");
      return;
    }
    setSubmitting(true);
    setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
    });
    setSubmitting(false);

    // Volontairement le MÊME message que l'e-mail existe ou non — ne jamais
    // confirmer ni infirmer qu'une adresse est enregistrée dans l'appli.
    // Seule une vraie limite de débit (Supabase renvoie 429) mérite un
    // message différent, pour ne pas laisser croire à un envoi réussi.
    if (resetError && resetError.status === 429) {
      setError('Trop de tentatives. Réessaie dans quelques minutes.');
      return;
    }
    setSent(true);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--cream)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 20, color: '#fff', margin: '0 auto 16px' }}>EG</div>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Mot de passe oublié</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Reçois un lien pour choisir un nouveau mot de passe</p>
        </div>

        {sent ? (
          <div className="card-bold" style={{ padding: '26px 24px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6 }}>
              Si un compte existe avec l'adresse <strong>{email.trim()}</strong>, un e-mail vient d'être envoyé avec un lien
              pour choisir un nouveau mot de passe. Vérifie aussi tes spams.
            </p>
            <Link to="/connexion" style={{ color: 'var(--forest)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>Retour à la connexion</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card-bold" style={{ padding: '26px 24px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>E-mail</p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@ecole.bj"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line-strong)', fontSize: 16, marginBottom: 8, boxSizing: 'border-box', color: 'var(--ink)' }}
            />
            <p style={{ margin: '0 0 16px', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
              Ton compte est enregistré avec un numéro de téléphone plutôt qu'un e-mail ? Cette page ne peut pas t'aider —
              contacte l'administrateur de la plateforme.
            </p>
            {error && (
              <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              style={{ width: '100%', background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, padding: 13, borderRadius: 'var(--radius)', opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? 'Envoi…' : 'Envoyer le lien'}
            </button>
          </form>
        )}

        <p style={{ margin: '18px 0 0', fontSize: '12.5px', color: 'var(--muted)', textAlign: 'center' }}>
          <Link to="/connexion" style={{ color: 'var(--forest)', fontWeight: 600 }}>Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}
