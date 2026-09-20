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

export default function MoneyInput({ value, onChange, style, placeholder, disabled }) {
  const ref = useRef(null);
  const lastValueRef = useRef(value);

  // Resynchronise l'affichage seulement si la valeur a changé depuis
  // l'extérieur (reset du formulaire, recalcul automatique…) — pas après
  // notre propre onChange, pour ne pas couper la frappe en cours.
  useEffect(() => {
    if (value === lastValueRef.current) return;
    lastValueRef.current = value;
    if (ref.current) ref.current.value = value === '' || value == null ? '' : fmt(Number(value));
  }, [value]);

  function handleInput(e) {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const nBefore = digitsBeforeCaret(el.value, caret);
    const digits = digitsOnly(el.value);
    const num = digits === '' ? '' : Number(digits);
    const formatted = digits === '' ? '' : fmt(num);

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
      defaultValue={value === '' || value == null ? '' : fmt(Number(value))}
      onInput={handleInput}
      placeholder={placeholder}
      disabled={disabled}
      style={style}
    />
  );
}
