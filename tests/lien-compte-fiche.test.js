// Lien entre un compte de connexion et une fiche du personnel : garde-fous de la colonne, rapprochement automatique, et règles du
// code de l'application. Le SQL vient de schema.sql et est rejoué dans une vraie base (PGlite).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const SCHEMA = fs.readFileSync(path.resolve(import.meta.dirname, '../supabase/schema.sql'), 'utf8');
const DEBUT = SCHEMA.indexOf('alter table staff add column if not exists profile_id');
const FIN = SCHEMA.indexOf('-- =====', DEBUT);
const BLOC = SCHEMA.slice(DEBUT, FIN);

const E1 = '11111111-1111-4111-8111-111111111111', E2 = '22222222-2222-4222-8222-222222222222', E3 = '33333333-3333-4333-8333-333333333333';
const U = (n) => `a0000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const S = (n) => `b0000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;

async function base(donnees = '') {
  const db = new PGlite();
  await db.exec(`
    create schema auth; create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table schools (id uuid primary key, plan text);
    create table profiles (id uuid primary key, school_id uuid, role text, full_name text, email text, phone text);
    create table staff (id uuid primary key, school_id uuid not null, full_name text, email text, phone text, role text);
    create function current_role_name() returns text language sql stable security definer as $$ select role from profiles where id = auth.uid() $$;
    create function check_plan_feature(p_school_id uuid, p_feature text) returns boolean language sql security definer as $$
      select coalesce((select plan <> 'decouverte' from schools where id = p_school_id), false) $$;
    -- Comme en production : modifier le personnel d'une école au forfait Découverte est refusé.
    create function refuser_decouverte() returns trigger language plpgsql as $$ begin
      if not check_plan_feature(new.school_id, 'personnel') then raise exception 'forfait'; end if; return new; end $$;
    create trigger trg_personnel_plan before insert or update on staff for each row execute function refuser_decouverte();
    insert into schools values ('${E1}', 'essentiel'), ('${E2}', 'essentiel'), ('${E3}', 'decouverte');
    ${BLOC}
    ${donnees}
  `);
  return db;
}
const lier = async (db, appliquer = false, profil = null) =>
  (await db.query('select methode, fiche, compte from lier_comptes_fiches($1, $2)', [appliquer, profil])).rows;
const liens = async (db) => (await db.query('select full_name, profile_id from staff order by full_name')).rows.map((r) => [r.full_name, r.profile_id]);

