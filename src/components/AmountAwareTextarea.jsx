import { useEffect, useRef } from 'react';
import { formatAmountsInText } from '../lib/utils.js';

// Champ de texte libre (note d'arrangement, note de paiement…) qui
// reformate automatiquement chaque montant repéré pendant la frappe
// ("20000" → "20.000"), sans toucher au reste du texte. Non contrôlé côté
// React (defaultValue + manipulation directe du DOM), même raison que
// MoneyInput : garder la main sur la position du curseur pendant la frappe.

function digitsBeforeCaret(str, pos) {
  return (str.slice(0, pos).match(/\d/g) || []).length;
}

// n <= 0 : le curseur était avant tout chiffre, donc dans une portion de
// texte que le formatage ne touche jamais — sa position d'origine reste
// valable telle quelle.
function caretAfterDigits(str, n, fallback) {
  if (n <= 0) return fallback;
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (/\d/.test(str[i])) {
      count += 1;
      if (count === n) return i + 1;
    }
  }
  return str.length;
}

export default function AmountAwareTextarea({ value, onChange, style, placeholder, rows, multiline = true }) {
  const ref = useRef(null);
  const lastValueRef = useRef(value);

  useEffect(() => {
    if (value === lastValueRef.current) return;
    lastValueRef.current = value;
    if (ref.current) ref.current.value = value || '';
  }, [value]);

  function handleInput(e) {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const nBefore = digitsBeforeCaret(el.value, caret);
    const formatted = formatAmountsInText(el.value);

    el.value = formatted;
    const newCaret = caretAfterDigits(formatted, nBefore, caret);
    el.setSelectionRange(newCaret, newCaret);

    lastValueRef.current = formatted;
    onChange(formatted);
  }

  const Tag = multiline ? 'textarea' : 'input';
  return (
    <Tag
      ref={ref}
      defaultValue={value || ''}
      onInput={handleInput}
      placeholder={placeholder}
      rows={multiline ? rows : undefined}
      style={style}
    />
  );
}
