// Montants des inscriptions (ce que chaque famille doit et a payé).
// Ils sont lisibles seulement par ceux qui ont accès aux finances (voir supabase/restreindre_montants_eleves.sql) : la base les sert dans la
// vue « enrollments_argent », et plus dans la table « enrollments » elle-même. Les autres colonnes (classe, statut, élève…) restent lisibles
// par tout le personnel.
//
// Avant le lancement de ce script SQL, la vue n'existe pas encore : on lit alors les montants à l'ancien endroit. L'application marche
// donc avant comme après, dans n'importe quel ordre.
import { lireTout } from './fetchAll.js';

export const COLONNES_ARGENT = 'montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, note_arrangement, moratoire_montant_convenu';

// Ce qu'on affiche à quelqu'un qui n'a pas accès aux finances : des champs vides (les écrans concernés lui sont cachés de toute façon).
export const ARGENT_VIDE = {
  montant_du: 0, montant_paye: 0, frais_connexe_du: 0, frais_connexe_paye: 0, note_arrangement: null, moratoire_montant_convenu: null,
};

const VUE_ABSENTE = (erreur) => !!erreur && (erreur.code === '42P01' || erreur.code === 'PGRST205' || /enrollments_argent/i.test(erreur.message || ''));

// Les inscriptions (colonnes `colonnes`, jointures comprises) AVEC leurs montants.
//   colonnes : le select des colonnes qui ne sont PAS de l'argent (classe, élève…) ;
//   filtrer  : (q) => q.eq('school_year_id', …), appliqué aux deux lectures ; il ne doit filtrer que sur id, student_id, school_year_id ;
//   finance  : l'utilisateur a-t-il accès aux finances ? Sinon on ne demande même pas les montants, et ils valent 0 ;
//   options  : { tri, keyOf } comme lireTout, pour la lecture des colonnes ordinaires.
// Renvoie { data, error } comme Supabase.
export async function lireInscriptions(supabase, { colonnes, filtrer = (q) => q, finance, ...options }) {
  const lecture = lireTout(supabase, 'enrollments', `id, ${colonnes}`, filtrer, options);
  if (!finance) {
    const { data, error } = await lecture;
    if (error) return { data: null, error };
    return { data: (data || []).map((ligne) => ({ ...ARGENT_VIDE, ...ligne })), error: null };
  }

  const [{ data, error }, argent] = await Promise.all([lecture, lireArgent(supabase, filtrer)]);
  if (error) return { data: null, error };
  if (argent.error) return { data: null, error: argent.error };
  return {
    data: (data || []).map((ligne) => ({ ...ARGENT_VIDE, ...(argent.parId.get(ligne.id) || {}), ...ligne })),
    error: null,
  };
}

async function lireArgent(supabase, filtrer) {
  let r = await lireTout(supabase, 'enrollments_argent', `id, ${COLONNES_ARGENT}`, filtrer, { keyOf: null });
  // La vue n'existe pas encore (script SQL pas lancé) : les montants sont encore dans la table.
  if (r.error && VUE_ABSENTE(r.error)) r = await lireTout(supabase, 'enrollments', `id, ${COLONNES_ARGENT}`, filtrer, { keyOf: null });
  if (r.error) return { error: r.error, parId: new Map() };
  const parId = new Map();
  (r.data || []).forEach((ligne) => { const { id, ...montants } = ligne; parId.set(id, montants); });
  return { error: null, parId };
}

// Suffixe à ajouter aux clés du cache local (hors ligne) : un appareil partagé ne doit pas servir à un enseignant les montants qu'une
// secrétaire y a laissés en mémoire.
export const suffixeCacheArgent = (finance) => (finance ? '' : '_sans_argent');
