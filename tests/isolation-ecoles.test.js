// Isolation entre écoles : garde-fous automatiques sur supabase/schema.sql, pour qu'une future migration ne rouvre pas une brèche.
// (La base de production peut différer du fichier : supabase/verify_isolation.sql sert à le vérifier directement dans Supabase.)
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const SCHEMA = fs.readFileSync(path.resolve(import.meta.dirname, '../supabase/schema.sql'), 'utf8');
const SANS_COMMENTAIRES = SCHEMA.replace(/--[^\n]*/g, '');

// --- Inventaire : tables, sécurité par ligne, règles (la dernière définition gagne, un « drop policy » retire la règle) ---
function inventaire() {
  const tables = {};
  for (const m of SANS_COMMENTAIRES.matchAll(/create table (?:if not exists )?(?:public\.)?(\w+)\s*\((.*?)\n\);/gs)) {
    tables[m[1]] = { colonnes: [...m[2].matchAll(/^\s*(\w+)\s+[a-z]/gm)].map((x) => x[1]), rls: false, regles: {} };
  }
  for (const m of SANS_COMMENTAIRES.matchAll(/alter table (?:public\.)?(\w+) add column (?:if not exists )?(\w+)/g)) if (tables[m[1]]) tables[m[1]].colonnes.push(m[2]);
  for (const m of SANS_COMMENTAIRES.matchAll(/alter table (?:public\.)?(\w+) enable row level security/g)) if (tables[m[1]]) tables[m[1]].rls = true;
  const evenements = [...SANS_COMMENTAIRES.matchAll(/drop policy (?:if exists )?(?:"([^"]+)"|(\w+)) on (?:public\.)?([\w.]+)|create policy (?:"([^"]+)"|(\w+)) on (?:public\.)?([\w.]+)(.*?);/gs)]
    .sort((a, b) => a.index - b.index);
  const stockage = {};
  for (const m of evenements) {
    const dropNom = m[1] || m[2], dropTable = m[3], creeNom = m[4] || m[5], creeTable = m[6], corps = m[7];
    const cible = dropTable || creeTable;
    const registre = cible === 'storage.objects' ? stockage : tables[cible]?.regles;
    if (!registre) continue;
    if (dropNom) delete registre[dropNom];
    else registre[creeNom] = ' ' + corps.replace(/\s+/g, ' ');
  }
  return { tables, stockage };
}
const { tables, stockage } = inventaire();

// Tables qui n'ont volontairement aucune règle : seule une fonction serveur (clé service_role) y accède.
const SERVEUR_SEUL = ['whatsapp_configs'];
// Règles qui, volontairement, ne se limitent pas à l'école : elles se limitent à l'utilisateur lui-même.
const PORTEE_UTILISATEUR = ['push_subscriptions'];

describe('toute table d\'école est protégée par la sécurité par ligne', () => {
  const tablesEcole = Object.entries(tables).filter(([, t]) => t.colonnes.includes('school_id'));
  it('il y a bien des tables à vérifier', () => expect(tablesEcole.length).toBeGreaterThan(25));
  it('chaque table avec school_id a la sécurité par ligne activée', () => {
    expect(tablesEcole.filter(([, t]) => !t.rls).map(([n]) => n)).toEqual([]);
  });
  it('chacune a au moins une règle (sauf les tables réservées au serveur)', () => {
    expect(tablesEcole.filter(([n, t]) => Object.keys(t.regles).length === 0 && !SERVEUR_SEUL.includes(n)).map(([n]) => n)).toEqual([]);
  });
  it('chaque règle est limitée à l\'école (ou à l\'utilisateur, ou à l\'administrateur de la plateforme)', () => {
    const faibles = [];
    for (const [nom, t] of tablesEcole) {
      if (PORTEE_UTILISATEUR.includes(nom)) continue;
      for (const [regle, corps] of Object.entries(t.regles)) {
        if (!/school_id|current_school_id|student_school_id|auth\.uid\(\)|platform_admins|can_access_conversation|is_conversation/.test(corps)) faibles.push(`${nom} / ${regle}`);
      }
    }
    expect(faibles).toEqual([]);
  });
  it('aucune règle ne laisse tout passer (« using (true) ») sur une table d\'école', () => {
    const ouvertes = [];
    for (const [nom, t] of tablesEcole) for (const [regle, corps] of Object.entries(t.regles)) if (/using\s*\(\s*true\s*\)/i.test(corps)) ouvertes.push(`${nom} / ${regle}`);
    expect(ouvertes).toEqual([]);
  });
  it('les règles d\'écriture (ajout) vérifient l\'école de la nouvelle ligne', () => {
    const sans = [];
    for (const [nom, t] of tablesEcole) {
      if (PORTEE_UTILISATEUR.includes(nom)) continue;
      for (const [regle, corps] of Object.entries(t.regles)) {
        if (/\bfor insert\b/i.test(corps) && !/with check[\s\S]*(school_id|current_school_id|auth\.uid\(\)|platform_admins)/i.test(corps)) sans.push(`${nom} / ${regle}`);
      }
    }
    expect(sans).toEqual([]);
  });
});

