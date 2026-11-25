// Salaire mensuel prévu de chaque membre du personnel.
// Il est stocké dans une table à part (staff_remuneration), lisible seulement par ceux qui ont accès aux finances : un enseignant voit la
// liste du personnel mais pas les salaires de ses collègues. Avant la mise à jour de la base de données, le montant se trouvait dans la
// fiche (staff.salaire_mensuel) : tant que la nouvelle table n'existe pas, on continue de le lire (et de l'écrire) à cet endroit.

const TABLE_ABSENTE = (erreur) => !!erreur && (erreur.code === '42P01' || erreur.code === 'PGRST205' || /staff_remuneration/i.test(erreur.message || ''));

// { staff_id: montant } pour les fiches visibles, ou null si la nouvelle table n'existe pas encore.
export async function chargerSalairesPrevus(supabase) {
  const { data, error } = await supabase.from('staff_remuneration').select('staff_id, salaire_mensuel');
  if (error) return null;
  const carte = {};
  (data || []).forEach((r) => { carte[r.staff_id] = r.salaire_mensuel; });
  return carte;
}

// Le salaire prévu d'une fiche : celui de la nouvelle table s'il y est, sinon celui de la fiche (ancien emplacement), sinon rien.
export function salairePrevu(personne, carte) {
  const dansTable = carte ? carte[personne.id] : undefined;
  if (dansTable !== undefined && dansTable !== null) return dansTable;
  return personne.salaire_mensuel ?? null;
}

// Ajoute `salaire_mensuel` à chaque fiche, depuis le bon endroit. Les écrans n'ont rien d'autre à changer.
export async function avecSalairesPrevus(supabase, fiches) {
  const carte = await chargerSalairesPrevus(supabase);
  return (fiches || []).map((p) => ({ ...p, salaire_mensuel: salairePrevu(p, carte) }));
}

// Enregistre (ou efface, si `montant` est vide) le salaire prévu. Renvoie { error } comme Supabase.
export async function enregistrerSalairePrevu(supabase, { staffId, schoolId, montant }) {
  const valeur = montant === null || montant === undefined || montant === '' ? null : Number(montant);
  const { error } = await supabase.from('staff_remuneration').upsert(
    { staff_id: staffId, school_id: schoolId, salaire_mensuel: valeur, updated_at: new Date().toISOString() },
    { onConflict: 'staff_id' },
  );
  if (!error) return { error: null };
  if (TABLE_ABSENTE(error)) return supabase.from('staff').update({ salaire_mensuel: valeur }).eq('id', staffId);
  return { error };
}
