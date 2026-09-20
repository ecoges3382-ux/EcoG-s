import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

// Une seule année scolaire est marquée is_current par école — c'est elle
// qui sert de référence à toute la gestion courante (inscriptions,
// paiements, notes, présences). Voir la migration "année scolaire, grille
// tarifaire, inscriptions" dans supabase/schema.sql.
export function useCurrentSchoolYear(schoolId) {
  const [schoolYear, setSchoolYear] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('school_years')
      .select('id, label')
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

  return { schoolYear, loading };
}