describe('fonctions qui contournent la sécurité par ligne', () => {
  it('« find_user_id_by_email » n\'est appelable que par le serveur (ni visiteur sans compte, ni utilisateur connecté)', () => {
    expect(SCHEMA).toMatch(/revoke execute on function find_user_id_by_email\(text\) from public, anon, authenticated;/);
    expect(SCHEMA).toMatch(/grant execute on function find_user_id_by_email\(text\) to service_role;/);
  });
  it('les fonctions qui renvoient des informations d\'une école choisie par l\'appelant sont fermées au public', () => {
    for (const f of ['check_plan_feature(uuid, text)', 'check_whatsapp_quota(uuid)']) {
      expect(SCHEMA, f).toContain(`revoke execute on function public.${f} from public, anon, authenticated;`);
    }
    expect(SCHEMA).toMatch(/revoke all on function platform_school_counts\(\) from public, anon, authenticated;/);
  });
  it('toute fonction « security definer » a un search_path fixé (pas de détournement par un schéma de l\'appelant)', () => {
    const sansChemin = [];
    for (const m of SANS_COMMENTAIRES.matchAll(/create or replace function (?:public\.)?(\w+)\s*\(([^)]*)\)([\s\S]*?)(?:\$function\$|\$\$)/g)) {
      const tete = m[3];
      if (!/security definer/i.test(tete)) continue;
      if (/set search_path/i.test(tete)) continue;
      if (new RegExp(`alter function (?:public\\.)?${m[1]}\\(.*?\\) set search_path`, 'i').test(SANS_COMMENTAIRES)) continue;
      sansChemin.push(m[1]);
    }
    expect([...new Set(sansChemin)]).toEqual([]);
  });
});

describe('stockage de fichiers', () => {
  const regles = Object.entries(stockage);
  it('le bucket public « photos » n\'a plus de lecture ouverte à tous : la liste des fichiers est limitée à son école', () => {
    expect(stockage['photos: lecture publique']).toBeUndefined();
    const lecture = stockage['photos: lecture par école'];
    expect(lecture).toMatch(/for select using/);
    expect(lecture).toMatch(/bucket_id = 'photos' and \(storage\.foldername\(name\)\)\[1\] = current_school_id\(\)::text/);
  });
  it('« documents » : lecture, dépôt et suppression limités à l\'école', () => {
    for (const nom of ['documents-bucket: lecture par école', 'documents-bucket: dépôt par école', 'documents-bucket: suppression par école']) {
      expect(stockage[nom], nom).toMatch(/\(storage\.foldername\(name\)\)\[1\] = current_school_id\(\)::text/);
    }
    expect(stockage['documents-bucket: lecture publique']).toBeUndefined();
  });
  it('aucune règle de stockage ne laisse tout passer', () => {
    expect(regles.filter(([, corps]) => /using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)/i.test(corps)).map(([n]) => n)).toEqual([]);
    // Toute règle d'écriture est limitée à l'école de l'utilisateur.
    const ecritures = regles.filter(([, corps]) => /for (insert|update|delete)/.test(corps));
    expect(ecritures.filter(([, corps]) => !/current_school_id\(\)/.test(corps)).map(([n]) => n)).toEqual([]);
  });
});