describe('rapprochement automatique', () => {
  const DONNEES = `
    insert into profiles values
      ('${U(1)}', '${E1}', 'enseignant', 'Koffi A.', 'koffi@ecole.bj', null),
      ('${U(2)}', '${E1}', 'secretaire', 'Awa BIO', null, '+229 97 00 00 02'),
      ('${U(3)}', '${E1}', 'directeur', 'Ismaël MENSAH', null, null),
      ('${U(4)}', '${E1}', 'enseignant', 'Jean KONE', null, null),
      ('${U(5)}', '${E1}', 'parent', 'Parent Test', 'parent@x.bj', null),
      ('${U(6)}', '${E2}', 'enseignant', 'Koffi A.', 'koffi@ecole.bj', null),
      ('${U(7)}', '${E3}', 'enseignant', 'Luc DOSSOU', 'luc@x.bj', null);
    insert into staff (id, school_id, full_name, email, phone, role) values
      ('${S(1)}', '${E1}', 'AGOSSOU Koffi', 'KOFFI@ecole.bj ', null, 'enseignant'),          -- par e-mail (casse et espace ignorés)
      ('${S(2)}', '${E1}', 'BIO Awa', null, '+2290197000002', 'secretaire'),                 -- par téléphone (ancien et nouveau format)
      ('${S(3)}', '${E1}', 'MENSAH Ismael', null, null, 'directeur'),                        -- par nom (accents et ordre des mots)
      ('${S(4)}', '${E1}', 'KONE Jean', null, null, 'enseignant'),                           -- homonyme :
      ('${S(5)}', '${E1}', 'Jean KONE', null, null, 'enseignant'),                           -- deux fiches pour un nom : pas de lien
      ('${S(6)}', '${E1}', 'Parent Test', 'parent@x.bj', null, 'enseignant'),                -- le compte est un compte parent : pas de lien
      ('${S(7)}', '${E2}', 'Autre ecole', 'koffi@ecole.bj', null, 'enseignant');             -- même e-mail dans l'autre école : relié à SON compte
    insert into staff (id, school_id, full_name, email, role) values ('${S(8)}', '${E3}', 'DOSSOU Luc', 'luc@x.bj', 'enseignant'); -- forfait Découverte`;
  // (staff 8 : insertion refusée par le déclencheur de forfait de ce banc d'essai ; on la contourne pour la mettre en place)
  async function pret() {
    const db = await base();
    await db.exec(`alter table staff disable trigger trg_personnel_plan;
      ${DONNEES.replace("insert into staff (id, school_id, full_name, email, role) values ('" + S(8) + "', '" + E3 + "', 'DOSSOU Luc', 'luc@x.bj', 'enseignant');", '')}
      insert into staff (id, school_id, full_name, email, role) values ('${S(8)}', '${E3}', 'DOSSOU Luc', 'luc@x.bj', 'enseignant');
      alter table staff enable trigger trg_personnel_plan;`);
    return db;
  }

  it('l\'aperçu ne modifie rien et annonce les liens sûrs, avec la méthode', async () => {
    const db = await pret();
    const apercu = await lier(db, false);
    expect(apercu.map((r) => [r.methode, r.fiche, r.compte])).toEqual([
      ['email', 'AGOSSOU Koffi', 'Koffi A.'],
      ['email', 'Autre ecole', 'Koffi A.'],
      ['nom', 'MENSAH Ismael', 'Ismaël MENSAH'],
      ['telephone', 'BIO Awa', 'Awa BIO'],
    ]);
    expect((await liens(db)).every(([, p]) => p === null)).toBe(true);
  });
  it('appliquer enregistre exactement ces liens', async () => {
    const db = await pret();
    await lier(db, true);
    const l = Object.fromEntries(await liens(db));
    expect(l['AGOSSOU Koffi']).toBe(U(1));
    expect(l['Autre ecole']).toBe(U(6));         // jamais le compte de l'autre école
    expect(l['BIO Awa']).toBe(U(2));
    expect(l['MENSAH Ismael']).toBe(U(3));
    expect(l['KONE Jean']).toBeNull();            // homonymes : on ne devine pas
    expect(l['Jean KONE']).toBeNull();
    expect(l['Parent Test']).toBeNull();          // compte parent
    expect(l['DOSSOU Luc']).toBeNull();           // forfait sans personnel : fiche laissée telle quelle, sans erreur
  });
  it('rejouer ne change rien (ce qui est relié n\'est plus candidat)', async () => {
    const db = await pret();
    await lier(db, true);
    const avant = await liens(db);
    expect(await lier(db, true)).toEqual([]);
    expect(await liens(db)).toEqual(avant);
  });
  it('limité à un compte : seulement lui', async () => {
    const db = await pret();
    const r = await lier(db, true, U(2));
    expect(r.map((x) => x.fiche)).toEqual(['BIO Awa']);
    expect((await liens(db)).filter(([, p]) => p).length).toBe(1);
  });
  it('un compte relié à une fiche ne l\'est pas à une deuxième', async () => {
    const db = await pret();
    await lier(db, true);
    await db.exec(`insert into staff (id, school_id, full_name, email, role) values ('${S(9)}', '${E1}', 'Koffi Bis', 'koffi@ecole.bj', 'enseignant')`);
    expect(await lier(db, true)).toEqual([]);
  });
});

