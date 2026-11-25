// Carte « Mon apparence » de Paramètres : mode clair/sombre et couleur de l'application, propres à chaque utilisateur
// (les autres gardent les leurs). Les mêmes réglages existent dans la barre du haut (lune et palette).
import { useApparence } from '../lib/apparence.js';
import SelecteurCouleur from './SelecteurCouleur.jsx';

const bouton = (actif) => ({
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 13,
  border: actif ? '2px solid var(--forest)' : '1px solid var(--line-strong)', background: actif ? 'var(--forest-light)' : 'var(--paper)', color: actif ? 'var(--forest-dark-text)' : 'var(--ink)',
});

export default function ApparenceCard() {
  const apparence = useApparence();
  if (!apparence) return null;
  const { theme, choisirMode, couleur, couleurEcole, choisirCouleur } = apparence;
  return (
    <div className="card-bold" style={{ padding: '16px 20px' }}>
      <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 600 }}>Mon apparence</p>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
        Ces choix ne concernent que toi : les autres utilisateurs gardent les leurs.
      </p>

      <p style={{ margin: '0 0 8px', fontSize: '11.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Mode</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <button type="button" onClick={() => choisirMode('light')} aria-pressed={theme === 'light'} style={bouton(theme === 'light')}>
          <i className="ti ti-sun" style={{ fontSize: 16 }} aria-hidden="true"></i>Clair
        </button>
        <button type="button" onClick={() => choisirMode('dark')} aria-pressed={theme === 'dark'} style={bouton(theme === 'dark')}>
          <i className="ti ti-moon" style={{ fontSize: 16 }} aria-hidden="true"></i>Sombre
        </button>
      </div>

      <p style={{ margin: '0 0 10px', fontSize: '11.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Couleur</p>
      <SelecteurCouleur couleur={couleur} couleurEcole={couleurEcole} onChoisir={choisirCouleur} />
    </div>
  );
}
