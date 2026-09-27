import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { guardedFetch } from './offlineCache.js';

// Source unique pour "la liste des élèves inscrits pour une année scolaire,
// avec leur situation financière" — Argent, Tableau de bord et Rapports
// appelaient jusqu'ici chacun leur propre variante de la même requête
// enrollments+fee_schedules. Un seul chargement, une seule forme de donnée,
// jamais un deuxième calcul du dû/payé/reste pour le même indicateur.
//
// Le dû/payé et la classe d'un élève sont propres à l'année scolaire
// (table enrollments) — students ne garde que son identité, donc un ancien
// élève non réinscrit n'apparaît jamais ici, même s'il existe encore dans
// "students".
export function useEnrollmentsForYear(schoolYear) {
  const [students, setStudents] = useState(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    guardedFetch({
      cacheKey: `enrollments_${schoolYear.id}`,
      hasData: false, // ré-hydrate à chaque changement d'année consultée
      load: async () => {
        const [{ data, error: e }, { data: fees }] = await Promise.all([
          supabase
            .from('enrollments')
            .select('montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, note_arrangement, statut, classe_id, classes ( id, nom, niveau ), students ( id, full_name, matricule, photo_url )')
            .eq('school_year_id', schoolYear.id),
          supabase.from('fee_schedules').select('*').eq('school_year_id', schoolYear.id),
        ]);
        if (e) return { error: e };
        const feeByNiveau = {};
        (fees || []).forEach((f) => { feeByNiveau[f.niveau] = f; });
        return {
          data: (data || []).map((en) => ({
            id: en.students.id,
            full_name: en.students.full_name,
            matricule: en.students.matricule,
            photo_url: en.students.photo_url,
            niveau: en.classes?.nom || '—',
            classeId: en.classe_id,
            classeNiveau: en.classes?.niveau || null,
            feeSchedule: en.classes?.niveau ? feeByNiveau[en.classes.niveau] : undefined,
            montant_du: en.montant_du,
            montant_paye: en.montant_paye,
            frais_connexe_du: en.frais_connexe_du,
            frais_connexe_paye: en.frais_connexe_paye,
            note_arrangement: en.note_arrangement,
            statut: en.statut,
          })),
        };
      },
      setData: setStudents,
      setOffline,
      onError: (e) => setError(e.message),
      onSuccess: () => setError(''),
      isCancelled: () => cancelled,
    });
    return () => { cancelled = true; };
  }, [schoolYear?.id]);

  return { students, error, offline };
}
