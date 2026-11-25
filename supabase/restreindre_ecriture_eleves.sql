-- =====================================================================================================================
-- ÉLÈVES : QUI PEUT LES AJOUTER, LES MODIFIER OU LES SUPPRIMER, ET QUI LIT L'HISTORIQUE DES MORATOIRES.
-- =====================================================================================================================
--
-- AVANT : un enseignant pouvait, directement dans la base, ajouter, modifier ou SUPPRIMER n'importe quelle fiche élève de son école
-- (l'application lui cachait les boutons, mais la base ne l'en empêchait pas). Il pouvait aussi lire l'historique des moratoires
-- (arrangements de paiement des familles).
--
-- APRÈS :
--   * ajouter, modifier ou supprimer un élève : fondateur, directeur et secrétaire seulement (comme l'application le montre déjà) ;
--   * lire l'historique des moratoires : seulement ceux qui ont accès aux finances (voir restreindre_finances.sql).
-- Les enseignants gardent tout ce dont leur travail a besoin : lire la liste des élèves, saisir les notes et les présences.
--
-- À lancer dans Supabase (SQL Editor), APRÈS restreindre_finances.sql. Rejouable sans danger.
-- Pour annuler : supabase/annuler_restriction_ecriture_eleves.sql
-- =====================================================================================================================

drop policy if exists "students: insert" on students;
create policy "students: insert" on students
  for insert with check (
    school_id = (select current_school_id())
    and (select current_role_name()) in ('fondateur', 'directeur', 'secretaire')
  );
drop policy if exists "students: update" on students;
create policy "students: update" on students
  for update using (
    school_id = (select current_school_id())
    and (select current_role_name()) in ('fondateur', 'directeur', 'secretaire')
  ) with check (
    school_id = (select current_school_id())
    and (select current_role_name()) in ('fondateur', 'directeur', 'secretaire')
  );
drop policy if exists "students: delete" on students;
create policy "students: delete" on students
  for delete using (
    school_id = (select current_school_id())
    and (select current_role_name()) in ('fondateur', 'directeur', 'secretaire')
  );

drop policy if exists "moratoire_history: select" on moratoire_history;
create policy "moratoire_history: select" on moratoire_history
  for select using (
    school_id = (select current_school_id())
    and (select peut_voir_finances())
  );
