import { useState } from 'react';

// SVG en dur plutôt que la police d'icônes (ti-eye) : ne dépend d'aucun
// chargement externe, s'affiche toujours même si la police d'icônes tarde
// ou échoue à charger.
function EyeIcon({ open }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {open ? (
        <>
          <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
          <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
        </>
      ) : (
        <>
          <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
          <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
          <path d="M3 3l18 18" />
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
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}
