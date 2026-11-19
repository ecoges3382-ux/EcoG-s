// Règles de sécurité de la table des notes : le correctif de vitesse (bloc « Lecture rapide des notes » de schema.sql)
// doit laisser voir EXACTEMENT les mêmes notes aux mêmes personnes. Le bloc est lu dans schema.sql, rejoué dans une vraie
// base PostgreSQL (PGlite) et comparé à l'état d'avant, avec des utilisateurs de rôles et d'écoles différents.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const SCHEMA = fs.readFileSync(path.resolve(import.meta.dirname, '../supabase/schema.sql'), 'utf8');
const BLOC = SCHEMA.slice(SCHEMA.indexOf('-- ---------- Lecture rapide des notes'));
const regle = (nom) => SCHEMA.match(new RegExp(`create policy "${nom.replace(/[()]/g, '\\$&')}" on grades[\\s\\S]*?;\\n`))[0];
const debutFonction = SCHEMA.lastIndexOf('create or replace function current_school_id()');
const COURANTE = SCHEMA.slice(debutFonction, SCHEMA.indexOf('$$;', SCHEMA.indexOf('$$', debutFonction + 60)) + 3);

const S1 = '11111111-1111-4111-8111-111111111111', S2 = '22222222-2222-4222-8222-222222222222', S3 = '33333333-3333-4333-8333-333333333333';
const U = {
  dir: 'a0000000-0000-4000-8000-000000000001', sec: 'a0000000-0000-4000-8000-000000000002', ens: 'a0000000-0000-4000-8000-000000000003',
  autreEcole: 'b0000000-0000-4000-8000-000000000001', suspendue: 'c0000000-0000-4000-8000-000000000001',
  parentLie: 'd0000000-0000-4000-8000-000000000001', parentSansLien: 'd0000000-0000-4000-8000-000000000002', sansProfil: 'e0000000-0000-4000-8000-000000000001',
};
const ST = { a: 'f0000000-0000-4000-8000-00000000000a', b: 'f0000000-0000-4000-8000-00000000000b', x: 'f0000000-0000-4000-8000-00000000000c' };
const Y = '99999999-9999-4999-8999-999999999999';

async function baseAvantCorrectif() {
  const db = new PGlite();
  await db.exec(`
  create schema auth; create role anon; create role authenticated;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  create table auth.users (id uuid primary key);
  create table schools (id uuid primary key, statut text default 'actif');
  create table profiles (id uuid primary key references auth.users(id), school_id uuid references schools(id), role text);
  create table students (id uuid primary key, school_id uuid references schools(id));
  create table subjects (id uuid primary key, school_id uuid references schools(id));
  create table student_guardians (student_id uuid not null references students(id), parent_profile_id uuid not null references profiles(id), primary key (student_id, parent_profile_id));
  create table grades (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id), student_id uuid not null references students(id), subject_id uuid not null references subjects(id),
    school_year_id uuid not null, type text not null default 'controle', note numeric not null, sur numeric not null default 20, periode text not null default 'Trimestre 1', created_at timestamptz not null default now());
  create index grades_year_idx on grades(school_year_id);
  ${COURANTE}
  create function current_role_name() returns text language sql stable security definer set search_path = public as $$ select role from profiles where id = auth.uid() $$;
  alter table grades enable row level security; alter table schools enable row level security; alter table profiles enable row level security;
  create policy tout on schools for select using (true); create policy tout on profiles for select using (true);
  ${regle('grades: select (personnel)')}
  ${regle('grades: select (parent)')}
  grant usage on schema auth to authenticated; grant execute on function auth.jwt(), auth.uid() to authenticated;
  grant select on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated;
  `);
  await db.exec(`
  insert into schools (id, statut) values ('${S1}','actif'), ('${S2}','actif'), ('${S3}','suspendu');
  ${Object.values(U).map((u) => `insert into auth.users (id) values ('${u}');`).join('\n')}
  insert into profiles (id, school_id, role) values ('${U.dir}','${S1}','directeur'), ('${U.sec}','${S1}','secretaire'), ('${U.ens}','${S1}','enseignant'),
    ('${U.autreEcole}','${S2}','directeur'), ('${U.suspendue}','${S3}','directeur'), ('${U.parentLie}','${S1}','parent'), ('${U.parentSansLien}','${S1}','parent');
  insert into students (id, school_id) values ('${ST.a}','${S1}'), ('${ST.b}','${S1}'), ('${ST.x}','${S2}');
  insert into subjects (id, school_id) select gen_random_uuid(), '${S1}' from generate_series(1,2);
  insert into student_guardians values ('${ST.a}','${U.parentLie}');
  insert into grades (school_id, student_id, subject_id, school_year_id, note)
    select s.school_id, s.id, (select id from subjects limit 1), '${Y}', n from students s cross join generate_series(1, 5) n;`);
  return db;
}

