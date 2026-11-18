// Les calculs d'échéances existent en QUATRE exemplaires : dans l'application (src/lib/retard.js) et copiés dans trois
// fonctions serveur (openwa-send, whatsapp-send, cron-reminders), parce qu'une fonction Deno ne peut pas importer le code
// de l'application. Chaque copie qui diverge, c'est un parent relancé à tort ou un montant faux dans un message.
// Ces tests exécutent les quatre versions sur les mêmes cas et exigent exactement les mêmes résultats.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { computeEcheances as clientComputeEcheances } from '../src/lib/retard.js';
import { lireFonctionServeur, extraireFonction, extraireConstante, compiler } from './helpers/extraire.js';

const FONCTIONS = ['openwa-send', 'whatsapp-send', 'cron-reminders'];

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-18T12:00:00Z')); });
afterAll(() => { vi.useRealTimers(); });

function copieServeur(nom) {
  const source = lireFonctionServeur(nom);
  return compiler(
    [extraireConstante(source, 'TRANCHE_LABELS'), extraireFonction(source, 'trancheSlots'), extraireFonction(source, 'computeEcheances')],
    ['computeEcheances'],
  ).computeEcheances;
}

function alea(graine) { let s = graine; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

function genererCas(n) {
  const r = alea(2026);
  const entier = (max) => Math.floor(r() * max);
  const date = () => { const x = r(); return x < 0.4 ? '2026-10-01' : x < 0.8 ? '2027-02-01' : (x < 0.9 ? '2026-11-18' : null); };
  const cas = [];
  for (let i = 0; i < n; i++) {
    cas.push({
      enrollment: {
        montant_du: r() < 0.05 ? 0 : entier(2_000_000),
        montant_paye: r() < 0.1 ? entier(3_000_000) : entier(1_000_000),
        frais_connexe_du: r() < 0.5 ? 0 : entier(50_000),
        frais_connexe_paye: entier(60_000),
      },
      schoolYear: { date_tranche1: date(), date_tranche2: date(), date_tranche3: date(), date_connexe: date() },
      feeSchedule: r() < 0.2 ? null : { montant_tranche1: entier(300_000), montant_tranche2: entier(300_000), montant_tranche3: r() < 0.3 ? 0 : entier(300_000) },
    });
  }
  return cas;
}

describe('les copies serveur du calcul des échéances donnent les mêmes résultats que l\'application', () => {
  const cas = genererCas(800);
  for (const nom of FONCTIONS) {
    it(`${nom} : 800 cas identiques à src/lib/retard.js`, () => {
      const serveur = copieServeur(nom);
      for (const [i, c] of cas.entries()) {
        const attendu = clientComputeEcheances(c.enrollment, c.schoolYear, c.feeSchedule);
        const obtenu = serveur(c.enrollment, c.schoolYear, c.feeSchedule);
        expect(JSON.stringify(obtenu), `${nom}, cas ${i} : ${JSON.stringify(c)}`).toBe(JSON.stringify(attendu));
      }
    });
  }

  it('les cas tirés couvrent bien les situations importantes (garde-fou du test lui-même)', () => {
    const toutes = cas.flatMap((c) => clientComputeEcheances(c.enrollment, c.schoolYear, c.feeSchedule));
    const statuts = new Set(toutes.map((e) => e.statut));
    expect(statuts).toEqual(new Set(['payee', 'partielle', 'impayee', 'a_venir']));
    expect(toutes.some((e) => e.enRetard)).toBe(true);
    expect(toutes.some((e) => e.id === 'connexe')).toBe(true);
  });
});
