// Réglage « Animations » : Automatique, Complètes ou Réduites. Propre à l'appareil. Voir src/lib/animations.js.
import { useState } from 'react';
import { choisirReglage, lireReglage, useModeAnimations } from '../lib/animations.js';

const OPTIONS = [
  { id: 'auto', titre: 'Automatique', texte: "Complètes, sauf si l'appareil est peu puissant ou demande moins de mouvement." },
  { id: 'complet', titre: 'Complètes', texte: 'Chiffres qui roulent, entrées en cascade, anneaux qui se remplissent.' },
  { id: 'reduit', titre: 'Réduites', texte: "Aucun mouvement. L'application est plus sobre et plus légère." },
];

export default function AnimationsCard() {
  const [reglage, setReglage] = useState(() => lireReglage());
  const mode = useModeAnimations();
  function choisir(id) { setReglage(id); choisirReglage(id); }
  return (
    <div className="card-bold" style={{ padding: '16px 20px' }}>
      <p style={{ margin: '0 0 3px', fontSize: '13.5px', fontWeight: 600 }}>Animations</p>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
        Effets de mouvement de l'application. Ce réglage est propre à cet appareil. Actuellement : <strong>{mode === 'reduit' ? 'réduites' : 'complètes'}</strong>.
      </p>
      <div role="radiogroup" aria-label="Animations" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {OPTIONS.map((o) => {
          const actif = reglage === o.id;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={actif} onClick={() => choisir(o.id)}
              style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 12, border: `1px solid ${actif ? 'var(--forest)' : 'var(--line-strong)'}`, background: actif ? 'var(--forest-light)' : 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: actif ? 'var(--forest-dark-text)' : 'var(--ink)' }}>{o.titre}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{o.texte}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
