-- =====================================================================================================================
-- ÉCOLE DE DÉMONSTRATION : remplit une école avec des données FICTIVES et réalistes, pour tes démos aux fondateurs.
-- =====================================================================================================================
--
-- CE QUE FAIT CE SCRIPT
--   Dans l'école de démonstration que tu désignes ci-dessous, il crée : 8 classes (6e à 3e, sections A et B), les frais de chaque niveau,
--   une année scolaire avec calendrier de paiement, environ 250 élèves avec leurs parents, des paiements variés (élèves à jour, en retard,
--   en avance, avec arrangement), des présences sur les 3 dernières semaines, des notes du 1er trimestre dans 8 matières (les bulletins sont
--   prêts à montrer), 8 membres du personnel avec leurs salaires des 2 derniers mois, et quelques dépenses.
--   Les dates sont calculées à partir d'AUJOURD'HUI : la démo a toujours l'air actuelle.
--
-- COMMENT L'UTILISER (une seule fois)
--   1. Crée l'école de démonstration par l'inscription normale d'EcoGès (code d'inscription), avec un nom contenant « démo »,
--      par exemple « École de démonstration ». C'est avec ce compte que tu feras tes démos.
--   2. Ci-dessous, vérifie que `v_nom_ecole` est EXACTEMENT le nom de cette école.
--   3. Colle tout ce fichier dans Supabase (SQL Editor) et clique sur Run. Le tableau final récapitule ce qui a été créé, avec le code parent
--      de l'élève modèle (pour montrer le portail parents sur un second téléphone).
--   4. Pour repartir de zéro (par exemple pour remettre les paiements de démo à l'état initial) : lance demo_ecole_vider.sql, puis celui-ci.
--
-- GARDE-FOUS
--   * Le script REFUSE de tourner si le nom de l'école ne contient pas « démo » ou « demo » : impossible de remplir par erreur l'école d'un client.
--   * Il REFUSE de tourner si l'école contient déjà des élèves : pas de doublons si tu le lances deux fois.
--   * Si l'école est au plan Découverte, il la passe au plan Essentiel (sinon le portail parents et le personnel sont verrouillés).
--     C'est l'école de démonstration qui change de plan, jamais une autre.
--   * Tous les numéros de téléphone sont FICTIFS (+229 01 00 00 00 xx) et les rappels automatiques sont désactivés :
--     personne ne peut recevoir de vrai message.
--   * Aucune table d'une autre école n'est touchée : toutes les écritures portent l'identifiant de l'école de démonstration.
-- =====================================================================================================================

do $demo$
declare
  -- ===================== À VÉRIFIER : le nom EXACT de l'école de démonstration =====================
  v_nom_ecole text := 'École de démonstration';
  -- ==================================================================================================

  v_school schools%rowtype;
  v_today date := current_date;
  v_ys int;
  v_debut date; v_fin date; v_t1 date; v_t2 date; v_t3 date; v_cx date;
  v_year_id uuid;

  v_niveaux text[] := array['6e', '5e', '4e', '3e'];
  v_sections text[] := array['A', 'B'];
  v_nom_niveau text[] := array['6ème', '5ème', '4ème', '3ème'];
  v_scol numeric[] := array[150000, 150000, 165000, 180000];
  v_t1m numeric[]  := array[60000, 60000, 66000, 72000];
  v_t2m numeric[]  := array[50000, 50000, 55000, 60000];
  v_t3m numeric[]  := array[40000, 40000, 44000, 48000];
  v_cxm numeric[]  := array[15000, 15000, 15000, 20000];
  v_insm numeric[] := array[10000, 10000, 12000, 12000];

  v_noms text[] := array['AGBODJAN', 'HOUNKPATIN', 'DOSSOU', 'ADJOVI', 'AKPOVI', 'TOSSOU', 'GBEDO', 'KOUTON', 'SOGLO', 'ZINSOU', 'ALLADAYE', 'HOUNGBO',
    'AHOUANSOU', 'DAGBA', 'FADONOUGBO', 'GLELE', 'BIAOU', 'KPOMASSE', 'AKOTEGNON', 'LOKOSSOU', 'AGOSSOU', 'SANNI', 'ADEDJOUMA', 'TCHIBOZO', 'HOUESSOU',
    'ATCHADE', 'BOCCO', 'CAKPO', 'DEGBE', 'EDAH', 'GANDAHO', 'HOUNSA', 'IDOHOU', 'KINDJI', 'MEDENOU', 'NOUDJENOUME', 'OKE', 'PADONOU', 'QUENUM', 'SEHOUETO'];
  v_pren_f text[] := array['Aïcha', 'Chimène', 'Esther', 'Josiane', 'Mariam', 'Sènami', 'Estelle', 'Nadège', 'Reine', 'Prisca', 'Fabiola', 'Grâce', 'Rosine', 'Annick', 'Flora',
    'Judith', 'Laetitia', 'Mireille', 'Noëlle', 'Océane', 'Rachelle', 'Suzanne', 'Tatiana', 'Victoire'];
  v_pren_m text[] := array['Fabrice', 'Rodrigue', 'Prosper', 'Kévin', 'Désiré', 'Arnaud', 'Boris', 'Cédric', 'Dieudonné', 'Éric', 'Franck', 'Gildas', 'Hervé', 'Jonas', 'Ludovic',
    'Marc', 'Nestor', 'Olivier', 'Patrice', 'Romaric', 'Serge', 'Thierry', 'Urbain', 'Yannick'];

  v_class_id uuid[] := '{}'; v_class_nom text[] := '{}'; v_class_niv int[] := '{}';
  v_cid uuid; v_nivi int; v_nom_classe text;
  v_sid uuid; v_pid uuid; v_prev_pid uuid; v_prev_nom text;
  v_i int := 0; v_cnt int; v_k int; v_c int; v_s int; v_t int;
  v_femme boolean; v_prenom text; v_nom text; v_code text; v_k2 int;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_dates date[]; v_montants numeric[];
  v_profil numeric; v_due date; v_amt numeric; v_pay date; v_mode text; v_note text;
  v_sexe_existe boolean; v_connexe_ok boolean;
  v_eleve_modele uuid;
  v_nb_jours int := 0; v_jour date;
begin
  -- ---------- garde-fous ----------
  select * into v_school from schools where name = v_nom_ecole limit 1;
  if not found then
    raise exception 'École introuvable : aucune école ne s''appelle « % ». Crée d''abord l''école de démonstration par l''inscription normale, puis corrige v_nom_ecole en haut du script.', v_nom_ecole;
  end if;
  if v_school.name !~* '(d[ée]mo)' then
    raise exception 'Refusé : l''école « % » ne contient pas « démo » dans son nom. Ce script ne remplit que des écoles de démonstration.', v_school.name;
  end if;
  if exists (select 1 from students where school_id = v_school.id) then
    raise exception 'Refusé : l''école « % » contient déjà des élèves. Lance d''abord demo_ecole_vider.sql si tu veux repartir de zéro.', v_school.name;
  end if;

  perform setseed(0.37); -- mêmes données à chaque exécution

  -- ---------- plan et réglages de l'école de démonstration ----------
  if v_school.plan = 'decouverte' then
    -- Le plan d'une école ne se change que côté serveur : on prend ce rôle le temps de cette seule mise à jour.
    perform set_config('role', 'service_role', true);
    update schools set plan = 'essentiel' where id = v_school.id;
    reset role;
  end if;
  update schools set rappels_auto = false where id = v_school.id;  -- aucun rappel automatique ne doit partir depuis la démo

  -- ---------- année scolaire et calendrier de paiement (relatifs à aujourd'hui) ----------
  v_ys := case when extract(month from v_today) >= 9 then extract(year from v_today)::int else extract(year from v_today)::int - 1 end;
  v_debut := make_date(v_ys, 9, 14);
  v_fin := make_date(v_ys + 1, 7, 15);
  v_cx := make_date(v_ys, 10, 15);
  v_t1 := make_date(v_ys, 10, 31);
  v_t2 := make_date(v_ys + 1, 1, 31);
  v_t3 := make_date(v_ys + 1, 4, 30);

  select id into v_year_id from school_years where school_id = v_school.id order by is_current desc, created_at desc limit 1;
  if v_year_id is null then
    insert into school_years (school_id, label, is_current, statut, date_debut, date_fin, date_tranche1, date_tranche2, date_tranche3, date_connexe)
    values (v_school.id, v_ys || '-' || (v_ys + 1), true, 'active', v_debut, v_fin, v_t1, v_t2, v_t3, v_cx) returning id into v_year_id;
  else
    update school_years set label = v_ys || '-' || (v_ys + 1), is_current = true, statut = 'active', date_debut = v_debut, date_fin = v_fin,
      date_tranche1 = v_t1, date_tranche2 = v_t2, date_tranche3 = v_t3, date_connexe = v_cx
    where id = v_year_id;
  end if;

  -- ---------- frais par niveau ----------
  for v_c in 1..4 loop
    insert into fee_schedules (school_id, school_year_id, niveau, montant_scolarite, montant_connexe, montant_tranche1, montant_tranche2, montant_tranche3, montant_inscription, montant_reinscription)
    values (v_school.id, v_year_id, v_niveaux[v_c], v_scol[v_c], v_cxm[v_c], v_t1m[v_c], v_t2m[v_c], v_t3m[v_c], v_insm[v_c], round(v_insm[v_c] * 0.75));
  end loop;

  -- ---------- matières (niveau vide = toutes les classes) ----------
  insert into subjects (school_id, nom, coefficient) values
    (v_school.id, 'Mathématiques', 4), (v_school.id, 'Français', 4), (v_school.id, 'Anglais', 3), (v_school.id, 'SVT', 2),
    (v_school.id, 'Physique-Chimie', 2), (v_school.id, 'Histoire-Géographie', 2), (v_school.id, 'EPS', 1), (v_school.id, 'Informatique', 1);

  -- ---------- classes ----------
  for v_c in 1..4 loop
    for v_s in 1..2 loop
      v_nom_classe := v_nom_niveau[v_c] || ' ' || v_sections[v_s];
      insert into classes (school_id, nom, niveau, section, salle, capacite)
      values (v_school.id, v_nom_classe, v_niveaux[v_c], v_sections[v_s], 'Salle ' || ((v_c - 1) * 2 + v_s), 40) returning id into v_cid;
      v_class_id := v_class_id || v_cid; v_class_nom := v_class_nom || v_nom_classe; v_class_niv := v_class_niv || v_c;
    end loop;
  end loop;

  select count(*) > 0 into v_sexe_existe from information_schema.columns where table_schema = 'public' and table_name = 'students' and column_name = 'sexe';

  -- ---------- élèves, parents, inscriptions, paiements ----------
  for v_c in 1..8 loop
    v_cnt := 28 + floor(random() * 7)::int;
    v_nivi := v_class_niv[v_c];
    for v_k in 1..v_cnt loop
      v_i := v_i + 1;
      v_femme := random() < 0.5;
      v_prenom := case when v_femme then v_pren_f[1 + floor(random() * array_length(v_pren_f, 1))::int] else v_pren_m[1 + floor(random() * array_length(v_pren_m, 1))::int] end;
      -- un élève sur neuf est le frère ou la sœur du précédent : même nom, même parent
      if v_i > 1 and v_i % 9 = 0 then v_nom := v_prev_nom; else v_nom := v_noms[1 + floor(random() * array_length(v_noms, 1))::int]; end if;

      insert into students (school_id, matricule, nom, prenom, full_name, parent_phone, parent_name, date_naissance)
      values (v_school.id, 'DEMO-' || lpad(v_i::text, 4, '0'), v_nom, v_prenom, v_nom || ' ' || v_prenom,
              '+2290100' || lpad(v_i::text, 6, '0'), 'Famille ' || v_nom,
              make_date(v_ys - 11 - v_nivi, 1, 1) + floor(random() * 360)::int)
      returning id into v_sid;
      if v_sexe_existe then execute 'update students set sexe = $1 where id = $2' using case when v_femme then 'F' else 'M' end, v_sid; end if;

      if v_i > 1 and v_i % 9 = 0 and v_prev_pid is not null then
        v_pid := v_prev_pid;
      else
        loop
          v_code := '';
          for v_k2 in 1..8 loop v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1); end loop;
          exit when not exists (select 1 from parent_access where code = v_code);
        end loop;
        insert into parent_access (school_id, nom, prenom, full_name, phone, code)
        values (v_school.id, v_nom, case when random() < 0.5 then v_pren_f[1 + floor(random() * array_length(v_pren_f, 1))::int] else v_pren_m[1 + floor(random() * array_length(v_pren_m, 1))::int] end,
                v_nom || ' (parent)', '+2290100' || lpad((1000 + v_i)::text, 6, '0'), v_code)
        returning id into v_pid;
        update parent_access set full_name = trim(upper(nom) || ' ' || prenom) where id = v_pid;
      end if;
      insert into parent_access_students (parent_access_id, student_id) values (v_pid, v_sid);
      v_prev_pid := v_pid; v_prev_nom := v_nom;
      if v_i = 1 then v_eleve_modele := v_sid; end if;

      -- profil de paiement de la famille
      v_profil := random();
      v_note := case when v_profil >= 0.96 then 'Arrangement : paiement échelonné convenu avec la direction' else null end;
      insert into enrollments (school_id, school_year_id, student_id, classe_id, montant_du, frais_connexe_du, statut, note_arrangement)
      values (v_school.id, v_year_id, v_sid, v_class_id[v_c], v_scol[v_nivi], v_cxm[v_nivi], 'inscrit', v_note);

      v_dates := array[v_t1, v_t2, v_t3];
      v_montants := array[v_t1m[v_nivi], v_t2m[v_nivi], v_t3m[v_nivi]];

      -- inscription : payée par tout le monde, à la rentrée
      insert into payments (school_id, student_id, school_year_id, type_frais, montant, mode, tranche, date)
      values (v_school.id, v_sid, v_year_id, 'inscription', v_insm[v_nivi], case when random() < 0.55 then 'especes' else 'mobile_money' end, 'complet',
              least(v_today, v_debut + floor(random() * 10)::int));

      -- frais connexes (échéance d'octobre, déjà passée) : réglés par les familles à jour ou en arrangement, par la moitié de celles
      -- qui ont un retard de scolarité partiel, et par un quart de celles qui n'ont rien versé
      v_connexe_ok := v_profil < 0.60 or v_profil >= 0.96 or random() < (case when v_profil < 0.77 then 0.5 else 0.25 end);
      if v_connexe_ok then
        insert into payments (school_id, student_id, school_year_id, type_frais, montant, mode, tranche, date)
        values (v_school.id, v_sid, v_year_id, 'connexe', v_cxm[v_nivi], case when random() < 0.55 then 'especes' else 'mobile_money' end, 'complet',
                least(v_today, v_debut + 3 + floor(random() * 40)::int));
      end if;

      -- scolarité selon le profil
      if v_profil < 0.15 then
        -- paie toute l'année d'un coup, à la rentrée
        insert into payments (school_id, student_id, school_year_id, type_frais, montant, mode, tranche, date)
        values (v_school.id, v_sid, v_year_id, 'scolarite', v_scol[v_nivi], case when random() < 0.55 then 'especes' else 'mobile_money' end, 'complet',
                least(v_today, v_debut + floor(random() * 14)::int));
      elsif v_profil < 0.60 then
        -- à jour : règle chaque tranche à son échéance (ou un peu avant)
        for v_t in 1..3 loop
          v_due := v_dates[v_t];
          if v_due <= v_today + 20 then
            insert into payments (school_id, student_id, school_year_id, type_frais, montant, mode, tranche, date)
            values (v_school.id, v_sid, v_year_id, 'scolarite', v_montants[v_t], case when random() < 0.55 then 'especes' else 'mobile_money' end, 'tranche' || v_t,
                    least(v_today, greatest(v_debut + 5, v_due - floor(random() * 14)::int)));
          end if;
        end loop;
      elsif v_profil < 0.77 then
        -- paiement partiel de la 1ère tranche : en retard
        v_amt := round((v_montants[1] * (0.4 + random() * 0.4)) / 500) * 500;
        insert into payments (school_id, student_id, school_year_id, type_frais, montant, mode, tranche, date)
        values (v_school.id, v_sid, v_year_id, 'scolarite', v_amt, case when random() < 0.55 then 'especes' else 'mobile_money' end, 'tranche1',
                least(v_today, v_debut + 10 + floor(random() * 30)::int));
      elsif v_profil < 0.96 then
        -- aucun versement de scolarité : en retard
        null;
      else
        -- arrangement avec la direction : 1ère tranche payée, le reste échelonné
        insert into payments (school_id, student_id, school_year_id, type_frais, montant, mode, tranche, date)
        values (v_school.id, v_sid, v_year_id, 'scolarite', v_montants[1], 'mobile_money', 'tranche1', least(v_today, v_debut + 15 + floor(random() * 20)::int));
      end if;
    end loop;
  end loop;

  -- ---------- présences : les 15 derniers jours de classe ----------
  v_jour := v_today;
  while v_nb_jours < 15 and v_jour >= v_debut loop
    if extract(isodow from v_jour) < 6 then
      insert into attendance_records (school_id, student_id, school_year_id, date, statut)
      select v_school.id, x.student_id, v_year_id, v_jour, case when x.r < 0.04 then 'absent' when x.r < 0.07 then 'retard' else 'present' end
      from (select e.student_id, random() as r from enrollments e where e.school_id = v_school.id and e.school_year_id = v_year_id) x;
      v_nb_jours := v_nb_jours + 1;
    end if;
    v_jour := v_jour - 1;
  end loop;

  -- ---------- notes du 1er trimestre : 3 notes par élève et par matière (2 contrôles, 1 devoir) ----------
  insert into grades (school_id, student_id, subject_id, school_year_id, type, note, sur, periode)
  select v_school.id, e.student_id, su.id, v_year_id, ty.type,
         greatest(2, least(20, round((9 + ((hashtext(e.student_id::text) & 1023) / 1023.0) * 7 + ((hashtext(su.id::text) & 7) / 7.0 - 0.5) * 2 + (random() - 0.5) * 6) * 4) / 4)),
         20, 'Trimestre 1'
  from enrollments e
  cross join subjects su
  cross join (values ('controle'), ('controle'), ('devoir')) as ty(type)
  where e.school_id = v_school.id and e.school_year_id = v_year_id and su.school_id = v_school.id;

  -- ---------- personnel et salaires des 2 derniers mois ----------
  insert into staff (school_id, matricule, nom, prenom, full_name, role, phone, statut, date_entree, salaire_mensuel, classes) values
    (v_school.id, 'DEMO-P01', 'GBEDO', 'Prosper', 'GBEDO Prosper', 'Directeur', '+2290100900001', 'actif', v_debut - 900, 250000, '{}'),
    (v_school.id, 'DEMO-P02', 'ADJOVI', 'Josiane', 'ADJOVI Josiane', 'Secrétaire', '+2290100900002', 'actif', v_debut - 600, 100000, '{}'),
    (v_school.id, 'DEMO-P03', 'HOUNKPATIN', 'Rodrigue', 'HOUNKPATIN Rodrigue', 'Enseignant', '+2290100900003', 'actif', v_debut - 700, 150000, array['6ème A', '6ème B']),
    (v_school.id, 'DEMO-P04', 'ZINSOU', 'Esther', 'ZINSOU Esther', 'Enseignant', '+2290100900004', 'actif', v_debut - 500, 140000, array['5ème A', '5ème B']),
    (v_school.id, 'DEMO-P05', 'DOSSOU', 'Désiré', 'DOSSOU Désiré', 'Enseignant', '+2290100900005', 'actif', v_debut - 400, 140000, array['4ème A', '4ème B']),
    (v_school.id, 'DEMO-P06', 'AGOSSOU', 'Nadège', 'AGOSSOU Nadège', 'Enseignant', '+2290100900006', 'actif', v_debut - 300, 130000, array['3ème A', '3ème B']),
    (v_school.id, 'DEMO-P07', 'KOUTON', 'Franck', 'KOUTON Franck', 'Enseignant', '+2290100900007', 'actif', v_debut - 200, 120000, array['6ème A', '5ème A', '4ème A']),
    (v_school.id, 'DEMO-P08', 'SANNI', 'Mariam', 'SANNI Mariam', 'Surveillant', '+2290100900008', 'actif', v_debut - 100, 90000, '{}');

  if v_today > v_debut + 45 then
    -- le mois précédent et celui d'avant, versés en fin de mois
    insert into staff_salaries (school_id, staff_id, school_year_id, montant, mois, date, mode)
    select v_school.id, st.id, v_year_id, st.salaire_mensuel,
           (array['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'])[extract(month from m.d)::int] || ' ' || extract(year from m.d)::int,
           least(v_today, (date_trunc('month', m.d) + interval '1 month - 2 days')::date), 'especes'
    from staff st
    cross join (select (date_trunc('month', v_today) - interval '1 month')::date as d union all select (date_trunc('month', v_today) - interval '2 month')::date) m
    where st.school_id = v_school.id and m.d >= date_trunc('month', v_debut);
  end if;

  -- ---------- dépenses ----------
  insert into expenses (school_id, school_year_id, libelle, categorie, montant, created_at) values
    (v_school.id, v_year_id, 'Facture d''électricité', 'Charges', 85000, v_today - 20),
    (v_school.id, v_year_id, 'Facture d''eau', 'Charges', 32000, v_today - 18),
    (v_school.id, v_year_id, 'Abonnement internet', 'Charges', 25000, v_today - 15),
    (v_school.id, v_year_id, 'Craies, marqueurs et cahiers de présence', 'Fournitures', 46000, v_today - 40),
    (v_school.id, v_year_id, 'Réparation des tables de la salle 3', 'Entretien', 38000, v_today - 28),
    (v_school.id, v_year_id, 'Produits d''entretien', 'Entretien', 21000, v_today - 12),
    (v_school.id, v_year_id, 'Impression des convocations', 'Fournitures', 14500, v_today - 6);

  -- ---------- l'élève modèle sert à la démo du paiement et du portail parents ----------
  update students set parent_name = 'Parent modèle de démonstration' where id = v_eleve_modele;
end
$demo$;

-- ---------- Récapitulatif (le résultat s'affiche sous la zone de saisie) ----------
with ecole as (select distinct school_id from students where matricule = 'DEMO-0001')
select 'Élèves' as element, (select count(*) from students s where s.school_id in (select school_id from ecole))::text as valeur
union all select 'Parents', (select count(*) from parent_access p where p.school_id in (select school_id from ecole))::text
union all select 'Paiements enregistrés', (select count(*) from payments p where p.school_id in (select school_id from ecole))::text
union all select 'Élèves avec un solde restant', (select count(*) from enrollments e where e.school_id in (select school_id from ecole) and e.montant_du - e.montant_paye > 0)::text
union all select 'Élève modèle (démo du paiement)', (select s.full_name || ' (' || s.matricule || ')' from students s where s.matricule = 'DEMO-0001' and s.school_id in (select school_id from ecole))
union all select 'Code du portail parents de l''élève modèle', (select p.code from parent_access p join parent_access_students l on l.parent_access_id = p.id join students s on s.id = l.student_id
                                                              where s.matricule = 'DEMO-0001' and s.school_id in (select school_id from ecole) limit 1);
