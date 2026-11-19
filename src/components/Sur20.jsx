// Le « /20 » (ou « /10 »…) d'une note ou d'une moyenne : plus petit que le chiffre et grisé, pour qu'on lise d'abord la valeur.
// Hors bulletins seulement : sur un bulletin, le barème s'écrit normalement (voir moyenneBulletin dans lib/formatNote.js).
export default function Sur20({ sur = 20 }) {
  if (!(Number(sur) > 0)) return null;
  return <span data-sur style={{ fontSize: '0.72em', fontWeight: 500, color: 'var(--muted)' }}>/{Number(sur)}</span>;
}
