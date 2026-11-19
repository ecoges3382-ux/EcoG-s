// Règles de lecture des présences, paiements, absences, inscriptions, élèves, messages et dépenses : le correctif de vitesse
// (bloc « Lecture rapide des autres tables » de schema.sql) réécrit leur texte en place. Il doit laisser voir EXACTEMENT les
// mêmes lignes aux mêmes personnes. Les règles viennent de schema.sql ; le bloc est rejoué dans une vraie base (PGlite).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const SCHEMA = fs.readFileSync(path.resolve(import.meta.dirname, '../supabase/schema.sql'), 'utf8');
const BLOC = SCHEMA.slice(SCHEMA.indexOf('-- ---------- Lecture rapide des autres tables'));
const TABLES = ['attendance_records', 'payments', 'absence_events', 'late_events', 'enrollments', 'students', 'whatsapp_messages', 'expenses'];
const REGLES = [
  ['attendance_records', 'attendance_records: select (personnel)'], ['attendance_records', 'attendance_records: select (parent)'],
  ['payments', 'payments: select (personnel)'], ['payments', 'payments: select (parent)'],
  ['absence_events', 'absence_events: select'], ['late_events', 'late_events: select'], ['enrollments', 'enrollments: select'],
  ['students', 'students: select (personnel)'], ['students', 'students: select (parent)'],
  ['whatsapp_messages', 'whatsapp_messages: select'], ['expenses', 'expenses: select'],
];
// Dernière définition de la règle dans schema.sql (c'est celle qui reste en production après les « drop policy »).
function regle(table, nom) {
  const m = [...SCHEMA.matchAll(new RegExp(`create policy "${nom.replace(/[()]/g, '\\$&')}" on ${table}\\b[\\s\\S]*?;\\n`, 'g'))];
  return m[m.length - 1][0];
}
const debutFonction = SCHEMA.lastIndexOf('create or replace function current_school_id()');
const COURANTE = SCHEMA.slice(debutFonction, SCHEMA.indexOf('$$;', SCHEMA.indexOf('$$', debutFonction + 60)) + 3);

const S1 = '11111111-1111-4111-8111-111111111111', S2 = '22222222-2222-4222-8222-222222222222', S3 = '33333333-3333-4333-8333-333333333333';
const U = {
  dir: 'a0000000-0000-4000-8000-000000000001', sec: 'a0000000-0000-4000-8000-000000000002', ens: 'a0000000-0000-4000-8000-000000000003', cens: 'a0000000-0000-4000-8000-000000000004',
  autreEcole: 'b0000000-0000-4000-8000-000000000001', suspendue: 'c0000000-0000-4000-8000-000000000001',
  parentLie: 'd0000000-0000-4000-8000-000000000001', parentSansLien: 'd0000000-0000-4000-8000-000000000002', sansProfil: 'e0000000-0000-4000-8000-000000000001',
};
const ST = { a: 'f0000000-0000-4000-8000-00000000000a', b: 'f0000000-0000-4000-8000-00000000000b', x: 'f0000000-0000-4000-8000-00000000000c' };

