import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { DEFAULT_DIAL } from './phone.js';

// Indicatif téléphonique du pays de l'école (Paramètres > Pays de l'école), ajouté automatiquement aux numéros
// saisis sans « + ». Lu à part du profil : si la colonne n'existe pas encore (mise à jour de la base pas faite) ou si
// la lecture échoue, on garde l'indicatif du Bénin, et l'application continue de fonctionner comme avant.
const cache = new Map(); // schoolId -> indicatif
const listeners = new Set();

export function setSchoolDial(schoolId, dial) {
  cache.set(schoolId, dial);
  listeners.forEach((l) => l());
}

export function useSchoolDial() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const [, force] = useState(0);

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  useEffect(() => {
    if (!schoolId || cache.has(schoolId)) return undefined;
    let cancelled = false;
    supabase.from('schools').select('indicatif_pays').eq('id', schoolId).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      const dial = !error && data?.indicatif_pays && /^\d{1,3}$/.test(String(data.indicatif_pays)) ? String(data.indicatif_pays) : DEFAULT_DIAL;
      setSchoolDial(schoolId, dial);
    });
    return () => { cancelled = true; };
  }, [schoolId]);

  return (schoolId && cache.get(schoolId)) || DEFAULT_DIAL;
}
