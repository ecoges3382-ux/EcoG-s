-- Audit d'isolation entre écoles : requêtes de LECTURE SEULE à exécuter dans Supabase SQL Editor (elles ne modifient rien).
-- Elles lisent le catalogue de la base de production, qui peut différer de schema.sql (éléments créés à la main).
-- Chaque requête dit ce qu'on attend en résultat.

-- 1) Tables du schéma public SANS sécurité par ligne (RLS). Attendu : aucune ligne.
select c.relname as table_sans_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
order by 1;

-- 2) Fonctions « SECURITY DEFINER » (elles contournent la sécurité par ligne) qu'un visiteur sans compte (anon) ou un utilisateur
--    connecté peut appeler. À relire une par une : chacune doit vérifier elle-même l'école de l'appelant, ou ne rien révéler.
--    Attendu : uniquement des fonctions d'aide au chat/école (current_school_id, current_role_name, can_access_conversation,
--    is_conversation_*, create_private_chat, mark_conversation_read, rename_general_conversation, delete_chat_message,
--    provision_school, student_school_id). Surtout PAS find_user_id_by_email, check_plan_feature, check_whatsapp_quota,
--    platform_school_counts.
select p.proname as fonction,
       has_function_privilege('anon', p.oid, 'execute') as anon_peut,
       has_function_privilege('authenticated', p.oid, 'execute') as connecte_peut,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
order by 1;

-- 3) Toutes les règles de lecture/écriture des fichiers (stockage). Attendu : chaque règle de bucket limitée à l'école
--    (premier dossier du chemin = identifiant d'école), SAUF éventuellement le bucket public « photos » en lecture.
--    À regarder en particulier les règles du bucket « chat-files » (absentes de schema.sql).
select policyname, cmd, roles, qual as using_expr, with_check as check_expr
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- 4) Buckets et leur visibilité. Attendu : « documents » et « chat-files » privés ; « photos » public.
select id, public from storage.buckets order by id;

-- 5) Règles dont le texte ne mentionne ni l'école ni l'utilisateur (à relire ; quelques-unes sont normales : listes fixes).
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and coalesce(qual, '') !~* '(school_id|current_school_id|auth\.uid|can_access_conversation|is_conversation|platform_admins)'
  and coalesce(with_check, '') !~* '(school_id|current_school_id|auth\.uid|can_access_conversation|is_conversation|platform_admins)'
order by tablename, policyname;

-- 6) Vues du schéma public (elles contournent la sécurité par ligne si elles ne sont pas « security_invoker »). Attendu : aucune ligne.
select c.relname as vue, c.reloptions
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v', 'm')
order by 1;

-- 7) Droits directs d'écriture donnés à « anon » (sans compte) sur les tables. Attendu : aucune ligne.
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon' and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
order by 1, 2;

-- 8) Après le correctif de cette PR : le visiteur sans compte ne doit plus pouvoir lister les photos ni appeler find_user_id_by_email.
select has_function_privilege('anon', 'public.find_user_id_by_email(text)', 'execute') as anon_trouve_un_email,   -- attendu : false
       has_function_privilege('authenticated', 'public.find_user_id_by_email(text)', 'execute') as connecte_trouve_un_email; -- attendu : false
