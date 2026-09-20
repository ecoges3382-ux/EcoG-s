import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const SELECT = 'id, label, date_tranche1, date_tranche2, date_tranche3, date_connexe';

// Une seule année scolaire est marquée is_current par école — c'est elle
// qui sert de référence à toute la gestion courante (inscriptions,
// paiements, notes, présences). Voir la migration "année scolaire, grille
// tarifaire, inscriptions" dans supabase/schema.sql.
export function useCurrentSchoolYear(schoolId) {
  const [schoolYear, setSchoolYear] = useState(null);
  const [loading, setLoading] = useState(true);

  // Exposé pour les écrans qui modifient school_years directement (ex. le
  // calendrier de paiement dans Argent → Grille tarifaire) et doivent
  // resynchroniser cet état après coup, plutôt que d'attendre un remount.
  const refresh = useCallback(() => {
    if (!schoolId) return Promise.resolve();
    return supabase
      .from('school_years')
      .select(SELECT)
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle()
      .then(({ data }) => setSchoolYear(data));
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('school_years')
      .select(SELECT)
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setSchoolYear(data);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [schoolId]);

  return { schoolYear, loading, refresh };
}
