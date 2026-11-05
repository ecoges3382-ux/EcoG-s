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

export function whatsappQuota(plan) {
  return WHATSAPP_QUOTAS[plan] ?? 0;
}

export function whatsappEnabledForPlan(plan) {
  return (WHATSAPP_QUOTAS[plan] ?? 0) > 0 || plan === 'premium';
}

// Prix (F CFA)
export const PLAN_PRICES = {
  decouverte: { mensuel: 0, annuel: 0 },
  essentiel: { mensuel: 12000, annuel: 120000 },
  standard: { mensuel: 20000, annuel: 200000 },
  premium: { mensuel: 35000, annuel: 350000 },
};

// Prix offre de lancement (-20 % à vie)
export const LAUNCH_PRICES = {
  essentiel: { mensuel: 9600, annuel: 96000 },
  standard: { mensuel: 16000, annuel: 160000 },
  premium: { mensuel: 28000, annuel: 280000 },
};
