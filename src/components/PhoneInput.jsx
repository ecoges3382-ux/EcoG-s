import { useEffect, useRef } from 'react';

// Indicatifs les plus pertinents pour le contexte de déploiement de
// l'appli (Bénin et pays voisins), plus quelques indicatifs courants.
// "groups" = découpage réel du numéro national de chaque pays (vérifié
// pays par pays, pas une convention unique appliquée partout) :
// - Bénin (10 chiffres depuis la réforme ARCEP du 30 nov. 2024) : 2-2-2-2-2
// - Côte d'Ivoire (10 chiffres depuis la réforme ARTCI du 31 janv. 2021) : 2-2-2-4
// - Togo / Niger / Burkina Faso / Mali : 8 chiffres, 2-2-2-2
// - Sénégal : 9 chiffres, 2-3-2-2
// - Nigeria : 10 chiffres (NSN), 3-3-4
// - Ghana : 9 chiffres, 2-3-4
// - France : 9 chiffres (hors le 0 initial), 1-2-2-2-2
export const COUNTRIES = [
  { dial: '229', flag: '🇧🇯', name: 'Bénin', groups: [2, 2, 2, 2, 2], example: '01 97 20 19 09' },
  { dial: '228', flag: '🇹🇬', name: 'Togo', groups: [2, 2, 2, 2], example: '90 12 34 56' },
  { dial: '225', flag: '🇨🇮', name: "Côte d'Ivoire", groups: [2, 2, 2, 4], example: '01 23 45 6789' },
  { dial: '221', flag: '🇸🇳', name: 'Sénégal', groups: [2, 3, 2, 2], example: '77 123 45 67' },
  { dial: '227', flag: '🇳🇪', name: 'Niger', groups: [2, 2, 2, 2], example: '96 12 34 56' },
  { dial: '226', flag: '🇧🇫', name: 'Burkina Faso', groups: [2, 2, 2, 2], example: '70 12 34 56' },
  { dial: '223', flag: '🇲🇱', name: 'Mali', groups: [2, 2, 2, 2], example: '70 12 34 56' },
  { dial: '234', flag: '🇳🇬', name: 'Nigeria', groups: [3, 3, 4], example: '803 123 4567' },
  { dial: '233', flag: '🇬🇭', name: 'Ghana', groups: [2, 3, 4], example: '24 123 4567' },
  { dial: '33', flag: '🇫🇷', name: 'France', groups: [1, 2, 2, 2, 2], example: '6 12 34 56 78' },
];

function countryOf(dial) {
  return COUNTRIES.find((c) => c.dial === dial) || COUNTRIES[0];
}

function onlyDigits(str) {
  return String(str || '').replace(/\D/g, '');
}

// Regroupe une suite de chiffres selon le découpage du pays choisi (ex.
// Bénin 2-2-2-2-2, Nigeria 3-3-4). Les chiffres au-delà de la longueur
// attendue restent affichés tels quels à la fin, plutôt que tronqués —
// on ne veut jamais perdre silencieusement ce que la personne a tapé.
export function formatLocalNumber(dial, digits) {
  const { groups } = countryOf(dial);
  const parts = [];
  let idx = 0;
  for (const size of groups) {
    if (idx >= digits.length) break;
    parts.push(digits.slice(idx, idx + size));
    idx += size;
  }
  if (idx < digits.length) parts.push(digits.slice(idx));
  return parts.join(' ');
}

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
  const digits = onlyDigits(local);
  if (!digits) return '';

  // Bénin (réforme ARCEP du 30 nov. 2024) et Côte d'Ivoire (réforme ARTCI
  // du 31 janv. 2021) : le préfixe à 2 chiffres (01, ou 01/05/07 selon
  // l'opérateur pour la Côte d'Ivoire) fait désormais partie intégrante du
  // numéro national — ce n'est plus un indicatif de tronc à retirer pour
  // l'international (+229 01 XX XX XX XX / +225 01 XX XX XXXX).
  if (dial === '229') {
    // Un ancien numéro à 8 chiffres saisi par habitude : le "01" est
    // uniforme quel que soit l'opérateur au Bénin, donc on peut le
    // compléter automatiquement sans se tromper.
    const withPrefix = digits.length === 8 ? `01${digits}` : digits;
    return `+${dial}${withPrefix}`;
  }
  if (dial === '225') {
    // Contrairement au Bénin, le préfixe ivoirien dépend de l'opérateur
    // (01 Moov, 05 MTN, 07 Orange) : impossible de le deviner à partir de
    // 8 chiffres seuls, donc pas de complément automatique ici — on garde
    // simplement tel quel ce qui est saisi, sans retirer de zéro initial.
    return `+${dial}${digits}`;
  }

  return `+${dial}${digits.replace(/^0+/, '')}`;
}

