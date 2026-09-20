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

-- ---------- Migration 4 : comptes utilisateurs (directeur/secrétaire/enseignant) ----------
-- Le fondateur peut créer des comptes de connexion pour son équipe (avec
-- mot de passe qu'il choisit) via l'Edge Function create-staff-account.
-- Ce bloc SQL prépare juste le terrain : colonne e-mail sur profiles (pour
-- l'affichage, sans avoir à interroger auth.users) et le droit, pour le
-- fondateur, de lire tous les profils de son école (pas seulement le sien).

alter table profiles add column if not exists email text;

create policy "profiles: le fondateur lit toute son école" on profiles
  for select using (school_id = current_school_id() and current_role_name() = 'fondateur');

-- Rejoue provision_school en y ajoutant l'e-mail du fondateur (lu depuis
-- auth.users, accessible ici car la fonction tourne en security definer).
create or replace function provision_school(p_school_name text, p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Un profil existe déjà pour cet utilisateur';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into schools (name) values (p_school_name) returning id into v_school_id;

  insert into profiles (id, school_id, full_name, role, email)
  values (auth.uid(), v_school_id, p_full_name, 'fondateur', v_email);

  return v_school_id;
end;
$$;

-- ---------- Migration 5 : comptes parents réels ----------
-- Un compte parent est un profil comme les autres (role='parent'), mais il
-- ne doit voir que ses propres enfants — pas la liste des élèves, pas le
-- personnel, pas les finances de l'école. Comme role='parent' partage la
-- colonne school_id avec le personnel, il faut resserrer les policies
-- existantes : jusqu'ici "select using (school_id = current_school_id())"
-- suffisait à donner accès à quiconque avait le bon school_id, personnel
-- comme parent. On ajoute donc la vérification de rôle qui manquait.

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('fondateur', 'directeur', 'secretaire', 'enseignant', 'parent'));

alter table students add column if not exists parent_name text;
alter table students add column if not exists parent_email text;

create table if not exists student_guardians (
  student_id uuid not null references students(id) on delete cascade,
  parent_profile_id uuid not null references profiles(id) on delete cascade,
  primary key (student_id, parent_profile_id)
);
alter table student_guardians enable row level security;

create policy "student_guardians: le personnel lit sa propre école" on student_guardians
  for select using (
    exists (
      select 1 from students s
      where s.id = student_guardians.student_id
        and s.school_id = current_school_id()
        and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
    )
  );
create policy "student_guardians: le parent lit ses propres liens" on student_guardians
  for select using (parent_profile_id = auth.uid());

-- students : on remplace l'unique policy "select" par deux policies plus
-- strictes (personnel de l'école vs parent limité à ses enfants).
drop policy if exists "students: select" on students;
create policy "students: select (personnel)" on students
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
create policy "students: select (parent)" on students
  for select using (
    exists (
      select 1 from student_guardians sg
      where sg.student_id = students.id and sg.parent_profile_id = auth.uid()
    )
  );

-- Les autres tables scolaires/financières ne concernent que le personnel :
-- on ajoute la vérification de rôle qui manquait à leurs policies "select".
drop policy if exists "staff: select" on staff;
create policy "staff: select" on staff
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );

drop policy if exists "schedule_entries: select" on schedule_entries;
create policy "schedule_entries: select" on schedule_entries
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );

drop policy if exists "announcements: select" on announcements;
create policy "announcements: select" on announcements
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );

drop policy if exists "salary_advances: select" on salary_advances;
create policy "salary_advances: select" on salary_advances
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );

drop policy if exists "expenses: select" on expenses;
create policy "expenses: select" on expenses
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );

