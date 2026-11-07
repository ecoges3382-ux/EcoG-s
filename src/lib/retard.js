import { TRANCHES } from './utils.js';

// Source unique pour tout calcul lié aux échéances de paiement d'un élève
// (Élèves, Argent, fiche élève, Dashboard) — au lieu de dupliquer la
// logique. computeRelance() est un dérivé de computeEcheances() : jamais
// deux calculs indépendants du même "reste à payer".
function trancheSlots(montantDu, feeSchedule, nbDelais) {
  const bruts = [
    Number(feeSchedule?.montant_tranche1) || 0,
    Number(feeSchedule?.montant_tranche2) || 0,
    Number(feeSchedule?.montant_tranche3) || 0,
  ];
  const totalBrut = bruts[0] + bruts[1] + bruts[2];
  const du = Number(montantDu) || 0;

  if (totalBrut > 0) {
    const actifs = [0, 1, 2].filter((i) => bruts[i] > 0);
    const montants = actifs.map((i) => Math.round((bruts[i] / totalBrut) * du));
    const ecart = du - montants.reduce((a, v) => a + v, 0);
    montants[montants.length - 1] += ecart;
    return actifs.map((slotIndex, k) => ({ slotIndex, montant: montants[k] }));
  }

  const n = Math.max(nbDelais, 1);
  const part = Math.round(du / n);
  return Array.from({ length: n }, (_, k) => ({
    slotIndex: k,
    montant: k === n - 1 ? du - part * (n - 1) : part,
  }));
}

// EXPORT IMPORTANT ICI
export function computeEcheances(enrollment, schoolYear, feeSchedule) {
  if (!schoolYear || !enrollment) return [];
  const today = new Date();
  const montantDu = Number(enrollment.montant_du) || 0;
  const montantPayeTotal = Number(enrollment.montant_paye) || 0;

  const datesConfigurees = [schoolYear.date_tranche1, schoolYear.date_tranche2, schoolYear.date_tranche3];
  const nbDelais = datesConfigurees.filter(Boolean).length;
  const slots = trancheSlots(montantDu, feeSchedule, nbDelais);

  let cumulAvant = 0;
  const echeancesScolarite = slots.map(({ slotIndex, montant }, k) => {
    const montantPaye = Math.min(Math.max(montantPayeTotal - cumulAvant, 0), montant);
    const dateLimite = datesConfigurees[slotIndex] || null;
    const isFuture = !!dateLimite && new Date(dateLimite) > today;

    let statut = 'impayee';
    if (montant <= 0 || montantPaye >= montant) {
      statut = 'payee';
    } else if (montantPaye > 0) {
      statut = 'partielle';
    } else if (isFuture) {
      statut = 'a_venir';
    }

    const enRetard = statut !== 'payee' && statut !== 'a_venir' && !!dateLimite && new Date(dateLimite) < today;
    cumulAvant += montant;

    return {
      id: `tranche${slotIndex + 1}`,
      label: TRANCHES.find((t) => t.id === `tranche${slotIndex + 1}`)?.label || `Échéance ${k + 1}`,
      ordre: k + 1,
      montant,
      dateLimite,
      montantPaye,
      montantRestant: Math.max(montant - montantPaye, 0),
      statut,
      enRetard,
    };
  });

  const echeances = [...echeancesScolarite];
  if (schoolYear.date_connexe || Number(enrollment.frais_connexe_du) > 0) {
    const montant = Number(enrollment.frais_connexe_du) || 0;
    const montantPaye = Math.min(Number(enrollment.frais_connexe_paye) || 0, montant);
    const isFuture = !!schoolYear.date_connexe && new Date(schoolYear.date_connexe) > today;

    let statut = 'impayee';
    if (montant <= 0 || montantPaye >= montant) {
      statut = 'payee';
    } else if (montantPaye > 0) {
      statut = 'partielle';
    } else if (isFuture) {
      statut = 'a_venir';
    }

    const enRetard = statut !== 'payee' && statut !== 'a_venir' && !!schoolYear.date_connexe && new Date(schoolYear.date_connexe) < today;

    echeances.push({
      id: 'connexe',
      label: 'Frais connexes',
      ordre: echeancesScolarite.length + 1,
      montant,
      dateLimite: schoolYear.date_connexe || null,
      montantPaye,
      montantRestant: Math.max(montant - montantPaye, 0),
      statut,
      enRetard,
    });
  }

  return echeances;
}