describe('un compte ne peut pas se donner des droits (profiles)', () => {
  const fonction = (() => {
    const debut = SCHEMA.indexOf('create or replace function public.profiles_immutable_fields()');
    return SCHEMA.slice(debut, SCHEMA.indexOf('$function$;', SCHEMA.indexOf('$function$', debut + 60)) + 11);
  })();

  async function base() {
    const db = new PGlite();
    await db.exec(`
      create role authenticated; create role service_role;
      create table profiles (id uuid primary key, school_id uuid, role text, full_name text, permissions jsonb);
      ${fonction}
      create trigger trg_profiles_immutable before update on profiles for each row execute function profiles_immutable_fields();
      grant select, update on profiles to authenticated, service_role;
      insert into profiles values ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'enseignant', 'Koffi', null);
    `);
    return db;
  }
  const ID = 'a0000000-0000-4000-8000-000000000001';

  it('un enseignant ne peut pas s\'accorder la permission « finance »', async () => {
    const db = await base();
    await db.exec('set role authenticated');
    await expect(db.exec(`update profiles set permissions = '{"finance": true}' where id = '${ID}'`)).rejects.toThrow(/permissions ne peuvent pas/);
  });
  it('il ne peut changer ni son rôle ni son école', async () => {
    const db = await base();
    await db.exec('set role authenticated');
    await expect(db.exec(`update profiles set role = 'fondateur' where id = '${ID}'`)).rejects.toThrow(/rôle/);
    await expect(db.exec(`update profiles set school_id = '22222222-2222-4222-8222-222222222222' where id = '${ID}'`)).rejects.toThrow(/école/);
  });
  it('il peut toujours modifier le reste de son profil (nom)', async () => {
    const db = await base();
    await db.exec('set role authenticated');
    await db.exec(`update profiles set full_name = 'Koffi A.' where id = '${ID}'`);
    await db.exec('reset role');
    expect((await db.query('select full_name from profiles')).rows[0].full_name).toBe('Koffi A.');
  });
  it('le serveur (fonction du fondateur, clé service_role) peut modifier les permissions', async () => {
    const db = await base();
    await db.exec('set role service_role');
    await db.exec(`update profiles set permissions = '{"finance": true}' where id = '${ID}'`);
    await db.exec('reset role');
    expect((await db.query('select permissions from profiles')).rows[0].permissions).toEqual({ finance: true });
  });
});

describe('outils d\'audit', () => {
  it('le script de vérification pour la production existe et ne contient que de la lecture', () => {
    const sql = fs.readFileSync(path.resolve(import.meta.dirname, '../supabase/verify_isolation.sql'), 'utf8').replace(/--[^\n]*/g, '');
    const instructions = sql.split(';').map((x) => x.trim()).filter(Boolean);
    expect(instructions.length).toBeGreaterThan(5);
    expect(instructions.filter((x) => !/^select\b/i.test(x))).toEqual([]); // rien d'autre que des « select »
    expect(sql).toMatch(/pg_policies/);
  });
});

