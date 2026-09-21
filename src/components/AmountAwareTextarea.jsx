import { useEffect, useRef } from 'react';
import { formatAmountsInText } from '../lib/utils.js';

// Champ de texte libre (note d'arrangement, note de paiement…) qui
// reformate automatiquement chaque montant repéré pendant la frappe
// ("20000" → "20.000"), sans toucher au reste du texte. Non contrôlé côté
// React (defaultValue + manipulation directe du DOM), même raison que
// MoneyInput : garder la main sur la position du curseur pendant la frappe.

// Le formatage n'ajoute et ne retire jamais que des points de regroupement
// ("."), jamais un autre caractère — donc compter tout ce qui N'EST PAS un
// point avant le curseur (chiffres, lettres, espaces...) donne une position
// stable, qu'on soit en train de taper dans un nombre ou juste après.
// L'ancienne version ne comptait que les chiffres : dès qu'on continuait à
// taper du texte après un montant déjà formaté, le curseur revenait se
// coller juste après le montant au lieu d'avancer avec la frappe.
function keptCharsBeforeCaret(str, pos) {
  let n = 0;
  for (let i = 0; i < pos; i++) if (str[i] !== '.') n++;
  return n;
}

function caretAfterKeptChars(str, n) {
  if (n <= 0) return 0;
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] !== '.') {
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
    const nBefore = keptCharsBeforeCaret(el.value, caret);
    const formatted = formatAmountsInText(el.value);

    el.value = formatted;
    const newCaret = caretAfterKeptChars(formatted, nBefore);
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
