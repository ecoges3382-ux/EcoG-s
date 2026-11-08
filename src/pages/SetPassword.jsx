import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import PasswordInput from '../components/PasswordInput.jsx';

export default function SetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    setError('');

    // On met à jour le mot de passe de l'utilisateur actuellement connecté (via le lien magique)
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // On l'envoie vers son tableau de bord
    navigate('/'); 
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--cream)' }}>
      <div className="card-bold" style={{ maxWidth: 420, width: '100%', padding: 30 }}>
        <p style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Bienvenue sur EcoGès !</p>
        <p style={{ margin: '0 0 24px', fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5 }}>
          Votre compte a bien été créé. Pour des raisons de sécurité, veuillez choisir votre mot de passe personnel.
        </p>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Nouveau mot de passe</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} style={inputStyle} />

          <label style={labelStyle}>Confirmer le mot de passe</label>
          <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} style={inputStyle} />

          {error && <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, fontSize: 14, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Enregistrement…' : 'Enregistrer mon mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 14 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
