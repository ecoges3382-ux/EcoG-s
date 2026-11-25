-- =====================================================================================================================
-- FINANCES ET PERSONNEL RÉSERVÉS : qui peut lire (et saisir) les salaires, paiements, dépenses et avances sur salaire,
-- et qui peut ajouter, modifier ou supprimer une fiche du personnel.
-- =====================================================================================================================
--
-- AVANT : tout membre du personnel de l'école, enseignants compris, pouvait LIRE dans la base les paiements, les versements de
-- salaires, les avances sur salaire, les dépenses et le salaire mensuel de chaque collègue (et saisir des dépenses ou des avances).
-- L'application cachait ces écrans aux enseignants, mais la base de données ne les empêchait pas de les lire.
--
-- APRÈS : seuls y accèdent
--   * le fondateur, le directeur et la secrétaire (leur rôle), et
--   * toute autre personne (enseignant, censeur…) à qui le fondateur a explicitement coché « Gestion financière (Argent) » dans
--     ses permissions. Un enseignant sans cette permission ne voit plus rien de tout cela, même en interrogeant la base directement.
--
--
-- PERSONNEL : n'importe quel membre du personnel, enseignants compris, pouvait AJOUTER, MODIFIER (rôle, salaire…) ou SUPPRIMER les fiches
-- du personnel directement dans la base. Désormais seuls le fondateur, le directeur et la secrétaire le peuvent, ainsi que toute autre
-- personne à qui le fondateur a coché « Personnel » dans ses permissions. Tout le monde continue de LIRE la liste (noms, rôles) :
-- les écrans Classes, Matières et Emploi du temps en ont besoin.
--
-- Ce script est rejouable sans danger. À lancer dans Supabase (SQL Editor), une fois. Il peut être lancé avant ou après la mise en
-- ligne de la nouvelle version de l'application (qui sait travailler dans les deux cas).
--
-- SALAIRE MENSUEL PRÉVU : il était stocké dans la fiche du personnel (staff.salaire_mensuel), lisible par tous les collègues. Il est
-- déplacé dans une table à part, staff_remuneration, réservée comme ci-dessus. Les montants déjà saisis sont COPIÉS, puis effacés de
-- la fiche du personnel (la colonne reste, vide, pour ne casser aucune ancienne version de l'application).
-- =====================================================================================================================

-- ---------- 1. La règle : qui a accès aux finances ----------
create or replace function public.peut_voir_finances()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role in ('fondateur', 'directeur', 'secretaire')
            or coalesce((p.permissions ->> 'finance')::boolean, false)
     from profiles p
     where p.id = auth.uid()),
    false)
$$;

create or replace function public.peut_gerer_personnel()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role in ('fondateur', 'directeur', 'secretaire')
            or coalesce((p.permissions ->> 'personnel')::boolean, false)
     from profiles p
     where p.id = auth.uid()),
    false)
$$;

-- ---------- 2. Lecture et saisie réservées aux finances ----------
drop policy if exists "staff_salaries: select" on staff_salaries;
create policy "staff_salaries: select" on staff_salaries
  for select using (
    school_id = (select current_school_id())
    and (select peut_voir_finances())
  );

drop policy if exists "salary_advances: select" on salary_advances;
create policy "salary_advances: select" on salary_advances
  for select using (
    school_id = (select current_school_id())
    and (select peut_voir_finances())
  );

drop policy if exists "salary_advances: insert" on salary_advances;
create policy "salary_advances: insert" on salary_advances
  for insert with check (
    school_id = (select current_school_id())
    and (select peut_voir_finances())
  );

drop policy if exists "expenses: select" on expenses;
create policy "expenses: select" on expenses
  for select using (
    school_id = (select current_school_id())
    and (select peut_voir_finances())
  );

drop policy if exists "expenses: insert" on expenses;
create policy "expenses: insert" on expenses
  for insert with check (
    school_id = (select current_school_id())
    and (select peut_voir_finances())
  );

-- Paiements : la règle « personnel » seulement. Celle du parent (il voit les paiements de SES enfants) ne change pas.
drop policy if exists "payments: select (personnel)" on payments;
create policy "payments: select (personnel)" on payments
  for select using (
    school_id = (select current_school_id())
    and (select peut_voir_finances())
  );

-- ---------- 3. Salaire mensuel prévu : table à part, réservée aux finances ----------
create table if not exists staff_remuneration (
  staff_id uuid primary key references staff(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  salaire_mensuel numeric,
  updated_at timestamptz not null default now()
);
create index if not exists staff_remuneration_school_idx on staff_remuneration(school_id);
alter table staff_remuneration enable row level security;

drop policy if exists "staff_remuneration: select" on staff_remuneration;
create policy "staff_remuneration: select" on staff_remuneration
  for select using (
    school_id = (select current_school_id())
    and (select peut_voir_finances())
  );
drop policy if exists "staff_remuneration: insert" on staff_remuneration;
create policy "staff_remuneration: insert" on staff_remuneration
  for insert with check (
    school_id = (select current_school_id())
    and (select peut_voir_finances())
    and exists (select 1 from staff st where st.id = staff_remuneration.staff_id and st.school_id = staff_remuneration.school_id)
  );
drop policy if exists "staff_remuneration: update" on staff_remuneration;
create policy "staff_remuneration: update" on staff_remuneration
  for update using (
    school_id = (select current_school_id())
    and (select peut_voir_finances())
  ) with check (
    school_id = (select current_school_id())
    and (select peut_voir_finances())
  );
drop policy if exists "staff_remuneration: delete" on staff_remuneration;
create policy "staff_remuneration: delete" on staff_remuneration
  for delete using (
    school_id = (select current_school_id())
    and (select peut_voir_finances())
  );

-- Copie des salaires déjà saisis, puis effacement de la fiche du personnel (lisible de tous les collègues).
-- L'effacement se fait fiche par fiche : si une école au forfait Découverte refuse la modification d'une fiche, cette fiche est
-- laissée telle quelle (le salaire y reste, mais il est aussi dans la nouvelle table) sans faire échouer le reste.
do $$
declare
  r record;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'staff' and column_name = 'salaire_mensuel') then
    insert into staff_remuneration (staff_id, school_id, salaire_mensuel)
    select id, school_id, salaire_mensuel from staff where salaire_mensuel is not null
    on conflict (staff_id) do nothing;
    -- On n'efface que ce qui est bien copié : si la copie a échoué, rien n'est perdu.
    for r in
      select s.id from staff s
      where s.salaire_mensuel is not null
        and exists (select 1 from staff_remuneration x where x.staff_id = s.id and x.salaire_mensuel is not distinct from s.salaire_mensuel)
    loop
      begin
        update staff set salaire_mensuel = null where id = r.id;
      exception when others then
        raise notice 'Fiche % laissée telle quelle : %', r.id, sqlerrm;
      end;
    end loop;
  end if;
end $$;

-- ---------- 4. Fiches du personnel : écriture réservée (la lecture reste ouverte à tout le personnel de l'école) ----------
drop policy if exists "staff: insert" on staff;
create policy "staff: insert" on staff
  for insert with check (
    school_id = (select current_school_id())
    and (select peut_gerer_personnel())
  );
drop policy if exists "staff: update" on staff;
create policy "staff: update" on staff
  for update using (
    school_id = (select current_school_id())
    and (select peut_gerer_personnel())
  ) with check (
    school_id = (select current_school_id())
    and (select peut_gerer_personnel())
  );
drop policy if exists "staff: delete" on staff;
create policy "staff: delete" on staff
  for delete using (
    school_id = (select current_school_id())
    and (select peut_gerer_personnel())
  );
