import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { guardedFetch, saveCache } from './offlineCache.js';
import { lireInscriptions, suffixeCacheArgent } from './argentInscriptions.js';
import { peutVoirFinances } from './droits.js';
import { useAuth } from '../auth/AuthProvider.jsx';

// Charge les inscriptions d'une année (élèves, classes, frais). Utilisé par la page
// et par le préchargement en arrière-plan. `finance` : l'utilisateur a-t-il accès aux montants ? (sinon ils valent 0, la base ne les lui donne pas)
export async function loadEnrollments(schoolYear, finance = true) {
  const [{ data, error: e }, { data: fees }] = await Promise.all([
    // Page par page : l'API plafonne chaque réponse à 1 000 lignes (une grande école a plus d'élèves).
    lireInscriptions(supabase, {
      colonnes: 'statut, classe_id, moratoire_actif, moratoire_nb_mensualites, moratoire_date_debut, moratoire_date_fin, moratoire_motif, moratoire_prochaine_echeance, classes ( id, nom, niveau ), students ( id, full_name, matricule, photo_url, sexe )',
      filtrer: (q) => q.eq('school_year_id', schoolYear.id),
      finance,
      keyOf: null,
    }),
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
}

// Remplit le cache local en arrière-plan : à la première visite, la page s'affiche
// tout de suite avec ces données, puis se met à jour.
export async function prefetchEnrollments(schoolYear, finance = true) {
  if (!schoolYear) return;
  try {
    const { data, error } = await loadEnrollments(schoolYear, finance);
    if (!error && data) await saveCache(`enrollments_${schoolYear.id}${suffixeCacheArgent(finance)}`, data);
  } catch { /* préchargement : sans importance si ça échoue */ }
}

export function useEnrollmentsForYear(schoolYear) {
  const { profile } = useAuth();
  const finance = peutVoirFinances(profile);
  const [students, setStudents] = useState(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!schoolYear) return;
    let cancelled = false;
    guardedFetch({
      cacheKey: `enrollments_${schoolYear.id}${suffixeCacheArgent(finance)}`,
      // hasData doit refléter l'état affiché AU MOMENT de l'appel : si des
      // élèves sont déjà à l'écran (rechargement, année re-sélectionnée),
      // on garde l'affichage actuel plutôt que de repartir du cache local.
      // L'ancienne version figeait ça à `false`, ce qui faisait toujours
      // réafficher la version d'hier pendant un instant avant que la
      // version du jour n'arrive — incohérent avec le reste de l'appli
      // (Staff.jsx, Payments, etc. utilisent tous `xxx !== null`).
      hasData: students !== null,
      load: () => loadEnrollments(schoolYear, finance),
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
