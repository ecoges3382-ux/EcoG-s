import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

export default function SecureImage({ src, bucket = 'photos', fallback = null, style, className, alt = "" }) {
  const [displayUrl, setDisplayUrl] = useState(null);

  useEffect(() => {
    if (!src) { setDisplayUrl(null); return; }

    // Si c'est déjà une URL externe (http...), on l'utilise directement
    if (src.startsWith('http') && !src.includes('/storage/v1/object/public/')) {
      setDisplayUrl(src);
      return;
    }

    // Si c'est une ancienne URL publique, on extrait le chemin
    let path = src;
    if (src.includes(`/storage/v1/object/public/${bucket}/`)) {
      path = src.split(`/storage/v1/object/public/${bucket}/`)[1];
    }

    // On demande un lien sécurisé valable 1 heure
    supabase.storage.from(bucket).createSignedUrl(path, 3600).then(({ data, error }) => {
      if (data) {
        setDisplayUrl(data.signedUrl);
      } else {
        console.warn("Impossible de charger l'image sécurisée:", error);
        setDisplayUrl(null);
      }
    });
  }, [src, bucket]);

  if (!src) return fallback;
  if (!displayUrl) return fallback; // Affiche le fallback (initiales) pendant le chargement

  return <img src={displayUrl} alt={alt} style={style} className={className} />;
}
