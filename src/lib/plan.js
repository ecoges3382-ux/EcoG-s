// src/lib/plan.js
// Règles centralisées des plans commerciaux EcoGès.
// Toute modification de prix ou de limite se fait ICI, jamais ailleurs.

export const PLAN_LIMITS = {
  decouverte: {
    label: 'Découverte',
    labelUpgrade: null,
    maxStudents: 60,
    maxStaffAccounts: 2,
    features: {
      parent_portal: false,
      personnel: false,
      schedule: false,
      documents: false,
      advanced_reports: false,
      annual_rollover: false,
    },
  },
  essentiel: {
    label: 'Essentiel',
    maxStudents: 200,
    maxStaffAccounts: 10,
    features: {
      parent_portal: true,
      personnel: true,
      schedule: true,
      documents: true,
      advanced_reports: true,
      annual_rollover: false,
    },
  },
  standard: {
    label: 'Standard',
    maxStudents: 500,
    maxStaffAccounts: Infinity,
    features: {
      parent_portal: true,
      personnel: true,
      schedule: true,
      documents: true,
      advanced_reports: true,
      annual_rollover: true,
    },
  },
  premium: {
    label: 'Premium',
    maxStudents: Infinity,
    maxStaffAccounts: Infinity,
    features: {
      parent_portal: true,
      personnel: true,
      schedule: true,
      documents: true,
      advanced_reports: true,
      annual_rollover: true,
    },
  },
};

// Libellé humain des features pour les messages "débloquer".
const FEATURE_PLAN_REQUIRED = {
  parent_portal: 'Essentiel',
  personnel: 'Essentiel',
  schedule: 'Essentiel',
  documents: 'Essentiel',
  advanced_reports: 'Essentiel',
  annual_rollover: 'Standard',
};

export function getPlan(planId) {
  return PLAN_LIMITS[planId] || PLAN_LIMITS.decouverte;
}

export function getPlanLabel(planId) {
  return getPlan(planId).label;
}

export function hasFeature(planId, featureKey) {
  return getPlan(planId).features[featureKey] === true;
}

export function featurePlanRequired(featureKey) {
  return FEATURE_PLAN_REQUIRED[featureKey] || 'Essentiel';
}

export function canAddStudent(planId, currentStudentCount) {
  const max = getPlan(planId).maxStudents;
  return currentStudentCount < max;
}

export function canAddStaffAccount(planId, currentAccountCount) {
  const max = getPlan(planId).maxStaffAccounts;
  return currentAccountCount < max;
}

export function studentQuotaLabel(planId) {
  const max = getPlan(planId).maxStudents;
  return max === Infinity ? 'illimité' : max;
}

export function staffQuotaLabel(planId) {
  const max = getPlan(planId).maxStaffAccounts;
  return max === Infinity ? 'illimité' : max;
}
