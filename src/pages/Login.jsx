import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { formatPhoneE164 } from '../lib/utils.js';

export default function Login() {
  const { signIn } = useAuth();
  const [method, setMethod] = useState('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const value = method === 'email' ? identifier.trim() : formatPhoneE164(identifier);
    const { error: signInError } = await signIn(value, password);
    setSubmitting(false);
    if (signInError) {
      setError('Identifiant ou mot de passe incorrect.');
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--cream)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 20, color: '#fff', margin: '0 auto 16px' }}>EG</div>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>EcoGès</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Connexion à votre espace de gestion scolaire</p>
        </div>

        <form onSubmit={handleSubmit} className="card-bold" style={{ padding: '26px 24px' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[{ id: 'email', label: 'E-mail' }, { id: 'phone', label: 'Téléphone' }].map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => { setMethod(m.id); setIdentifier(''); }}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${method === m.id ? 'var(--forest)' : 'var(--line-strong)'}`,
                  background: method === m.id ? 'var(--forest)' : 'var(--paper)',
                  color: method === m.id ? '#fff' : 'var(--ink)',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {method === 'email' ? 'E-mail' : 'Téléphone'}
          </p>
          <input
            type={method === 'email' ? 'email' : 'tel'}
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={method === 'email' ? 'vous@ecole.bj' : '97 00 00 00'}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line-strong)', fontSize: 16, marginBottom: 16, boxSizing: 'border-box', color: 'var(--ink)' }}
          />
          <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Mot de passe</p>
          <PasswordInput
            required
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
            style={{ width: '100%', background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, padding: 13, borderRadius: 'var(--radius)', marginTop: 6, opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Connexion…' : 'Continuer'}
          </button>
        </form>

        <p style={{ margin: '18px 0 0', fontSize: '12.5px', color: 'var(--muted)', textAlign: 'center' }}>
          Nouvelle école ? <Link to="/inscription" style={{ color: 'var(--forest)', fontWeight: 600 }}>Créer une école</Link>
        </p>
      </div>
    </div>
  );
}
