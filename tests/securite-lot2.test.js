// Deuxième lot de sécurité : écriture des élèves réservée aux gestionnaires, historique des moratoires réservé aux finances, couleur
// personnelle de chaque utilisateur. Rejoué sur une copie COMPLÈTE de schema.sql (PGlite), avec de vrais comptes de rôles différents.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const RACINE = path.resolve(import.meta.dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, 'supabase', f), 'utf8');
const SCHEMA = lire('schema.sql');
const ECRITURE = lire('restreindre_ecriture_eleves.sql');
const ANNULATION = lire('annuler_restriction_ecriture_eleves.sql');
const COULEUR = lire('couleur_personnelle.sql');

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const U = {
  fondateur: 'a0000000-0000-4000-8000-000000000001',
  directeur: 'a0000000-0000-4000-8000-000000000002',
  secretaire: 'a0000000-0000-4000-8000-000000000003',
  enseignant: 'a0000000-0000-4000-8000-000000000004',
  enseignantFinance: 'a0000000-0000-4000-8000-000000000005',
  autreEcole: 'b0000000-0000-4000-8000-000000000001',
};

describe('sécurité, deuxième lot', () => {
  let db; let yearId; let classeId; let studentId; let enrollmentId; let matiereId;
  const comme = async (utilisateur, sql, params) => {
    await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub: utilisateur, aal: 'aal1' })}', false)`);
    try { return { rows: (await db.query(sql, params)).rows }; }
    catch (e) { return { erreur: String(e.message) }; }
    finally { await db.exec('reset role'); }
  };

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create schema auth; create schema storage; create role anon; create role authenticated; create role service_role bypassrls;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
      create function auth.role() returns text language sql stable as $$ select 'authenticated'::text $$;
      create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb, created_at timestamptz default now());
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb);
      create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;
      create publication supabase_realtime;`);
    await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on functions to anon, authenticated, service_role;`);
    await db.exec(SCHEMA);
    await db.exec('alter table parent_access add column lien_parente text, add column civilite text; alter table students add column if not exists sexe text;');
    await db.exec('grant usage on schema public, auth to authenticated, service_role; grant execute on function auth.jwt(), auth.uid() to authenticated, anon;');
    await db.exec(`
      insert into schools (id, name, plan) values ('${S1}', 'Collège A', 'essentiel'), ('${S2}', 'Collège B', 'essentiel');
      ${Object.values(U).map((u) => `insert into auth.users (id) values ('${u}');`).join('\n')}
      insert into profiles (id, school_id, role, full_name, permissions) values
        ('${U.fondateur}', '${S1}', 'fondateur', 'F', null),
        ('${U.directeur}', '${S1}', 'directeur', 'D', null),
        ('${U.secretaire}', '${S1}', 'secretaire', 'S', null),
        ('${U.enseignant}', '${S1}', 'enseignant', 'E', '{"finance": false, "notes": true}'),
        ('${U.enseignantFinance}', '${S1}', 'enseignant', 'EF', '{"finance": true}'),
        ('${U.autreEcole}', '${S2}', 'directeur', 'DB', null);`);
    yearId = (await db.query(`insert into school_years (school_id, label, is_current) values ('${S1}', '2026-2027', true) returning id`)).rows[0].id;
    classeId = (await db.query(`insert into classes (school_id, nom, niveau) values ('${S1}', '6e A', '6e') returning id`)).rows[0].id;
    studentId = (await db.query(`insert into students (school_id, nom, prenom, full_name) values ('${S1}', 'A', 'B', 'A B') returning id`)).rows[0].id;
    enrollmentId = (await db.query(`insert into enrollments (school_id, school_year_id, student_id, classe_id, montant_du) values ('${S1}', '${yearId}', '${studentId}', '${classeId}', 100000) returning id`)).rows[0].id;
    matiereId = (await db.query(`insert into subjects (school_id, nom) values ('${S1}', 'Maths') returning id`)).rows[0].id;
    await db.exec(`insert into moratoire_history (enrollment_id, school_id, action, nouveau_resume) values ('${enrollmentId}', '${S1}', 'creation', 'Arrangement en 3 fois')`);
    await db.exec(`insert into enrollment_decisions (school_id, school_year_id, student_id, decision, montant_du) values ('${S1}', '${yearId}', '${studentId}', 'passe', 120000)`);
    await db.exec(ECRITURE);
    await db.exec(COULEUR);
  }, 120000);

  describe('élèves : écriture réservée aux gestionnaires', () => {
    it('un enseignant ne peut plus ajouter un élève', async () => {
      const r = await comme(U.enseignant, `insert into students (school_id, nom, prenom, full_name) values ('${S1}', 'Pirate', 'X', 'Pirate X')`);
      expect(r.erreur).toMatch(/row-level security/);
    });
    it('ni par la fonction d’inscription', async () => {
      const r = await comme(U.enseignant, `select create_student_with_enrollment('${S1}', 'P', 'X', 'P X', null, null, null, '${yearId}', '${classeId}', 0, 0)`);
      expect(r.erreur).toBeDefined();
    });
    it('un enseignant ne peut plus modifier un élève', async () => {
      const r = await comme(U.enseignant, `update students set full_name = 'Piraté' where id = '${studentId}' returning id`);
      expect(r.erreur ?? r.rows.length).toSatisfy((v) => typeof v === 'string' || v === 0);
      const reel = await db.query('select full_name from students where id = $1', [studentId]);
      expect(reel.rows[0].full_name).toBe('A B');
    });
    it('un enseignant ne peut plus supprimer un élève', async () => {
      const r = await comme(U.enseignant, `delete from students where id = '${studentId}' returning id`);
      expect(r.erreur ?? r.rows.length).toSatisfy((v) => typeof v === 'string' || v === 0);
      const reste = await db.query('select count(*)::int n from students where id = $1', [studentId]);
      expect(reste.rows[0].n).toBe(1);
    });
    it('même avec la permission « finance », un enseignant ne gère pas les élèves', async () => {
      const r = await comme(U.enseignantFinance, `update students set full_name = 'Piraté' where id = '${studentId}' returning id`);
      expect(r.erreur ?? r.rows.length).toSatisfy((v) => typeof v === 'string' || v === 0);
    });
    it('le fondateur, le directeur et la secrétaire peuvent toujours ajouter, modifier et supprimer', async () => {
      for (const [u, nom] of [[U.fondateur, 'F1'], [U.directeur, 'D1'], [U.secretaire, 'S1']]) {
        const ins = await comme(u, `insert into students (school_id, nom, prenom, full_name) values ('${S1}', '${nom}', 'x', '${nom} x') returning id`);
        expect(ins.erreur, `ajout ${nom}`).toBeUndefined();
        const id = ins.rows[0].id;
        const upd = await comme(u, `update students set prenom = 'y' where id = '${id}' returning id`);
        expect(upd.rows, `modification ${nom}`).toHaveLength(1);
        const del = await comme(u, `delete from students where id = '${id}' returning id`);
        expect(del.rows, `suppression ${nom}`).toHaveLength(1);
      }
    });
    it('la secrétaire inscrit toujours un élève avec la fonction d’inscription', async () => {
      const r = await comme(U.secretaire, `select create_student_with_enrollment('${S1}', 'KONE', 'Aïcha', 'KONE Aïcha', null, null, null, '${yearId}', '${classeId}', 150000, 20000) id`);
      expect(r.erreur).toBeUndefined();
    });
    it('on ne peut pas ajouter un élève dans une autre école', async () => {
      const r = await comme(U.directeur, `insert into students (school_id, nom, prenom, full_name) values ('${S2}', 'X', 'x', 'X x')`);
      expect(r.erreur).toMatch(/row-level security/);
    });
    it('un enseignant lit toujours la liste des élèves', async () => {
      const r = await comme(U.enseignant, 'select count(*)::int n from students');
      expect(r.rows[0].n).toBeGreaterThan(0);
    });
    it('un enseignant saisit toujours des notes et des présences (son vrai travail)', async () => {
      const note = await comme(U.enseignant, `insert into grades (school_id, student_id, school_year_id, subject_id, note, periode, type) values ('${S1}', '${studentId}', '${yearId}', '${matiereId}', 14, 'T1', 'devoir') returning id`);
      expect(note.erreur).toBeUndefined();
      const modif = await comme(U.enseignant, `update grades set note = 15 where id = '${note.rows[0].id}' returning id`);
      expect(modif.rows).toHaveLength(1);
      const pres = await comme(U.enseignant, `insert into attendance_records (school_id, student_id, school_year_id, date, statut) values ('${S1}', '${studentId}', '${yearId}', current_date, 'present') returning id`);
      expect(pres.erreur).toBeUndefined();
    });
  });

  describe('historique des moratoires', () => {
    it('fondateur, directeur, secrétaire et « finance » le lisent', async () => {
      for (const u of [U.fondateur, U.directeur, U.secretaire, U.enseignantFinance]) {
        expect((await comme(u, 'select * from moratoire_history')).rows).toHaveLength(1);
      }
    });
    it('un enseignant n’y voit plus rien', async () => {
      expect((await comme(U.enseignant, 'select * from moratoire_history')).rows).toHaveLength(0);
    });
    it('une autre école n’y voit rien', async () => {
      expect((await comme(U.autreEcole, 'select * from moratoire_history')).rows).toHaveLength(0);
    });
    it('la secrétaire peut toujours y ajouter une ligne', async () => {
      const r = await comme(U.secretaire, `insert into moratoire_history (enrollment_id, school_id, action, nouveau_resume) values ('${enrollmentId}', '${S1}', 'modification', 'x')`);
      expect(r.erreur).toBeUndefined();
    });
  });

  describe('préparation de la rentrée (décisions)', () => {
    it('réservée au fondateur et au directeur : ni un enseignant ni la secrétaire n’y lisent les montants', async () => {
      expect((await comme(U.enseignant, 'select * from enrollment_decisions')).rows).toHaveLength(0);
      expect((await comme(U.enseignantFinance, 'select * from enrollment_decisions')).rows).toHaveLength(0);
      expect((await comme(U.fondateur, 'select * from enrollment_decisions')).rows).toHaveLength(1);
      expect((await comme(U.directeur, 'select * from enrollment_decisions')).rows).toHaveLength(1);
    });
  });

  describe('couleur personnelle', () => {
    it('chaque utilisateur enregistre sa couleur sur son profil et la relit', async () => {
      const w = await comme(U.enseignant, `update profiles set couleur_perso = '#1D4ED8' where id = '${U.enseignant}' returning couleur_perso`);
      expect(w.rows).toEqual([{ couleur_perso: '#1D4ED8' }]);
      const r = await comme(U.enseignant, 'select couleur_perso from profiles where id = auth.uid()');
      expect(r.rows[0].couleur_perso).toBe('#1D4ED8');
    });
    it('on peut effacer sa couleur (retour à celle de l’école)', async () => {
      const w = await comme(U.enseignant, `update profiles set couleur_perso = null where id = '${U.enseignant}' returning couleur_perso`);
      expect(w.rows).toEqual([{ couleur_perso: null }]);
    });
    it('une valeur qui n’est pas une couleur est refusée', async () => {
      for (const v of ['rouge', '#12', "#ZZZZZZ", "#123456; drop table profiles"]) {
        const w = await comme(U.enseignant, 'update profiles set couleur_perso = $1 where id = $2', [v, U.enseignant]);
        expect(w.erreur, v).toMatch(/profiles_couleur_perso_format/);
      }
    });
    it('on ne peut pas changer la couleur d’un autre utilisateur', async () => {
      await comme(U.fondateur, `update profiles set couleur_perso = '#B91C1C' where id = '${U.directeur}'`);
      const r = await db.query('select couleur_perso from profiles where id = $1', [U.directeur]);
      expect(r.rows[0].couleur_perso).toBeNull();
    });
    it('le rôle et les permissions restent verrouillés', async () => {
      const role = await comme(U.enseignant, `update profiles set role = 'fondateur' where id = '${U.enseignant}'`);
      expect(role.erreur).toMatch(/rôle/);
      const perm = await comme(U.enseignant, `update profiles set permissions = '{"finance": true}' where id = '${U.enseignant}'`);
      expect(perm.erreur).toMatch(/permissions/);
    });
  });

  describe('scripts', () => {
    it('se rejouent sans erreur', async () => {
      await db.exec(ECRITURE); await db.exec(COULEUR);
      expect((await comme(U.enseignant, `insert into students (school_id, nom, prenom, full_name) values ('${S1}', 'P', 'X', 'P X')`)).erreur).toMatch(/row-level security/);
    });
    it('sont repris tels quels dans schema.sql', () => {
      expect(SCHEMA).toContain(ECRITURE);
      expect(SCHEMA).toContain(COULEUR);
    });
    it('le script d’annulation redonne l’ancien droit d’écriture, puis le script le reprend', async () => {
      await db.exec(ANNULATION);
      const ouvert = await comme(U.enseignant, `insert into students (school_id, nom, prenom, full_name) values ('${S1}', 'Test', 'x', 'Test x') returning id`);
      expect(ouvert.erreur).toBeUndefined();
      await db.exec(`delete from students where nom = 'Test'`);
      await db.exec(ECRITURE);
      expect((await comme(U.enseignant, `insert into students (school_id, nom, prenom, full_name) values ('${S1}', 'P', 'X', 'P X')`)).erreur).toMatch(/row-level security/);
    });
  });
});
