// Indicatifs les plus pertinents pour le contexte de déploiement de
// l'appli (Bénin et pays voisins), plus quelques indicatifs courants.
export const COUNTRIES = [
  { dial: '229', flag: '🇧🇯', name: 'Bénin' },
  { dial: '228', flag: '🇹🇬', name: 'Togo' },
  { dial: '225', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { dial: '221', flag: '🇸🇳', name: 'Sénégal' },
  { dial: '227', flag: '🇳🇪', name: 'Niger' },
  { dial: '226', flag: '🇧🇫', name: 'Burkina Faso' },
  { dial: '223', flag: '🇲🇱', name: 'Mali' },
  { dial: '234', flag: '🇳🇬', name: 'Nigeria' },
  { dial: '233', flag: '🇬🇭', name: 'Ghana' },
  { dial: '33', flag: '🇫🇷', name: 'France' },
];

// Sépare un numéro E.164 déjà stocké ("+22997000000") en indicatif +
// numéro local, pour préremplir le sélecteur pays et le champ numéro.
export function decomposePhone(e164) {
  if (!e164) return { dial: COUNTRIES[0].dial, local: '' };
  const match = COUNTRIES.find((c) => e164.startsWith(`+${c.dial}`));
  if (match) return { dial: match.dial, local: e164.slice(match.dial.length + 1) };
  return { dial: COUNTRIES[0].dial, local: e164.replace(/^\+/, '') };
}

// Recombine indicatif + numéro local (saisi librement, espaces/tirets
// tolérés, zéro de tête retiré) en E.164. Renvoie '' si rien n'est saisi.
export function composePhone(dial, local) {
  const digits = String(local || '').replace(/\D/g, '').replace(/^0+/, '');
  return digits ? `+${dial}${digits}` : '';
}

// Champ téléphone à deux parties : sélecteur de pays (drapeau + indicatif)
// et numéro local, pour que l'appli sache toujours dans quel format
// interpréter ce qui est saisi plutôt que de le deviner.
export default function PhoneInput({ dial, local, onDialChange, onLocalChange, style }) {
  return (
    <div style={{ display: 'flex', gap: 8, ...style }}>
      <select
        value={dial}
        onChange={(e) => onDialChange(e.target.value)}
        style={{ padding: '10px 6px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, color: 'var(--ink)', flexShrink: 0, width: 100 }}
      >
        {COUNTRIES.map((c) => (
          <option key={c.dial} value={c.dial}>{c.flag} +{c.dial}</option>
        ))}
      </select>
      <input
        type="tel"
        value={local}
        onChange={(e) => onLocalChange(e.target.value)}
        placeholder="97 00 00 00"
        style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)' }}
      />
    </div>
  );
}
