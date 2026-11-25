// Couleur personnelle enregistrée sur le profil (colonne profiles.couleur_perso, voir supabase/couleur_personnelle.sql), pour qu'un
// utilisateur retrouve sa couleur sur tous ses appareils. Tant que le script SQL n'a pas été lancé, la colonne n'existe pas : tout
// reste alors local à l'appareil (comme avant), sans erreur.
const HEX = /^#[0-9a-fA-F]{6}$/;

// { disponible, couleur } : `disponible` est faux si la colonne n'existe pas encore ou si le réseau échoue (on garde alors le choix local).
export async function lireCouleurServeur(supabase, userId) {
  if (!userId) return { disponible: false, couleur: null };
  try {
    const { data, error } = await supabase.from('profiles').select('couleur_perso').eq('id', userId).maybeSingle();
    if (error || !data) return { disponible: false, couleur: null };
    return { disponible: true, couleur: HEX.test(data.couleur_perso || '') ? data.couleur_perso : null };
  } catch {
    return { disponible: false, couleur: null };
  }
}

// Enregistre (ou efface, avec null) la couleur sur le profil. Renvoie true si c'est enregistré.
export async function ecrireCouleurServeur(supabase, userId, hex) {
  if (!userId) return false;
  try {
    const { error } = await supabase.from('profiles').update({ couleur_perso: hex || null }).eq('id', userId);
    return !error;
  } catch {
    return false;
  }
}
