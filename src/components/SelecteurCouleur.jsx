// Choix de couleur : 8 couleurs proposées, un choix libre, et le retour à la couleur de l'école.
// Utilisé par le bouton palette de la barre du haut et par la carte « Mon apparence » de Paramètres.
import { COULEURS_PROPOSEES, couleurLisible } from '../lib/theme.js';

export default function SelecteurCouleur({ couleur, couleurEcole, onChoisir }) {
  const active = (couleur || '').toLowerCase();
  const estProposee = COULEURS_PROPOSEES.some((c) => (couleurLisible(c.hex) || c.hex).toLowerCase() === active);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {COULEURS_PROPOSEES.map((c) => {
          const choisie = (couleurLisible(c.hex) || c.hex).toLowerCase() === active;
          return (
            <button key={c.hex} type="button" onClick={() => onChoisir(c.hex)} title={c.nom} aria-label={c.nom} aria-pressed={choisie}
              style={{ width: 42, height: 42, borderRadius: '50%', border: choisie ? '3px solid var(--ink)' : '3px solid transparent', outline: '1px solid var(--line-strong)', background: c.hex, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: 0, justifySelf: 'center' }}>
              {choisie && <i className="ti ti-check" style={{ fontSize: 16 }} aria-hidden="true"></i>}
            </button>
          );
        })}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', marginBottom: 12 }}>
        <input type="color" value={active && !estProposee ? active : '#0f4c3a'} onChange={(e) => onChoisir(e.target.value)}
          style={{ width: 42, height: 34, borderRadius: 9, border: '1px solid var(--line-strong)', padding: 2, cursor: 'pointer', background: 'var(--paper)' }} />
        Une autre couleur
      </label>

      <button type="button" onClick={() => onChoisir(null)} disabled={!couleur}
        style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600, fontSize: 13, cursor: couleur ? 'pointer' : 'default', opacity: couleur ? 1 : 0.55, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {couleurEcole && <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: '50%', background: couleurEcole, border: '1px solid var(--line-strong)' }}></span>}
        Couleur de l'école
      </button>
    </div>
  );
}