function digitsBeforeCaret(str, pos) {
  return onlyDigits(str.slice(0, pos)).length;
}

function caretAfterDigits(str, n) {
  if (n <= 0) return 0;
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (/[0-9]/.test(str[i])) {
      count += 1;
      if (count === n) return i + 1;
    }
  }
  return str.length;
}

// Champ téléphone à deux parties : sélecteur de pays (drapeau + indicatif)
// et numéro local, formaté en direct pendant la saisie selon le découpage
// propre à chaque pays (non contrôlé côté React, comme MoneyInput, pour
// garder la main sur la position du curseur).
export default function PhoneInput({ dial, local, onDialChange, onLocalChange, style }) {
  const country = countryOf(dial);
  const isBenin = dial === '229';
  const isCI = dial === '225';
  const ref = useRef(null);
  const lastDigitsRef = useRef(onlyDigits(local));
  const lastDialRef = useRef(dial);

  // Resynchronise l'affichage si la valeur ou le pays changent depuis
  // l'extérieur (reset du formulaire, changement de pays, préremplissage
  // à l'édition…) — pas après notre propre onLocalChange, pour ne pas
  // couper la frappe en cours.
  useEffect(() => {
    const digits = onlyDigits(local);
    if (digits === lastDigitsRef.current && dial === lastDialRef.current) return;
    lastDigitsRef.current = digits;
    lastDialRef.current = dial;
    if (ref.current) ref.current.value = formatLocalNumber(dial, digits);
  }, [local, dial]);

  function handleInput(e) {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const nBefore = digitsBeforeCaret(el.value, caret);
    const digits = onlyDigits(el.value);
    const formatted = formatLocalNumber(dial, digits);

    el.value = formatted;
    const newCaret = caretAfterDigits(formatted, nBefore);
    el.setSelectionRange(newCaret, newCaret);

    lastDigitsRef.current = digits;
    onLocalChange(digits);
  }

  return (
    <div style={style}>
      <div style={{ display: 'flex', gap: 8 }}>
        <select
          value={dial}
          onChange={(e) => {
            // Le découpage en groupes diffère totalement d'un pays à
            // l'autre : garder les chiffres déjà tapés produirait un
            // numéro sans aucun sens, donc on repart d'un champ vide.
            onDialChange(e.target.value);
            onLocalChange('');
          }}
          style={{ padding: '10px 6px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, color: 'var(--ink)', flexShrink: 0, width: 172 }}
        >
          {COUNTRIES.map((c) => (
            <option key={c.dial} value={c.dial}>{c.flag} +{c.dial} {c.name}</option>
          ))}
        </select>
        <input
          ref={ref}
          type="tel"
          inputMode="numeric"
          defaultValue={formatLocalNumber(dial, onlyDigits(local))}
          onInput={handleInput}
          placeholder={country.example}
          style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-strong)', fontSize: 14, boxSizing: 'border-box', color: 'var(--ink)' }}
        />
      </div>
      {(isBenin || isCI) && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted)' }}>
          {isBenin
            ? 'Format béninois depuis nov. 2024 : 10 chiffres, toujours précédés de 01.'
            : "Format ivoirien depuis 2021 : 10 chiffres, précédés de 01, 05 ou 07 selon l'opérateur."}
        </p>
      )}
    </div>
  );
}
