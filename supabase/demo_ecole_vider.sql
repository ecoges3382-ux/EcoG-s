-- =====================================================================================================================
-- ÉCOLE DE DÉMONSTRATION : VIDER. Supprime TOUTES les données de l'école de démonstration pour repartir de zéro
-- (élèves, parents, inscriptions, paiements, présences, notes, classes, matières, personnel, salaires, dépenses, frais).
-- L'école elle-même, ses années scolaires et les comptes de connexion sont conservés. Ensuite, relance demo_ecole.sql.
--
-- GARDE-FOUS : refuse de tourner si le nom de l'école ne contient pas « démo » ou « demo », et ne touche que cette école.
-- =====================================================================================================================

do $vider$
declare
  -- ===================== À VÉRIFIER : le nom EXACT de l'école de démonstration =====================
  v_nom_ecole text := 'École de démonstration';
  -- ==================================================================================================
  v_school schools%rowtype;
begin
  select * into v_school from schools where name = v_nom_ecole limit 1;
  if not found then
    raise exception 'École introuvable : aucune école ne s''appelle « % ». Corrige v_nom_ecole en haut du script.', v_nom_ecole;
  end if;
  if v_school.name !~* '(d[ée]mo)' then
    raise exception 'Refusé : l''école « % » ne contient pas « démo » dans son nom. Ce script ne vide que des écoles de démonstration.', v_school.name;
  end if;

  delete from payments where school_id = v_school.id;
  delete from payments_audit where school_id = v_school.id;   -- le journal de suppression créé par la ligne ci-dessus
  delete from grades where school_id = v_school.id;
  delete from attendance_records where school_id = v_school.id;
  delete from parent_access_students where parent_access_id in (select id from parent_access where school_id = v_school.id);
  delete from parent_access where school_id = v_school.id;
  delete from enrollments where school_id = v_school.id;
  delete from students where school_id = v_school.id;
  delete from fee_schedules where school_id = v_school.id;
  delete from classes where school_id = v_school.id;
  delete from subjects where school_id = v_school.id;
  delete from staff_salaries where school_id = v_school.id;
  delete from staff where school_id = v_school.id;
  delete from expenses where school_id = v_school.id;
end
$vider$;

select 'École de démonstration vidée' as resultat;
