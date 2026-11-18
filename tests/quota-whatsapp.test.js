// Quota mensuel de messages WhatsApp. Le calcul existe en trois exemplaires (src/lib/plan.js, openwa-send, cron-reminders) :
// ces tests exigent qu'ils restent identiques, et vérifient ce que compte (et ne compte pas) la requête de comptage.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { whatsappQuota as clientQuota } from '../src/lib/plan.js';
import { lireFonctionServeur, extraireFonction, extraireConstante, compiler } from './helpers/extraire.js';

const FONCTIONS = ['openwa-send', 'cron-reminders'];
const PLANS_TESTES = ['decouverte', 'essentiel', 'standard', 'premium', '', 'inconnu', undefined, null];

function copie(nom) {
  const source = lireFonctionServeur(nom);
  return compiler(
    [extraireConstante(source, 'WHATSAPP_QUOTAS'), extraireFonction(source, 'whatsappQuota'), extraireFonction(source, 'quotaState')],
    ['whatsappQuota', 'quotaState'],
  );
}

afterEach(() => { vi.useRealTimers(); });

describe('le quota WhatsApp serveur suit exactement celui de l\'application', () => {
  for (const nom of FONCTIONS) {
    it(`${nom} : même quota pour chaque plan, y compris plan inconnu ou vide`, () => {
      const { whatsappQuota } = copie(nom);
      for (const plan of PLANS_TESTES) expect(whatsappQuota(plan), `${nom}, plan ${String(plan)}`).toBe(clientQuota(plan));
    });
  }

  it('le texte du comptage est identique dans les deux fonctions', () => {
    const [a, b] = FONCTIONS.map((nom) => extraireFonction(lireFonctionServeur(nom), 'quotaState'));
    expect(a).toBe(b);
  });
});

// Faux client : enregistre les filtres de la requête de comptage et renvoie le nombre voulu.
function faussClient({ count, error = null }) {
  const appels = { table: null, filtres: [], options: null };
  const api = {
    select(_cols, options) { appels.options = options; return api; },
    eq(k, v) { appels.filtres.push(['eq', k, v]); return api; },
    neq(k, v) { appels.filtres.push(['neq', k, v]); return api; },
    gte(k, v) { appels.filtres.push(['gte', k, v]); return api; },
    then(res, rej) { return Promise.resolve({ count, error }).then(res, rej); },
  };
  return { client: { from(t) { appels.table = t; return api; } }, appels };
}

describe('ce que compte le quota', () => {
  for (const nom of FONCTIONS) {
    it(`${nom} : les messages de CETTE école, ce mois-ci (UTC), sans les échecs`, async () => {
      vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-18T12:00:00Z'));
      const { quotaState } = copie(nom);
      const { client, appels } = faussClient({ count: 120 });
      const etat = await quotaState(client, 'ECOLE-1', 'essentiel');
      expect(etat).toEqual({ quota: 1000, used: 120 });
      expect(appels.table).toBe('whatsapp_messages');
      expect(appels.options).toEqual({ count: 'exact', head: true });
      expect(appels.filtres).toContainEqual(['eq', 'school_id', 'ECOLE-1']);
      expect(appels.filtres).toContainEqual(['neq', 'statut', 'echec']);
      expect(appels.filtres).toContainEqual(['gte', 'created_at', '2026-11-01T00:00:00.000Z']);
    });

    it(`${nom} : le 1er du mois à 00:00 UTC compte déjà pour le nouveau mois`, async () => {
      vi.useFakeTimers(); vi.setSystemTime(new Date('2026-12-01T00:00:00Z'));
      const { quotaState } = copie(nom);
      const { client, appels } = faussClient({ count: 0 });
      await quotaState(client, 'E', 'standard');
      expect(appels.filtres).toContainEqual(['gte', 'created_at', '2026-12-01T00:00:00.000Z']);
    });

    it(`${nom} : Premium (illimité) ne fait aucune requête`, async () => {
      const { quotaState } = copie(nom);
      const { client, appels } = faussClient({ count: 999999 });
      expect(await quotaState(client, 'E', 'premium')).toEqual({ quota: null, used: 0 });
      expect(appels.table).toBeNull();
    });

    it(`${nom} : si le comptage échoue, on le sait (jamais un « 0 message » par défaut)`, async () => {
      const { quotaState } = copie(nom);
      await expect(quotaState(faussClient({ count: null, error: { message: 'x' } }).client, 'E', 'essentiel')).rejects.toThrow('quota_indisponible');
      await expect(quotaState(faussClient({ count: null }).client, 'E', 'essentiel')).rejects.toThrow('quota_indisponible');
    });
  }
});

describe('refus d\'un envoi qui dépasse le quota (openwa-send)', () => {
  const { assertQuota } = compiler([extraireFonction(lireFonctionServeur('openwa-send'), 'assertQuota')], ['assertQuota']);

  it('passe tant que le reste couvre tout l\'envoi, pile à la limite comprise', () => {
    expect(() => assertQuota({ quota: 1000, used: 0 }, 1)).not.toThrow();
    expect(() => assertQuota({ quota: 1000, used: 950 }, 50)).not.toThrow();
  });

  it('illimité : toujours accepté', () => {
    expect(() => assertQuota({ quota: null, used: 0 }, 100000)).not.toThrow();
  });

  it('quota épuisé : message clair', () => {
    expect(() => assertQuota({ quota: 1000, used: 1000 }, 1)).toThrow(/quota WhatsApp du mois est atteint \(1000 messages/);
    expect(() => assertQuota({ quota: 1000, used: 1200 }, 1)).toThrow(/est atteint/); // déjà dépassé : jamais un reste négatif
  });

  it('envoi trop gros pour le reste : refusé en entier, avec le reste et la demande', () => {
    expect(() => assertQuota({ quota: 1000, used: 990 }, 20)).toThrow(/Il vous reste 10 messages WhatsApp ce mois-ci \(quota de 1000\) et cet envoi en demande 20/);
    expect(() => assertQuota({ quota: 1000, used: 999 }, 2)).toThrow(/Il vous reste 1 message WhatsApp/);
  });
});
