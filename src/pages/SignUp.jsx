import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function SignUp() {
  const [schoolName, setSchoolName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    setSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { school_name: schoolName.trim(), full_name: fullName.trim() },
      },
    });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.message === 'User already registered'
        ? 'Un compte existe déjà avec cet e-mail.'
        : signUpError.message);
      return;
    }
    // Avec la confirmation d'e-mail activée, aucune session n'est ouverte
    // ici : l'école et le profil "fondateur" ne sont créés qu'après le
    // clic sur le lien de confirmation (voir AuthProvider).
    setSent(true);
    void data;
  }

  if (sent) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="card-bold" style={{ padding: '26px 24px', maxWidth: 400, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, margin: '0 0 10px' }}>Vérifiez votre boîte mail</p>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            Un e-mail de confirmation a été envoyé à <strong>{email}</strong>.
            Cliquez sur le lien qu'il contient pour activer votre compte et
            créer votre école.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--cream)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 20, color: '#fff', margin: '0 auto 16px' }}>EG</div>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Créer une école</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Votre compte fondateur et l'espace de votre école</p>
        </div>

        <form onSubmit={handleSubmit} className="card-bold" style={{ padding: '26px 24px' }}>
          <Field label="Nom de l'école">
            <input required value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="ex. Complexe Scolaire Mèdécon" style={inputStyle} />
          </Field>
          <Field label="Votre nom">
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="E-mail">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Mot de passe" last>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />
          </Field>

          {error && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            style={{ width: '100%', background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, padding: 13, borderRadius: 'var(--radius)', marginTop: 6, opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Création…' : 'Créer mon école'}
          </button>
        </form>

        <p style={{ margin: '18px 0 0', fontSize: '12.5px', color: 'var(--muted)', textAlign: 'center' }}>
          Déjà inscrit ? <Link to="/connexion" style={{ color: 'var(--forest)', fontWeight: 600 }}>Se connecter</Link>
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line-strong)',
  fontSize: 16, marginBottom: 16, boxSizing: 'border-box', color: 'var(--ink)',
};

function Field({ label, children, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 0 }}>
      <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</p>
      {children}
    </div>
  );
}
