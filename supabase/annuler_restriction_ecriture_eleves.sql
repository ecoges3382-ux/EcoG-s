-- Annule supabase/restreindre_ecriture_eleves.sql : les enseignants peuvent de nouveau écrire dans la table des élèves et lire
-- l'historique des moratoires. À n'utiliser qu'en cas de problème. Rejouable sans danger.
drop policy if exists "students: insert" on students;
create policy "students: insert" on students
  for insert with check (school_id = (select current_school_id()) and (select current_role_name()) in ('fondateur', 'directeur', 'secretaire', 'enseignant'));
drop policy if exists "students: update" on students;
create policy "students: update" on students
  for update using (school_id = (select current_school_id()) and (select current_role_name()) in ('fondateur', 'directeur', 'secretaire', 'enseignant'));
drop policy if exists "students: delete" on students;
create policy "students: delete" on students
  for delete using (school_id = (select current_school_id()) and (select current_role_name()) in ('fondateur', 'directeur', 'secretaire', 'enseignant'));
drop policy if exists "moratoire_history: select" on moratoire_history;
create policy "moratoire_history: select" on moratoire_history
  for select using (school_id = (select current_school_id()) and (select current_role_name()) = any (array['fondateur', 'directeur', 'censeur', 'secretaire', 'enseignant']));
