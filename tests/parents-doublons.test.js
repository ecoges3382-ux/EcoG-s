// Parents en double : repérage (même nom ET même numéro), fusion, et nettoyage des anciens numéros à 8 chiffres.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

vi.mock('../src/lib/supabase.js', () => ({ supabase: {} }));
const { grouperDoublonsParents, parentAGarder } = await import('../src/lib/parents.js');
const { liensAAjouter, fusionnerParents } = await import('../src/lib/fusionParents.js');

const enf = (...ids) => ids.map((id) => ({ students: { id } }));
const parent = (id, full_name, phone, enfants = [], created_at = '2026-01-01', extra = {}) => ({ id, full_name, phone, created_at, parent_access_students: enf(...enfants), ...extra });

describe('repérer les doublons', () => {
  const parents = [
    parent('p1', 'Ina KEITA', '+229 97703154', ['e1']),
    parent('p2', 'KEITA Ina', '+2290197703154', ['e2', 'e3'], '2026-02-01'),   // même personne : ordre des mots et « 01 » en plus
    parent('p3', 'Diane SANOGO', '+22990000001', ['e4']),
    parent('p4', 'Diane SANOGO', '+22990000002', ['e5']),                        // même nom, autre numéro : pas un doublon
    parent('p5', 'Binta NDIAYE', null, ['e6']),
    parent('p6', 'Binta NDIAYE', null, ['e7']),                                  // sans numéro : jamais rapprochés
    parent('p7', 'AKAMBI John', '+2290196000000', []),
  ];
  it('même nom et même numéro (anciens et nouveaux formats confondus) = un groupe', () => {
    const g = grouperDoublonsParents(parents);
    expect(g).toHaveLength(1);
    expect(g[0].membres.map((m) => m.id).sort()).toEqual(['p1', 'p2']);
  });
  it('conseille de garder celui qui a le plus d\'enfants', () => {
    expect(grouperDoublonsParents(parents)[0].conseille).toBe('p2');
  });
  it('à égalité d\'enfants : le plus ancien ; puis l\'identifiant', () => {
    expect(parentAGarder([parent('b', 'X', '1', ['e1'], '2026-05-01'), parent('a', 'X', '1', ['e2'], '2026-01-01')]).id).toBe('a');
    expect(parentAGarder([parent('b', 'X', '1', [], '2026-01-01'), parent('a', 'X', '1', [], '2026-01-01')]).id).toBe('a');
  });
  it('utilise nom et prénom quand ils existent', () => {
    const g = grouperDoublonsParents([
      parent('a', 'Ina KEITA', '+2290197703154', [], '2026-01-01', { nom: 'KEITA', prenom: 'Ina' }),
      parent('b', 'KEITA Ina', '+2290197703154', [], '2026-01-02'),
    ]);
    expect(g).toHaveLength(1);
  });
  it('rien à signaler : liste vide', () => {
    expect(grouperDoublonsParents([])).toEqual([]);
    expect(grouperDoublonsParents(undefined)).toEqual([]);
    expect(grouperDoublonsParents([parents[6]])).toEqual([]);
  });
});

describe('fusion', () => {
  const garder = parent('g', 'Ina KEITA', '+2290197703154', ['e1', 'e2']);
  const d1 = parent('d1', 'KEITA Ina', '+229 97703154', ['e2', 'e3']);
  const d2 = parent('d2', 'Ina Keita', '+22901 97703154', ['e3', 'e4']);

  it('rattache à la fiche gardée les enfants des doublons, sans doublon de lien', () => {
    expect(liensAAjouter(garder, [d1, d2])).toEqual([
      { parent_access_id: 'g', student_id: 'e3' },
      { parent_access_id: 'g', student_id: 'e4' },
    ]);
  });

  function client({ erreurLiens = null, erreurSuppr = null } = {}) {
    const appels = [];
    return {
      appels,
      from: (table) => ({
        upsert: async (rows, opts) => { appels.push({ op: 'upsert', table, rows, opts }); return { error: erreurLiens }; },
        delete: () => ({ in: async (col, ids) => { appels.push({ op: 'delete', table, col, ids }); return { error: erreurSuppr }; } }),
      }),
    };
  }

  it('ajoute d\'abord les liens, supprime ensuite les doublons', async () => {
    const c = client();
    const r = await fusionnerParents(garder, [d1, d2], c);
    expect(r).toEqual({ ok: true, ajoutes: 2, supprimes: 2 });
    expect(c.appels.map((a) => `${a.op}:${a.table}`)).toEqual(['upsert:parent_access_students', 'delete:parent_access']);
    expect(c.appels[0].opts).toEqual({ onConflict: 'parent_access_id,student_id', ignoreDuplicates: true });
    expect(c.appels[1].ids).toEqual(['d1', 'd2']);
  });
  it('si l\'ajout des liens échoue, rien n\'est supprimé', async () => {
    const c = client({ erreurLiens: { message: 'non' } });
    const r = await fusionnerParents(garder, [d1], c);
    expect(r.ok).toBe(false);
    expect(c.appels.some((a) => a.op === 'delete')).toBe(false);
  });
  it('doublons sans enfant : pas d\'ajout, suppression seule', async () => {
    const c = client();
    const r = await fusionnerParents(garder, [parent('d9', 'Ina KEITA', '+2290197703154', [])], c);
    expect(r).toEqual({ ok: true, ajoutes: 0, supprimes: 1 });
    expect(c.appels.map((a) => a.op)).toEqual(['delete']);
  });
  it('ne supprime jamais la fiche gardée, même si elle figure parmi les doublons', async () => {
    const c = client();
    await fusionnerParents(garder, [garder, d1], c);
    expect(c.appels.find((a) => a.op === 'delete').ids).toEqual(['d1']);
  });
  it('échec de suppression : erreur rendue', async () => {
    const r = await fusionnerParents(garder, [d1], client({ erreurSuppr: { message: 'refus' } }));
    expect(r.ok).toBe(false);
  });
});

