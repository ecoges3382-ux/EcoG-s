// Numéros de téléphone : logique commune, sans React, pour pouvoir la tester et la copier côté serveur.
//
// Règle générale : un numéro est enregistré au format international (« +22901 97 20 19 09 » sans espaces).
// L'indicatif par défaut est celui du pays de l'école (Paramètres), « 229 » (Bénin) tant qu'il n'est pas choisi.
// Quelqu'un qui vit dans un autre pays garde son propre indicatif : il suffit de le choisir dans le sélecteur
// de pays du champ, ou de saisir le numéro complet avec « + » ou « 00 ».

export const DEFAULT_DIAL = '229';

export function onlyDigits(str) {
  return String(str || '').replace(/\D/g, '');
}

// Recombine indicatif + numéro local (saisi librement, espaces/tirets tolérés) en E.164.
// Renvoie '' si rien n'est saisi.
export function composePhone(dial, local) {
  const digits = onlyDigits(local);
  if (!digits) return '';

  // Bénin (réforme ARCEP du 30 nov. 2024) et Côte d'Ivoire (réforme ARTCI du 31 janv. 2021) : le préfixe à
  // 2 chiffres (01, ou 01/05/07 selon l'opérateur pour la Côte d'Ivoire) fait désormais partie intégrante du
  // numéro national — ce n'est plus un indicatif de tronc à retirer pour l'international.
  if (dial === '229') {
    // Un ancien numéro à 8 chiffres saisi par habitude : le « 01 » est uniforme quel que soit l'opérateur au
    // Bénin, donc on peut le compléter automatiquement sans se tromper.
    const withPrefix = digits.length === 8 ? `01${digits}` : digits;
    return `+${dial}${withPrefix}`;
  }
  if (dial === '225') {
    // Le préfixe ivoirien dépend de l'opérateur : impossible de le deviner à partir de 8 chiffres seuls, donc
    // on garde tel quel ce qui est saisi, sans retirer de zéro initial.
    return `+${dial}${digits}`;
  }

  return `+${dial}${digits.replace(/^0+/, '')}`;
}

// Numéro enregistré (n'importe quelle forme) -> « +indicatif… » valide, ou null s'il est inutilisable.
//  - « +… » ou « 00… » : déjà international, seulement nettoyé et contrôlé ;
//  - chiffres seuls : on ajoute l'indicatif du pays de l'école, comme le fait le champ de saisie. Si le numéro
//    commence déjà par cet indicatif et que le reste est assez long (ex. « 22997000001 »), on ne le double pas.
export function toInternational(raw, dial = DEFAULT_DIAL) {
  if (raw === null || raw === undefined) return null;
  let p = String(raw).trim().replace(/[\s().-]/g, '');
  if (!p) return null;
  if (p.startsWith('00')) p = `+${p.slice(2)}`;
  if (!p.startsWith('+')) {
    if (!/^\d+$/.test(p)) return null;
    const indicatif = /^\d{1,3}$/.test(String(dial)) ? String(dial) : DEFAULT_DIAL;
    const dejaAvecIndicatif = p.startsWith(indicatif) && p.length >= indicatif.length + 8;
    const local = dejaAvecIndicatif ? p.slice(indicatif.length) : p;
    if (local.length < 7) return null; // trop court pour un numéro : évite d'enregistrer « +22912345 »
    p = composePhone(indicatif, local);
  }
  return /^\+[1-9]\d{6,14}$/.test(p) ? p : null;
}