-- Créer un compte parent : réservé fondateur/directeur/secrétaire (le
-- personnel d'accueil), jamais un enseignant ni un parent lui-même.
create policy "profiles: personnel crée des comptes parents" on profiles
  for insert with check (
    role = 'parent'
    and school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );

-- Le directeur et la secrétaire peuvent aussi gérer les comptes parents
-- (Comptes → Comptes parents), mais seul le fondateur a le droit plus large
-- de lire tout profil de l'école ("profiles: le fondateur lit toute son
-- école" ci-dessus) : ils ont donc besoin d'un droit de lecture propre,
-- limité aux seuls comptes role='parent' — pas au reste du personnel.
create policy "profiles: le personnel d'accueil lit les comptes parents" on profiles
  for select using (
    role = 'parent'
    and school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );

-- ---------- Migration 6 : Paiements réels, Présences, Classes → Matières → Notes → Bulletins ----------

-- 1) Sécurité laissée ouverte par la Migration 5 : elle a fermé la LECTURE
-- de students/staff/schedule_entries/announcements/salary_advances/expenses
-- aux comptes parents, mais pas l'ÉCRITURE — leurs policies insert/update/
-- delete ne vérifiaient que le school_id, jamais le rôle. Un compte parent
-- pouvait donc, en théorie, créer ou modifier un élève, un membre du
-- personnel, un créneau, une annonce, une avance ou une dépense de son
-- école. On ferme ce trou avant d'ajouter de nouvelles tables sur le même
-- modèle (école + rôle).

drop policy if exists "students: insert" on students;
create policy "students: insert" on students
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
drop policy if exists "students: update" on students;
create policy "students: update" on students
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
drop policy if exists "students: delete" on students;
create policy "students: delete" on students
  for delete using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );

drop policy if exists "staff: insert" on staff;
create policy "staff: insert" on staff
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
drop policy if exists "staff: update" on staff;
create policy "staff: update" on staff
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
drop policy if exists "staff: delete" on staff;
create policy "staff: delete" on staff
  for delete using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );

drop policy if exists "schedule_entries: insert" on schedule_entries;
create policy "schedule_entries: insert" on schedule_entries
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
drop policy if exists "schedule_entries: update" on schedule_entries;
create policy "schedule_entries: update" on schedule_entries
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
drop policy if exists "schedule_entries: delete" on schedule_entries;
create policy "schedule_entries: delete" on schedule_entries
  for delete using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );

drop policy if exists "announcements: insert" on announcements;
create policy "announcements: insert" on announcements
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );

drop policy if exists "salary_advances: insert" on salary_advances;
create policy "salary_advances: insert" on salary_advances
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );

drop policy if exists "expenses: insert" on expenses;
create policy "expenses: insert" on expenses
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );

-- 2) Classes et matières : listes de référence gérées par le personnel
-- d'encadrement (pas les enseignants, qui les consultent seulement).

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  nom text not null,
  niveau text not null,
  section text,
  salle text,
  capacite integer,
  prof_principal_id uuid references staff(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table classes enable row level security;

create policy "classes: select" on classes
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
create policy "classes: insert" on classes
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );
create policy "classes: update" on classes
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );
create policy "classes: delete" on classes
  for delete using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  nom text not null,
  coefficient numeric not null default 1,
  niveau text,
  enseignant_id uuid references staff(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table subjects enable row level security;

create policy "subjects: select" on subjects
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
create policy "subjects: insert" on subjects
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );
create policy "subjects: update" on subjects
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );
create policy "subjects: delete" on subjects
  for delete using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );

-- 3) Notes : une ligne par évaluation (contrôle/devoir/examen), pas une
-- moyenne unique modifiable à la main — les bulletins se calculent à partir
-- de ces lignes, exactement comme dans un vrai cahier de notes.

create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  type text not null default 'controle' check (type in ('controle', 'devoir', 'examen')),
  note numeric not null,
  sur numeric not null default 20,
  periode text not null default 'Trimestre 1',
  created_at timestamptz not null default now()
);
alter table grades enable row level security;

create policy "grades: select (personnel)" on grades
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
create policy "grades: select (parent)" on grades
  for select using (
    exists (
      select 1 from student_guardians sg
      where sg.student_id = grades.student_id and sg.parent_profile_id = auth.uid()
    )
  );
create policy "grades: insert" on grades
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
create policy "grades: update" on grades
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
create policy "grades: delete" on grades
  for delete using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );

-- 4) Présences : un appel quotidien par élève (present/absent/retard),
-- une seule ligne par élève et par jour (upsert depuis l'écran d'appel).