describe('nettoyage des anciens numéros (supabase/nettoyage_numeros.sql)', () => {
  const SQL = fs.readFileSync(path.resolve(import.meta.dirname, '../supabase/nettoyage_numeros.sql'), 'utf8');
  const E1 = '11111111-1111-4111-8111-111111111111', E2 = '22222222-2222-4222-8222-222222222222';

  async function base() {
    const db = new PGlite();
    await db.exec(`
      create table schools (id uuid primary key, plan text);
      create function check_plan_feature(p_school_id uuid, p_feature text) returns boolean language sql as $$
        select coalesce((select plan <> 'decouverte' from schools where id = p_school_id), false) $$;
      create table parent_access (id serial primary key, school_id uuid, phone text);
      create table students (id serial primary key, parent_phone text);
      create table staff (id serial primary key, school_id uuid, phone text);
      create table profiles (id serial primary key, phone text);
      -- Comme en production : modifier ces tables est refusé aux écoles dont le forfait ne les inclut pas.
      create function refuser() returns trigger language plpgsql as $$ begin
        if not check_plan_feature(new.school_id, 'x') then raise exception 'forfait'; end if; return new; end $$;
      create trigger t1 before update on parent_access for each row execute function refuser();
      create trigger t2 before update on staff for each row execute function refuser();
      insert into schools values ('${E1}', 'essentiel'), ('${E2}', 'decouverte');
      insert into parent_access (school_id, phone) values
        ('${E1}', '+229 97703154'), ('${E1}', '+22997703154'), ('${E1}', '+2290197703154'), ('${E1}', '+229 01 97 70 31 54'),
        ('${E1}', '+22890123456'), ('${E1}', '97703154'), ('${E1}', null), ('${E1}', '00229 97703154'), ('${E2}', '+22997703154');
      insert into students (parent_phone) values ('+229 97703154'), ('+2290197703154'), ('+22507070707');
      insert into staff (school_id, phone) values ('${E1}', '+22997703154'), ('${E2}', '+22997703154');
      insert into profiles (phone) values ('+22997703154'), (null);
    `);
    return db;
  }

  it('complète le « 01 » des numéros à 8 chiffres, et seulement ceux-là', async () => {
    const db = await base();
    await db.exec(SQL);
    const pa = (await db.query(`select phone from parent_access where school_id = '${E1}' order by id`)).rows.map((r) => r.phone);
    expect(pa).toEqual([
      '+2290197703154',        // « +229 97703154 »
      '+2290197703154',        // « +22997703154 »
      '+2290197703154',        // déjà à 10 chiffres : inchangé
      '+229 01 97 70 31 54',   // déjà à 10 chiffres (avec espaces) : inchangé
      '+22890123456',          // Togo : inchangé
      '97703154',              // sans indicatif : inchangé
      null,
      '+2290197703154',        // « 00229 97703154 »
    ]);
    expect((await db.query('select parent_phone from students order by id')).rows.map((r) => r.parent_phone)).toEqual(['+2290197703154', '+2290197703154', '+22507070707']);
    expect((await db.query(`select phone from staff where school_id = '${E1}'`)).rows[0].phone).toBe('+2290197703154');
    expect((await db.query('select phone from profiles order by id')).rows.map((r) => r.phone)).toEqual(['+2290197703154', null]);
  });
  it('une école dont le forfait refuse la modification est laissée telle quelle, sans faire échouer le reste', async () => {
    const db = await base();
    await db.exec(SQL);
    expect((await db.query(`select phone from parent_access where school_id = '${E2}'`)).rows[0].phone).toBe('+22997703154');
    expect((await db.query(`select phone from staff where school_id = '${E2}'`)).rows[0].phone).toBe('+22997703154');
  });
  it('sauvegarde les anciennes valeurs avant de modifier', async () => {
    const db = await base();
    await db.exec(SQL);
    const anciennes = (await db.query(`select ancien from sauvegarde_numeros_avant_01 where table_ = 'parent_access' order by ancien`)).rows.map((r) => r.ancien);
    expect(anciennes).toContain('+229 97703154');
    expect(anciennes).toHaveLength(8); // les 8 numéros non vides, avant correction
  });
  it('rejouer le script ne change plus rien', async () => {
    const db = await base();
    await db.exec(SQL);
    const avant = (await db.query('select phone from parent_access order by id')).rows;
    await db.exec(SQL);
    expect((await db.query('select phone from parent_access order by id')).rows).toEqual(avant);
  });
});
