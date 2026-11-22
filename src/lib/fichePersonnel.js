// Retrouver la fiche du personnel d'une personne qu'on connaît par son compte de connexion (Comptes utilisateurs, Chat) : les
// comptes et les fiches ne sont pas reliés par un identifiant, on les rapproche donc par l'e-mail, puis le téléphone, puis le nom.
// Règle de prudence : on ne relie QUE s'il y a exactement une fiche qui correspond (jamais la fiche d'un homonyme).
import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { sansAccents } from './texte.js';
import { cleNumero } from './parents.js';

const cleEmail = (e) => String(e || '').trim().toLowerCase();
const cleNom = (nom) => sansAccents(nom).split(/[\s'-]+/).filter(Boolean).sort().join(' ');

// personne : { nom, email, phone } ; personnel : [{ id, full_name, email, phone }]. Renvoie l'identifiant de la fiche, ou null.
export function trouverFiche({ nom, email, phone }, personnel) {
  const liste = personnel || [];
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

function lirePersonnel() {
  if (memoire.promesse && Date.now() - memoire.lu < DUREE_MS) return memoire.promesse;
  memoire = {
    lu: Date.now(),
    promesse: Promise.resolve(supabase.from('staff').select('id, full_name, email, phone')).then(({ data, error }) => (error ? [] : data || []), () => []),
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