create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  date date not null,
  statut text not null default 'present' check (statut in ('present', 'absent', 'retard')),
  created_at timestamptz not null default now(),
  unique (student_id, date)
);
alter table attendance_records enable row level security;

create policy "attendance_records: select (personnel)" on attendance_records
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
create policy "attendance_records: select (parent)" on attendance_records
  for select using (
    exists (
      select 1 from student_guardians sg
      where sg.student_id = attendance_records.student_id and sg.parent_profile_id = auth.uid()
    )
  );
create policy "attendance_records: insert" on attendance_records
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
create policy "attendance_records: update" on attendance_records
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
create policy "attendance_records: delete" on attendance_records
  for delete using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );

-- 5) Paiements : un vrai grand livre de transactions. Jusqu'ici
-- students.montant_paye / frais_connexe_paye étaient posés à 0 à
-- l'inscription et ne bougeaient plus jamais — rien dans l'appli ne
-- permettait d'enregistrer qu'une famille avait payé quoi que ce soit.
-- Désormais ces deux colonnes sont recalculées automatiquement (trigger
-- ci-dessous) à partir de la somme des paiements réels : elles ne peuvent
-- plus jamais afficher un montant qui ne correspond à aucune transaction.
-- Restreint à fondateur/directeur/secrétaire (maniement d'argent), pas
-- l'enseignant — à la différence des dépenses/avances qui restent ouvertes
-- à tout le personnel.

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  type_frais text not null default 'scolarite' check (type_frais in ('scolarite', 'connexe', 'inscription', 'autre')),
  montant numeric not null,
  mode text not null default 'especes',
  statut text not null default 'complet',
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
alter table payments enable row level security;

create policy "payments: select (personnel)" on payments
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
create policy "payments: select (parent)" on payments
  for select using (
    exists (
      select 1 from student_guardians sg
      where sg.student_id = payments.student_id and sg.parent_profile_id = auth.uid()
    )
  );
create policy "payments: insert" on payments
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );
create policy "payments: delete" on payments
  for delete using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );

create or replace function recompute_student_paye()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := coalesce(new.student_id, old.student_id);
begin
  update students set
    montant_paye = coalesce((select sum(montant) from payments where student_id = v_student_id and type_frais = 'scolarite'), 0),
    frais_connexe_paye = coalesce((select sum(montant) from payments where student_id = v_student_id and type_frais = 'connexe'), 0)
  where id = v_student_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_recompute_student_paye on payments;
create trigger trg_recompute_student_paye
after insert or update or delete on payments
for each row execute function recompute_student_paye();

-- ---------- Migration 7 : Communication (parents), Documents, Rapports ----------

-- Communication : les annonces existent depuis la Migration 2, mais deux
-- trous subsistaient — "Une classe" ne précisait jamais LAQUELLE (colonne
-- manquante), et un compte parent ne pouvait de toute façon rien lire du
-- tout (la policy select de la Migration 5 ne couvre que le personnel).
-- On ajoute la classe ciblée et le droit de lecture du parent, limité aux
-- annonces qui le concernent (école entière, ou la classe de son enfant).

alter table announcements add column if not exists classe_cible text;

create policy "announcements: select (parent)" on announcements
  for select using (
    exists (
      select 1 from student_guardians sg
      join students s on s.id = sg.student_id
      where sg.parent_profile_id = auth.uid()
        and s.school_id = announcements.school_id
        and (announcements.portee = 'École entière' or announcements.classe_cible = s.niveau)
    )
  );

-- Documents : circulaires et fichiers partagés par le personnel, visibles
-- par tout le monde dans l'école (y compris les parents — un formulaire ou
-- une circulaire n'a pas besoin d'être filtré par enfant).

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  titre text not null,
  file_url text not null,
  uploaded_by text,
  created_at timestamptz not null default now()
);
alter table documents enable row level security;

create policy "documents: select (personnel)" on documents
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
create policy "documents: select (parent)" on documents
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'parent' and p.school_id = documents.school_id
    )
  );
create policy "documents: insert" on documents
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
create policy "documents: delete" on documents
  for delete using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

create policy "documents-bucket: lecture publique" on storage.objects
  for select using (bucket_id = 'documents');
