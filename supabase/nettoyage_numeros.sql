-- Anciens numéros béninois à 8 chiffres : ajouter le « 01 » (réforme du 30 novembre 2024).
-- « +229 97 70 31 54 » devient « +2290197703154 ». À exécuter dans Supabase SQL Editor, étape par étape.
-- Les fiches d'une école dont le forfait n'inclut pas le portail parents (parent_access) ou le personnel (staff) sont laissées telles
-- quelles : la base refuse toute modification de ces tables pour ces écoles, et un seul refus annulerait toute la correction.
-- Ne touche que les numéros qui commencent par +229 (ou 00229) et ont exactement 8 chiffres après l'indicatif : un numéro déjà à
-- 10 chiffres, un numéro d'un autre pays (Togo +228 à 8 chiffres, Côte d'Ivoire...) ou un numéro sans indicatif ne change PAS.
-- L'application sait déjà lire les deux formes (l'envoi WhatsApp complète le « 01 » à la volée) : ce nettoyage rend seulement
-- les fiches cohérentes et évite les faux doublons.

-- ÉTAPE 1 : aperçu (lecture seule). Combien de numéros vont changer, et en quoi ?
with candidats as (
  select 'parent_access' as table_, id::text, phone as ancien,
         '+22901' || right(regexp_replace(phone, '\D', '', 'g'), 8) as nouveau
  from parent_access
  where phone ~ '^\s*(\+|00)229' and length(regexp_replace(phone, '\D', '', 'g')) = case when phone ~ '^\s*00' then 13 else 11 end
    and check_plan_feature(school_id, 'parent_portal')
  union all
  select 'students', id::text, parent_phone,
         '+22901' || right(regexp_replace(parent_phone, '\D', '', 'g'), 8)
  from students
  where parent_phone ~ '^\s*(\+|00)229' and length(regexp_replace(parent_phone, '\D', '', 'g')) = case when parent_phone ~ '^\s*00' then 13 else 11 end
  union all
  select 'staff', id::text, phone,
         '+22901' || right(regexp_replace(phone, '\D', '', 'g'), 8)
  from staff
  where phone ~ '^\s*(\+|00)229' and length(regexp_replace(phone, '\D', '', 'g')) = case when phone ~ '^\s*00' then 13 else 11 end
    and check_plan_feature(school_id, 'personnel')
  union all
  select 'profiles', id::text, phone,
         '+22901' || right(regexp_replace(phone, '\D', '', 'g'), 8)
  from profiles
  where phone ~ '^\s*(\+|00)229' and length(regexp_replace(phone, '\D', '', 'g')) = case when phone ~ '^\s*00' then 13 else 11 end
)
select table_, count(*) as nombre from candidats group by table_ order by table_;
-- (pour voir le détail : remplace la dernière ligne par « select * from candidats order by table_, ancien; »)

-- ÉTAPE 2 : sauvegarde des valeurs actuelles (une copie, au cas où).
create table if not exists sauvegarde_numeros_avant_01 as
select 'parent_access'::text as table_, id::text, phone as ancien from parent_access where phone is not null
union all select 'students', id::text, parent_phone from students where parent_phone is not null
union all select 'staff', id::text, phone from staff where phone is not null
union all select 'profiles', id::text, phone from profiles where phone is not null;
alter table sauvegarde_numeros_avant_01 enable row level security; -- personne n'y accède par l'application

-- ÉTAPE 3 : la correction (une seule transaction : tout ou rien).
begin;
update parent_access set phone = '+22901' || right(regexp_replace(phone, '\D', '', 'g'), 8)
 where phone ~ '^\s*(\+|00)229' and length(regexp_replace(phone, '\D', '', 'g')) = case when phone ~ '^\s*00' then 13 else 11 end
   and check_plan_feature(school_id, 'parent_portal');
update students set parent_phone = '+22901' || right(regexp_replace(parent_phone, '\D', '', 'g'), 8)
 where parent_phone ~ '^\s*(\+|00)229' and length(regexp_replace(parent_phone, '\D', '', 'g')) = case when parent_phone ~ '^\s*00' then 13 else 11 end;
update staff set phone = '+22901' || right(regexp_replace(phone, '\D', '', 'g'), 8)
 where phone ~ '^\s*(\+|00)229' and length(regexp_replace(phone, '\D', '', 'g')) = case when phone ~ '^\s*00' then 13 else 11 end
   and check_plan_feature(school_id, 'personnel');
update profiles set phone = '+22901' || right(regexp_replace(phone, '\D', '', 'g'), 8)
 where phone ~ '^\s*(\+|00)229' and length(regexp_replace(phone, '\D', '', 'g')) = case when phone ~ '^\s*00' then 13 else 11 end;
commit;

-- ÉTAPE 4 : vérification. Attendu : 0 partout (sauf, pour parent_access et staff, les écoles dont le forfait ne les inclut pas).
select 'parent_access' as table_, count(*) from parent_access where phone ~ '^\s*(\+|00)229' and length(regexp_replace(phone, '\D', '', 'g')) = case when phone ~ '^\s*00' then 13 else 11 end
union all select 'students', count(*) from students where parent_phone ~ '^\s*(\+|00)229' and length(regexp_replace(parent_phone, '\D', '', 'g')) = case when parent_phone ~ '^\s*00' then 13 else 11 end
union all select 'staff', count(*) from staff where phone ~ '^\s*(\+|00)229' and length(regexp_replace(phone, '\D', '', 'g')) = case when phone ~ '^\s*00' then 13 else 11 end
union all select 'profiles', count(*) from profiles where phone ~ '^\s*(\+|00)229' and length(regexp_replace(phone, '\D', '', 'g')) = case when phone ~ '^\s*00' then 13 else 11 end;