describe('garde-fous du lien', () => {
  const DONNEES = `
    insert into profiles values
      ('${U(1)}', '${E1}', 'fondateur', 'Fondatrice', null, null),
      ('${U(2)}', '${E1}', 'enseignant', 'Koffi A.', null, null),
      ('${U(3)}', '${E2}', 'enseignant', 'Autre ecole', null, null),
      ('${U(4)}', '${E1}', 'parent', 'Parent', null, null);
    insert into staff (id, school_id, full_name, role) values ('${S(1)}', '${E1}', 'AGOSSOU Koffi', 'enseignant'), ('${S(2)}', '${E1}', 'BIO Awa', 'enseignant');
    grant select, update, insert on staff to authenticated; grant select on profiles to authenticated;`;
  const moi = (db, id) => db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`);

  it('le fondateur relie une fiche à un compte de son école, et peut délier', async () => {
    const db = await base(DONNEES);
    await moi(db, U(1));
    await db.exec(`update staff set profile_id = '${U(2)}' where id = '${S(1)}'`);
    await db.exec(`update staff set profile_id = null where id = '${S(1)}'`);
    await db.exec('reset role');
    expect((await db.query(`select profile_id from staff where id = '${S(1)}'`)).rows[0].profile_id).toBeNull();
  });
  it('jamais un compte d\'une autre école', async () => {
    const db = await base(DONNEES);
    await moi(db, U(1));
    await expect(db.exec(`update staff set profile_id = '${U(3)}' where id = '${S(1)}'`)).rejects.toThrow(/n'appartient pas à cette école/);
  });
  it('jamais un compte parent', async () => {
    const db = await base(DONNEES);
    await moi(db, U(1));
    await expect(db.exec(`update staff set profile_id = '${U(4)}' where id = '${S(1)}'`)).rejects.toThrow(/n'appartient pas à cette école/);
  });
  it('un enseignant ne peut ni relier ni délier, même sa propre fiche', async () => {
    const db = await base(DONNEES);
    await moi(db, U(2));
    await expect(db.exec(`update staff set profile_id = '${U(2)}' where id = '${S(1)}'`)).rejects.toThrow(/Seul le fondateur/);
  });
  it('mais il peut toujours modifier le reste de la fiche (pas de blocage des autres colonnes)', async () => {
    const db = await base(DONNEES);
    await moi(db, U(2));
    await db.exec(`update staff set full_name = 'AGOSSOU K.' where id = '${S(1)}'`);
  });
  it('un compte ne peut être relié qu\'à une seule fiche', async () => {
    const db = await base(DONNEES);
    await moi(db, U(1));
    await db.exec(`update staff set profile_id = '${U(2)}' where id = '${S(1)}'`);
    await expect(db.exec(`update staff set profile_id = '${U(2)}' where id = '${S(2)}'`)).rejects.toThrow(/duplicate key|unique/);
  });
  it('le rapprochement automatique est fermé au public (serveur et éditeur SQL seulement)', () => {
    expect(SCHEMA).toMatch(/revoke all on function public\.lier_comptes_fiches\(boolean, uuid\) from public, anon, authenticated;/);
    expect(SCHEMA).toMatch(/grant execute on function public\.lier_comptes_fiches\(boolean, uuid\) to service_role;/);
  });
});

describe('création de compte (fonction serveur)', () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, '../supabase/functions/manage-staff-account/index.ts'), 'utf8');
  it('tente de relier le nouveau compte à sa fiche, sans jamais faire échouer la création', () => {
    expect(source).toMatch(/adminClient\.rpc\('lier_comptes_fiches', \{ p_appliquer: true, p_profile: created\.user\.id \}\)/);
    const i = source.indexOf("rpc('lier_comptes_fiches'");
    expect(source.slice(i - 80, i + 160)).toMatch(/try \{[\s\S]*catch/);
    expect(source.indexOf("rpc('lier_comptes_fiches'")).toBeGreaterThan(source.indexOf("from('profiles').insert"));
  });
});