describe('fichiers du chat (dossier « chat-files »)', () => {
  const bloc = (() => {
    const debut = SCHEMA.indexOf('do $chat$');
    return SCHEMA.slice(debut, SCHEMA.indexOf('$chat$;', debut + 10) + 7);
  })();
  const U = { a1: 'a0000000-0000-4000-8000-000000000001', a2: 'a0000000-0000-4000-8000-000000000002', a3: 'a0000000-0000-4000-8000-000000000003', b1: 'b0000000-0000-4000-8000-000000000001' };
  const E1 = '11111111-1111-4111-8111-111111111111', E2 = '22222222-2222-4222-8222-222222222222';
  const GENERAL = 'c0000000-0000-4000-8000-000000000001', PRIVEE = 'c0000000-0000-4000-8000-000000000002', AUTRE = 'c0000000-0000-4000-8000-000000000003';

  async function base() {
    const db = new PGlite();
    await db.exec(`
      create schema auth; create schema storage; create role anon; create role authenticated;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table profiles (id uuid primary key, school_id uuid, role text);
      create table chat_conversations (id uuid primary key, school_id uuid, type text);
      create table chat_participants (conversation_id uuid, user_id uuid);
      create function current_school_id() returns uuid language sql stable security definer as $$ select school_id from profiles where id = auth.uid() $$;
      -- Même règle que la fonction de production (schema.sql, can_access_conversation).
      create function can_access_conversation(p_conv uuid) returns boolean language sql stable security definer as $$
        select exists (select 1 from chat_conversations c where c.id = p_conv
          and c.school_id = (select p.school_id from profiles p where p.id = auth.uid())
          and (c.type <> 'private' or exists (select 1 from chat_participants cp where cp.conversation_id = c.id and cp.user_id = auth.uid()))) $$;
      create table storage.buckets (id text primary key, name text, public boolean);
      create table storage.objects (id serial primary key, bucket_id text, name text);
      create function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
      alter table storage.objects enable row level security;
      grant usage on schema auth, storage to anon, authenticated;
      grant select, insert, delete on storage.objects to anon, authenticated;
      grant usage on all sequences in schema storage to authenticated;
      grant select on profiles, chat_conversations, chat_participants to authenticated;
      grant execute on all functions in schema public to authenticated;
      grant execute on all functions in schema storage to anon, authenticated;
      insert into storage.buckets values ('chat-files', 'chat-files', true);
      -- Anciennes règles (production avant correction) : lecture ouverte à tous.
      create policy "chat-files: lecture publique" on storage.objects for select to public using (bucket_id = 'chat-files');
      insert into profiles values ('${U.a1}', '${E1}', 'fondateur'), ('${U.a2}', '${E1}', 'secretaire'), ('${U.a3}', '${E1}', 'enseignant'), ('${U.b1}', '${E2}', 'fondateur');
      insert into chat_conversations values ('${GENERAL}', '${E1}', 'general'), ('${PRIVEE}', '${E1}', 'private'), ('${AUTRE}', '${E2}', 'general');
      insert into chat_participants values ('${PRIVEE}', '${U.a1}'), ('${PRIVEE}', '${U.a2}');
      insert into storage.objects (bucket_id, name) values
        ('chat-files', '${E1}/${GENERAL}/general.png'), ('chat-files', '${E1}/${PRIVEE}/prive.png'), ('chat-files', '${E2}/${AUTRE}/autre-ecole.png'),
        ('chat-files', '${E1}/pas-un-identifiant/x.png'), ('photos', '${E1}/logo.png');
      ${bloc}
    `);
    return db;
  }
  const comme = (db, id) => db.exec(id ? `set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);` : 'set role anon;');
  const vus = async (db) => (await db.query(`select name from storage.objects where bucket_id = 'chat-files' order by name`)).rows.map((r) => r.name.split('/').slice(1).join('/'));

  it('le dossier devient privé et la lecture publique disparaît', async () => {
    const db = await base();
    expect((await db.query(`select public from storage.buckets where id = 'chat-files'`)).rows[0].public).toBe(false);
    expect((await db.query(`select policyname from pg_policies where tablename = 'objects' and policyname = 'chat-files: lecture publique'`)).rows).toHaveLength(0);
  });
  it('un visiteur sans compte ne voit aucun fichier du chat', async () => {
    const db = await base();
    await comme(db, null);
    expect(await vus(db)).toEqual([]);
  });
  it('le chat général de son école est lisible par tous les comptes de l\'école', async () => {
    const db = await base();
    await comme(db, U.a3);
    expect(await vus(db)).toEqual([`${GENERAL}/general.png`]);
  });
  it('une conversation privée n\'est lisible que par ses participants (pas par un collègue de l\'école)', async () => {
    const db = await base();
    await comme(db, U.a1);
    expect(await vus(db)).toEqual([`${GENERAL}/general.png`, `${PRIVEE}/prive.png`]);
    await db.exec('reset role');
    await comme(db, U.a3);
    expect(await vus(db)).not.toContain(`${PRIVEE}/prive.png`);
  });
  it('jamais les fichiers d\'une autre école, et un nom de dossier inattendu ne fait pas échouer la requête', async () => {
    const db = await base();
    await comme(db, U.b1);
    expect(await vus(db)).toEqual([`${AUTRE}/autre-ecole.png`]);
    await db.exec('reset role');
    await comme(db, U.a1);
    expect(await vus(db)).not.toContain('pas-un-identifiant/x.png');
  });
  it('dépôt : seulement dans une conversation accessible, de son école', async () => {
    const db = await base();
    await comme(db, U.a3);
    await db.exec(`insert into storage.objects (bucket_id, name) values ('chat-files', '${E1}/${GENERAL}/nouveau.png')`);
    await expect(db.exec(`insert into storage.objects (bucket_id, name) values ('chat-files', '${E1}/${PRIVEE}/intrus.png')`)).rejects.toThrow(/row-level security/);
    await expect(db.exec(`insert into storage.objects (bucket_id, name) values ('chat-files', '${E2}/${AUTRE}/intrus.png')`)).rejects.toThrow(/row-level security/);
  });
  it('suppression : seulement dans une conversation accessible', async () => {
    const db = await base();
    await comme(db, U.a3);
    await db.exec(`delete from storage.objects where name = '${E1}/${PRIVEE}/prive.png'`);
    await db.exec('reset role');
    expect(await vus(db)).toContain(`${PRIVEE}/prive.png`); // le collègue non participant n'a rien supprimé
    await comme(db, U.a2);
    await db.exec(`delete from storage.objects where name = '${E1}/${PRIVEE}/prive.png'`);
    await db.exec('reset role');
    expect(await vus(db)).not.toContain(`${PRIVEE}/prive.png`);
  });
  it('rejouer le bloc ne change rien et ne casse rien', async () => {
    const db = await base();
    await db.exec(bloc);
    expect((await db.query(`select count(*) n from pg_policies where tablename = 'objects' and policyname like 'chat-files:%'`)).rows[0].n).toBe(3);
  });
  it('sur une base sans stockage (banc d\'essai), le bloc est ignoré sans erreur', async () => {
    const db = new PGlite();
    await db.exec(bloc);
  });
});
