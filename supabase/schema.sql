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
