-- Annule supabase/restreindre_montants_eleves.sql : tout le personnel de l'école (enseignants compris) lit de nouveau les montants des
-- élèves directement dans « enrollments ». À n'utiliser qu'en cas de problème. Rejouable sans danger.
grant select on public.enrollments to authenticated;
drop view if exists public.enrollments_argent;
