// Fusionner des parents en double : on garde un parent, on lui rattache les enfants des doublons, puis on supprime les doublons.
//
// Ordre voulu : d'abord AJOUTER les liens (si ça échoue, rien n'est perdu), ensuite seulement supprimer le doublon (ses anciens liens
// partent avec lui). Conséquences à annoncer : le lien d'accès (code) du doublon cesse de fonctionner, et l'historique WhatsApp du
// doublon n'est plus rattaché à un parent (les messages restent visibles dans l'historique de l'école).
import { supabase } from './supabase.js';

// Liens à ajouter pour que « garder » ait tous les enfants des doublons (sans ceux qu'il a déjà).
export function liensAAjouter(garder, doublons) {
  const deja = new Set((garder.parent_access_students || []).map((l) => l.students?.id).filter(Boolean));
  const ajoutes = new Set();
  const liens = [];
  for (const d of doublons) {
    for (const l of d.parent_access_students || []) {
      const id = l.students?.id;
      if (!id || deja.has(id) || ajoutes.has(id)) continue;
      ajoutes.add(id);
      liens.push({ parent_access_id: garder.id, student_id: id });
    }
  }
  return liens;
}

/** Fusionne `doublons` dans `garder`. Rend { ok: true, ajoutes, supprimes } ou { ok: false, erreur }. */
export async function fusionnerParents(garder, doublons, client = supabase) {
  const liens = liensAAjouter(garder, doublons);
  if (liens.length > 0) {
    const { error } = await client.from('parent_access_students').upsert(liens, { onConflict: 'parent_access_id,student_id', ignoreDuplicates: true });
    if (error) return { ok: false, erreur: error };
  }
  const ids = doublons.map((d) => d.id).filter((id) => id !== garder.id);
  if (ids.length > 0) {
    const { error } = await client.from('parent_access').delete().in('id', ids);
    if (error) return { ok: false, erreur: error };
  }
  return { ok: true, ajoutes: liens.length, supprimes: ids.length };
}
