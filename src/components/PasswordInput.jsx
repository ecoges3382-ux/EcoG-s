import { useState } from 'react';

// SVG en dur pour garantir l'affichage.
function EyeIcon({ visible }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {!visible ? (
        // 1. Mot de passe CACHÉ : on affiche un œil OUVERT (pour dire "clique pour voir")
        <>
          <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
          <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
        </>
      ) : (
        // 2. Mot de passe VISIBLE : on affiche un œil FERMÉ (paupière avec cils)
        <>
          <path d="M3 12c2.4 4 5.4 6 9 6c3.6 0 6.6 -2 9 -6" />
          <path d="M9 17l-1 2" />
          <path d="M15 17l1 2" />
          <path d="M12 18v2" />
        </>
      )}
    </svg>
  );
}

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
          padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0,
        }}
      >
        <EyeIcon visible={visible} />
      </button>
    </div>
  );
}
