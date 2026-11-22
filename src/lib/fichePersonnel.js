// Retrouver la fiche du personnel d'une personne qu'on connaît par son compte de connexion (Comptes utilisateurs, Chat).
// 1) Le lien enregistré (colonne staff.profile_id) fait foi.
// 2) À défaut (compte pas encore relié, ou base pas encore mise à jour), on le devine par l'e-mail, puis le téléphone, puis le nom,
//    parmi les fiches qui ne sont reliées à aucun autre compte. Règle de prudence : on ne relie QUE s'il y a exactement une fiche
//    qui correspond (jamais la fiche d'un homonyme).
import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { sansAccents } from './texte.js';
import { cleNumero } from './parents.js';

const cleEmail = (e) => String(e || '').trim().toLowerCase();
const cleNom = (nom) => sansAccents(nom).split(/[\s'-]+/).filter(Boolean).sort().join(' ');

// personne : { id (compte), nom, email, phone } ; personnel : [{ id, full_name, email, phone, profile_id }]. Renvoie l'identifiant de
// la fiche, ou null.
export function trouverFiche({ id: compteId, nom, email, phone }, personnel) {
  const toutes = personnel || [];
  if (compteId) {
    const reliee = toutes.find((p) => p.profile_id && p.profile_id === compteId);
    if (reliee) return reliee.id;
  }
  const liste = toutes.filter((p) => !p.profile_id); // une fiche déjà reliée à un autre compte n'est pas celle-ci
  const unique = (candidats) => (candidats.length === 1 ? candidats[0].id : null);
  const e = cleEmail(email);
  if (e) { const id = unique(liste.filter((p) => cleEmail(p.email) === e)); if (id) return id; }
  const t = cleNumero(phone);
  if (t) { const id = unique(liste.filter((p) => cleNumero(p.phone) === t)); if (id) return id; }
  const n = cleNom(nom);
  if (n) { const id = unique(liste.filter((p) => cleNom(p.full_name) === n)); if (id) return id; }
  return null;
}

// Le personnel de l'école, lu une seule fois pour toute la page (plusieurs noms à afficher = une seule lecture), puis relu après 2 minutes.
const DUREE_MS = 2 * 60 * 1000;
let memoire = { lu: 0, promesse: null };

// Avec le lien enregistré ; si la colonne n'existe pas encore (mise à jour de la base pas faite), sans lui : on devine comme avant.
async function lireFiches() {
  try {
    const avecLien = await supabase.from('staff').select('id, full_name, email, phone, profile_id');
    if (!avecLien.error) return avecLien.data || [];
    const sansLien = await supabase.from('staff').select('id, full_name, email, phone');
    return sansLien.error ? [] : sansLien.data || [];
  } catch {
    return [];
  }
}

function lirePersonnel() {
  if (memoire.promesse && Date.now() - memoire.lu < DUREE_MS) return memoire.promesse;
  memoire = {
    lu: Date.now(),
    promesse: lireFiches(),
  };
  return memoire.promesse;
}

export function oublierPersonnel() { memoire = { lu: 0, promesse: null }; }

export function usePersonnel() {
  const [liste, setListe] = useState(null);
  useEffect(() => {
    let annule = false;
    lirePersonnel().then((l) => { if (!annule) setListe(l); });
    return () => { annule = true; };
  }, []);
  return liste;
}