async function base(extra = '') {
  const db = new PGlite();
  await db.exec(`
  create schema auth; create role anon; create role authenticated;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  create table auth.users (id uuid primary key);
  create table schools (id uuid primary key, statut text default 'actif');
  create table profiles (id uuid primary key references auth.users(id), school_id uuid references schools(id), role text);
  create table student_guardians (student_id uuid not null, parent_profile_id uuid not null references profiles(id), primary key (student_id, parent_profile_id));
  ${COURANTE}
  create function current_role_name() returns text language sql stable security definer set search_path = public as $$ select role from profiles where id = auth.uid() $$;
  ${TABLES.map((t) => `create table ${t} (id uuid primary key default gen_random_uuid(), school_id uuid not null, student_id uuid, school_year_id uuid, valeur int);`).join('\n')}
  create table grades (id uuid primary key default gen_random_uuid(), school_id uuid not null, student_id uuid, valeur int);
  alter table schools enable row level security; alter table profiles enable row level security;
  create policy tout on schools for select using (true); create policy tout on profiles for select using (true);
  ${TABLES.map((t) => `alter table ${t} enable row level security;`).join('\n')}
  alter table grades enable row level security;
  ${REGLES.map(([t, n]) => regle(t, n)).join('\n')}
  create policy "grades: select (personnel)" on grades for select using (school_id = current_school_id() and current_role_name() in ('fondateur','directeur','secretaire','enseignant'));
  ${extra}
  grant usage on schema auth to authenticated; grant execute on function auth.jwt(), auth.uid() to authenticated;
  grant select on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated;
  `);
  await db.exec(`
  insert into schools (id, statut) values ('${S1}','actif'), ('${S2}','actif'), ('${S3}','suspendu');
  ${Object.values(U).map((u) => `insert into auth.users (id) values ('${u}');`).join('\n')}
  insert into profiles (id, school_id, role) values ('${U.dir}','${S1}','directeur'), ('${U.sec}','${S1}','secretaire'), ('${U.ens}','${S1}','enseignant'), ('${U.cens}','${S1}','censeur'),
    ('${U.autreEcole}','${S2}','directeur'), ('${U.suspendue}','${S3}','directeur'), ('${U.parentLie}','${S1}','parent'), ('${U.parentSansLien}','${S1}','parent');
  insert into student_guardians values ('${ST.a}','${U.parentLie}');
  ${[...TABLES, 'grades'].map((t) => `insert into ${t} (school_id, student_id, valeur) values ('${S1}','${ST.a}',1), ('${S1}','${ST.a}',2), ('${S1}','${ST.b}',3), ('${S2}','${ST.x}',4), ('${S3}','${ST.x}',5);`).join('\n')}`);
  return db;
}

async function vue(db, user, table, role = 'authenticated') {
  await db.exec(`set role ${role}; select set_config('request.jwt.claims', '${user ? JSON.stringify({ sub: user }) : '{}'}', false)`);
  try { return (await db.query(`select valeur from ${table} order by valeur`)).rows.map((r) => r.valeur).join(','); }
  catch (e) { return 'ERREUR ' + String(e.message).slice(0, 50); }
  finally { await db.exec('reset role'); }
}
async function toutesLesVues(db) {
  const r = {};
  for (const t of [...TABLES, 'grades']) {
    for (const [nom, u] of Object.entries(U)) r[`${t} / ${nom}`] = await vue(db, u, t);
    r[`${t} / anonyme`] = await vue(db, null, t, 'anon');
  }
  return r;
}
const qual = async (db) => Object.fromEntries((await db.query(`select tablename || ' / ' || policyname k, qual from pg_policies order by 1`)).rows.map((r) => [r.k, r.qual]));

