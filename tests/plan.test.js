// Règles des offres (Découverte, Essentiel, Standard, Premium) : ce que chaque plan permet.
import { describe, it, expect } from 'vitest';
import { PLANS, planIndex, hasFeature, whatsappQuota, whatsappEnabledForPlan, PLAN_PRICES, LAUNCH_PRICES, studentLimit, accountLimit, usageLevel, nextPlan } from '../src/lib/plan.js';

describe('fonctions réservées à un plan', () => {
  it('l\'ordre des plans est Découverte < Essentiel < Standard < Premium', () => {
    expect(PLANS).toEqual(['decouverte', 'essentiel', 'standard', 'premium']);
    expect(planIndex('premium')).toBeGreaterThan(planIndex('standard'));
  });

  it('le plan gratuit n\'a ni portail parent, ni WhatsApp, ni personnel', () => {
    for (const f of ['parent_portal', 'whatsapp', 'personnel', 'emploi_du_temps', 'documents', 'rapports_avances']) {
      expect(hasFeature('decouverte', f), f).toBe(false);
      expect(hasFeature('essentiel', f), f).toBe(true);
    }
  });

  it('le passage d\'année et les rôles personnalisés commencent au plan Standard', () => {
    for (const f of ['passage_annee', 'roles_personnalises']) {
      expect(hasFeature('essentiel', f), f).toBe(false);
      expect(hasFeature('standard', f), f).toBe(true);
      expect(hasFeature('premium', f), f).toBe(true);
    }
  });

  it('le multi-campus est réservé à Premium', () => {
    expect(hasFeature('standard', 'multi_campus')).toBe(false);
    expect(hasFeature('premium', 'multi_campus')).toBe(true);
  });

  it('une fonction non réservée est ouverte à tous', () => {
    expect(hasFeature('decouverte', 'fonction_inconnue_de_la_liste')).toBe(true);
  });
});

describe('WhatsApp selon le plan', () => {
  it('aucun message pour le plan gratuit, des quotas croissants, illimité en Premium', () => {
    expect(whatsappQuota('decouverte')).toBe(0);
    expect(whatsappQuota('essentiel')).toBe(1000);
    expect(whatsappQuota('standard')).toBe(3000);
    expect(whatsappQuota('premium')).toBeNull();
  });

  it('WhatsApp activé à partir d\'Essentiel', () => {
    expect(whatsappEnabledForPlan('decouverte')).toBe(false);
    expect(whatsappEnabledForPlan('essentiel')).toBe(true);
    expect(whatsappEnabledForPlan('premium')).toBe(true);
  });

  it('un plan inconnu ou vide est traité comme gratuit (jamais comme payant)', () => {
    expect(whatsappQuota(undefined)).toBe(0);
    expect(whatsappEnabledForPlan(null)).toBe(false);
    expect(hasFeature('plan_qui_n_existe_pas', 'whatsapp')).toBe(false);
  });
});

describe('prix', () => {
  it('l\'offre de lancement fait bien 20 % de moins que le prix normal, pour chaque plan payant', () => {
    for (const plan of ['essentiel', 'standard', 'premium']) {
      expect(LAUNCH_PRICES[plan].annuel, plan).toBe(PLAN_PRICES[plan].annuel * 0.8);
      expect(LAUNCH_PRICES[plan].mensuel, plan).toBe(PLAN_PRICES[plan].mensuel * 0.8);
    }
  });

  it('le plan gratuit est gratuit, et le prix annuel est toujours inférieur à 12 mensualités', () => {
    expect(PLAN_PRICES.decouverte).toEqual({ mensuel: 0, annuel: 0 });
    for (const plan of ['essentiel', 'standard', 'premium']) expect(PLAN_PRICES[plan].annuel).toBeLessThan(PLAN_PRICES[plan].mensuel * 12);
  });
});

describe('limites d\'élèves et de comptes', () => {
  it('reprennent exactement ce qui est annoncé sur la page d\'accueil', () => {
    expect(['decouverte', 'essentiel', 'standard', 'premium'].map(studentLimit)).toEqual([50, 300, 800, null]);
    expect(['decouverte', 'essentiel', 'standard', 'premium'].map(accountLimit)).toEqual([2, 10, null, null]);
  });

  it('un plan inconnu ou vide a les limites du plan gratuit, jamais celles d\'un plan large', () => {
    expect(studentLimit(undefined)).toBe(50);
    expect(accountLimit('nimporte_quoi')).toBe(2);
  });

  it('le niveau d\'alerte : ok sous 90 %, near dès 90 %, full à la limite et au-delà', () => {
    expect(usageLevel(269, 300)).toBe('ok');
    expect(usageLevel(270, 300)).toBe('near');
    expect(usageLevel(299, 300)).toBe('near');
    expect(usageLevel(300, 300)).toBe('full');
    expect(usageLevel(350, 300)).toBe('full');
    expect(usageLevel(0, 50)).toBe('ok');
    expect(usageLevel(45, 50)).toBe('near');
    expect(usageLevel(1, 2)).toBe('ok');
    expect(usageLevel(2, 2)).toBe('full');
  });

  it('illimité : jamais d\'alerte', () => {
    expect(usageLevel(5000, null)).toBe('ok');
    expect(usageLevel(5000, undefined)).toBe('ok');
  });

  it('le plan suivant proposé, et rien après Premium', () => {
    expect(nextPlan('decouverte')).toBe('essentiel');
    expect(nextPlan('standard')).toBe('premium');
    expect(nextPlan('premium')).toBeNull();
    expect(nextPlan('inconnu')).toBeNull();
  });
});
