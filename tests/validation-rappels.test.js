// Validation des rappels automatiques par le fondateur : règles de décision, parité avec la fonction serveur, traitement côté serveur
// avec une base simulée, et présence des règles de sécurité en base.
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { HEURE_LIMITE_UTC, heureLimiteBenin, cleRappel, peutPartir, planifierValidation, decrireRappel, jourUtc } from '../src/lib/validationRappels.js';
import { reglagesRappels } from '../src/lib/rappelsAuto.js';
import { lireFonctionServeur, extraireFonction, extraireConstante, compiler } from './helpers/extraire.js';

const source = lireFonctionServeur('cron-reminders');
const serveur = compiler(
  [extraireConstante(source, 'MILESTONES'), extraireConstante(source, 'HEURE_LIMITE_UTC'), ...['cleRappel', 'peutPartir', 'planifierValidation', 'reglagesRappels'].map((n) => extraireFonction(source, n))],
  ['cleRappel', 'peutPartir', 'planifierValidation', 'reglagesRappels'],
);

describe('heure limite et décision d\'envoi', () => {
  it('11 h UTC = midi au Bénin', () => {
    expect(HEURE_LIMITE_UTC).toBe(11);
    expect(heureLimiteBenin()).toBe(12);
  });
  it('un rappel validé part à n\'importe quelle heure', () => {
    expect(peutPartir('valide', 8)).toBe(true);
    expect(peutPartir('valide', 11)).toBe(true);
  });
  it('un rappel en attente part seulement à partir de l\'heure limite (option B)', () => {
    expect(peutPartir('a_valider', 8)).toBe(false);
    expect(peutPartir('a_valider', 10)).toBe(false);
    expect(peutPartir('a_valider', 11)).toBe(true);
  });
  it('un rappel refusé, annulé, expiré ou déjà envoyé ne part jamais', () => {
    for (const st of ['refuse', 'annule', 'expire', 'envoye']) for (const h of [8, 11, 20]) expect(peutPartir(st, h), `${st} ${h}h`).toBe(false);
  });
});

describe('planification d\'un passage', () => {
  const ligne = (cle, statut, id = `id-${cle}`) => ({ id, cle, statut });
  it('premier passage du matin : tout est préparé, rien ne part', () => {
    expect(planifierValidation(['a', 'b'], [], 8)).toEqual({ aInserer: ['a', 'b'], aEnvoyer: [], aAnnuler: [] });
  });
  it('même après l\'heure limite, ce qui vient d\'être préparé ne part pas dans le même passage', () => {
    expect(planifierValidation(['a'], [], 11).aEnvoyer).toEqual([]);
  });
  it('avant l\'heure limite : seul le validé part', () => {
    const r = planifierValidation(['a', 'b', 'c'], [ligne('a', 'valide'), ligne('b', 'a_valider'), ligne('c', 'refuse')], 9);
    expect(r.aEnvoyer).toEqual([{ cle: 'a', ligneId: 'id-a' }]);
    expect(r.aInserer).toEqual([]);
  });
  it('après l\'heure limite : validé et en attente partent, le refusé non', () => {
    const r = planifierValidation(['a', 'b', 'c'], [ligne('a', 'valide'), ligne('b', 'a_valider'), ligne('c', 'refuse')], 11);
    expect(r.aEnvoyer.map((e) => e.cle)).toEqual(['a', 'b']);
  });
  it('un parent qui a payé entre-temps (plus candidat) est annulé, pas envoyé', () => {
    const r = planifierValidation(['a'], [ligne('a', 'a_valider'), ligne('b', 'a_valider'), ligne('c', 'valide'), ligne('d', 'refuse')], 11);
    expect(r.aAnnuler.sort()).toEqual(['id-b', 'id-c']); // le refusé n'a pas besoin d'être annulé
    expect(r.aEnvoyer.map((e) => e.cle)).toEqual(['a']);
  });
  it('un rappel déjà envoyé n\'est pas renvoyé', () => {
    const r = planifierValidation(['a'], [ligne('a', 'envoye')], 11);
    expect(r).toEqual({ aInserer: [], aEnvoyer: [], aAnnuler: [] });
  });
});

