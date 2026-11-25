// Finances et personnel réservés : un enseignant ne peut plus LIRE (ni saisir) salaires, paiements, dépenses et avances, ni modifier les
// fiches du personnel, même en interrogeant la base directement. Rejoué sur une copie COMPLÈTE de schema.sql (PGlite), avec de vrais comptes de rôles différents.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const RACINE = path.resolve(import.meta.dirname, '..');
const SCHEMA = fs.readFileSync(path.join(RACINE, 'supabase/schema.sql'), 'utf8');
const MIGRATION = fs.readFileSync(path.join(RACINE, 'supabase/restreindre_finances.sql'), 'utf8');

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const U = {
  fondateur: 'a0000000-0000-4000-8000-000000000001',
  directeur: 'a0000000-0000-4000-8000-000000000002',
  secretaire: 'a0000000-0000-4000-8000-000000000003',
  enseignant: 'a0000000-0000-4000-8000-000000000004',
  enseignantFinance: 'a0000000-0000-4000-8000-000000000005',
  enseignantExplicitNon: 'a0000000-0000-4000-8000-000000000006',
  enseignantPersonnel: 'a0000000-0000-4000-8000-000000000008',
  sansPermissions: 'a0000000-0000-4000-8000-000000000007',
  autreEcole: 'b0000000-0000-4000-8000-000000000001',
};
const TABLES_FINANCES = ['payments', 'staff_salaries', 'salary_advances', 'expenses', 'staff_remuneration'];

