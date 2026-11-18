// Centralisation des plans, features et quotas. À utiliser partout où
// on a besoin de savoir ce qu'un plan autorise (Settings, Parents, Staff,
// PlatformAdmin, Landing).

export const PLANS = ['decouverte', 'essentiel', 'standard', 'premium'];

export const PLAN_LABELS = {
  decouverte: 'Découverte',
  essentiel: 'Essentiel',
  standard: 'Standard',
  premium: 'Premium',
};

// Feature → plan minimal requis
const FEATURE_REQUIREMENTS = {
  parent_portal: 'essentiel',
  personnel: 'essentiel',
  emploi_du_temps: 'essentiel',
  documents: 'essentiel',
  rapports_avances: 'essentiel',
  whatsapp: 'essentiel',
  passage_annee: 'standard',
  roles_personnalises: 'standard',
  multi_campus: 'premium',
};

export function planIndex(plan) {
  return PLANS.indexOf(plan);
}

export function hasFeature(plan, feature) {
  const required = FEATURE_REQUIREMENTS[feature];
  if (!required) return true;
  return planIndex(plan) >= planIndex(required);
}

export function getPlanLabel(plan) {
  return PLAN_LABELS[plan] || plan;
}

export function featurePlanRequired(feature) {
  return PLAN_LABELS[FEATURE_REQUIREMENTS[feature]] || 'Standard';
}

// Quotas WhatsApp mensuels (null = illimité / fair use)
const WHATSAPP_QUOTAS = {
  decouverte: 0,
  essentiel: 1000,
  standard: 3000,
  premium: null,
};

// null = illimité (Premium) ; un plan inconnu ou vide vaut 0 : jamais traité comme un plan payant.
export function whatsappQuota(plan) {
  return Object.prototype.hasOwnProperty.call(WHATSAPP_QUOTAS, plan) ? WHATSAPP_QUOTAS[plan] : 0;
}

export function whatsappEnabledForPlan(plan) {
  const quota = whatsappQuota(plan);
  return quota === null || quota > 0;
}

// Limites annoncées sur la page d'accueil (null = illimité). Elles ne BLOQUENT rien : l'application
// avertit l'école (bandeau) et la console d'administration montre qui dépasse. Un plan inconnu ou vide
// vaut Découverte : jamais traité comme un plan large.
const STUDENT_LIMITS = { decouverte: 50, essentiel: 300, standard: 800, premium: null };
const ACCOUNT_LIMITS = { decouverte: 2, essentiel: 10, standard: null, premium: null };

function limitFor(table, plan) {
  return Object.prototype.hasOwnProperty.call(table, plan) ? table[plan] : table.decouverte;
}
export function studentLimit(plan) { return limitFor(STUDENT_LIMITS, plan); }
export function accountLimit(plan) { return limitFor(ACCOUNT_LIMITS, plan); }

// 'ok' (sous 90 %), 'near' (90 % ou plus), 'full' (limite atteinte ou dépassée). Illimité : toujours 'ok'.
export function usageLevel(count, limit) {
  if (limit === null || limit === undefined || !(limit > 0)) return 'ok';
  if (count >= limit) return 'full';
  if (count >= Math.ceil(limit * 0.9)) return 'near';
  return 'ok';
}

// Plan à proposer quand une limite est atteinte (null si déjà au plus haut).
export function nextPlan(plan) {
  const i = planIndex(plan);
  return i >= 0 && i < PLANS.length - 1 ? PLANS[i + 1] : null;
}

// 👇 NOUVELLE GRILLE TARIFAIRE (Prix standards) 👇
export const PLAN_PRICES = {
  decouverte: { mensuel: 0, annuel: 0 },
  essentiel: { mensuel: 12000, annuel: 120000 },
  standard: { mensuel: 20000, annuel: 200000 },
  premium: { mensuel: 40000, annuel: 400000 },
};

// 👇 PRIX OFFRE DE LANCEMENT (-20 % à vie) 👇
export const LAUNCH_PRICES = {
  essentiel: { mensuel: 9600, annuel: 96000 },
  standard: { mensuel: 16000, annuel: 160000 },
  premium: { mensuel: 32000, annuel: 320000 },
};