export const MORATOIRE_ALERTE_JOURS = 7;

function hasMoratoireActif(enrollment) {
  if (!enrollment) return false;
  if (enrollment.moratoire_actif === true) return true;
  if (enrollment.note_arrangement && enrollment.note_arrangement.trim() !== '') return true;
  return false;
}

export function resumeMoratoire(enrollment) {
  if (!enrollment) return 'Aucun moratoire';
  if (!hasMoratoireActif(enrollment)) return 'Aucun moratoire';
  const parts = [];
  if (enrollment.moratoire_motif) parts.push(`Motif : ${enrollment.moratoire_motif}`);
  if (enrollment.moratoire_montant_convenu != null) parts.push(`Montant convenu : ${Number(enrollment.moratoire_montant_convenu).toLocaleString('fr-FR')} F`);
  if (enrollment.moratoire_nb_mensualites) parts.push(`${enrollment.moratoire_nb_mensualites} mensualité(s)`);
  if (enrollment.moratoire_date_debut) parts.push(`Début : ${enrollment.moratoire_date_debut}`);
  if (enrollment.moratoire_date_fin) parts.push(`Fin : ${enrollment.moratoire_date_fin}`);
  if (enrollment.moratoire_prochaine_echeance) parts.push(`Prochaine échéance : ${enrollment.moratoire_prochaine_echeance}`);
  if (enrollment.note_arrangement && enrollment.note_arrangement.trim() !== '') parts.push(`Note : ${enrollment.note_arrangement}`);
  return parts.length > 0 ? parts.join(' · ') : 'Moratoire actif';
}

export function computeRelance(enrollment, schoolYear, feeSchedule) {
  if (!enrollment) {
    return { relance: false, moratoire: false, relanceEcolage: false, relanceConnexe: false };
  }

  const maintenant = new Date();

  const ecolageDu = Number(enrollment.montant_du) || 0;
  const ecolagePaye = Number(enrollment.montant_paye) || 0;
  const connexeDu = Number(enrollment.frais_connexe_du) || 0;
  const connexePaye = Number(enrollment.frais_connexe_paye) || 0;
  const toutPaye = (ecolageDu - ecolagePaye <= 0) && (connexeDu - connexePaye <= 0);

  const moratoireActif = hasMoratoireActif(enrollment);

  if (moratoireActif && toutPaye) {
    return {
      relance: false,
      moratoire: false,
      moratoireRetireAuto: true,
      relanceEcolage: false,
      relanceConnexe: false,
    };
  }

  if (moratoireActif) {
    let joursRestantsMoratoire = null;
    let moratoireExpirant = false;

    if (enrollment.moratoire_date_fin) {
      const fin = new Date(enrollment.moratoire_date_fin);
      const diffMs = fin.getTime() - maintenant.getTime();
      joursRestantsMoratoire = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (joursRestantsMoratoire <= MORATOIRE_ALERTE_JOURS) {
        moratoireExpirant = true;
      }
    }

    if (moratoireExpirant && schoolYear) {
      const echeances = computeEcheances(enrollment, schoolYear, feeSchedule);
      const relanceEcolage = echeances.some((e) => e.id !== 'connexe' && e.enRetard);
      const relanceConnexe = echeances.some((e) => e.id === 'connexe' && e.enRetard);
      return {
        relance: relanceEcolage || relanceConnexe,
        moratoire: false,
        moratoireExpirant: true,
        joursRestantsMoratoire,
        relanceEcolage,
        relanceConnexe,
      };
    }

    return {
      relance: false,
      moratoire: true,
      joursRestantsMoratoire,
      relanceEcolage: false,
      relanceConnexe: false,
    };
  }

  if (!schoolYear) {
    return { relance: false, moratoire: false, relanceEcolage: false, relanceConnexe: false };
  }

  const echeances = computeEcheances(enrollment, schoolYear, feeSchedule);
  const relanceEcolage = echeances.some((e) => e.id !== 'connexe' && e.enRetard);
  const relanceConnexe = echeances.some((e) => e.id === 'connexe' && e.enRetard);

  return { relance: relanceEcolage || relanceConnexe, moratoire: false, relanceEcolage, relanceConnexe };
}
