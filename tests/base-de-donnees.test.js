// Règles de la base de données rapatriées dans schema.sql (messagerie, offres, facturation, profils, notifications…).
// Le bloc est lu DANS schema.sql, rejoué deux fois dans une vraie base PostgreSQL (PGlite) et vérifié avec des
// utilisateurs de rôles différents : ce que chacun peut lire, écrire ou changer. Si quelqu'un modifie une règle de
// sécurité de travers, ce test le dit avant la mise en ligne.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const RACINE = path.resolve(import.meta.dirname, '..');
const SCHEMA = fs.readFileSync(path.join(RACINE, 'supabase/schema.sql'), 'utf8');
const MARQUEUR = '-- Éléments créés à la main en production';
const DEBUT = SCHEMA.lastIndexOf('-- =====', SCHEMA.indexOf(MARQUEUR));
// Le bloc rapatrié s'arrête où commence le bloc suivant (« Lecture rapide des notes », testé dans regles-notes.test.js).
const FIN = SCHEMA.indexOf('-- ---------- Lecture rapide des notes');
const SQL = SCHEMA.slice(DEBUT, FIN > DEBUT ? FIN : undefined);

describe('règles de la base de données rapatriées', () => {
  it('le bloc se rejoue sans erreur et toutes les règles se comportent comme en production', async () => {
    const db = new PGlite();
    const echecs = [];
    const check = (nom, condition, info) => { if (!condition) echecs.push(info === undefined ? nom : nom + ' → ' + JSON.stringify(info)); };
    // ---- environnement minimal : ce que le reste de schema.sql fournit déjà en production ----
    await db.exec(`
    create schema auth; create role anon; create role authenticated; create role service_role bypassrls;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
    create table auth.users (id uuid primary key default gen_random_uuid());
    create table schools (id uuid primary key default gen_random_uuid(), name text, plan text not null default 'decouverte', statut text not null default 'actif', indicatif_pays text default '229');
    create table profiles (id uuid primary key references auth.users(id), school_id uuid references schools(id), role text, full_name text, permissions jsonb);
    create table platform_admins (user_id uuid primary key);
    create table school_years (id uuid primary key default gen_random_uuid(), school_id uuid references schools(id));
    create table students (id uuid primary key default gen_random_uuid(), school_id uuid references schools(id));
    create table enrollments (id uuid primary key default gen_random_uuid(), school_id uuid references schools(id));
    create table parent_access (id uuid primary key default gen_random_uuid(), school_id uuid references schools(id), lien_parente text, civilite text, full_name text);
    create table staff (id uuid primary key default gen_random_uuid(), school_id uuid references schools(id), nom text);
    create table whatsapp_messages (id uuid primary key default gen_random_uuid(), school_id uuid references schools(id), created_at timestamptz default now(), statut text);
    create table staff_salaries (id uuid primary key default gen_random_uuid(), school_id uuid, staff_id uuid, montant numeric, mois text, date date, mode text, note text, created_by uuid);
    create table salary_advances (id uuid primary key default gen_random_uuid(), staff_id uuid, statut text, solde numeric, montant_rembourse numeric, created_at timestamptz default now());
    create function current_school_id() returns uuid language sql stable security definer set search_path = public as $$ select school_id from profiles where id = auth.uid() $$;
    create function current_role_name() returns text language sql stable security definer set search_path = public as $$ select role from profiles where id = auth.uid() $$;
    create publication supabase_realtime;
    `);
    // ---- application du bloc, DEUX fois (doit être rejouable) ----
    let err1 = null, err2 = null;
    try { await db.exec(SQL); } catch (e) { err1 = String(e.message).slice(0, 300); }
    try { await db.exec(SQL); } catch (e) { err2 = String(e.message).slice(0, 300); }
    check('le bloc s\'applique sans erreur', err1 === null, err1);
    check('et se rejoue sans erreur (idempotent)', err2 === null, err2);
    if (err1 || err2) throw new Error(`Le bloc ne s'applique pas : ${err1 || err2}`);
    await db.exec(`grant usage on schema auth to authenticated, anon; grant execute on function auth.jwt(), auth.uid() to authenticated, anon;
    grant all on all tables in schema public to authenticated, service_role; grant all on all functions in schema public to service_role; grant execute on function current_school_id(), current_role_name(), can_access_conversation(uuid), is_conversation_participant(uuid), is_conversation_in_my_school(uuid), create_private_chat(uuid), delete_chat_message(uuid), mark_conversation_read(uuid), rename_general_conversation(uuid, text) to authenticated;`);

    // ---- données ----
    const S1 = '11111111-1111-4111-8111-111111111111', S2 = '22222222-2222-4222-8222-222222222222', SD = '33333333-3333-4333-8333-333333333333';
    const U = { dir: 'a0000000-0000-4000-8000-000000000001', sec: 'a0000000-0000-4000-8000-000000000002', ens: 'a0000000-0000-4000-8000-000000000003', other: 'b0000000-0000-4000-8000-000000000001', adm: 'c0000000-0000-4000-8000-000000000001' };
    await db.exec(`
    insert into schools (id, name, plan) values ('${S1}','Ecole 1','essentiel'), ('${S2}','Ecole 2','essentiel'), ('${SD}','Ecole decouverte','decouverte');
    ${Object.values(U).map((u) => `insert into auth.users (id) values ('${u}');`).join('\n')}
    insert into profiles (id, school_id, role) values ('${U.dir}','${S1}','directeur'), ('${U.sec}','${S1}','secretaire'), ('${U.ens}','${S1}','enseignant'), ('${U.other}','${S2}','directeur');
    insert into platform_admins values ('${U.adm}');`);
    const as = async (user, role, q, params) => { await db.exec(`set role ${role}; select set_config('request.jwt.claims', '${user ? JSON.stringify({ sub: user, aal: 'aal1' }) : '{}'}', false)`); try { return { ok: true, r: await db.query(q, params) }; } catch (e) { return { ok: false, e: String(e.message) }; } finally { await db.exec('reset role'); } };
    const A = (u, q, p) => as(u, 'authenticated', q, p);

    // ---- offres : portail parents et personnel ----
    let x = await db.query(`insert into parent_access (school_id, lien_parente, full_name) values ('${SD}','pere','P') returning id`).catch((e) => ({ err: String(e.message) }));
    check('plan Découverte: création d\'un parent refusée avec le message en français', x.err && /portail parents/.test(x.err), x);
    x = await db.query(`insert into parent_access (school_id, lien_parente, full_name) values ('${S1}','mère','P') returning civilite`);
    check('plan Essentiel: création d\'un parent acceptée, civilité déduite du lien (mère -> Mme)', x.rows[0].civilite === 'Mme', x.rows);
    x = await db.query(`insert into parent_access (school_id, lien_parente, full_name) values ('${S1}','PERE','P') returning civilite`);
    check('lien « PERE » (majuscules, sans accent) -> M', x.rows[0].civilite === 'M', x.rows);
    x = await db.query(`insert into staff (school_id, nom) values ('${SD}','X')`).catch((e) => ({ err: String(e.message) }));
    check('plan Découverte: création de personnel refusée', x.err && /gérer le personnel/.test(x.err), x);
    x = await db.query(`insert into staff (school_id, nom) values ('${S1}','X')`).then(() => ({ ok: true }));
    check('plan Essentiel: personnel accepté', x.ok);
    x = await db.query(`select check_plan_feature('${SD}','parent_portal') a, check_plan_feature('${S1}','parent_portal') b, check_plan_feature('${SD}','fonction_libre') c`);
    check('check_plan_feature: Découverte refusé, Essentiel accepté, fonction non réservée ouverte', !x.rows[0].a && x.rows[0].b && x.rows[0].c, x.rows);
    // quota WhatsApp : les échecs ne comptent pas
    await db.exec(`insert into whatsapp_messages (school_id, statut) select '${SD}', 'echec' from generate_series(1,3);`);
    x = await db.query(`select check_whatsapp_quota('${SD}') a, check_whatsapp_quota('${S1}') b`);
    check('check_whatsapp_quota: Découverte (quota 0) refusé, Essentiel (0 envoi) accepté', !x.rows[0].a && x.rows[0].b, x.rows);
    await db.exec(`insert into whatsapp_messages (school_id, statut) select '${S1}', 'echec' from generate_series(1,1000);`);
    x = await db.query(`select check_whatsapp_quota('${S1}') a`);
    check('le quota ne compte PAS les messages en échec (1 000 échecs ne bloquent pas l\'envoi)', x.rows[0].a === true, x.rows);
    await db.exec(`insert into whatsapp_messages (school_id, statut) select '${S1}', 'envoye' from generate_series(1,1000);`);
    x = await db.query(`select check_whatsapp_quota('${S1}') a`);
    check('1 000 messages envoyés ce mois-ci : le quota Essentiel est atteint', x.rows[0].a === false, x.rows);

    // ---- facturation protégée ----
    x = await A(U.dir, `update schools set plan = 'premium' where id = '${S1}'`);
    check('un directeur ne peut pas changer le plan de son école', !x.ok && /forfait/.test(x.e), x);
    x = await A(U.dir, `update schools set statut = 'actif' where id = '${S1}'`);
    check('ni le statut (même vers la même valeur ça passe, un vrai changement est refusé)', x.ok);
    x = await A(U.dir, `update schools set statut = 'suspendu' where id = '${S1}'`);
    check('changement réel de statut refusé', !x.ok && /statut/.test(x.e), x);
    x = await A(U.dir, `update schools set indicatif_pays = '228', name = 'Nouveau nom' where id = '${S1}'`);
    check('mais le nom et l\'indicatif du pays restent modifiables', x.ok);
    x = await A(U.adm, `update schools set plan = 'standard' where id = '${S1}'`);
    check('un administrateur de la plateforme peut changer le plan', x.ok);
    await db.exec(`reset role; set role service_role; update schools set plan = 'premium' where id = '${S1}'; reset role;`);
    x = await db.query(`select plan from schools where id = '${S1}'`);
    check('le serveur (service_role) peut changer le plan', x.rows[0].plan === 'premium', x.rows);
    await db.exec(`update schools set plan = 'essentiel' where id = '${S1}'`);

    // ---- profils : rôle et école immuables ----
    x = await A(U.dir, `update profiles set role = 'fondateur' where id = '${U.dir}'`);
    check('un utilisateur ne peut pas se donner un autre rôle', !x.ok && /rôle/.test(x.e), x);
    x = await A(U.dir, `update profiles set school_id = '${S2}' where id = '${U.dir}'`);
    check('ni changer d\'école', !x.ok && /école/.test(x.e), x);
    x = await A(U.dir, `update profiles set full_name = 'Nom' where id = '${U.dir}'`);
    check('mais peut modifier son nom', x.ok);
    x = await A(U.dir, `update profiles set permissions = '{"finance": true}' where id = '${U.dir}'`);
    check('ne peut pas s\'accorder des permissions lui-même', !x.ok);

    // ---- messagerie ----
    const gen = (await db.query(`insert into chat_conversations (school_id, type) values ('${S1}','general') returning id`)).rows[0].id;
    x = await db.query(`insert into chat_conversations (school_id, type) values ('${S1}','general')`).catch((e) => ({ err: String(e.message) }));
    check('un seul canal général par école', x.err && /one_general_chat_per_school/.test(x.err), x);
    x = await A(U.dir, `select create_private_chat('${U.sec}') as id`); const priv = x.r?.rows[0].id;
    check('création d\'une conversation privée entre deux collègues', x.ok && priv, x);
    x = await A(U.dir, `select create_private_chat('${U.sec}') as id`);
    check('la même conversation est réutilisée, pas dupliquée', x.ok && x.r.rows[0].id === priv, x);
    x = await A(U.dir, `select create_private_chat('${U.other}') as id`);
    check('conversation privée avec une personne d\'une autre école refusée', !x.ok && /introuvable/.test(x.e), x);
    x = await A(U.dir, `select create_private_chat('${U.dir}') as id`);
    check('et avec soi-même', !x.ok && /soi-même/.test(x.e), x);
    x = await A(U.ens, `select id from chat_conversations where id = '${priv}'`);
    check('un tiers de la même école ne voit PAS la conversation privée', x.ok && x.r.rows.length === 0, x);
    x = await A(U.ens, `select id from chat_conversations where id = '${gen}'`);
    check('mais voit le canal général de son école', x.ok && x.r.rows.length === 1, x);
    x = await A(U.other, `select id from chat_conversations where id = '${gen}'`);
    check('une autre école ne voit rien', x.ok && x.r.rows.length === 0, x);
    x = await A(U.dir, `insert into chat_messages (conversation_id, sender_id, content) values ('${priv}','${U.dir}','Bonjour') returning id`); const m1 = x.r?.rows[0].id;
    check('un participant écrit dans la conversation', x.ok && m1, x);
    x = await A(U.ens, `insert into chat_messages (conversation_id, sender_id, content) values ('${priv}','${U.ens}','intrus')`);
    check('un tiers ne peut pas écrire dans une conversation privée', !x.ok, x);
    x = await A(U.sec, `insert into chat_messages (conversation_id, sender_id, content) values ('${priv}','${U.dir}','usurpation')`);
    check('on ne peut pas écrire au nom d\'un autre', !x.ok, x);
    x = await A(U.dir, `insert into chat_messages (conversation_id, sender_id, content, reply_to_id) values ('${gen}','${U.dir}','réponse piégée','${m1}')`);
    check('une réponse vers un message d\'une AUTRE conversation est refusée (déclencheur)', !x.ok && /même conversation/.test(x.e), x);
    x = await A(U.dir, `insert into chat_messages (conversation_id, sender_id, content, reply_to_id) values ('${priv}','${U.dir}','ok','${m1}')`);
    check('une réponse dans la même conversation est acceptée', x.ok, x);
    x = await A(U.sec, `select delete_chat_message('${m1}')`);
    check('on ne peut supprimer que ses propres messages', !x.ok && /propres messages/.test(x.e), x);
    x = await A(U.dir, `select delete_chat_message('${m1}') as f`);
    check('l\'auteur supprime son message (contenu effacé, trace conservée)', x.ok, x);
    x = await db.query(`select content, deleted_at is not null as supprime from chat_messages where id = '${m1}'`);
    check('le message est vidé et marqué supprimé', x.rows[0].content === null && x.rows[0].supprime, x.rows);
    x = await A(U.sec, `select mark_conversation_read('${gen}')`);
    check('marquer lu: accepté pour le canal général de son école', x.ok, x);
    x = await A(U.other, `select mark_conversation_read('${gen}')`);
    check('marquer lu: refusé pour une conversation d\'une autre école', !x.ok && /Accès refusé/.test(x.e), x);
    x = await A(U.dir, `select rename_general_conversation('${gen}', '  Salle des profs  ') as n`);
    check('le directeur renomme le canal général (espaces nettoyés)', x.ok && x.r.rows[0].n === 'Salle des profs', x);
    x = await A(U.ens, `select rename_general_conversation('${gen}', 'X')`);
    check('un enseignant ne peut pas renommer le canal', !x.ok && /fondateur et le directeur/.test(x.e), x);
    x = await A(U.dir, `select rename_general_conversation('${gen}', '${'x'.repeat(41)}')`);
    check('nom de plus de 40 caractères refusé', !x.ok && /40 caractères/.test(x.e), x);

    // ---- moratoire, appréciations, push ----
    const enr = (await db.query(`insert into enrollments (school_id) values ('${S1}') returning id`)).rows[0].id;
    x = await A(U.sec, `insert into moratoire_history (enrollment_id, school_id, action) values ('${enr}','${S1}','creation')`);
    check('moratoire_history: la secrétaire peut écrire', x.ok, x);
    x = await A(U.ens, `insert into moratoire_history (enrollment_id, school_id, action) values ('${enr}','${S1}','creation')`);
    check('moratoire_history: un enseignant ne peut pas écrire', !x.ok, x);
    x = await A(U.ens, `select count(*)::int n from moratoire_history`);
    check('moratoire_history: un enseignant peut lire', x.ok && x.r.rows[0].n === 1, x);
    x = await A(U.other, `select count(*)::int n from moratoire_history`);
    check('moratoire_history: une autre école ne voit rien', x.ok && x.r.rows[0].n === 0, x);
    const sy = (await db.query(`insert into school_years (school_id) values ('${S1}') returning id`)).rows[0].id;
    const st = (await db.query(`insert into students (school_id) values ('${S1}') returning id`)).rows[0].id;
    x = await A(U.sec, `insert into report_card_appreciations (school_id, school_year_id, student_id, periode, appreciation) values ('${S1}','${sy}','${st}','T1','Bien')`);
    check('appréciations: la secrétaire écrit', x.ok, x);
    x = await A(U.ens, `insert into report_card_appreciations (school_id, school_year_id, student_id, periode) values ('${S1}','${sy}','${st}','T2')`);
    check('appréciations: un enseignant ne peut pas écrire', !x.ok, x);
    x = await A(U.sec, `insert into report_card_appreciations (school_id, school_year_id, student_id, periode) values ('${S1}','${sy}','${st}','T1')`);
    check('appréciations: une seule ligne par élève, année et période', !x.ok && /unique|duplicate/i.test(x.e), x);
    x = await A(U.dir, `insert into push_subscriptions (user_id, school_id, endpoint, p256dh, auth) values ('${U.dir}','${S1}','https://push/1','k','a')`);
    check('push: on enregistre son propre appareil', x.ok, x);
    x = await A(U.sec, `select count(*)::int n from push_subscriptions`);
    check('push: un collègue ne voit pas l\'appareil des autres', x.ok && x.r.rows[0].n === 0, x);
    x = await A(U.sec, `insert into push_subscriptions (user_id, school_id, endpoint, p256dh, auth) values ('${U.dir}','${S1}','https://push/2','k','a')`);
    check('push: on ne peut pas enregistrer un appareil au nom d\'un autre', !x.ok, x);

    // ---- temps réel ----
    x = await db.query(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1`);
    check('temps réel: les 3 tables de la messagerie, une fois chacune', JSON.stringify(x.rows.map((r) => r.tablename)) === '["chat_conversations","chat_messages","chat_participants"]', x.rows);

    // ---- durcissement ----
    x = await db.query(`select proname, proconfig from pg_proc where proname in ('check_plan_feature','check_whatsapp_quota','enforce_parent_portal_plan','enforce_personnel_plan','protect_school_billing') order by 1`);
    check('durcissement: les 5 fonctions ont un chemin de recherche figé', x.rows.every((r) => (r.proconfig || []).some((c) => /search_path=public/.test(c))) && x.rows.length === 5, x.rows);
    x = await A(U.dir, `select check_whatsapp_quota('${S1}')`);
    check('durcissement: un utilisateur connecté ne peut plus interroger le quota d\'une école', !x.ok && /permission denied/.test(x.e), x);
    x = await as(null, 'anon', `select check_plan_feature('${S1}','x')`);
    check('durcissement: ni un visiteur anonyme', !x.ok && /permission denied/.test(x.e), x);
    x = await db.query(`insert into parent_access (school_id, lien_parente, full_name) values ('${S1}','mere','Encore') returning id`).then(() => ({ ok: true })).catch((e) => ({ err: String(e.message) }));
    check('et les déclencheurs de plan fonctionnent toujours après le durcissement', x.ok, x);
    x = await A(U.sec, `insert into parent_access (school_id, lien_parente, full_name) values ('${S1}','pere','Via utilisateur')`);
    check('même quand c\'est un utilisateur connecté qui crée le parent (le déclencheur appelle la vérification avec les droits du propriétaire)', x.ok, x);


    expect(echecs, `vérifications en échec :\n${echecs.join('\n')}`).toEqual([]);
  }, 120000);
});
