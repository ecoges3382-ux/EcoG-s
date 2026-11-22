// Fichiers et images du Chat : ouvrir dans l'application, enregistrer, partager (téléphone : feuille de partage du système).
//
// Les fichiers sont dans le stockage privé « chat-files » : on passe toujours par une adresse signée de courte durée.
// « Enregistrer » = téléchargement (en-tête « attachment » demandé au stockage, donc sans page qui s'ouvre).
// « Partager » = feuille de partage du téléphone (WhatsApp, Enregistrer dans Photos/Fichiers, AirDrop...). Elle exige que le fichier soit
// DÉJÀ téléchargé quand on touche le bouton (le navigateur refuse de partager si l'attente a été trop longue), d'où la préparation
// à l'avance : preparerFichierChat() est appelée dès que la visionneuse ou le menu s'ouvre, et le résultat est gardé en mémoire.
import { supabase } from './supabase.js';

const BUCKET = 'chat-files';

const TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', zip: 'application/zip',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  mp3: 'audio/mpeg', mp4: 'video/mp4',
};

// Nom sous lequel le fichier est enregistré : celui que l'expéditeur a choisi, à défaut la fin du chemin de stockage.
export function nomFichierChat(m) {
  const brut = String(m?.file_name || '').trim() || String(m?.file_url || '').split('?')[0].split('/').pop() || '';
  return brut || 'fichier';
}

export function typeParNom(nom) {
  const ext = String(nom || '').split('.').pop().toLowerCase();
  return TYPES[ext] || 'application/octet-stream';
}

// Le téléphone (ou le navigateur) sait-il ouvrir sa feuille de partage pour des fichiers ?
export function partageDisponible() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
}

// Adresse d'accès à un fichier du Chat. Pour un fichier ancien déjà enregistré avec une adresse complète, on la garde telle quelle.
// telecharger = true : le stockage répond avec « Content-Disposition: attachment », le navigateur enregistre au lieu d'afficher.
export async function adresseFichierChat(m, { telecharger = false, secondes = 600 } = {}) {
  const src = m?.file_url;
  if (!src) return null;
  if (/^https?:/.test(src)) return src;
  const options = telecharger ? { download: nomFichierChat(m) } : undefined;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(src, secondes, options);
  return error || !data?.signedUrl ? null : data.signedUrl;
}

const preparés = new Map(); // chemin du fichier -> promesse d'un objet File

// Télécharge le fichier en mémoire pour pouvoir le partager sans attendre. Rend un File, ou null si impossible (réseau, accès).
export function preparerFichierChat(m) {
  const cle = m?.file_url;
  if (!cle) return Promise.resolve(null);
  if (!preparés.has(cle)) {
    const promesse = (async () => {
      const url = await adresseFichierChat(m);
      if (!url) return null;
      const reponse = await fetch(url);
      if (!reponse.ok) return null;
      const blob = await reponse.blob();
      const nom = nomFichierChat(m);
      return new File([blob], nom, { type: blob.type && blob.type !== 'application/octet-stream' ? blob.type : typeParNom(nom) });
    })().catch(() => null);
    preparés.set(cle, promesse);
    promesse.then((f) => { if (!f) preparés.delete(cle); }); // un échec peut être retenté
    if (preparés.size > 12) preparés.delete(preparés.keys().next().value); // la mémoire ne grossit pas indéfiniment
  }
  return preparés.get(cle);
}

/**
 * Ouvre la feuille de partage du système avec le fichier.
 * Rend 'partage' (fait), 'annule' (la personne a fermé la feuille), ou 'indisponible' (pas de partage de fichiers sur cet appareil,
 * ou fichier impossible à récupérer : le message doit alors proposer « Enregistrer »).
 */
export async function partagerFichierChat(m) {
  if (!partageDisponible()) return 'indisponible';
  const fichier = await preparerFichierChat(m);
  if (!fichier || !navigator.canShare({ files: [fichier] })) return 'indisponible';
  try {
    await navigator.share({ files: [fichier], title: fichier.name });
    return 'partage';
  } catch (err) {
    if (err && err.name === 'AbortError') return 'annule';
    return 'indisponible';
  }
}

/** Enregistre le fichier (dossier Téléchargements, ou feuille « Enregistrer » du téléphone). Rend true si le téléchargement est lancé. */
export async function enregistrerFichierChat(m) {
  const url = await adresseFichierChat(m, { telecharger: true });
  if (!url) return false;
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichierChat(m);
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
