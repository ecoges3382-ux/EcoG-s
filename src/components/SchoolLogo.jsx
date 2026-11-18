import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

// Le logo d'une école est enregistré soit comme un lien complet (« https://… », cas actuel : l'envoi d'un fichier
// enregistre l'adresse publique), soit comme un ancien chemin du stockage « photos » (« id-ecole/fichier.png »).
// Toute l'application doit le convertir de la même façon.
export function schoolLogoUrl(val) {
  if (!val) return null;
  if (/^https?:\/\//i.test(val)) return val;
  return supabase.storage.from('photos').getPublicUrl(val).data.publicUrl;
}

export function schoolInitials(name) {
  return (name || 'EG').split(' ').filter((w) => w.length > 1).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'EG';
}

// À placer dans un cadre déjà dimensionné (carré, arrondi, fond de couleur) : affiche le logo, ou les initiales de
// l'école s'il n'y a pas de logo OU si l'image ne se charge pas (lien mort, fichier supprimé).
export default function SchoolLogo({ url, name }) {
  const src = schoolLogoUrl(url);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  if (src && !failed) {
    return <img src={src} alt="" onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  return schoolInitials(name);
}