describe('parité avec la fonction serveur', () => {
  it('même clé, même décision, même plan', () => {
    expect(serveur.cleRappel('p', 's', 't')).toBe(cleRappel('p', 's', 't'));
    for (const st of ['a_valider', 'valide', 'refuse', 'envoye', 'annule', 'expire']) for (const h of [0, 8, 10, 11, 12, 23]) expect(serveur.peutPartir(st, h), `${st} ${h}`).toBe(peutPartir(st, h));
    const lignes = [{ id: '1', cle: 'a', statut: 'valide' }, { id: '2', cle: 'b', statut: 'a_valider' }, { id: '3', cle: 'x', statut: 'a_valider' }, { id: '4', cle: 'c', statut: 'refuse' }];
    for (const h of [8, 11]) expect(serveur.planifierValidation(['a', 'b', 'c', 'd'], lignes, h)).toEqual(planifierValidation(['a', 'b', 'c', 'd'], lignes, h));
  });
  it('le réglage « validation » est lu pareil des deux côtés', () => {
    for (const cas of [null, {}, { rappels_validation: true }, { rappels_validation: false }, { rappels_validation: 'oui' }]) expect(serveur.reglagesRappels(cas)).toEqual(reglagesRappels(cas));
  });
  it('sans réglage, la validation est désactivée : comportement d\'avant', () => {
    expect(reglagesRappels(null).validation).toBe(false);
    expect(reglagesRappels({ rappels_auto: true }).validation).toBe(false);
  });
});

// Base simulée : on enregistre les écritures et on rend les lignes demandées.
function baseSimulee(lignesExistantes, { erreurLecture = false } = {}) {
  const ecritures = [];
  const requete = (table) => {
    const etat = { op: null, valeurs: null, filtres: [] };
    const q = {
      select() { etat.op = 'select'; return q; },
      update(v) { etat.op = 'update'; etat.valeurs = v; return q; },
      upsert(rows, opts) { ecritures.push({ op: 'upsert', rows, opts }); return Promise.resolve({ error: null }); },
      eq(c, v) { etat.filtres.push(['eq', c, v]); return q; },
      lt(c, v) { etat.filtres.push(['lt', c, v]); return q; },
      in(c, v) { etat.filtres.push(['in', c, v]); return q; },
      then(resolve) {
        if (etat.op === 'update') { ecritures.push({ op: 'update', table, valeurs: etat.valeurs, filtres: etat.filtres }); return resolve({ error: null }); }
        return resolve(erreurLecture ? { data: null, error: { message: 'boom' } } : { data: lignesExistantes, error: null });
      },
    };
    return q;
  };
  return { client: { from: requete }, ecritures };
}

describe('traitement côté serveur (base simulée)', () => {
  const notifications = [];
  const traiter = (() => {
    // La notification au fondateur est remplacée par un espion : elle est testée plus bas.
    const espion = 'async function prevenirFondateur(_c: unknown, ecole: string, nombre: number) { (globalThis as any).__notifs.push([ecole, nombre]); }';
    const morceaux = [espion, extraireConstante(source, 'HEURE_LIMITE_UTC'), ...['cleRappel', 'peutPartir', 'planifierValidation', 'traiterValidation'].map((n) => extraireFonction(source, n))];
    return compiler(morceaux, ['traiterValidation']).traiterValidation;
  })();
  globalThis.__notifs = notifications;
  beforeEach(() => { notifications.length = 0; });
  const job = (p, st, t = 'rappel_j7_tranche2') => ({ schoolId: 'S', parentId: p, studentId: st, phone: '+22901970000' + p, templateName: t, message: `Bonjour ${p}`, config: {} });

  it('premier passage : prépare les rappels, n\'en envoie aucun', async () => {
    const { client, ecritures } = baseSimulee([]);
    const r = await traiter(client, 'S', [job('1', 'a'), job('2', 'b')]);
    expect(r).toEqual([]);
    const up = ecritures.find((e) => e.op === 'upsert');
    expect(up.rows).toHaveLength(2);
    expect(up.rows[0]).toMatchObject({ school_id: 'S', statut: 'a_valider', jour: jourUtc(), contenu: 'Bonjour 1', template_name: 'rappel_j7_tranche2' });
    expect(up.opts).toMatchObject({ ignoreDuplicates: true });
    expect(notifications).toEqual([['S', 2]]); // le fondateur est prévenu une fois, avec le nombre de rappels
  });
  it('aux passages suivants (rien de nouveau à préparer), le fondateur n\'est pas prévenu de nouveau', async () => {
    const lignes = [{ id: 'L1', statut: 'a_valider', parent_access_id: '1', student_id: 'a', template_name: 'rappel_j7_tranche2' }];
    const { client } = baseSimulee(lignes);
    await traiter(client, 'S', [job('1', 'a')]);
    expect(notifications).toEqual([]);
  });
  it('rend le validé (avec sa ligne à marquer) et annule celui qui a payé', async () => {
    const lignes = [
      { id: 'L1', statut: 'valide', parent_access_id: '1', student_id: 'a', template_name: 'rappel_j7_tranche2' },
      { id: 'L2', statut: 'refuse', parent_access_id: '2', student_id: 'b', template_name: 'rappel_j7_tranche2' },
      { id: 'L3', statut: 'a_valider', parent_access_id: '9', student_id: 'z', template_name: 'rappel_j7_tranche2' }, // a payé depuis
    ];
    const { client, ecritures } = baseSimulee(lignes);
    const r = await traiter(client, 'S', [job('1', 'a'), job('2', 'b')]);
    expect(r.map((j) => [j.parentId, j.ligneId])).toEqual([['1', 'L1']]);
    const annule = ecritures.find((e) => e.op === 'update' && e.valeurs.statut === 'annule');
    expect(annule.filtres).toContainEqual(['in', 'id', ['L3']]);
    expect(ecritures.some((e) => e.op === 'upsert')).toBe(false);
  });
  it('périme les rappels des jours passés', async () => {
    const { client, ecritures } = baseSimulee([]);
    await traiter(client, 'S', []);
    const expire = ecritures.find((e) => e.op === 'update' && e.valeurs.statut === 'expire');
    expect(expire.filtres).toContainEqual(['lt', 'jour', jourUtc()]);
  });
  it('lecture impossible : rien ne part pour cette école', async () => {
    const { client } = baseSimulee(null, { erreurLecture: true });
    expect(await traiter(client, 'S', [job('1', 'a')])).toEqual([]);
  });
});

