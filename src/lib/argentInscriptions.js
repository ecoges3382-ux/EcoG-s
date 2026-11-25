// Montants des inscriptions (ce que chaque famille doit et a payé).
// Ils sont lisibles seulement par ceux qui ont accès aux finances (voir supabase/restreindre_montants_eleves.sql) : la base les sert dans la
// vue « enrollments_argent », et plus dans la table « enrollments » elle-même. Les autres colonnes (classe, statut, élève…) restent lisibles
// par tout le personnel.
//
// Avant le lancement de ce script SQL, la vue n'existe pas encore : on lit alors les montants à l'ancien endroit. L'application marche
// donc avant comme après, dans n'importe quel ordre.
import { lireTout } from './fetchAll.js';

// Les montants ET le moratoire (arrangement de paiement) : savoir qu'une famille a un arrangement, c'est savoir qu'elle a du mal à payer.
const COLONNES_V1 = 'montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, note_arrangement, moratoire_montant_convenu';
const COLONNES_MORATOIRE_EN_PLUS = 'moratoire_actif, moratoire_nb_mensualites, moratoire_date_debut, moratoire_date_fin, moratoire_motif, moratoire_prochaine_echeance';
export const COLONNES_ARGENT = `${COLONNES_V1}, ${COLONNES_MORATOIRE_EN_PLUS}`;

// Ce qu'on affiche à quelqu'un qui n'a pas accès aux finances : des champs vides (les écrans concernés lui sont cachés de toute façon).
export const ARGENT_VIDE = {
  montant_du: 0, montant_paye: 0, frais_connexe_du: 0, frais_connexe_paye: 0, note_arrangement: null,
  moratoire_actif: false, moratoire_montant_convenu: null, moratoire_nb_mensualites: null, moratoire_date_debut: null,
  moratoire_date_fin: null, moratoire_motif: null, moratoire_prochaine_echeance: null,
};

// La vue n'existe pas du tout (script SQL jamais lancé)…
const VUE_ABSENTE = (erreur) => !!erreur && (erreur.code === '42P01' || erreur.code === 'PGRST205' || /relation .*does not exist|could not find the table/i.test(erreur.message || ''));
// …ou elle existe dans sa première version, sans les colonnes du moratoire (script SQL lancé avant sa mise à jour).
const COLONNE_ABSENTE = (erreur) => !!erreur && (erreur.code === '42703' || /column .*does not exist/i.test(erreur.message || ''));

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
  const lire = (table, colonnes) => lireTout(supabase, table, `id, ${colonnes}`, filtrer, { keyOf: null });
  let r = await lire('enrollments_argent', COLONNES_ARGENT);
  if (r.error && VUE_ABSENTE(r.error)) {
    // La vue n'existe pas encore (script SQL pas lancé) : tout est encore dans la table.
    r = await lire('enrollments', COLONNES_ARGENT);
  } else if (r.error && COLONNE_ABSENTE(r.error)) {
    // Première version de la vue (sans le moratoire) : les montants viennent de la vue, le moratoire est encore lisible dans la table.
    const [montants, moratoire] = await Promise.all([lire('enrollments_argent', COLONNES_V1), lire('enrollments', COLONNES_MORATOIRE_EN_PLUS)]);
    if (montants.error) r = montants;
    else if (moratoire.error) r = moratoire;
    else {
      const parId = new Map((moratoire.data || []).map(({ id, ...reste }) => [id, reste]));
      r = { data: (montants.data || []).map((ligne) => ({ ...ligne, ...(parId.get(ligne.id) || {}) })), error: null };
    }
  }
  if (r.error) return { error: r.error, parId: new Map() };
  const parId = new Map();
  (r.data || []).forEach((ligne) => { const { id, ...montants } = ligne; parId.set(id, montants); });
  return { error: null, parId };
}

// Suffixe à ajouter aux clés du cache local (hors ligne) : un appareil partagé ne doit pas servir à un enseignant les montants qu'une
// secrétaire y a laissés en mémoire.
export const suffixeCacheArgent = (finance) => (finance ? '' : '_sans_argent');