// Ce que chaque personne voit : la liste triée des notes, ou l'erreur renvoyée.
async function vue(db, user, role = 'authenticated') {
  await db.exec(`set role ${role}; select set_config('request.jwt.claims', '${user ? JSON.stringify({ sub: user }) : '{}'}', false)`);
  try { return (await db.query('select id from grades order by id')).rows.map((r) => r.id).join(','); }
  catch (e) { return 'ERREUR ' + String(e.message).slice(0, 60); }
  finally { await db.exec('reset role'); }
}
async function toutesLesVues(db) {
  const r = {};
  for (const [nom, u] of Object.entries(U)) r[nom] = await vue(db, u);
  r.anonyme = await vue(db, null, 'anon');
  return r;
}

describe('correctif de vitesse des règles de lecture des notes', () => {
  it('chacun voit exactement les mêmes notes avant et après', async () => {
    const db = await baseAvantCorrectif();
    const avant = await toutesLesVues(db);
    await db.exec(BLOC);
    const apres = await toutesLesVues(db);
    expect(apres).toEqual(avant);

    // et les valeurs de départ sont bien celles attendues (le test ne compare pas deux listes vides)
    const nb = (v) => (v.startsWith('ERREUR') || v === '' ? 0 : v.split(',').length);
    expect(nb(avant.dir)).toBe(10);        // les 2 élèves de son école, 5 notes chacun
    expect(nb(avant.sec)).toBe(10);
    expect(nb(avant.ens)).toBe(10);
    expect(nb(avant.autreEcole)).toBe(5);  // seulement l'autre école
    expect(nb(avant.parentLie)).toBe(5);   // seulement son enfant
    expect(nb(avant.parentSansLien)).toBe(0);
    expect(nb(avant.suspendue)).toBe(0);   // école suspendue : rien
    expect(nb(avant.sansProfil)).toBe(0);
    expect(nb(avant.anonyme)).toBe(0);
  });

  it('modifie bien les deux règles et crée l\'index', async () => {
    const db = await baseAvantCorrectif();
    await db.exec(BLOC);
    const q = Object.fromEntries((await db.query(`select policyname, qual from pg_policies where tablename = 'grades'`)).rows.map((r) => [r.policyname, r.qual]));
    expect(q['grades: select (personnel)']).toMatch(/SELECT current_school_id/i);
    expect(q['grades: select (personnel)']).toMatch(/SELECT current_role_name/i);
    expect(q['grades: select (parent)']).toMatch(/SELECT auth\.uid/i);
    expect((await db.query(`select 1 from pg_indexes where indexname = 'grades_year_created_idx'`)).rows).toHaveLength(1);
  });

  it('se rejoue sans erreur (déjà fait : rien ne change)', async () => {
    const db = await baseAvantCorrectif();
    await db.exec(BLOC);
    const avant = (await db.query(`select policyname, qual from pg_policies where tablename = 'grades' order by 1`)).rows;
    await db.exec(BLOC);
    expect((await db.query(`select policyname, qual from pg_policies where tablename = 'grades' order by 1`)).rows).toEqual(avant);
  });

  it('refuse de toucher à une règle qui n\'est pas celle attendue, et ne change RIEN', async () => {
    const db = await baseAvantCorrectif();
    await db.exec(`alter policy "grades: select (personnel)" on grades using (true)`); // règle différente en production
    const avant = (await db.query(`select policyname, qual from pg_policies where tablename = 'grades' order by 1`)).rows;
    await expect(db.exec(BLOC)).rejects.toThrow(/ne ressemble pas à celle attendue/);
    expect((await db.query(`select policyname, qual from pg_policies where tablename = 'grades' order by 1`)).rows).toEqual(avant);
  });

  it('refuse aussi si une règle est introuvable', async () => {
    const db = await baseAvantCorrectif();
    await db.exec(`drop policy "grades: select (parent)" on grades`);
    await expect(db.exec(BLOC)).rejects.toThrow(/introuvable/);
  });

  it('les fonctions de sécurité ne sont plus appelées pour chaque ligne lue', async () => {
    const db = await baseAvantCorrectif();
    await db.exec(`insert into grades (school_id, student_id, subject_id, school_year_id, note) select '${S1}', '${ST.a}', (select id from subjects limit 1), '${Y}', 10 from generate_series(1, 2000)`);
    // Même fonction qu'en production, mais elle compte ses appels (PGlite ne tient pas de statistiques d'appels).
    await db.exec(`create or replace function current_school_id() returns uuid language plpgsql stable security definer set search_path = public as $$
      begin
        perform set_config('app.appels', (coalesce(nullif(current_setting('app.appels', true), ''), '0')::int + 1)::text, false);
        return (select p.school_id from profiles p join schools s on s.id = p.school_id where p.id = auth.uid() and s.statut not in ('suspendu', 'resilie'));
      end $$`);
    const appels = async () => {
      await db.exec(`select set_config('app.appels', '0', false); set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub: U.dir })}', false)`);
      await db.query(`select id from grades where school_year_id = '${Y}' order by created_at desc, id limit 500 offset 1500`);
      await db.exec('reset role');
      return Number((await db.query(`select current_setting('app.appels') n`)).rows[0].n);
    };
    const avant = await appels();
    await db.exec(BLOC);
    const apres = await appels();
    expect(avant, 'avant le correctif : plusieurs appels par ligne lue').toBeGreaterThan(1000);
    expect(apres, 'après : une poignée d\'appels par requête').toBeLessThan(10);
  });
});
