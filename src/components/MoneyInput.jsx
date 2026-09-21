import { useEffect, useRef } from 'react';
import { fmt } from '../lib/utils.js';

// Champ de saisie de montant qui affiche les séparateurs de milliers
// pendant la frappe (125.375), pas seulement une fois le formulaire validé.
// Non contrôlé côté React (defaultValue + manipulation directe du DOM) pour
// garder la main sur la position du curseur — un input contrôlé reformaté
// à chaque frappe renvoie sinon systématiquement le curseur en fin de
// champ, ce qui rend la saisie au milieu d'un nombre inutilisable.

function digitsOnly(str) {
  return str.replace(/[^0-9]/g, '');
}

function digitsBeforeCaret(str, pos) {
  return digitsOnly(str.slice(0, pos)).length;
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

// suffix : unité fixe affichée après le montant (ex. "F CFA"), jamais
// éditable. À 0/vide, le champ n'affiche que le suffixe (pas de "0"
// devant) ; cliquer n'importe où dans le champ replace le curseur juste
// avant le suffixe (avec l'espace qui les sépare), pour qu'on ne puisse ni
// taper dedans ni coller un montant contre "F CFA".
function formatValue(value, suffix) {
  const isEmpty = value === '' || value == null || (suffix && Number(value) === 0);
  const numPart = isEmpty ? '' : fmt(Number(value));
  if (!suffix) return numPart;
  return numPart === '' ? suffix : `${numPart} ${suffix}`;
}

function placeCaretBeforeSuffix(el, suffix) {
  if (!suffix) return;
  const totalDigits = digitsOnly(el.value).length;
  const pos = caretAfterDigits(el.value, totalDigits);
  el.setSelectionRange(pos, pos);
}

export default function MoneyInput({ value, onChange, style, placeholder, disabled, suffix }) {
  const ref = useRef(null);
  const lastValueRef = useRef(value);

  // Resynchronise l'affichage seulement si la valeur a changé depuis
  // l'extérieur (reset du formulaire, recalcul automatique…) — pas après
  // notre propre onChange, pour ne pas couper la frappe en cours.
  useEffect(() => {
    if (value === lastValueRef.current) return;
    lastValueRef.current = value;
    if (ref.current) ref.current.value = formatValue(value, suffix);
  }, [value, suffix]);

  function handleInput(e) {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const nBefore = digitsBeforeCaret(el.value, caret);
    const digits = digitsOnly(el.value);
    const num = digits === '' ? '' : Number(digits);
    const formatted = formatValue(num, suffix);

    el.value = formatted;
    const newCaret = caretAfterDigits(formatted, nBefore);
    el.setSelectionRange(newCaret, newCaret);

    lastValueRef.current = num;
    onChange(num);
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      defaultValue={formatValue(value, suffix)}
      onInput={handleInput}
      onClick={(e) => placeCaretBeforeSuffix(e.target, suffix)}
      onFocus={(e) => { const el = e.target; setTimeout(() => placeCaretBeforeSuffix(el, suffix), 0); }}
      placeholder={placeholder}
      disabled={disabled}
      style={style}
    />
  );
}
