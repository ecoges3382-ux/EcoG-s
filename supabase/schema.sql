-- EcoGès — schéma initial (multi-écoles avec sécurité au niveau ligne)
-- À coller dans Supabase : Table Editor → SQL Editor → New query → Run

-- ---------- Tables ----------

create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#0F4C3A',
  logo_url text,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('fondateur','directeur','secretaire','enseignant')),
  created_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  matricule text,
  full_name text not null,
  niveau text not null,
  parent_phone text,
  montant_du numeric not null default 0,
  montant_paye numeric not null default 0,
  frais_connexe_du numeric not null default 0,
  frais_connexe_paye numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Tables créées maintenant pour la suite (Personnel, Emploi du temps,
-- Annonces, Avances) — pas encore utilisées par l'application en Stage 1.

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  matricule text,
  full_name text not null,
  role text not null,
  niveau_etudes text,
  classes text[] not null default '{}',
  phone text,
  email text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists schedule_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  jour text not null,
  creneau text not null,
  classe text not null,
  matiere text not null,
  enseignant text,
  created_at timestamptz not null default now()
);

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  auteur text not null,
  role text,
  portee text not null,
  titre text not null,
  created_at timestamptz not null default now()
);

create table if not exists salary_advances (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  staff_id uuid references staff(id) on delete cascade,
  montant numeric not null,
  solde numeric not null,
  statut text not null default 'attente_fondateur',
  created_at timestamptz not null default now()
);

-- ---------- Sécurité (Row Level Security) ----------
-- Chaque utilisateur ne voit que les données de sa propre école. C'est
-- Postgres qui l'impose, pas le code JS côté client.

create or replace function current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from profiles where id = auth.uid()
$$;

alter table schools enable row level security;
alter table profiles enable row level security;
alter table students enable row level security;
alter table staff enable row level security;
alter table schedule_entries enable row level security;
alter table announcements enable row level security;
alter table salary_advances enable row level security;

create policy "profiles: lecture de son propre profil" on profiles
  for select using (id = auth.uid());
create policy "profiles: modification de son propre profil" on profiles
  for update using (id = auth.uid());

create policy "schools: lecture de sa propre école" on schools
  for select using (id = current_school_id());

create policy "students: select" on students
  for select using (school_id = current_school_id());
create policy "students: insert" on students
  for insert with check (school_id = current_school_id());
create policy "students: update" on students
  for update using (school_id = current_school_id());
create policy "students: delete" on students
  for delete using (school_id = current_school_id());

create policy "staff: select" on staff
  for select using (school_id = current_school_id());
create policy "staff: insert" on staff
  for insert with check (school_id = current_school_id());
create policy "staff: update" on staff
  for update using (school_id = current_school_id());
create policy "staff: delete" on staff
  for delete using (school_id = current_school_id());

create policy "schedule_entries: select" on schedule_entries
  for select using (school_id = current_school_id());
create policy "schedule_entries: insert" on schedule_entries
  for insert with check (school_id = current_school_id());
create policy "schedule_entries: update" on schedule_entries
  for update using (school_id = current_school_id());
create policy "schedule_entries: delete" on schedule_entries
  for delete using (school_id = current_school_id());

create policy "announcements: select" on announcements
  for select using (school_id = current_school_id());
create policy "announcements: insert" on announcements
  for insert with check (school_id = current_school_id());

create policy "salary_advances: select" on salary_advances
  for select using (school_id = current_school_id());
create policy "salary_advances: insert" on salary_advances
  for insert with check (school_id = current_school_id());
create policy "salary_advances: update" on salary_advances
  for update using (school_id = current_school_id());

-- ---------- Inscription en libre-service ----------
-- Appelée par le frontend juste après qu'un nouvel utilisateur a confirmé
-- son e-mail. Crée l'école et le profil "fondateur" en une fois. Tourne en
-- security definer pour pouvoir écrire malgré la RLS (l'utilisateur n'a
-- encore aucun profil à ce stade, donc current_school_id() renverrait
-- null et bloquerait un insert normal) — mais elle ne peut créer un profil
-- que pour l'utilisateur authentifié qui l'appelle (auth.uid()), jamais
-- pour quelqu'un d'autre, et refuse si un profil existe déjà.

create or replace function provision_school(p_school_name text, p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Un profil existe déjà pour cet utilisateur';
  end if;

  insert into schools (name) values (p_school_name) returning id into v_school_id;

  insert into profiles (id, school_id, full_name, role)
  values (auth.uid(), v_school_id, p_full_name, 'fondateur');

  return v_school_id;
end;
$$;

grant execute on function provision_school(text, text) to authenticated;

-- ---------- Migration 2 : Argent (dépenses), Bulletins, rôles ----------
-- À exécuter en plus du bloc ci-dessus sur un projet qui a déjà tourné la
-- première version de ce fichier (ce bloc-ci n'existait pas encore).

alter table students add column if not exists moyenne numeric;
alter table students add column if not exists bulletin_pret boolean not null default false;

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  libelle text not null,
  categorie text not null,
  montant numeric not null,
  created_at timestamptz not null default now()
);

alter table expenses enable row level security;

create policy "expenses: select" on expenses
  for select using (school_id = current_school_id());
create policy "expenses: insert" on expenses
  for insert with check (school_id = current_school_id());

-- Rôle de l'utilisateur courant, pour les policies qui doivent restreindre
-- une action à certains rôles (pas seulement à la bonne école).
create or replace function current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

-- Modifier les paramètres de l'école : réservé au fondateur.
create policy "schools: le fondateur modifie son école" on schools
  for update using (id = current_school_id() and current_role_name() = 'fondateur');

-- Statuer sur une avance sur salaire : réservé fondateur/directeur.
-- Remplace la policy "salary_advances: update" de la migration 1, qui
-- n'imposait qu'un scoping par école : avec deux policies "update"
-- permissives, Postgres les combine en OR, donc la première ne
-- suffisait pas à bloquer un enseignant. On la retire au profit d'une
-- version qui vérifie aussi le rôle.
drop policy if exists "salary_advances: update" on salary_advances;
create policy "salary_advances: fondateur/directeur statuent" on salary_advances
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
  );

-- ---------- Migration 3 : photos (logo école, élèves, personnel) ----------

alter table students add column if not exists photo_url text;

-- Bucket public : les photos ne sont pas des données sensibles et doivent
-- s'afficher directement via une URL simple (balise <img>), sans passer
-- par une authentification à chaque affichage.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Les fichiers sont rangés sous "<school_id>/...", donc on peut restreindre
-- qui a le droit d'écrire en comparant ce premier segment du chemin à
-- l'école de l'utilisateur connecté — même si le bucket est public en
-- lecture, l'écriture reste cloisonnée par école.
create policy "photos: lecture publique" on storage.objects
  for select using (bucket_id = 'photos');
create policy "photos: dépôt par école" on storage.objects
  for insert with check (
    bucket_id = 'photos' and (storage.foldername(name))[1] = current_school_id()::text
  );
create policy "photos: modification par école" on storage.objects
  for update using (
    bucket_id = 'photos' and (storage.foldername(name))[1] = current_school_id()::text
  );
create policy "photos: suppression par école" on storage.objects
  for delete using (
    bucket_id = 'photos' and (storage.foldername(name))[1] = current_school_id()::text
  );