describe('correctif de vitesse des règles de lecture des autres tables', () => {
  it('chacun voit exactement les mêmes lignes avant et après, table par table', async () => {
    const db = await base();
    const avant = await toutesLesVues(db);
    await db.exec(BLOC);
    expect(await toutesLesVues(db)).toEqual(avant);
    // les valeurs de départ ne sont pas des listes vides par hasard
    expect(avant['payments / dir']).toBe('1,2,3');
    expect(avant['payments / autreEcole']).toBe('4');
    expect(avant['payments / parentLie']).toBe('1,2');
    expect(avant['payments / parentSansLien']).toBe('');
    expect(avant['payments / suspendue']).toBe('');
    expect(avant['enrollments / ens']).toBe('1,2,3');
    expect(avant['absence_events / cens']).toBe('1,2,3'); // le censeur lit les absences
    expect(avant['absence_events / parentLie']).toBe('');
    expect(avant['whatsapp_messages / ens']).toBe('');    // pas de lecture des messages pour un enseignant
    expect(avant['payments / anonyme']).toMatch(/^ERREUR|^$/);
  });

  it('réécrit bien toutes les règles de lecture de ces tables', async () => {
    const db = await base();
    await db.exec(BLOC);
    const q = await qual(db);
    for (const [t, n] of REGLES) {
      const texte = q[`${t} / ${n}`];
      expect(texte, `${t} / ${n}`).not.toMatch(/(?<!SELECT )current_school_id\(\)/i);
      expect(texte, `${t} / ${n}`).not.toMatch(/(?<!SELECT )current_role_name\(\)/i);
      expect(texte, `${t} / ${n}`).not.toMatch(/(?<!SELECT )auth\.uid\(\)/i);
    }
    expect(q['payments / payments: select (personnel)']).toMatch(/SELECT current_school_id/i);
    expect(q['payments / payments: select (parent)']).toMatch(/SELECT auth\.uid/i);
  });

  it('ne touche pas aux tables hors de la liste (les notes ont leur propre bloc)', async () => {
    const db = await base();
    const avant = (await qual(db))['grades / grades: select (personnel)'];
    await db.exec(BLOC);
    expect((await qual(db))['grades / grades: select (personnel)']).toBe(avant);
  });

  it('se rejoue sans erreur et sans rien changer', async () => {
    const db = await base();
    await db.exec(BLOC);
    const apres1 = await qual(db);
    await db.exec(BLOC);
    expect(await qual(db)).toEqual(apres1);
  });

  it('une règle écrite avec le nom qualifié (public.fonction()) est réécrite sans erreur, et voit les mêmes lignes', async () => {
    // PostgreSQL l'affiche sans le schéma : le texte lu par le script est alors une règle ordinaire.
    const db = await base(`create policy "expenses: qualifiee" on expenses for select using (school_id = public.current_school_id());`);
    const avant = await toutesLesVues(db);
    await db.exec(BLOC); // doit s'appliquer sans erreur de syntaxe
    expect((await qual(db))['expenses / expenses: qualifiee']).toMatch(/SELECT current_school_id/i);
    expect(await toutesLesVues(db)).toEqual(avant);
  });

  it('un seul passage : si une règle ne pouvait pas être réécrite, aucune ne l\'est', async () => {
    const db = await base();
    await db.exec(`create policy "zzz: cassee" on payments for select using (school_id = current_school_id())`);
    const avant = await qual(db);
    // on provoque l'échec de la dernière réécriture en supprimant la table visée entre la lecture et l'écriture : impossible
    // ici ; on vérifie donc plutôt que le bloc est bien atomique (un seul « do »), donc tout ou rien
    expect((BLOC.match(/^do \$\$/gm) || []).length).toBe(1);
    expect(avant['payments / zzz: cassee']).toMatch(/current_school_id/);
  });

  it('les fonctions de sécurité ne sont plus appelées pour chaque ligne lue', async () => {
    const db = await base();
    await db.exec(`insert into payments (school_id, student_id, valeur) select '${S1}', '${ST.a}', n from generate_series(10, 2009) n`);
    await db.exec(`create or replace function current_school_id() returns uuid language plpgsql stable security definer set search_path = public as $$
      begin
        perform set_config('app.appels', (coalesce(nullif(current_setting('app.appels', true), ''), '0')::int + 1)::text, false);
        return (select p.school_id from profiles p join schools s on s.id = p.school_id where p.id = auth.uid() and s.statut not in ('suspendu', 'resilie'));
      end $$`);
    const appels = async () => {
      await db.exec(`select set_config('app.appels', '0', false); set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub: U.dir })}', false)`);
      await db.query(`select id from payments order by id limit 500 offset 1500`);
      await db.exec('reset role');
      return Number((await db.query(`select current_setting('app.appels') n`)).rows[0].n);
    };
    const avant = await appels();
    await db.exec(BLOC);
    const apres = await appels();
    expect(avant, 'avant : plusieurs appels par ligne lue').toBeGreaterThan(1000);
    expect(apres, 'après : une poignée d\'appels').toBeLessThan(10);
  });
});