describe('notification au fondateur', () => {
  const message = compiler([extraireFonction(source, 'messageNotificationValidation')], ['messageNotificationValidation']).messageNotificationValidation;
  it('annonce le nombre de rappels et l\'heure limite en heure du Bénin, et ouvre Recouvrement', () => {
    expect(message(1, HEURE_LIMITE_UTC)).toEqual({ title: '🔔 Rappels WhatsApp à valider', body: '1 rappel est prêt. Sans votre réponse, il part à 12 h.', url: '/recouvrement' });
    expect(message(25, HEURE_LIMITE_UTC).body).toBe('25 rappels sont prêts. Sans votre réponse, ceux que vous ne refusez pas partent à 12 h.');
  });
  it('n\'est envoyée qu\'à la préparation réussie, jamais en bloquant l\'envoi, et seulement au fondateur', () => {
    expect(source).toMatch(/else await prevenirFondateur\(adminClient, schoolId, rows\.length\)/);
    expect(source).toMatch(/\.eq\('school_id', schoolId\)\.eq\('role', 'fondateur'\)/);
    const corps = source.slice(source.indexOf('async function prevenirFondateur'), source.indexOf('async function traiterValidation'));
    expect(corps).toMatch(/try \{[\s\S]*\} catch \(err\) \{\s*console\.warn/); // une panne de notification ne casse rien
    expect(corps).toMatch(/if \(!cle \|\| !privee \|\| !sujet\) return;/);
  });
});

describe('affichage', () => {
  it('décrit un rappel en français', () => {
    expect(decrireRappel('rappel_j15_tranche1')).toBe('15 jours avant la 1ère tranche');
    expect(decrireRappel('rappel_j-3_connexe')).toBe('3 jours après les frais connexes');
    expect(decrireRappel('autre_chose')).toBe('autre_chose');
  });
});

describe('base de données et fonction serveur', () => {
  const schema = fs.readFileSync(path.resolve(import.meta.dirname, '../supabase/schema.sql'), 'utf8');
  it('le schéma crée la colonne (désactivée par défaut) et la table', () => {
    expect(schema).toMatch(/alter table schools add column if not exists rappels_validation boolean not null default false;/);
    expect(schema).toMatch(/create table if not exists rappels_a_valider/);
    expect(schema).toMatch(/alter table rappels_a_valider enable row level security;/);
  });
  it('seul le fondateur lit et décide, et il ne peut changer que le statut', () => {
    expect(schema).toMatch(/create policy "rappels_a_valider: select" on rappels_a_valider\s+for select using \(school_id = current_school_id\(\) and current_role_name\(\) = 'fondateur'\)/);
    expect(schema).toMatch(/create policy "rappels_a_valider: update"[\s\S]*?current_role_name\(\) = 'fondateur'/);
    expect(schema).toMatch(/revoke update on rappels_a_valider from authenticated;\s*grant update \(statut, decide_le\) on rappels_a_valider to authenticated;/);
    expect(schema).not.toMatch(/create policy "rappels_a_valider: (insert|delete)"/);
  });
  it('la fonction serveur lit la validation à part : sa colonne absente ne doit pas faire oublier la coupure des rappels', () => {
    expect(source).toMatch(/select\('rappels_auto, rappels_jalons'\)/);
    expect(source).toMatch(/select\('rappels_validation'\)/);
  });
  it('le texte envoyé est celui préparé : la ligne passe à « envoye » seulement après un envoi réussi', () => {
    expect(source).toMatch(/if \(job\.ligneId\) await adminClient\.from\('rappels_a_valider'\)\.update\(\{ statut: 'envoye' \}\)/);
  });
});
