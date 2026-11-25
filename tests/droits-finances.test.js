// Qui voit l'argent de l'école, côté application (même règle que la base de données).
import { describe, it, expect } from 'vitest';
import { peutVoirFinances, peutGererPersonnel } from '../src/lib/droits.js';
import { chargerSalairesPrevus, salairePrevu, avecSalairesPrevus, enregistrerSalairePrevu } from '../src/lib/remuneration.js';

describe('peutVoirFinances', () => {
  it('fondateur, directeur et secrétaire : oui, par leur rôle', () => {
    for (const role of ['fondateur', 'directeur', 'secretaire']) expect(peutVoirFinances({ role, permissions: { finance: false } }), role).toBe(true);
  });
  it('enseignant : non, sauf si le fondateur lui a coché « Gestion financière »', () => {
    expect(peutVoirFinances({ role: 'enseignant', permissions: { finance: false, notes: true } })).toBe(false);
    expect(peutVoirFinances({ role: 'enseignant', permissions: {} })).toBe(false);
    expect(peutVoirFinances({ role: 'enseignant', permissions: null })).toBe(false);
    expect(peutVoirFinances({ role: 'enseignant' })).toBe(false);
    expect(peutVoirFinances({ role: 'enseignant', permissions: { finance: true } })).toBe(true);
    expect(peutVoirFinances({ role: 'censeur', permissions: { finance: true } })).toBe(true);
  });
  it('« false » écrit en texte, ou toute autre valeur que true : non', () => {
    expect(peutVoirFinances({ role: 'enseignant', permissions: { finance: 'false' } })).toBe(false);
    expect(peutVoirFinances({ role: 'enseignant', permissions: { finance: 1 } })).toBe(false);
  });
  it('pas de profil : non', () => {
    expect(peutVoirFinances(null)).toBe(false);
    expect(peutVoirFinances(undefined)).toBe(false);
  });
});

describe('peutGererPersonnel', () => {
  it('fondateur, directeur et secrétaire : oui, par leur rôle', () => {
    for (const role of ['fondateur', 'directeur', 'secretaire']) expect(peutGererPersonnel({ role, permissions: { personnel: false } }), role).toBe(true);
  });
  it('enseignant ou censeur : non, sauf si le fondateur a coché « Personnel »', () => {
    expect(peutGererPersonnel({ role: 'enseignant', permissions: { personnel: false, finance: true } })).toBe(false);
    expect(peutGererPersonnel({ role: 'enseignant', permissions: {} })).toBe(false);
    expect(peutGererPersonnel({ role: 'enseignant', permissions: null })).toBe(false);
    expect(peutGererPersonnel({ role: 'enseignant', permissions: { personnel: true } })).toBe(true);
    expect(peutGererPersonnel({ role: 'censeur', permissions: { personnel: true } })).toBe(true);
    expect(peutGererPersonnel({ role: 'enseignant', permissions: { personnel: 'true' } })).toBe(false);
  });
  it('pas de profil : non', () => expect(peutGererPersonnel(null)).toBe(false));
});

// Faux client Supabase minimal
const client = ({ remuneration, erreurLecture, erreurEcriture, staffUpdate } = {}) => ({
  from: (table) => {
    if (table === 'staff_remuneration') return {
      select: () => Promise.resolve(erreurLecture ? { data: null, error: erreurLecture } : { data: remuneration || [], error: null }),
      upsert: (ligne) => { client.derniereLigne = ligne; return Promise.resolve({ error: erreurEcriture || null }); },
    };
    if (table === 'staff') return { update: (v) => ({ eq: (c, id) => { staffUpdate && staffUpdate({ v, c, id }); return Promise.resolve({ error: null }); } }) };
    throw new Error('table inattendue ' + table);
  },
});

describe('salaire mensuel prévu', () => {
  it('lit le salaire dans la nouvelle table', async () => {
    const sb = client({ remuneration: [{ staff_id: 'a', salaire_mensuel: 120000 }] });
    const fiches = await avecSalairesPrevus(sb, [{ id: 'a', salaire_mensuel: null }, { id: 'b', salaire_mensuel: null }]);
    expect(fiches.map((f) => f.salaire_mensuel)).toEqual([120000, null]);
  });
  it('un enseignant (la table ne lui renvoie rien) voit un salaire vide, jamais celui d\'un collègue', async () => {
    const sb = client({ remuneration: [] });
    const fiches = await avecSalairesPrevus(sb, [{ id: 'a', salaire_mensuel: null }]);
    expect(fiches[0].salaire_mensuel).toBeNull();
  });
  it('tant que la nouvelle table n\'existe pas, on lit l\'ancien emplacement (la fiche)', async () => {
    const sb = client({ erreurLecture: { code: '42P01', message: 'relation does not exist' } });
    expect(await chargerSalairesPrevus(sb)).toBeNull();
    const fiches = await avecSalairesPrevus(sb, [{ id: 'a', salaire_mensuel: 90000 }]);
    expect(fiches[0].salaire_mensuel).toBe(90000);
  });
  it('la nouvelle table l\'emporte sur une valeur restée dans la fiche', () => {
    expect(salairePrevu({ id: 'a', salaire_mensuel: 1 }, { a: 2 })).toBe(2);
    expect(salairePrevu({ id: 'a', salaire_mensuel: 1 }, {})).toBe(1);
    expect(salairePrevu({ id: 'a' }, null)).toBeNull();
  });
  it('enregistre dans la nouvelle table', async () => {
    const sb = client();
    const r = await enregistrerSalairePrevu(sb, { staffId: 's1', schoolId: 'e1', montant: '150000' });
    expect(r.error).toBeNull();
    expect(client.derniereLigne).toMatchObject({ staff_id: 's1', school_id: 'e1', salaire_mensuel: 150000 });
  });
  it('un montant vide efface le salaire', async () => {
    const sb = client();
    await enregistrerSalairePrevu(sb, { staffId: 's1', schoolId: 'e1', montant: '' });
    expect(client.derniereLigne.salaire_mensuel).toBeNull();
  });
  it('sans la nouvelle table, retombe sur l\'ancienne colonne de la fiche', async () => {
    let appel = null;
    const sb = client({ erreurEcriture: { code: 'PGRST205', message: "Could not find the table 'public.staff_remuneration'" }, staffUpdate: (x) => { appel = x; } });
    const r = await enregistrerSalairePrevu(sb, { staffId: 's1', schoolId: 'e1', montant: 80000 });
    expect(r.error).toBeNull();
    expect(appel).toEqual({ v: { salaire_mensuel: 80000 }, c: 'id', id: 's1' });
  });
  it('une autre erreur (droits refusés) est renvoyée telle quelle, sans écrire ailleurs', async () => {
    let appel = null;
    const sb = client({ erreurEcriture: { code: '42501', message: 'new row violates row-level security policy' }, staffUpdate: (x) => { appel = x; } });
    const r = await enregistrerSalairePrevu(sb, { staffId: 's1', schoolId: 'e1', montant: 80000 });
    expect(r.error.code).toBe('42501');
    expect(appel).toBeNull();
  });
});