describe('finances réservées', () => {
  let db; let yearId; let studentId; let staffId;
  const comme = async (utilisateur, sql, params) => {
    await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub: utilisateur, aal: 'aal1' })}', false)`);
    try { return { rows: (await db.query(sql, params)).rows }; }
    catch (e) { return { erreur: String(e.message) }; }
    finally { await db.exec('reset role'); }
  };
  const nb = async (utilisateur, table) => { const r = await comme(utilisateur, `select count(*)::int n from ${table}`); return r.erreur ? `ERREUR ${r.erreur}` : r.rows[0].n; };

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
    await db.exec(SCHEMA);
    await db.exec('alter table parent_access add column lien_parente text, add column civilite text;');
    await db.exec(`grant usage on schema public, auth to authenticated, service_role; grant all on all tables in schema public to authenticated, service_role;
      grant all on all functions in schema public to authenticated, service_role; grant execute on function auth.jwt(), auth.uid() to authenticated, anon;`);
    await db.exec(`
      insert into schools (id, name, plan) values ('${S1}', 'Collège A', 'essentiel'), ('${S2}', 'Collège B', 'essentiel');
      ${Object.values(U).map((u) => `insert into auth.users (id) values ('${u}');`).join('\n')}
      insert into profiles (id, school_id, role, full_name, permissions) values
        ('${U.fondateur}', '${S1}', 'fondateur', 'F', null),
        ('${U.directeur}', '${S1}', 'directeur', 'D', '{"finance": true}'),
        ('${U.secretaire}', '${S1}', 'secretaire', 'S', '{"finance": true}'),
        ('${U.enseignant}', '${S1}', 'enseignant', 'E', '{"finance": false, "notes": true}'),
        ('${U.enseignantFinance}', '${S1}', 'enseignant', 'EF', '{"finance": true}'),
        ('${U.enseignantExplicitNon}', '${S1}', 'enseignant', 'EN', '{"finance": "false"}'),
        ('${U.sansPermissions}', '${S1}', 'enseignant', 'SP', null),
        ('${U.enseignantPersonnel}', '${S1}', 'enseignant', 'EP', '{"personnel": true, "finance": false}'),
        ('${U.autreEcole}', '${S2}', 'directeur', 'DB', '{"finance": true}');`);
    yearId = (await db.query(`insert into school_years (school_id, label, is_current) values ('${S1}', '2026-2027', true) returning id`)).rows[0].id;
    studentId = (await db.query(`insert into students (school_id, nom, prenom, full_name) values ('${S1}', 'A', 'B', 'A B') returning id`)).rows[0].id;
    staffId = (await db.query(`insert into staff (school_id, nom, prenom, full_name, role, salaire_mensuel) values ('${S1}', 'X', 'Y', 'X Y', 'Enseignant', 120000) returning id`)).rows[0].id;
    await db.exec(`
      insert into payments (school_id, student_id, school_year_id, type_frais, montant) values ('${S1}', '${studentId}', '${yearId}', 'scolarite', 50000);
      insert into staff_salaries (school_id, staff_id, school_year_id, montant, mois) values ('${S1}', '${staffId}', '${yearId}', 100000, 'Octobre 2026');
      insert into salary_advances (school_id, staff_id, montant, solde, statut) values ('${S1}', '${staffId}', 20000, 20000, 'attente_fondateur');
      insert into expenses (school_id, school_year_id, libelle, categorie, montant) values ('${S1}', '${yearId}', 'Électricité', 'Charges', 30000);`);
    // la migration copie les salaires de la fiche vers la nouvelle table et les efface de la fiche
    await db.exec(MIGRATION);
  }, 120000);

  describe('lecture', () => {
    for (const table of TABLES_FINANCES) {
      it(`${table} : visible par le fondateur, le directeur et la secrétaire`, async () => {
        expect(await nb(U.fondateur, table)).toBeGreaterThan(0);
        expect(await nb(U.directeur, table)).toBeGreaterThan(0);
        expect(await nb(U.secretaire, table)).toBeGreaterThan(0);
      });
      it(`${table} : invisible pour un enseignant, quelle que soit sa configuration`, async () => {
        expect(await nb(U.enseignant, table)).toBe(0);
        expect(await nb(U.sansPermissions, table)).toBe(0);
        expect(await nb(U.enseignantExplicitNon, table)).toBe(0);
      });
      it(`${table} : visible par un enseignant à qui le fondateur a donné la permission « finance »`, async () => {
        expect(await nb(U.enseignantFinance, table)).toBeGreaterThan(0);
      });
      it(`${table} : invisible pour une autre école`, async () => {
        expect(await nb(U.autreEcole, table)).toBe(0);
      });
    }
  });

  describe('saisie', () => {
    it('un enseignant ne peut plus saisir une dépense ni une avance', async () => {
      const dep = await comme(U.enseignant, `insert into expenses (school_id, school_year_id, libelle, categorie, montant) values ('${S1}', '${yearId}', 'Pirate', 'X', 1)`);
      expect(dep.erreur).toMatch(/row-level security/);
      const av = await comme(U.enseignant, `insert into salary_advances (school_id, staff_id, montant, solde, statut) values ('${S1}', '${staffId}', 5, 5, 'attente_fondateur')`);
      expect(av.erreur).toMatch(/row-level security/);
    });
    it('la secrétaire peut toujours saisir une dépense', async () => {
      const dep = await comme(U.secretaire, `insert into expenses (school_id, school_year_id, libelle, categorie, montant) values ('${S1}', '${yearId}', 'Craie', 'Fournitures', 2000)`);
      expect(dep.erreur).toBeUndefined();
    });
    it('un enseignant ne peut ni inscrire ni modifier un salaire prévu', async () => {
      const ins = await comme(U.enseignant, `insert into staff_remuneration (staff_id, school_id, salaire_mensuel) values ('${staffId}', '${S1}', 1) on conflict (staff_id) do update set salaire_mensuel = 1`);
      expect(ins.erreur).toBeDefined();
      const upd = await comme(U.enseignant, `update staff_remuneration set salaire_mensuel = 999999 where staff_id = '${staffId}' returning staff_id`);
      expect(upd.erreur ?? upd.rows.length).toSatisfy((v) => typeof v === 'string' || v === 0);
      const reel = await db.query('select salaire_mensuel from staff_remuneration where staff_id = $1', [staffId]);
      expect(Number(reel.rows[0].salaire_mensuel)).toBe(120000);
    });
    it('le directeur peut modifier un salaire prévu', async () => {
      const upd = await comme(U.directeur, `update staff_remuneration set salaire_mensuel = 130000 where staff_id = '${staffId}' returning staff_id`);
      expect(upd.rows).toHaveLength(1);
      await db.exec(`update staff_remuneration set salaire_mensuel = 120000 where staff_id = '${staffId}'`);
    });
  });

  describe('ce qui doit continuer à marcher', () => {
    it('un enseignant voit toujours la liste du personnel (noms, rôles) mais plus aucun salaire dans la fiche', async () => {
      const r = await comme(U.enseignant, 'select full_name, role, salaire_mensuel from staff');
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0].full_name).toBe('X Y');
      expect(r.rows[0].salaire_mensuel).toBeNull();
    });
    it('un parent voit toujours les paiements de son enfant (la règle « parent » est inchangée)', async () => {
      const regles = (await db.query(`select policyname from pg_policies where tablename = 'payments' and cmd = 'SELECT'`)).rows.map((x) => x.policyname);
      expect(regles).toContain('payments: select (parent)');
    });
  });

  describe('fiches du personnel', () => {
    const ajout = (nom) => `insert into staff (school_id, nom, prenom, full_name, role) values ('${S1}', '${nom}', 'Z', '${nom} Z', 'Enseignant') returning id`;

    it('un enseignant ne peut ni ajouter, ni modifier, ni supprimer une fiche', async () => {
      expect((await comme(U.enseignant, ajout('PIRATE'))).erreur).toMatch(/row-level security/);
      const upd = await comme(U.enseignant, `update staff set role = 'Directeur' where id = '${staffId}' returning id`);
      expect(upd.erreur ?? upd.rows.length).toSatisfy((v) => typeof v === 'string' || v === 0);
      const del = await comme(U.enseignant, `delete from staff where id = '${staffId}' returning id`);
      expect(del.erreur ?? del.rows.length).toSatisfy((v) => typeof v === 'string' || v === 0);
      const reste = await db.query('select role from staff where id = $1', [staffId]);
      expect(reste.rows).toHaveLength(1);
      expect(reste.rows[0].role).toBe('Enseignant');
    });
    it('même chose sans permissions du tout, ou avec « personnel » refusé', async () => {
      expect((await comme(U.sansPermissions, ajout('X1'))).erreur).toMatch(/row-level security/);
      expect((await comme(U.enseignantFinance, ajout('X2'))).erreur).toMatch(/row-level security/); // la finance ne donne pas le personnel
      expect((await comme(U.enseignantExplicitNon, ajout('X3'))).erreur).toMatch(/row-level security/);
    });
    it('un enseignant à qui le fondateur a coché « Personnel » peut gérer les fiches', async () => {
      const r = await comme(U.enseignantPersonnel, ajout('AUTORISE'));
      expect(r.erreur).toBeUndefined();
      const upd = await comme(U.enseignantPersonnel, `update staff set niveau_etudes = 'Licence' where id = '${r.rows[0].id}' returning id`);
      expect(upd.rows).toHaveLength(1);
      const del = await comme(U.enseignantPersonnel, `delete from staff where id = '${r.rows[0].id}' returning id`);
      expect(del.rows).toHaveLength(1);
    });
    it('le fondateur, le directeur et la secrétaire peuvent toujours ajouter, modifier et supprimer', async () => {
      for (const u of [U.fondateur, U.directeur, U.secretaire]) {
        const r = await comme(u, ajout('NOUVEAU'));
        expect(r.erreur, u).toBeUndefined();
        const upd = await comme(u, `update staff set niveau_etudes = 'Master' where id = '${r.rows[0].id}' returning id`);
        expect(upd.rows, u).toHaveLength(1);
        const del = await comme(u, `delete from staff where id = '${r.rows[0].id}' returning id`);
        expect(del.rows, u).toHaveLength(1);
      }
    });
    it('un directeur d\'une autre école ne peut rien faire sur les fiches de cette école', async () => {
      expect((await comme(U.autreEcole, ajout('INTRUS'))).erreur).toMatch(/row-level security/);
      const upd = await comme(U.autreEcole, `update staff set role = 'X' where id = '${staffId}' returning id`);
      expect(upd.rows ?? []).toHaveLength(0);
      const del = await comme(U.autreEcole, `delete from staff where id = '${staffId}' returning id`);
      expect(del.rows ?? []).toHaveLength(0);
    });
    it('la lecture de la liste reste ouverte au personnel de l\'école (Classes, Matières, Emploi du temps en ont besoin)', async () => {
      expect(await nb(U.enseignant, 'staff')).toBeGreaterThan(0);
      expect(await nb(U.sansPermissions, 'staff')).toBeGreaterThan(0);
    });
  });

  describe('migration', () => {
    it('a copié le salaire de la fiche vers la nouvelle table, et l\'a effacé de la fiche', async () => {
      const r = await db.query('select salaire_mensuel from staff_remuneration where staff_id = $1', [staffId]);
      expect(Number(r.rows[0].salaire_mensuel)).toBe(120000);
      const fiche = await db.query('select salaire_mensuel from staff where id = $1', [staffId]);
      expect(fiche.rows[0].salaire_mensuel).toBeNull();
    });
    it('se rejoue sans erreur et sans rien changer', async () => {
      await db.exec(MIGRATION);
      const r = await db.query('select count(*)::int n, sum(salaire_mensuel)::int total from staff_remuneration');
      expect(r.rows[0]).toEqual({ n: 1, total: 120000 });
    });
    it('est bien le texte placé à la fin de schema.sql (un seul endroit à maintenir)', () => {
      expect(SCHEMA.endsWith(MIGRATION)).toBe(true);
    });
  });
});
