// Scripts de l'école de démonstration (supabase/demo_ecole.sql et demo_ecole_vider.sql) : rejoués sur une copie COMPLÈTE de schema.sql
// dans une vraie base PostgreSQL (PGlite). On vérifie les garde-fous (jamais une école de client), les données produites, la cohérence
// des montants, qu'aucun vrai numéro n'est utilisé et qu'une autre école n'est jamais touchée.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { statutRecouvrement } from '../src/lib/retard.js';

const RACINE = path.resolve(import.meta.dirname, '..');
const SCHEMA = fs.readFileSync(path.join(RACINE, 'supabase/schema.sql'), 'utf8');
const REMPLIR = fs.readFileSync(path.join(RACINE, 'supabase/demo_ecole.sql'), 'utf8');
const VIDER = fs.readFileSync(path.join(RACINE, 'supabase/demo_ecole_vider.sql'), 'utf8');
const NOM_DEMO = 'École de démonstration';

const rejeter = async (db, sql) => { try { await db.exec(sql); return null; } catch (e) { return String(e.message); } };

describe('école de démonstration', () => {
  let db; let demoId; let clientId; let empreinte1;
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const un = async (sql, params) => (await q(sql, params))[0];

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
    // comme sur Supabase, le rôle serveur a accès à toutes les tables
    await db.exec('grant usage on schema public, auth to service_role; grant all on all tables in schema public to service_role; grant all on all functions in schema public to service_role;');
    // colonnes qui existent en production sans figurer dans schema.sql
    await db.exec('alter table parent_access add column lien_parente text, add column civilite text; alter table students add column sexe text;');
    demoId = (await un(`insert into schools (name, plan) values ($1, 'decouverte') returning id`, [NOM_DEMO])).id;
    clientId = (await un(`insert into schools (name, plan) values ('Collège Les Palmiers', 'essentiel') returning id`)).id;
    // une vraie école de client, avec ses propres données : elles ne doivent jamais bouger
    await db.exec(`insert into students (school_id, nom, prenom, full_name, matricule) values ('${clientId}', 'REEL', 'Élève', 'REEL Élève', 'C-1');`);
  }, 120000);

  it('refuse une école introuvable, avec un message clair', async () => {
    const err = await rejeter(db, REMPLIR.replace("'École de démonstration'", "'Ecole inconnue'"));
    expect(err).toMatch(/École introuvable/);
  });

  it('refuse de remplir l\'école d\'un client (nom sans « démo »)', async () => {
    const err = await rejeter(db, REMPLIR.replace("'École de démonstration'", "'Collège Les Palmiers'"));
    expect(err).toMatch(/ne contient pas « démo »/);
    expect((await un('select count(*)::int n from students where school_id = $1', [clientId])).n).toBe(1);
  });

  it('refuse de vider l\'école d\'un client', async () => {
    const err = await rejeter(db, VIDER.replace("'École de démonstration'", "'Collège Les Palmiers'"));
    expect(err).toMatch(/ne contient pas « démo »/);
    expect((await un('select count(*)::int n from students where school_id = $1', [clientId])).n).toBe(1);
  });

  describe('remplissage', () => {
    beforeAll(async () => {
      const err = await rejeter(db, REMPLIR); if (err) throw new Error(err);
      empreinte1 = (await un(`select md5(string_agg(s.matricule || s.full_name || e.montant_paye::text, '|' order by s.matricule)) h from students s join enrollments e on e.student_id = s.id where s.school_id = $1`, [demoId])).h;
    }, 120000);

    it('passe l\'école de démonstration au plan Essentiel et coupe les rappels automatiques', async () => {
      const s = await un('select plan, rappels_auto from schools where id = $1', [demoId]);
      expect(s.plan).toBe('essentiel');
      expect(s.rappels_auto).toBe(false);
    });

    it('ne change pas le plan ni les réglages d\'une autre école', async () => {
      const s = await un('select plan, rappels_auto from schools where id = $1', [clientId]);
      expect(s.plan).toBe('essentiel');
      expect(s.rappels_auto).toBe(true);
    });

    it('crée 8 classes, 4 niveaux de frais, 8 matières et une année en cours avec calendrier', async () => {
      expect((await un('select count(*)::int n from classes where school_id = $1', [demoId])).n).toBe(8);
      expect((await un('select count(*)::int n from fee_schedules where school_id = $1', [demoId])).n).toBe(4);
      expect((await un('select count(*)::int n from subjects where school_id = $1', [demoId])).n).toBe(8);
      const y = await un('select * from school_years where school_id = $1 and is_current', [demoId]);
      expect(y.date_tranche1 && y.date_tranche2 && y.date_tranche3 && y.date_connexe).toBeTruthy();
      expect(new Date(y.date_fin) > new Date(y.date_debut)).toBe(true);
    });

    it('crée entre 200 et 300 élèves, chacun inscrit dans une classe et lié à un parent', async () => {
      const n = (await un('select count(*)::int n from students where school_id = $1', [demoId])).n;
      expect(n).toBeGreaterThanOrEqual(200);
      expect(n).toBeLessThanOrEqual(300);
      expect((await un('select count(*)::int n from enrollments where school_id = $1 and classe_id is not null', [demoId])).n).toBe(n);
      expect((await un(`select count(*)::int n from students s where school_id = $1 and not exists (select 1 from parent_access_students l where l.student_id = s.id)`, [demoId])).n).toBe(0);
    });

    it('le montant payé de chaque inscription est exactement la somme de ses paiements (scolarité et frais connexes)', async () => {
      const ecarts = await q(`
        select e.id from enrollments e where e.school_id = $1 and (
          e.montant_paye <> coalesce((select sum(montant) from payments p where p.student_id = e.student_id and p.school_year_id = e.school_year_id and p.type_frais = 'scolarite'), 0)
          or e.frais_connexe_paye <> coalesce((select sum(montant) from payments p where p.student_id = e.student_id and p.school_year_id = e.school_year_id and p.type_frais = 'connexe'), 0))`, [demoId]);
      expect(ecarts).toEqual([]);
    });

    it('personne ne paie plus que ce qu\'il doit', async () => {
      expect((await q('select id from enrollments where school_id = $1 and (montant_paye > montant_du or frais_connexe_paye > frais_connexe_du)', [demoId]))).toEqual([]);
    });

    it('les paiements sont variés : élèves ayant tout payé, à jour de leurs échéances, en retard, avec arrangement', async () => {
      const r = await un(`select
        count(*) filter (where montant_du - montant_paye <= 0)::int tout_paye,
        count(*) filter (where montant_paye = 0)::int rien_paye,
        count(*) filter (where note_arrangement is not null)::int arrangements,
        count(*)::int total
        from enrollments where school_id = $1`, [demoId]);
      expect(r.tout_paye).toBeGreaterThan(r.total * 0.08);
      expect(r.rien_paye).toBeGreaterThan(5);
      expect(r.arrangements).toBeGreaterThan(0);
      expect(r.arrangements).toBeLessThan(r.total * 0.1);
    });

    it('vu par l\'application (même calcul que le Tableau de bord et Recouvrement) : à jour, dans les délais, à relancer et arrangements sont tous représentés', async () => {
      const ds = (v) => (v ? new Date(v).toISOString().slice(0, 10) : null);
      const y = await un('select * from school_years where school_id = $1 and is_current', [demoId]);
      const annee = { date_tranche1: ds(y.date_tranche1), date_tranche2: ds(y.date_tranche2), date_tranche3: ds(y.date_tranche3), date_connexe: ds(y.date_connexe) };
      const grille = Object.fromEntries((await q('select * from fee_schedules where school_id = $1', [demoId])).map((f) => [f.niveau, f]));
      const lignes = await q('select e.*, c.niveau from enrollments e join classes c on c.id = e.classe_id where e.school_id = $1', [demoId]);
      const n = {};
      for (const e of lignes) { const k = statutRecouvrement(e, annee, grille[e.niveau]).statutKey; n[k] = (n[k] || 0) + 1; }
      const t = lignes.length;
      expect((n.a_relancer || 0) / t).toBeGreaterThan(0.25);   // de quoi remplir le tableau « à relancer »
      expect((n.a_relancer || 0) / t).toBeLessThan(0.5);       // sans que toute l'école paraisse en faillite
      expect((n.dans_les_delais || 0) / t).toBeGreaterThan(0.25);
      expect((n.a_jour || 0) / t).toBeGreaterThan(0.08);
      expect(n.moratoire || 0).toBeGreaterThan(0);
    });

    it('aucun paiement n\'est daté dans le futur ni avant la rentrée', async () => {
      const r = await un(`select count(*)::int n from payments p join school_years y on y.id = p.school_year_id
        where p.school_id = $1 and (p.date > current_date or p.date < y.date_debut)`, [demoId]);
      expect(r.n).toBe(0);
    });

    it('les présences couvrent 15 jours de classe, sans week-end, avec absents et retards', async () => {
      const jours = await q('select distinct date from attendance_records where school_id = $1', [demoId]);
      expect(jours).toHaveLength(15);
      expect(jours.some((j) => [0, 6].includes(new Date(j.date).getUTCDay()))).toBe(false);
      const r = await un(`select count(*) filter (where statut = 'absent')::int a, count(*) filter (where statut = 'retard')::int r from attendance_records where school_id = $1`, [demoId]);
      expect(r.a).toBeGreaterThan(0);
      expect(r.r).toBeGreaterThan(0);
    });

    it('chaque élève a 3 notes par matière au 1er trimestre, toutes entre 2 et 20', async () => {
      const n = (await un('select count(*)::int n from students where school_id = $1', [demoId])).n;
      expect((await un('select count(*)::int n from grades where school_id = $1', [demoId])).n).toBe(n * 8 * 3);
      const bornes = await un('select min(note) mn, max(note) mx from grades where school_id = $1', [demoId]);
      expect(Number(bornes.mn)).toBeGreaterThanOrEqual(2);
      expect(Number(bornes.mx)).toBeLessThanOrEqual(20);
    });

    it('crée 8 membres du personnel avec leurs salaires, et des dépenses', async () => {
      expect((await un('select count(*)::int n from staff where school_id = $1', [demoId])).n).toBe(8);
      expect((await un('select count(*)::int n from staff_salaries where school_id = $1', [demoId])).n).toBeGreaterThan(0);
      expect((await un('select count(*)::int n from expenses where school_id = $1', [demoId])).n).toBe(7);
    });

    it('tous les numéros de téléphone sont fictifs (+229 01 00 …) : aucun vrai message ne peut partir', async () => {
      const vrais = await q(`
        select phone from parent_access where school_id = $1 and phone not like '+2290100%'
        union all select parent_phone from students where school_id = $1 and parent_phone not like '+2290100%'
        union all select phone from staff where school_id = $1 and phone not like '+2290100%'`, [demoId]);
      expect(vrais).toEqual([]);
    });

    it('les codes du portail parents sont uniques, de 8 caractères, sans caractères ambigus', async () => {
      const codes = (await q('select code from parent_access where school_id = $1', [demoId])).map((r) => r.code);
      expect(new Set(codes).size).toBe(codes.length);
      expect(codes.every((c) => /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(c))).toBe(true);
    });

    it('l\'élève modèle existe avec un code parent, et des frères et sœurs partagent le même parent', async () => {
      const m = await un(`select p.code from students s join parent_access_students l on l.student_id = s.id join parent_access p on p.id = l.parent_access_id
        where s.school_id = $1 and s.matricule = 'DEMO-0001'`, [demoId]);
      expect(m.code).toHaveLength(8);
      expect((await un(`select count(*)::int n from (select parent_access_id from parent_access_students l join parent_access p on p.id = l.parent_access_id
        where p.school_id = $1 group by 1 having count(*) > 1) x`, [demoId])).n).toBeGreaterThan(5);
    });

    it('les élèves ont un sexe renseigné quand la colonne existe (diagramme filles/garçons)', async () => {
      const r = await un(`select count(*) filter (where sexe = 'F')::int f, count(*) filter (where sexe = 'M')::int m from students where school_id = $1`, [demoId]);
      expect(r.f).toBeGreaterThan(50);
      expect(r.m).toBeGreaterThan(50);
    });

    it('rien n\'a été écrit dans l\'école du client', async () => {
      const t = ['students', 'enrollments', 'payments', 'classes', 'grades', 'parent_access', 'staff', 'expenses', 'school_years', 'fee_schedules', 'subjects', 'attendance_records'];
      for (const table of t) {
        const n = (await un(`select count(*)::int n from ${table} where school_id = $1`, [clientId])).n;
        expect(n, table).toBe(table === 'students' ? 1 : 0);
      }
    });

    it('refuse de tourner une seconde fois (pas de doublons)', async () => {
      const avant = (await un('select count(*)::int n from students where school_id = $1', [demoId])).n;
      const err = await rejeter(db, REMPLIR);
      expect(err).toMatch(/contient déjà des élèves/);
      expect((await un('select count(*)::int n from students where school_id = $1', [demoId])).n).toBe(avant);
    });

  });

  describe('vidage puis nouveau remplissage', () => {
    it('vide toute l\'école de démonstration, garde l\'école et son année, et ne touche pas l\'école du client', async () => {
      const err = await rejeter(db, VIDER);
      expect(err).toBeNull();
      for (const table of ['students', 'enrollments', 'payments', 'payments_audit', 'classes', 'grades', 'parent_access', 'staff', 'expenses', 'fee_schedules', 'subjects', 'attendance_records', 'staff_salaries']) {
        expect((await un(`select count(*)::int n from ${table} where school_id = $1`, [demoId])).n, table).toBe(0);
      }
      expect((await un('select count(*)::int n from schools where id = $1', [demoId])).n).toBe(1);
      expect((await un('select count(*)::int n from school_years where school_id = $1', [demoId])).n).toBe(1);
      expect((await un('select count(*)::int n from students where school_id = $1', [clientId])).n).toBe(1);
    });

    it('on peut remplir de nouveau après le vidage, et on retrouve le même nombre d\'élèves qu\'au premier remplissage', async () => {
      const err = await rejeter(db, REMPLIR);
      expect(err).toBeNull();
      const n = (await un('select count(*)::int n from students where school_id = $1', [demoId])).n;
      expect(n).toBeGreaterThanOrEqual(200);
      expect((await un('select count(*)::int n from school_years where school_id = $1', [demoId])).n).toBe(1);
    });

    it('le résultat est reproductible : exactement les mêmes élèves et les mêmes montants qu\'au premier remplissage', async () => {
      const h = (await un(`select md5(string_agg(s.matricule || s.full_name || e.montant_paye::text, '|' order by s.matricule)) h from students s join enrollments e on e.student_id = s.id where s.school_id = $1`, [demoId])).h;
      expect(h).toBe(empreinte1);
    });
  });
});
