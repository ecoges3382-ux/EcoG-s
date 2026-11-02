import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { guardedFetch } from './offlineCache.js';

export function useEnrollmentsForYear(schoolYear) {
  const [students, setStudents] = useState(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    guardedFetch({
      cacheKey: `enrollments_${schoolYear.id}`,
      hasData: false,
      load: async () => {
        const [{ data, error: e }, { data: fees }] = await Promise.all([
          supabase
            .from('enrollments')
            .select('montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, note_arrangement, statut, classe_id, moratoire_actif, moratoire_montant_convenu, moratoire_nb_mensualites, moratoire_date_debut, moratoire_date_fin, moratoire_motif, moratoire_prochaine_echeance, classes ( id, nom, niveau ), students ( id, full_name, matricule, photo_url, sexe )')
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
            sexe: en.students.sexe,
            niveau: en.classes?.nom || '—',
            classeId: en.classe_id,
            classeNiveau: en.classes?.niveau || null,
            feeSchedule: en.classes?.niveau ? feeByNiveau[en.classes.niveau] : undefined,
            montant_du: en.montant_du,
            montant_paye: en.montant_paye,
            frais_connexe_du: en.frais_connexe_du,
            frais_connexe_paye: en.frais_connexe_paye,
            note_arrangement: en.note_arrangement,
            moratoire_actif: en.moratoire_actif,
            moratoire_montant_convenu: en.moratoire_montant_convenu,
            moratoire_nb_mensualites: en.moratoire_nb_mensualites,
            moratoire_date_debut: en.moratoire_date_debut,
            moratoire_date_fin: en.moratoire_date_fin,
            moratoire_motif: en.moratoire_motif,
            moratoire_prochaine_echeance: en.moratoire_prochaine_echeance,
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
