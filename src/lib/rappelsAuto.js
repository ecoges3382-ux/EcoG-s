// Rappels de paiement automatiques (WhatsApp) : réglages de l'école et calendrier des prochains envois.
//
// L'envoi lui-même est fait chaque matin par la fonction serveur cron-reminders (supabase/functions/cron-reminders). Les règles
// ci-dessous (quels jalons, qui est exclu) en sont une COPIE : tests/rappels-auto.test.js vérifie que les deux restent identiques.
import { computeEcheances } from './retard.js';

// Jours par rapport à la date d'échéance : positif = avant, négatif = après.
export const JALONS = [15, 7, 3, -3];
export const LIBELLE_JALON = { 15: '15 jours avant', 7: '7 jours avant', 3: '3 jours avant', '-3': '3 jours après' };

export const ECHEANCES = [
  { type: 'tranche1', cle: 'date_tranche1', libelle: 'la 1ère tranche' },
  { type: 'tranche2', cle: 'date_tranche2', libelle: 'la 2ème tranche' },
  { type: 'tranche3', cle: 'date_tranche3', libelle: 'la 3ème tranche' },
  { type: 'connexe', cle: 'date_connexe', libelle: 'les frais connexes' },
];

// Réglages d'une école à partir de sa ligne « schools » : tant que la base n'a pas les colonnes (ou n'a rien enregistré),
// tout est activé comme avant. Un jalon inconnu est ignoré ; aucun jalon coché revient à ne rien envoyer.
export function reglagesRappels(row) {
  if (!row) return { actif: true, jalons: [...JALONS] };
  const brut = Array.isArray(row.rappels_jalons) ? row.rappels_jalons : JALONS;
  return { actif: row.rappels_auto !== false, jalons: JALONS.filter((j) => brut.includes(j)) };
}

// Un élève sous moratoire n'est jamais relancé (même règle que src/lib/retard.js et que la fonction serveur).
export function sousMoratoire(eleve) {
  return eleve?.moratoire_actif === true || String(eleve?.note_arrangement || '').trim() !== '';
}

// « 2026-11-28 » -> nombre de jours depuis un repère fixe, sans décalage d'heure ni de fuseau.
function numeroDeJour(texte) {
  const m = String(texte || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null;
}
const numeroDuJourDe = (date) => Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
const dateDuJour = (numero) => { const d = new Date(numero * 86400000); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };

/**
 * Les prochains envois : pour chaque jalon actif de chaque échéance dont la date est configurée, le jour où le rappel part et les
 * élèves concernés (il leur reste un solde sur cette échéance, hors moratoire). Chaque entrée :
 *   { jours (dans combien de jours, 0 = aujourd'hui), date, jalon, type, libelle, eleves: [{ id, nom }] }
 * Les entrées sans aucun élève concerné sont omises. Estimation : les paiements d'ici là peuvent encore changer la liste.
 */
export function prochainsRappels({ schoolYear, eleves, jalons = JALONS, aujourdhui = new Date(), horizonJours = 30 }) {
  if (!schoolYear) return [];
  const auj = numeroDuJourDe(aujourdhui);
  const sorties = [];
  for (const ech of ECHEANCES) {
    const jourEcheance = numeroDeJour(schoolYear[ech.cle]);
    if (jourEcheance === null) continue;
    for (const jalon of jalons) {
      const jours = jourEcheance - jalon - auj;
      if (jours < 0 || jours > horizonJours) continue;
      const concernes = [];
      for (const eleve of eleves || []) {
        if (sousMoratoire(eleve)) continue;
        const e = computeEcheances(eleve, schoolYear, eleve.feeSchedule || null).find((x) => x.id === ech.type);
        if (!e || e.statut === 'payee') continue;
        concernes.push({ id: eleve.id, nom: eleve.full_name });
      }
      if (concernes.length > 0) sorties.push({ jours, date: dateDuJour(jourEcheance - jalon), jalon, type: ech.type, libelle: ech.libelle, eleves: concernes });
    }
  }
  return sorties.sort((a, b) => a.jours - b.jours || b.jalon - a.jalon);
}
