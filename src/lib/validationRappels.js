// Rappels automatiques : validation par le fondateur avant l'envoi.
//
// Quand le réglage est activé, cron-reminders prépare la liste du jour (table rappels_a_valider) au lieu d'écrire aux parents. Le
// fondateur valide ou refuse ; à l'heure limite, tout ce qui n'est pas refusé part automatiquement.
// Les règles ci-dessous (heure limite, qui part, qui est annulé) sont une COPIE de la fonction serveur cron-reminders :
// tests/validation-rappels.test.js vérifie que les deux restent identiques.
import { JALONS, LIBELLE_JALON, ECHEANCES } from './rappelsAuto.js';

// Heure limite, en UTC. 11 h UTC = midi au Bénin (UTC+1). La tâche planifiée doit tourner jusque-là (voir README des tâches).
export const HEURE_LIMITE_UTC = 11;
export const DECALAGE_BENIN = 1;
export const heureLimiteBenin = () => HEURE_LIMITE_UTC + DECALAGE_BENIN;

export const cleRappel = (parentId, studentId, templateName) => `${parentId}:${studentId}:${templateName}`;

// Un rappel part s'il est validé, ou s'il attend encore et que l'heure limite est passée. Un refusé ne part jamais.
export function peutPartir(statut, heureUtc) {
  return statut === 'valide' || (statut === 'a_valider' && heureUtc >= HEURE_LIMITE_UTC);
}

/**
 * Ce que la tâche planifiée doit faire à ce passage, pour une école avec validation.
 *  - candidats : clés des rappels qui devraient partir aujourd'hui (calculées à l'instant, donc sans ceux qui ont payé entre-temps)
 *  - lignes : ce qui est déjà préparé aujourd'hui ({ id, cle, statut })
 * Renvoie { aInserer (clés à préparer), aEnvoyer ([{ cle, ligneId }]), aAnnuler (ids de lignes à annuler) }.
 * Un rappel qui vient d'être préparé ne part jamais dans le même passage : le fondateur a au moins un passage pour réagir.
 */
export function planifierValidation(candidats, lignes, heureUtc) {
  const parCle = new Map(lignes.map((l) => [l.cle, l]));
  const presents = new Set(candidats);
  const aInserer = candidats.filter((c) => !parCle.has(c));
  const aEnvoyer = candidats
    .filter((c) => parCle.has(c) && peutPartir(parCle.get(c).statut, heureUtc))
    .map((c) => ({ cle: c, ligneId: parCle.get(c).id }));
  const aAnnuler = lignes.filter((l) => (l.statut === 'a_valider' || l.statut === 'valide') && !presents.has(l.cle)).map((l) => l.id);
  return { aInserer, aEnvoyer, aAnnuler };
}

// « rappel_j15_tranche1 » -> « 15 jours avant la 1ère tranche ». Un nom inconnu est rendu tel quel.
export function decrireRappel(templateName) {
  const m = String(templateName || '').match(/^rappel_j(-?\d+)_(\w+)$/);
  if (!m) return String(templateName || '');
  const jalon = Number(m[1]);
  const ech = ECHEANCES.find((e) => e.type === m[2]);
  if (!JALONS.includes(jalon) || !ech) return String(templateName);
  return `${LIBELLE_JALON[jalon]} ${ech.libelle}`;
}

// Date du jour en UTC, au format de la colonne « jour » (la tâche planifiée tourne en UTC).
export const jourUtc = (date = new Date()) => date.toISOString().slice(0, 10);
