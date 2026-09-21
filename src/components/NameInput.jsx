import { useEffect, useRef } from 'react';

// Champ Nom/Prénom qui se met en forme pendant la frappe, quelle que soit
// la casse utilisée (même sans majuscule activée au clavier) :
// mode="upper" → NOM en majuscules (comme dans displayName côté affichage)
// mode="title" → Prénom, première lettre de chaque mot en majuscule (plusieurs
// prénoms séparés par un espace donnent chacun leur majuscule).
// Non contrôlé côté React (defaultValue + manipulation directe du DOM),
// même raison que MoneyInput/PhoneInput : garder la main sur la position
// du curseur pendant la frappe.

function transformValue(str, mode) {
  if (mode === 'upper') return (str || '').toUpperCase();
  return (str || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

export default function NameInput({ value, onChange, mode, style, placeholder }) {
  const ref = useRef(null);
  const lastValueRef = useRef(value);

  useEffect(() => {
    if (value === lastValueRef.current) return;
    lastValueRef.current = value;
    if (ref.current) ref.current.value = value || '';
  }, [value]);

  function handleInput(e) {
    const el = e.target;
    const caret = el.selectionStart;
    const transformed = transformValue(el.value, mode);
    el.value = transformed;
    el.setSelectionRange(caret, caret);
    lastValueRef.current = transformed;
    onChange(transformed);
  }

  return (
    <input
      ref={ref}
      defaultValue={value || ''}
      onInput={handleInput}
      placeholder={placeholder}
      style={style}
    />
  );
}
