-- Vérifications structurelles — à exécuter dans Supabase SQL Editor après
-- avoir appliqué les migrations de ce correctif (fin de schema.sql).
--
-- Ce script ne simule PAS d'utilisateur authentifié (le faire proprement
-- demande de manipuler le rôle de session et les claims JWT à l'intérieur
-- d'une transaction, ce qui n'a pas pu être testé en conditions réelles
-- dans cet environnement sans accès à un projet Supabase live — je préfère
-- te donner un script simple et sûr plutôt qu'un script élaboré non
-- vérifié). Chaque requête ci-dessous se contente de lire le catalogue
-- système pour confirmer que les objets attendus existent avec la bonne
-- définition. Le raisonnement "pourquoi c'est sûr" (RLS bloque bien le
-- cross-tenant sur les nouvelles fonctions) est détaillé dans le rapport,
-- vérifié par relecture manuelle ligne à ligne plutôt que par exécution.
--
-- Pour une vérification IRL, le plus fiable reste un test manuel dans
-- l'appli : connecte-toi avec un compte de l'école A, ouvre les outils
-- développeur, et essaie d'appeler ces RPC avec le school_id de l'école B
-- (voir exemples en bas de fichier) — tu dois obtenir une erreur de
-- permission à chaque fois.

-- 1) Les deux fonctions existent bien en SECURITY INVOKER (donc soumises à
--    la RLS de l'appelant, pas d'élévation de privilège).
select proname, prosecdef as is_security_definer
from pg_proc
where proname in ('create_student_with_enrollment', 'import_students_csv');
-- Attendu : is_security_definer = false pour les deux.

-- 2) payments_audit n'a aucune policy insert/update/delete pour authenticated
--    (seul le trigger, security definer, doit pouvoir y écrire).
select polname, polcmd
from pg_policy
where polrelid = 'payments_audit'::regclass;
-- Attendu : une seule ligne, polcmd = 'r' (select). Aucune ligne pour i/u/d.

-- 3) Le trigger de journalisation des suppressions de paiements existe.
select tgname, tgenabled from pg_trigger where tgrelid = 'payments'::regclass and tgname = 'trg_log_payment_deletion';
-- Attendu : une ligne, tgenabled = 'O' (activé).

-- 4) Contrainte d'unicité sur la clé d'idempotence des paiements.
select indexname, indexdef from pg_indexes where tablename = 'payments' and indexname = 'payments_idempotency_key_uidx';
-- Attendu : une ligne, definition contient "UNIQUE".

-- 5) Bucket "documents" privé.
select id, public from storage.buckets where id = 'documents';
-- Attendu : public = false.

-- 6) Policy de lecture du bucket "documents" scopée par école (plus de lecture publique).
select policyname, cmd from pg_policies where tablename = 'objects' and schemaname = 'storage' and policyname ilike 'documents-bucket%';
-- Attendu : "documents-bucket: lecture par école" (select), "documents-bucket: dépôt par école" (insert),
-- "documents-bucket: suppression par école" (delete). Plus de "lecture publique".

-- 7) parent_access_attempts : RLS activée, aucune policy (accès service_role uniquement).
select relrowsecurity from pg_class where relname = 'parent_access_attempts';
select count(*) as nb_policies from pg_policies where tablename = 'parent_access_attempts';
-- Attendu : relrowsecurity = true, nb_policies = 0.

-- 8) payments.created_by et documents.storage_path existent.
select column_name, is_nullable from information_schema.columns
where (table_name = 'payments' and column_name in ('created_by', 'idempotency_key'))
   or (table_name = 'documents' and column_name in ('storage_path', 'file_url'));
-- Attendu : payments.created_by/idempotency_key nullable=true (colonnes ajoutées, pas de backfill possible
-- pour l'historique) ; documents.storage_path nullable=true ; documents.file_url nullable=true désormais
-- (n'est plus la source de vérité pour l'accès, gardée pour compat d'affichage éventuelle).

-- ---------- Test manuel recommandé (dans la console du navigateur, connecté à l'appli) ----------
-- Doit échouer avec une erreur de permission (pas juste "requête vide") :
--
-- const { data, error } = await supabase.rpc('create_student_with_enrollment', {
--   p_school_id: '<uuid d une AUTRE école>', p_nom: 'Test', p_prenom: 'Hack',
--   p_full_name: 'HACK Test', p_parent_phone: null, p_photo_url: null, p_matricule: null,
--   p_school_year_id: '<un uuid quelconque>', p_classe_id: null, p_montant_du: 0,
--   p_frais_connexe_du: 0, p_existing_parent_access_id: null,
-- });
-- console.log(error); // doit être non-null (violation RLS)