create policy "documents-bucket: dépôt par école" on storage.objects
  for insert with check (
    bucket_id = 'documents' and (storage.foldername(name))[1] = current_school_id()::text
  );
create policy "documents-bucket: suppression par école" on storage.objects
  for delete using (
    bucket_id = 'documents' and (storage.foldername(name))[1] = current_school_id()::text
  );

-- Rapports : lecture seule, réutilise les policies select déjà en place sur
-- students/staff/classes/payments — rien à ajouter ici.

-- ---------- Migration 8 : correctif — récursion infinie students ↔ student_guardians ----------
-- "student_guardians: le personnel lit sa propre école" interroge students
-- pour vérifier l'école, et "students: select (parent)" interroge
-- student_guardians pour vérifier le lien parent → boucle : Postgres
-- réévalue indéfiniment la RLS de l'une pour évaluer celle de l'autre.
-- Comme pour current_school_id()/current_role_name(), on passe par une
-- fonction security definer qui contourne la RLS de students pour casser
-- la boucle — la fonction tourne avec les droits du propriétaire de la
-- table, pas ceux de l'utilisateur connecté, donc plus de réévaluation
-- récursive de la policy.

create or replace function student_school_id(p_student_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from students where id = p_student_id
$$;

drop policy if exists "student_guardians: le personnel lit sa propre école" on student_guardians;
create policy "student_guardians: le personnel lit sa propre école" on student_guardians
  for select using (
    student_school_id(student_guardians.student_id) = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );

-- ---------- Migration 9 : identification par numéro de téléphone ----------
-- En plus de l'e-mail, un compte (personnel ou parent) peut désormais se
-- connecter avec son numéro de téléphone + mot de passe. Le numéro est posé
-- directement sur auth.users (via les Edge Functions manage-*-account, en
-- format E.164, confirmé d'office comme l'e-mail) ; cette colonne n'est
-- qu'une copie de confort pour l'affichage, comme profiles.email.

alter table profiles add column if not exists phone text;

-- ---------- Migration 10 : "Créer une école" par téléphone (code SMS) ----------
-- Rejoue provision_school pour aussi reporter le téléphone du fondateur
-- (le formulaire d'auto-inscription accepte maintenant l'un ou l'autre),
-- exactement comme l'e-mail l'était déjà depuis la Migration 4.

create or replace function provision_school(p_school_name text, p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_email text;
  v_phone text;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Un profil existe déjà pour cet utilisateur';
  end if;

  select email, phone into v_email, v_phone from auth.users where id = auth.uid();

  insert into schools (name) values (p_school_name) returning id into v_school_id;

  insert into profiles (id, school_id, full_name, role, email, phone)
  values (auth.uid(), v_school_id, p_full_name, 'fondateur', v_email, v_phone);

  return v_school_id;
end;
$$;

-- ---------- Migration 11 : accès parent par code, sans compte ----------
-- Un parent d'élève n'est pas un membre du personnel : il n'a pas besoin
-- d'un vrai compte (e-mail/téléphone + mot de passe). On remplace donc les
-- comptes parents par un simple code d'accès, généré par le personnel et
-- partagé (lien ou message) : le parent le saisit sur une page publique et
-- voit directement ses enfants. Aucune de ces deux tables n'accorde le
-- moindre accès à un utilisateur anonyme — la lecture côté parent passe
-- entièrement par l'Edge Function parent-portal (clé service_role), qui
-- vérifie le code elle-même ; ici, seul le personnel (via une session
-- authentifiée normale) peut gérer ces codes.

create table if not exists parent_access (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  full_name text not null,
  phone text,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table parent_access enable row level security;

create policy "parent_access: select" on parent_access
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );
create policy "parent_access: insert" on parent_access
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );
create policy "parent_access: update" on parent_access
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );
create policy "parent_access: delete" on parent_access
  for delete using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );

