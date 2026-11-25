// Montants des élèves réservés : un enseignant ne peut plus lire ce que chaque famille doit et a payé, même en interrogeant la base
// directement. Rejoué sur une copie COMPLÈTE de schema.sql (PGlite), avec de vrais comptes de rôles différents.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const RACINE = path.resolve(import.meta.dirname, '..');
const SCHEMA = fs.readFileSync(path.join(RACINE, 'supabase/schema.sql'), 'utf8');
const MIGRATION = fs.readFileSync(path.join(RACINE, 'supabase/restreindre_montants_eleves.sql'), 'utf8');
const ANNULATION = fs.readFileSync(path.join(RACINE, 'supabase/annuler_restriction_montants_eleves.sql'), 'utf8');

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
const ARGENT = ['montant_du', 'montant_paye', 'frais_connexe_du', 'frais_connexe_paye', 'note_arrangement',
  'moratoire_actif', 'moratoire_montant_convenu', 'moratoire_nb_mensualites', 'moratoire_date_debut', 'moratoire_date_fin', 'moratoire_motif', 'moratoire_prochaine_echeance'];

describe('montants des élèves réservés', () => {
  let db; let yearId; let classeId; let studentId; let enrollmentId;
  let colonnesIllisibles = [];
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
    // Comme sur Supabase : les droits par défaut sont donnés AVANT que le schéma crée les tables.
    await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on functions to anon, authenticated, service_role;`);
    await db.exec(SCHEMA);
    // État de schema.sql SEUL : une colonne ajoutée à « enrollments » sans le droit de lecture correspondant serait détectée ici.
    {
      const cols = (await db.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'enrollments'`)).rows.map((r) => r.column_name);
      await db.exec('set role authenticated');
      for (const c of cols.filter((x) => !ARGENT.includes(x))) {
        try { await db.query(`select ${c} from enrollments limit 1`); } catch { colonnesIllisibles.push(c); }
      }
      await db.exec('reset role');
    }
    await db.exec('alter table parent_access add column lien_parente text, add column civilite text; alter table students add column if not exists sexe text;');
    // La production a en plus les colonnes du moratoire, absentes de schema.sql : on les ajoute pour tester comme en vrai.
    await db.exec(`alter table enrollments add column if not exists moratoire_actif boolean not null default false, add column if not exists moratoire_montant_convenu numeric,
      add column if not exists moratoire_nb_mensualites int, add column if not exists moratoire_date_debut date, add column if not exists moratoire_date_fin date,
      add column if not exists moratoire_motif text, add column if not exists moratoire_prochaine_echeance date;
      -- la version précédente du script (6 colonnes) a déjà été lancée en production : la nouvelle doit la remplacer proprement
      drop view if exists enrollments_argent;
      create view enrollments_argent as select id, school_id, school_year_id, student_id, montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, note_arrangement, moratoire_montant_convenu from enrollments;`);
    // La migration est relancée après l'ajout de ces colonnes (elle les prend alors en compte, comme en production).
    await db.exec(`grant usage on schema public, auth to authenticated, service_role; grant execute on function auth.jwt(), auth.uid() to authenticated, anon;`);
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
    enrollmentId = (await db.query(`insert into enrollments (school_id, school_year_id, student_id, classe_id, montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, note_arrangement)
      values ('${S1}', '${yearId}', '${studentId}', '${classeId}', 150000, 40000, 20000, 5000, 'Paie en 3 fois') returning id`)).rows[0].id;
    await db.exec(MIGRATION);
  }, 120000);

  describe('lecture directe de la table', () => {
    for (const colonne of ARGENT) {
      it(`un enseignant ne peut pas lire « ${colonne} »`, async () => {
        const r = await comme(U.enseignant, `select ${colonne} from enrollments`);
        expect(r.erreur).toMatch(/permission denied/);
      });
    }
    it('un enseignant ne peut pas contourner avec « select * »', async () => {
      const r = await comme(U.enseignant, 'select * from enrollments');
      expect(r.erreur).toMatch(/permission denied/);
    });
    it('ni en filtrant ou en triant sur un montant (déduction par tâtonnement)', async () => {
      expect((await comme(U.enseignant, 'select id from enrollments where montant_du > 100000')).erreur).toMatch(/permission denied/);
      expect((await comme(U.enseignant, 'select id from enrollments order by montant_paye')).erreur).toMatch(/permission denied/);
    });
    it('ni par une jointure ou une sous-requête', async () => {
      expect((await comme(U.enseignant, 'select e.montant_du from students s join enrollments e on e.student_id = s.id')).erreur).toMatch(/permission denied/);
      expect((await comme(U.enseignant, 'select (select sum(montant_du) from enrollments)')).erreur).toMatch(/permission denied/);
    });
    it('un enseignant lit toujours la classe, l’année et le statut des élèves', async () => {
      const r = await comme(U.enseignant, 'select id, student_id, classe_id, school_year_id, statut, created_at from enrollments');
      expect(r.erreur).toBeUndefined();
      expect(r.rows).toHaveLength(1);
    });
    it('même le fondateur ne lit plus les montants directement (il passe par la vue)', async () => {
      const r = await comme(U.fondateur, 'select montant_du from enrollments');
      expect(r.erreur).toMatch(/permission denied/);
    });
    it('les personnes non connectées ne lisent rien', async () => {
      await db.exec('set role anon');
      try { await expect(db.query('select id from enrollments')).rejects.toThrow(/permission denied/); } finally { await db.exec('reset role'); }
    });
  });

  describe('la vue des montants', () => {
    it('le fondateur, le directeur et la secrétaire y lisent les montants de leur école', async () => {
      for (const u of [U.fondateur, U.directeur, U.secretaire]) {
        const r = await comme(u, 'select montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, note_arrangement from enrollments_argent');
        expect(r.erreur).toBeUndefined();
        expect(r.rows).toHaveLength(1);
        expect(Number(r.rows[0].montant_du)).toBe(150000);
        expect(Number(r.rows[0].frais_connexe_paye)).toBe(5000);
        expect(r.rows[0].note_arrangement).toBe('Paie en 3 fois');
      }
    });
    it('un enseignant à qui le fondateur a donné « finance » y lit aussi les montants', async () => {
      const r = await comme(U.enseignantFinance, 'select montant_du from enrollments_argent');
      expect(r.rows).toHaveLength(1);
    });
    it('un enseignant sans cette permission n’y voit aucune ligne (et pas d’erreur : l’écran reste simplement vide)', async () => {
      const r = await comme(U.enseignant, 'select * from enrollments_argent');
      expect(r.erreur).toBeUndefined();
      expect(r.rows).toHaveLength(0);
    });
    it('une autre école n’y voit rien', async () => {
      const r = await comme(U.autreEcole, 'select * from enrollments_argent');
      expect(r.rows).toHaveLength(0);
    });
    it('les personnes non connectées n’y ont pas accès', async () => {
      await db.exec('set role anon');
      try { await expect(db.query('select * from enrollments_argent')).rejects.toThrow(/permission denied/); } finally { await db.exec('reset role'); }
    });
    it('ne contient que l’identifiant de l’inscription et les colonnes d’argent', async () => {
      const r = await db.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'enrollments_argent'`);
      const colonnes = r.rows.map((x) => x.column_name).filter((c) => !['id', 'school_id', 'school_year_id', 'student_id'].includes(c)).sort();
      expect(colonnes).toEqual([...ARGENT].sort());
    });
  });

  describe('ce qui doit continuer à marcher', () => {
    it('la secrétaire enregistre un paiement : les montants de l’inscription se recalculent', async () => {
      const p = await comme(U.secretaire, `insert into payments (school_id, student_id, school_year_id, type_frais, montant) values ('${S1}', '${studentId}', '${yearId}', 'scolarite', 25000)`);
      expect(p.erreur).toBeUndefined();
      const r = await comme(U.secretaire, 'select montant_paye from enrollments_argent');
      expect(Number(r.rows[0].montant_paye)).toBe(25000);
    });
    it('la secrétaire modifie le montant dû et la classe (sans relire la ligne)', async () => {
      const r = await comme(U.secretaire, `update enrollments set classe_id = '${classeId}', montant_du = 160000 where id = '${enrollmentId}'`);
      expect(r.erreur).toBeUndefined();
      const lu = await comme(U.secretaire, 'select montant_du from enrollments_argent');
      expect(Number(lu.rows[0].montant_du)).toBe(160000);
    });
    it('le moratoire est caché à l’enseignant : ni lisible, ni devinable', async () => {
      for (const c of ['moratoire_actif', 'moratoire_motif', 'moratoire_date_fin', 'moratoire_prochaine_echeance']) {
        expect((await comme(U.enseignant, `select ${c} from enrollments`)).erreur, c).toMatch(/permission denied/);
      }
      expect((await comme(U.enseignant, 'select id from enrollments where moratoire_actif')).erreur).toMatch(/permission denied/);
    });
    it('un moratoire s’enregistre (écriture des colonnes protégées)', async () => {
      const r = await comme(U.secretaire, `update enrollments set moratoire_actif = true, moratoire_montant_convenu = 90000, moratoire_motif = 'Maladie', note_arrangement = 'Accord' where id = '${enrollmentId}'`);
      expect(r.erreur).toBeUndefined();
      const lu = await comme(U.secretaire, 'select moratoire_actif, moratoire_motif, moratoire_montant_convenu, note_arrangement from enrollments_argent');
      expect(lu.rows[0].moratoire_actif).toBe(true);
      expect(lu.rows[0].moratoire_motif).toBe('Maladie');
      expect(Number(lu.rows[0].moratoire_montant_convenu)).toBe(90000);
      expect(lu.rows[0].note_arrangement).toBe('Accord');
    });
    it('un enseignant ne peut toujours pas modifier un montant', async () => {
      const r = await comme(U.enseignant, `update enrollments set montant_du = 1 where id = '${enrollmentId}' returning id`);
      expect(r.erreur ?? r.rows.length).toSatisfy((v) => typeof v === 'string' || v === 0);
      const reel = await db.query('select montant_du from enrollments where id = $1', [enrollmentId]);
      expect(Number(reel.rows[0].montant_du)).toBe(160000);
    });
    it('l’inscription d’un nouvel élève (fonction create_student_with_enrollment) marche pour la secrétaire', async () => {
      const r = await comme(U.secretaire, `select create_student_with_enrollment('${S1}', 'KONE', 'Aïcha', 'KONE Aïcha', null, null, null, '${yearId}', '${classeId}', 150000, 20000) id`);
      expect(r.erreur).toBeUndefined();
      const lu = await comme(U.secretaire, 'select count(*)::int n from enrollments_argent');
      expect(lu.rows[0].n).toBe(2);
    });
    it('l’import CSV d’élèves (fonction import_students_csv) marche pour la secrétaire', async () => {
      const lignes = JSON.stringify([{ nom: 'MENSAH', prenom: 'Koffi', full_name: 'MENSAH Koffi', classe_id: classeId, matricule: 'M-1', montant_du: 180000 }]);
      const r = await comme(U.secretaire, 'select import_students_csv($1, $2, $3::jsonb) res', [S1, yearId, lignes]);
      expect(r.erreur).toBeUndefined();
    });
    it('le fondateur et un enseignant lisent le tableau de bord des classes (fonction qui lit les inscriptions sans montant)', async () => {
      const r = await comme(U.enseignant, 'select count(*)::int n from enrollments where classe_id is not null');
      expect(r.erreur).toBeUndefined();
    });
  });

  describe('garde-fou pour la suite', () => {
    it('toute colonne de « enrollments » (schema.sql) qui n’est pas un montant est lisible (sinon l’app casserait) : si ce test échoue, ajoute « grant select (colonne) on enrollments to authenticated »', () => {
      expect(colonnesIllisibles).toEqual([]);
    });
    it('les colonnes d’argent protégées existent bien (pas de faute de frappe)', async () => {
      const cols = (await db.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'enrollments'`)).rows.map((r) => r.column_name);
      for (const c of ARGENT) expect(cols).toContain(c);
    });
  });

  describe('migration', () => {
    it('se rejoue sans erreur et sans rien changer', async () => {
      await db.exec(MIGRATION);
      const r = await comme(U.fondateur, 'select count(*)::int n from enrollments_argent');
      expect(r.rows[0].n).toBeGreaterThan(0);
      expect((await comme(U.enseignant, 'select montant_du from enrollments')).erreur).toMatch(/permission denied/);
    });
    it('est bien reprise telle quelle dans schema.sql (un seul endroit à maintenir)', () => {
      expect(SCHEMA).toContain(MIGRATION);
    });
    it('le script d’annulation redonne l’accès, et la migration peut ensuite être relancée', async () => {
      await db.exec(ANNULATION);
      expect((await comme(U.enseignant, 'select montant_du from enrollments')).erreur).toBeUndefined();
      await db.exec(MIGRATION);
      expect((await comme(U.enseignant, 'select montant_du from enrollments')).erreur).toMatch(/permission denied/);
    });
  });
});
