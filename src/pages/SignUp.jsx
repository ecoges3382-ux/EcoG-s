import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import PasswordInput from '../components/PasswordInput.jsx';
import PhoneInput, { COUNTRIES, composePhone } from '../components/PhoneInput.jsx';

export default function SignUp() {
  const [method, setMethod] = useState('email');
  const [schoolName, setSchoolName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneDial, setPhoneDial] = useState(COUNTRIES[0].dial);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  // Après le code SMS saisi et vérifié :
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resending, setResending] = useState(false);

  const phoneValue = composePhone(phoneDial, phoneLocal);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }

    if (method === 'phone' && !phoneValue) {
      setError('Le numéro de téléphone est obligatoire.');
      return;
    }

    setSubmitting(true);
    const { error: signUpError } = await supabase.auth.signUp({
      ...(method === 'email' ? { email: email.trim() } : { phone: phoneValue }),
      password,
      options: {
        data: { school_name: schoolName.trim(), full_name: fullName.trim() },
      },
    });
    setSubmitting(false);
    if (signUpError) {
      setError(
        signUpError.message === 'User already registered'
          ? `Un compte existe déjà avec cet ${method === 'email' ? 'e-mail' : 'numéro'}.`
          : signUpError.message,
      );
      return;
    }
    // E-mail : aucune session n'est ouverte ici — l'école et le profil
    // "fondateur" ne sont créés qu'après le clic sur le lien de
    // confirmation (voir AuthProvider). Téléphone : il faut d'abord
    // vérifier le code reçu par SMS (écran suivant) avant que la session
    // ne s'ouvre et ne déclenche la même création automatique.
    setSent(true);
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setOtpError('');
    if (!otpCode.trim()) {
      setOtpError('Saisis le code reçu par SMS.');
      return;
    }
    setVerifying(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: phoneValue,
      token: otpCode.trim(),
      type: 'sms',
    });
    setVerifying(false);
    if (verifyError) {
      setOtpError('Code incorrect ou expiré. Réessaie.');
      return;
    }
    // Session ouverte : RedirectIfAuthed (App.jsx) redirige automatiquement,
    // puis AuthProvider crée l'école + le profil fondateur à partir des
    // métadonnées posées au signUp — même mécanisme que pour l'e-mail.
  }

  async function handleResendOtp() {
    setResending(true);
    setOtpError('');
    const { error: resendError } = await supabase.auth.resend({ type: 'sms', phone: phoneValue });
    setResending(false);
    if (resendError) setOtpError(resendError.message);
  }

  if (sent && method === 'email') {
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

  if (sent && method === 'phone') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="card-bold" style={{ padding: '26px 24px', maxWidth: 400, width: '100%' }}>
          <p style={{ fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, margin: '0 0 10px', textAlign: 'center' }}>Vérifie ton téléphone</p>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, margin: '0 0 18px', textAlign: 'center' }}>
            Un code a été envoyé par SMS au <strong>{phoneValue}</strong>. Saisis-le pour activer ton compte et créer ton école.
          </p>
          <form onSubmit={handleVerifyOtp}>
            <p style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Code reçu par SMS</p>
            <input
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line-strong)', fontSize: 18, letterSpacing: '0.1em', textAlign: 'center', marginBottom: 14, boxSizing: 'border-box', color: 'var(--ink)' }}
            />
            {otpError && <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>{otpError}</p>}
            <button
              type="submit"
              disabled={verifying}
              style={{ width: '100%', background: 'var(--forest)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, padding: 13, borderRadius: 'var(--radius)', opacity: verifying ? 0.7 : 1 }}
            >
              {verifying ? 'Vérification…' : 'Vérifier'}
            </button>
          </form>
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resending}
            style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', color: 'var(--forest)', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer' }}
          >
            {resending ? 'Envoi…' : 'Renvoyer le code'}
          </button>
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

          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[{ id: 'email', label: 'E-mail' }, { id: 'phone', label: 'Téléphone' }].map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => { setMethod(m.id); setEmail(''); setPhoneLocal(''); }}
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

          {method === 'email' ? (
            <Field label="E-mail">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            </Field>
          ) : (
            <Field label="Téléphone">
              <PhoneInput dial={phoneDial} local={phoneLocal} onDialChange={setPhoneDial} onLocalChange={setPhoneLocal} style={{ marginBottom: 16 }} />
            </Field>
          )}

          <Field label="Mot de passe" last>
            <PasswordInput required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />
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
