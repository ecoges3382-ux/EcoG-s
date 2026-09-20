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
// tolérés) en E.164. Renvoie '' si rien n'est saisi.
export function composePhone(dial, local) {
  const digits = String(local || '').replace(/\D/g, '');
  if (!digits) return '';

  // Réforme du 30 novembre 2024 (ARCEP Bénin) : les numéros béninois sont
  // passés à 10 chiffres, avec un « 01 » qui fait désormais partie
  // intégrante du numéro national — ce n'est plus un simple préfixe de
  // tronc à retirer pour l'international (+229 01 XX XX XX XX). On garde
  // donc le numéro tel quel, en ajoutant le « 01 » si on reconnaît encore
  // un ancien numéro à 8 chiffres saisi par habitude.
  if (dial === '229') {
    const withPrefix = digits.length === 8 ? `01${digits}` : digits;
    return `+${dial}${withPrefix}`;
  }

  return `+${dial}${digits.replace(/^0+/, '')}`;
}

// Champ téléphone à deux parties : sélecteur de pays (drapeau + indicatif)
// et numéro local, pour que l'appli sache toujours dans quel format
// interpréter ce qui est saisi plutôt que de le deviner.
export default function PhoneInput({ dial, local, onDialChange, onLocalChange, style }) {
  const isBenin = dial === '229';
  return (
    <div style={style}>
      <div style={{ display: 'flex', gap: 8 }}>
        <select
          value={dial}
          onChange={(e) => onDialChange(e.target.value)}
          style={{ padding: '10px 6px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, color: 'var(--ink)', flexShrink: 0, width: 172 }}
        >
          {COUNTRIES.map((c) => (
            <option key={c.dial} value={c.dial}>{c.flag} +{c.dial} {c.name}</option>
          ))}
        </select>
        <input
          type="tel"
          value={local}
          onChange={(e) => onLocalChange(e.target.value)}
          placeholder={isBenin ? '01 90 00 00 00' : '97 00 00 00'}
          style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)' }}
        />
      </div>
      {isBenin && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted)' }}>
          Format béninois depuis nov. 2024 : 10 chiffres, toujours précédés de 01.
        </p>
      )}
    </div>
  );
}