create table if not exists parent_access_students (
  parent_access_id uuid not null references parent_access(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  primary key (parent_access_id, student_id)
);
alter table parent_access_students enable row level security;

create policy "parent_access_students: select" on parent_access_students
  for select using (
    exists (
      select 1 from parent_access pa
      where pa.id = parent_access_students.parent_access_id
        and pa.school_id = current_school_id()
        and current_role_name() in ('fondateur', 'directeur', 'secretaire')
    )
  );
create policy "parent_access_students: insert" on parent_access_students
  for insert with check (
    exists (
      select 1 from parent_access pa
      where pa.id = parent_access_students.parent_access_id
        and pa.school_id = current_school_id()
        and current_role_name() in ('fondateur', 'directeur', 'secretaire')
    )
  );
create policy "parent_access_students: delete" on parent_access_students
  for delete using (
    exists (
      select 1 from parent_access pa
      where pa.id = parent_access_students.parent_access_id
        and pa.school_id = current_school_id()
        and current_role_name() in ('fondateur', 'directeur', 'secretaire')
    )
  );

-- Administration de la plateforme (la créatrice de l'app, pas un rôle
-- d'école) : voir toutes les écoles et en supprimer, indépendamment de tout
-- rôle "fondateur"
-- scopé à une seule école. Une simple liste d'utilisateurs autorisés — la
-- lecture/suppression de toutes les écoles passe entièrement par l'Edge
-- Function platform-admin (clé service_role), qui vérifie ici l'appartenance
-- avant d'agir. Le seul droit accordé directement par RLS est de lire SA
-- PROPRE présence dans cette liste (pour que l'app sache afficher le lien
-- "Administration").
create table if not exists platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table platform_admins enable row level security;

create policy "platform_admins: lecture de son propre statut" on platform_admins
  for select using (user_id = auth.uid());

-- Nom / prénom séparés pour les élèves et les parents, en plus de
-- full_name (conservé tel quel pour tout l'affichage existant, composé
-- désormais à la saisie comme "prénom nom"). Nécessaire pour rapprocher de
-- façon fiable un parent existant au nom de famille d'un élève : deviner le
-- nom de famille en prenant le dernier mot d'un champ "nom complet" libre
-- échouait dès que l'ordre de saisie changeait (ex. un parent enregistré
-- "Nom Prénom" au lieu de "Prénom Nom").
alter table students add column if not exists nom text;
alter table students add column if not exists prenom text;
update students set
  prenom = trim(regexp_replace(full_name, '\S+$', '')),
  nom = trim(regexp_replace(full_name, '^.*\s', ''))
where nom is null;
alter table students alter column nom set not null;
alter table students alter column prenom set not null;

alter table parent_access add column if not exists nom text;
alter table parent_access add column if not exists prenom text;
update parent_access set
  prenom = trim(regexp_replace(full_name, '\S+$', '')),
  nom = trim(regexp_replace(full_name, '^.*\s', ''))
where nom is null;
alter table parent_access alter column nom set not null;
alter table parent_access alter column prenom set not null;

-- "statut" (complet/partiel) ne suffisait pas : certaines écoles
-- fonctionnent en 2 ou 3 tranches, un paiement peut être la 1ère, la 2ème,
-- la 3ème tranche, la moitié, ou le complet. Renommé en "tranche" — le nom
-- "statut" ne correspondait plus à ce que le champ représente. Les
-- anciennes valeurs ('complet'/'partiel') restent telles quelles ; 'partiel'
-- n'est plus proposé à la saisie mais reste géré à l'affichage pour les
-- paiements déjà enregistrés avant ce changement.
alter table payments rename column statut to tranche;

-- ---------- Migration : année scolaire, grille tarifaire, inscriptions ----------
-- Jusqu'ici "students" portait directement niveau/montant_du/montant_paye/
-- frais_connexe_* : des informations propres à UNE année scolaire, collées
-- sur la fiche permanente de l'élève. Ça empêchait de distinguer les
-- données d'une année de celles de la suivante (notes, paiements, dû/payé
-- se seraient tous mélangés au premier passage à l'année suivante), et ne
-- permettait aucune grille tarifaire centralisée (le montant dû était
-- retapé à la main à chaque inscription).
--
-- Remplacé par : "school_years" (une ligne par année scolaire, une seule
-- marquée is_current par école), "fee_schedules" (le montant attendu par
-- niveau pour une année donnée), et "enrollments" (une ligne = un élève
-- inscrit dans une classe pour une année scolaire donnée — c'est elle qui
-- porte désormais classe/montant dû/montant payé/frais connexes).
-- payments/grades/attendance_records reçoivent chacun un school_year_id.

create table if not exists school_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  label text not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists school_years_one_current_per_school
  on school_years(school_id) where is_current;
alter table school_years enable row level security;

create policy "school_years: select" on school_years
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
create policy "school_years: insert" on school_years
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
  );
