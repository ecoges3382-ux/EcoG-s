import { useState } from 'react';

// Champ mot de passe avec bouton œil (afficher/masquer), partagé par tous
// les formulaires de connexion/création de compte de l'appli.
export default function PasswordInput({ style = {}, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative', width: style.width, marginBottom: style.marginBottom }}>
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        style={{ ...style, width: '100%', marginBottom: 0, paddingRight: 40 }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
          padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <i className={`ti ${visible ? 'ti-eye-off' : 'ti-eye'}`} style={{ fontSize: 17 }} aria-hidden="true"></i>
      </button>
    </div>
  );
}
