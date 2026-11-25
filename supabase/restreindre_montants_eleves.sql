-- =====================================================================================================================
-- MONTANTS DES ÉLÈVES RÉSERVÉS : ce que chaque famille doit et a payé n'est lisible que par ceux qui ont accès aux finances.
-- =====================================================================================================================
--
-- AVANT : tout membre du personnel, enseignants compris, pouvait lire dans la base, pour chaque élève, le montant dû, le montant payé,
-- les frais connexes et la note d'arrangement (la liste de qui doit quoi). Les classes et les notes ont besoin de lire les inscriptions
-- (qui est dans quelle classe), mais pas les montants.
--
-- APRÈS : les inscriptions restent lisibles par tous les membres du personnel, SANS ces colonnes d'argent :
--     montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, note_arrangement,
--     et tout le moratoire (arrangement de paiement) : moratoire_actif, moratoire_montant_convenu, moratoire_nb_mensualites,
--     moratoire_date_debut, moratoire_date_fin, moratoire_motif, moratoire_prochaine_echeance.
-- (Savoir qu'une famille a négocié un arrangement, c'est déjà savoir qu'elle a du mal à payer.)
-- Elles se lisent désormais dans la vue « enrollments_argent », qui ne renvoie des lignes qu'aux personnes ayant accès aux finances
-- (même règle que supabase/restreindre_finances.sql : fondateur, directeur, secrétaire, ou permission « finance » cochée).
-- L'écriture ne change pas (qui peut inscrire, modifier un montant, enregistrer un paiement : inchangé).
--
-- Les fonctions du serveur (rappels WhatsApp, portail des parents, enregistrement des paiements…) s'exécutent avec des droits
-- propres et continuent de lire ces colonnes normalement.
--
-- ATTENTION pour la suite : une colonne AJOUTÉE plus tard à « enrollments » n'est pas lisible par les utilisateurs tant qu'on ne l'a pas
-- accordée (grant select (colonne) on enrollments to authenticated). Un test de la base le vérifie (tests/restreindre-finances.test.js).
--
-- À lancer dans Supabase (SQL Editor), APRÈS restreindre_finances.sql. Rejouable sans danger (à relancer après une mise à jour : il
-- prend en compte les colonnes du moratoire). L'application sait travailler
-- avant comme après (voir src/lib/argentInscriptions.js).
-- Pour annuler : supabase/annuler_restriction_montants_eleves.sql
-- =====================================================================================================================

do $$
declare
  protegees constant text[] := array['montant_du', 'montant_paye', 'frais_connexe_du', 'frais_connexe_paye', 'note_arrangement',
    'moratoire_actif', 'moratoire_montant_convenu', 'moratoire_nb_mensualites', 'moratoire_date_debut', 'moratoire_date_fin', 'moratoire_motif', 'moratoire_prochaine_echeance'];
  colonnes_argent text;
  colonnes_libres text;
begin
  select string_agg('e.' || quote_ident(column_name::text), ', ' order by ordinal_position) filter (where column_name::text = any (protegees)),
         string_agg(quote_ident(column_name::text), ', ' order by ordinal_position) filter (where column_name::text <> all (protegees))
    into colonnes_argent, colonnes_libres
  from information_schema.columns
  where table_schema = 'public' and table_name = 'enrollments';

  if colonnes_argent is null or colonnes_libres is null then
    raise exception 'Table enrollments introuvable ou sans colonnes d''argent : rien n''a été modifié.';
  end if;

  -- 1. La vue des montants : seulement les lignes de MON école, et seulement si j'ai accès aux finances.
  --    (Elle s'exécute avec les droits de son propriétaire, qui peut lire les colonnes d'argent ; le filtre ci-dessous est ce qui protège.)
  -- (la vue est recréée : une version précédente avait moins de colonnes, et « create or replace » ne sait pas en insérer au milieu)
  execute 'drop view if exists public.enrollments_argent';
  execute 'create view public.enrollments_argent as select e.id, e.school_id, e.school_year_id, e.student_id, ' || colonnes_argent
    || ' from public.enrollments e where e.school_id = (select public.current_school_id()) and (select public.peut_voir_finances())';
  execute 'revoke all on public.enrollments_argent from public, anon';
  execute 'grant select on public.enrollments_argent to authenticated, service_role';

  -- 2. Les inscriptions : lisibles par tous les membres du personnel (règles inchangées), mais sans les colonnes d'argent.
  execute 'revoke select on public.enrollments from anon, authenticated';
  execute 'grant select (' || colonnes_libres || ') on public.enrollments to authenticated';
end $$;