create policy "school_years: update" on school_years
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
  );

create table if not exists fee_schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  school_year_id uuid not null references school_years(id) on delete cascade,
  niveau text not null,
  montant_scolarite numeric not null default 0,
  montant_connexe numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (school_year_id, niveau)
);
alter table fee_schedules enable row level security;

create policy "fee_schedules: select" on fee_schedules
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
create policy "fee_schedules: insert" on fee_schedules
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
  );
create policy "fee_schedules: update" on fee_schedules
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
  );
create policy "fee_schedules: delete" on fee_schedules
  for delete using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
  );

create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  school_year_id uuid not null references school_years(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  classe_id uuid references classes(id) on delete set null,
  montant_du numeric not null default 0,
  montant_paye numeric not null default 0,
  frais_connexe_du numeric not null default 0,
  frais_connexe_paye numeric not null default 0,
  statut text not null default 'inscrit' check (statut in ('inscrit', 'redouble', 'parti')),
  created_at timestamptz not null default now(),
  unique (school_year_id, student_id)
);
create index if not exists enrollments_year_classe_idx on enrollments(school_year_id, classe_id);
alter table enrollments enable row level security;

create policy "enrollments: select" on enrollments
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
create policy "enrollments: insert" on enrollments
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );
create policy "enrollments: update" on enrollments
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );
create policy "enrollments: delete" on enrollments
  for delete using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );

alter table payments add column if not exists school_year_id uuid references school_years(id);
alter table grades add column if not exists school_year_id uuid references school_years(id);
alter table attendance_records add column if not exists school_year_id uuid references school_years(id);
create index if not exists payments_year_idx on payments(school_year_id);
create index if not exists grades_year_idx on grades(school_year_id);
create index if not exists attendance_year_idx on attendance_records(school_year_id);

-- ---------- Bascule des données existantes ----------
-- ⚠️ Remplace '2025-2026' par le libellé réel de l'année scolaire en cours
-- dans TON école avant d'exécuter ce script.

insert into school_years (school_id, label, is_current)
select id, '2025-2026', true from schools
where not exists (select 1 from school_years sy where sy.school_id = schools.id and sy.is_current);

insert into enrollments (school_id, school_year_id, student_id, classe_id, montant_du, montant_paye, frais_connexe_du, frais_connexe_paye)
select s.school_id, sy.id, s.id, c.id, s.montant_du, s.montant_paye, s.frais_connexe_du, s.frais_connexe_paye
from students s
join school_years sy on sy.school_id = s.school_id and sy.is_current
left join classes c on c.school_id = s.school_id and c.nom = s.niveau
where not exists (
  select 1 from enrollments e where e.student_id = s.id and e.school_year_id = sy.id
);

update payments p set school_year_id = sy.id
from school_years sy
where sy.school_id = p.school_id and sy.is_current and p.school_year_id is null;

update grades g set school_year_id = sy.id
from school_years sy
where sy.school_id = g.school_id and sy.is_current and g.school_year_id is null;

update attendance_records a set school_year_id = sy.id
from school_years sy
where sy.school_id = a.school_id and sy.is_current and a.school_year_id is null;

alter table payments alter column school_year_id set not null;
alter table grades alter column school_year_id set not null;
alter table attendance_records alter column school_year_id set not null;

-- students ne garde que l'identité permanente : classe/dû/payé/frais
-- connexes vivent désormais dans "enrollments", propre à chaque année.
alter table students drop column if exists niveau;
alter table students drop column if exists montant_du;
alter table students drop column if exists montant_paye;
alter table students drop column if exists frais_connexe_du;
alter table students drop column if exists frais_connexe_paye;
