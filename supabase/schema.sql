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

drop policy if exists "school_years: select" on school_years;
create policy "school_years: select" on school_years
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
drop policy if exists "school_years: insert" on school_years;
create policy "school_years: insert" on school_years
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
  );
drop policy if exists "school_years: update" on school_years;
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

drop policy if exists "fee_schedules: select" on fee_schedules;
create policy "fee_schedules: select" on fee_schedules
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
drop policy if exists "fee_schedules: insert" on fee_schedules;
create policy "fee_schedules: insert" on fee_schedules
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
  );
drop policy if exists "fee_schedules: update" on fee_schedules;
create policy "fee_schedules: update" on fee_schedules
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
  );
drop policy if exists "fee_schedules: delete" on fee_schedules;
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

drop policy if exists "enrollments: select" on enrollments;
create policy "enrollments: select" on enrollments
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
drop policy if exists "enrollments: insert" on enrollments;
create policy "enrollments: insert" on enrollments
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );
drop policy if exists "enrollments: update" on enrollments;
create policy "enrollments: update" on enrollments
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );
drop policy if exists "enrollments: delete" on enrollments;
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

-- L'ancien trigger tenait students.montant_paye/frais_connexe_paye à jour
-- automatiquement à partir des paiements réels (voir Migration 6). On le
-- retire avant la bascule ; il est remplacé plus bas par une version qui
-- fait la même chose sur enrollments, une fois cette table en place.
drop trigger if exists trg_recompute_student_paye on payments;
drop function if exists recompute_student_paye();

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

-- Cette règle de sécurité (jamais vraiment utilisée : les parents de
-- l'appli passent par un code d'accès via l'Edge Function "parent-portal",
-- pas par une session Supabase Auth — voir student_guardians, jamais
-- alimentée par le code) lisait encore students.niveau et bloque sinon la
-- suppression de la colonne.
drop policy if exists "announcements: select (parent)" on announcements;

-- students ne garde que l'identité permanente : classe/dû/payé/frais
-- connexes vivent désormais dans "enrollments", propre à chaque année.
alter table students drop column if exists niveau;
alter table students drop column if exists montant_du;
alter table students drop column if exists montant_paye;
alter table students drop column if exists frais_connexe_du;
alter table students drop column if exists frais_connexe_paye;

-- Nouveau trigger, équivalent à l'ancien mais sur enrollments (scopé à
-- l'année scolaire du paiement) : à chaque paiement créé/modifié/supprimé,
-- le dû/payé de l'inscription reste toujours calculé depuis les vraies
-- transactions, jamais modifiable "à la main".
create or replace function recompute_enrollment_paye()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := coalesce(new.student_id, old.student_id);
  v_school_year_id uuid := coalesce(new.school_year_id, old.school_year_id);
begin
  update enrollments set
    montant_paye = coalesce((select sum(montant) from payments where student_id = v_student_id and school_year_id = v_school_year_id and type_frais = 'scolarite'), 0),
    frais_connexe_paye = coalesce((select sum(montant) from payments where student_id = v_student_id and school_year_id = v_school_year_id and type_frais = 'connexe'), 0)
  where student_id = v_student_id and school_year_id = v_school_year_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_recompute_enrollment_paye on payments;
create trigger trg_recompute_enrollment_paye
after insert or update or delete on payments
for each row execute function recompute_enrollment_paye();

-- ---------- Migration : affichage "NOM Prénom" (nom en majuscules) ----------
-- full_name était jusqu'ici stocké "Prénom Nom" tel que saisi. Recalculé ici
-- pour tous les élèves et parents déjà enregistrés à partir de leurs
-- colonnes nom/prenom déjà séparées ; les nouvelles fiches sont créées
-- directement dans ce format côté application.

update students set full_name = trim(upper(nom) || ' ' || prenom);
update parent_access set full_name = trim(upper(nom) || ' ' || prenom);

-- ---------- Migration : Nom/Prénom séparés pour le personnel ----------
-- Même correctif que pour élèves/parents (Migration 5) : "staff" n'avait
-- qu'un champ "Nom complet" libre, saisi "Prénom Nom". Découpage best-effort
-- (dernier mot = nom de famille) pour les fiches déjà créées ; la nouvelle
-- inscription (NewStaffModal) saisit maintenant Nom et Prénom séparément.

alter table staff add column if not exists nom text;
alter table staff add column if not exists prenom text;
update staff set
  prenom = trim(regexp_replace(full_name, '\S+$', '')),
  nom = trim(regexp_replace(full_name, '^.*\s', ''))
where nom is null;
alter table staff alter column nom set not null;
alter table staff alter column prenom set not null;

update staff set full_name = trim(upper(nom) || ' ' || prenom);

-- ---------- Migration : calendrier de paiement + moratoires ----------
-- Délais de paiement des tranches et des frais connexes, identiques pour
-- toute l'école (pas par niveau) : un calendrier par année scolaire. Sert
-- à générer automatiquement la liste des familles "à relancer" (voir
-- src/lib/retard.js côté application) une fois un délai dépassé.
alter table school_years add column if not exists date_tranche1 date;
alter table school_years add column if not exists date_tranche2 date;
alter table school_years add column if not exists date_tranche3 date;
alter table school_years add column if not exists date_connexe date;

-- Note de moratoire par élève pour l'année : une famille qui a négocié un
-- arrangement (ex. payer par mensualités plutôt que par tranches) reste
-- ainsi exclue des relances automatiques tant que la note existe.
alter table enrollments add column if not exists note_arrangement text;

-- ---------- Migration : rôle "censeur" ----------
-- Nouveau rôle de compte utilisateur, pour les écoles qui en ont un.
-- Affiché entre directeur et secrétaire dans "Comptes" (voir sortByRole
-- dans src/lib/utils.js) ; ne porte pour l'instant aucune permission
-- particulière au-delà de celles déjà accordées par les policies
-- existantes (comme "enseignant", il n'apparaît dans aucune liste de
-- rôles autorisés tant que ce n'est pas explicitement demandé).
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('fondateur', 'directeur', 'censeur', 'secretaire', 'enseignant', 'parent'));

-- ---------- Migration : audit sécurité/intégrité — atomicité élève+inscription ----------
-- Jusqu'ici NewStudentModal et l'import CSV faisaient "insert students" puis
-- "insert enrollments" en deux appels séparés depuis le navigateur : si le
-- second échouait (coupure réseau, erreur de contrainte...), l'élève restait
-- créé sans inscription — état incohérent, invisible dans les listes
-- filtrées par année, et source de doublons au nouvel essai.
--
-- Remplacé par deux fonctions RPC "security invoker" (donc soumises à la
-- RLS existante, exactement comme les inserts directs qu'elles remplacent —
-- aucune élévation de privilège) : un appel de fonction est une seule
-- transaction implicite, une erreur à n'importe quelle étape annule tout.

create or replace function create_student_with_enrollment(
  p_school_id uuid,
  p_nom text,
  p_prenom text,
  p_full_name text,
  p_parent_phone text,
  p_photo_url text,
  p_matricule text,
  p_school_year_id uuid,
  p_classe_id uuid,
  p_montant_du numeric,
  p_frais_connexe_du numeric,
  p_existing_parent_access_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  -- school_year_id/classe_id sont des uuid non énumérables (le client ne
  -- peut pas les lire pour une autre école via la RLS), mais rien ne
  -- garantit qu'ils appartiennent bien à p_school_id si jamais l'un d'eux
  -- fuit par un autre canal — la RLS de "enrollments" ne le vérifiait pas
  -- non plus. Vérifié explicitement ici plutôt que de se reposer sur la
  -- seule inaccessibilité pratique des identifiants d'une autre école.
  if not exists (select 1 from school_years sy where sy.id = p_school_year_id and sy.school_id = p_school_id) then
    raise exception 'Année scolaire invalide pour cette école.';
  end if;
  if p_classe_id is not null and not exists (select 1 from classes c where c.id = p_classe_id and c.school_id = p_school_id) then
    raise exception 'Classe invalide pour cette école.';
  end if;

  insert into students (school_id, full_name, nom, prenom, parent_phone, photo_url, matricule)
  values (p_school_id, p_full_name, p_nom, p_prenom, p_parent_phone, p_photo_url, p_matricule)
  returning id into v_student_id;

  insert into enrollments (school_id, school_year_id, student_id, classe_id, montant_du, montant_paye, frais_connexe_du, frais_connexe_paye)
  values (p_school_id, p_school_year_id, v_student_id, p_classe_id, coalesce(p_montant_du, 0), 0, coalesce(p_frais_connexe_du, 0), 0);

  if p_existing_parent_access_id is not null then
    insert into parent_access_students (parent_access_id, student_id)
    values (p_existing_parent_access_id, v_student_id);
  end if;

  return v_student_id;
end;
$$;

grant execute on function create_student_with_enrollment(uuid, text, text, text, text, text, text, uuid, uuid, numeric, numeric, uuid) to authenticated;

-- Import CSV : tout le fichier dans une seule transaction (all-or-nothing).
-- Choix délibéré plutôt qu'un import partiel avec rapport de lignes en
-- échec : les lignes invalides (nom vide, classe non reconnue) sont déjà
-- filtrées côté client AVANT l'appel, donc un échec ici ne peut venir que
-- d'un problème de fond (RLS, contrainte) qui doit bloquer tout le fichier
-- plutôt que produire un import à moitié fait, difficile à corriger à la main.
create or replace function import_students_csv(
  p_school_id uuid,
  p_school_year_id uuid,
  p_rows jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  r record;
  v_count integer := 0;
  v_index integer := 0;
begin
  for r in
    select * from jsonb_to_recordset(p_rows) as x(
      nom text, prenom text, full_name text, matricule text,
      parent_phone text, classe_id uuid, montant_du numeric
    )
  loop
    v_index := v_index + 1;
    begin
      perform create_student_with_enrollment(
        p_school_id, r.nom, r.prenom, r.full_name, r.parent_phone, null, r.matricule,
        p_school_year_id, r.classe_id, r.montant_du, 0, null
      );
    exception when others then
      raise exception 'Ligne % du fichier : %', v_index + 1, sqlerrm;
    end;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function import_students_csv(uuid, uuid, jsonb) to authenticated;

-- ---------- Migration : traçabilité des paiements ----------
-- payments n'avait ni colonne "créé par" ni aucune trace en cas de
-- suppression (autorisée pour fondateur/directeur/secrétaire) : impossible
-- de savoir qui a enregistré ou supprimé une transaction. created_by est
-- posé côté serveur (défaut auth.uid(), jamais fourni par le client) ; la
-- suppression est journalisée par un trigger security definer dans une
-- table que ni la RLS ni aucun rôle applicatif ne permet de modifier —
-- seul le trigger y écrit, donc infalsifiable depuis le client.

alter table payments add column if not exists created_by uuid references profiles(id);
alter table payments alter column created_by set default auth.uid();

create table if not exists payments_audit (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null,
  school_id uuid not null,
  student_id uuid,
  montant numeric,
  type_frais text,
  mode text,
  tranche text,
  date date,
  note text,
  created_by uuid,
  payment_created_at timestamptz,
  action text not null default 'delete',
  performed_by uuid,
  performed_at timestamptz not null default now()
);
alter table payments_audit enable row level security;

drop policy if exists "payments_audit: select" on payments_audit;
create policy "payments_audit: select" on payments_audit
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
  );
-- Volontairement aucune policy insert/update/delete pour authenticated :
-- seul le trigger ci-dessous (security definer, donc hors RLS) y écrit.

create or replace function log_payment_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into payments_audit (
    payment_id, school_id, student_id, montant, type_frais, mode, tranche, date, note,
    created_by, payment_created_at, action, performed_by
  ) values (
    old.id, old.school_id, old.student_id, old.montant, old.type_frais, old.mode, old.tranche, old.date, old.note,
    old.created_by, old.created_at, 'delete', auth.uid()
  );
  return old;
end;
$$;

drop trigger if exists trg_log_payment_deletion on payments;
create trigger trg_log_payment_deletion
before delete on payments
for each row execute function log_payment_deletion();

-- ---------- Migration : idempotence des paiements (anti-doublon) ----------
-- Le bouton "Enregistrer" est déjà désactivé pendant l'envoi côté React,
-- mais ça ne protège pas d'un retry réseau (la requête part une 2e fois
-- alors que la 1re a en fait réussi côté serveur) ni d'un appel direct à
-- l'API. Clé d'idempotence générée une seule fois à l'ouverture du
-- formulaire (voir NewPaymentModal) : une contrainte unique empêche deux
-- lignes de paiement de partager la même clé, donc un retry de la même
-- soumission échoue proprement (23505) plutôt que de créer un doublon —
-- le frontend traite cette erreur précise comme "déjà enregistré".
alter table payments add column if not exists idempotency_key uuid;
create unique index if not exists payments_idempotency_key_uidx
  on payments(idempotency_key) where idempotency_key is not null;

-- ---------- Migration : bucket "documents" privé (URLs signées) ----------
-- Le bucket était public : n'importe qui muni de l'URL y accédait pour
-- toujours, sans jamais repasser par une vérification d'école. Le chemin
-- inclut un UUID v4 non énumérable (pas de fuite par balayage), mais ce
-- n'est pas un vrai contrôle d'accès. Vérifié avant de modifier le Storage :
-- "documents" n'est utilisé QUE par src/pages/Documents.jsx (upload, liste,
-- ouverture, suppression), jamais par le portail parent (parent-portal ne
-- lit jamais cette table) — tous les lecteurs sont déjà des utilisateurs
-- authentifiés de l'appli, donc les URLs signées générées à la volée avec
-- leur propre session (pas de nouvelle Edge Function nécessaire) suffisent.
alter table documents add column if not exists storage_path text;
update documents set storage_path = regexp_replace(file_url, '^.*/object/public/documents/', '')
where storage_path is null and file_url like '%/object/public/documents/%';
alter table documents alter column file_url drop not null;

update storage.buckets set public = false where id = 'documents';

drop policy if exists "documents-bucket: lecture publique" on storage.objects;
drop policy if exists "documents-bucket: lecture par école" on storage.objects;
create policy "documents-bucket: lecture par école" on storage.objects
  for select using (
    bucket_id = 'documents' and (storage.foldername(name))[1] = current_school_id()::text
  );

-- ---------- Migration : anti-brute-force du portail parent ----------
-- Le code d'accès (8 caractères, alphabet de 32 sans caractères ambigus,
-- ~40 bits — voir generateAccessCode dans src/lib/utils.js) résiste déjà à
-- un brute-force aléatoire pur (32^8 ≈ 1,1×10^12 combinaisons), mais
-- l'Edge Function parent-portal est un endpoint public, sans compte, et ne
-- limitait jusqu'ici aucun débit — rien n'empêchait un script de tester des
-- milliers de codes par minute. Ne stocke que les tentatives avec un code
-- INVALIDE (une navigation légitime peut renvoyer le même code correct des
-- dizaines de fois en une session sans jamais compter ici). Lue/écrite
-- uniquement par la clé service_role (l'Edge Function) : RLS activée, sans
-- aucune policy, donc inaccessible à anon/authenticated.
create table if not exists parent_access_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists parent_access_attempts_ip_time_idx on parent_access_attempts (ip, created_at);
alter table parent_access_attempts enable row level security;

-- ---------- Migration : correctifs suite à vérification du lot sécurité ----------
-- Trois trous confirmés par relecture ligne à ligne après le lot précédent
-- (voir le rapport de vérification) : aucun n'a été détecté par du code qui
-- tournait déjà — ils concernent des cas qui n'arrivent jamais via l'appli
-- normale, seulement via un appel direct à l'API construit à la main.

-- 1) payments.created_by falsifiable : DEFAULT auth.uid() ne s'applique que
-- si le client OMET la colonne. Rien n'empêchait un insert direct à l'API
-- d'envoyer explicitement created_by = l'UUID de quelqu'un d'autre, ce qui
-- aurait permis de faire porter une transaction litigieuse sur un tiers —
-- annulant exactement l'objectif de la colonne. Ajout de la vérification
-- dans la policy elle-même : la valeur doit obligatoirement correspondre à
-- l'utilisateur réellement authentifié, qu'elle soit fournie explicitement
-- ou laissée au DEFAULT (les deux aboutissent à la même valeur au moment où
-- la policy est évaluée, donc aucun changement de comportement pour l'appli
-- normale, qui ne renseigne jamais ce champ).
drop policy if exists "payments: insert" on payments;
create policy "payments: insert" on payments
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
    and created_by = auth.uid()
  );

-- 2) Cohérence school_year_id/classe_id : voir la nouvelle version de
-- create_student_with_enrollment ci-dessus (modifiée en place, pas encore
-- exécutée sur une vraie base au moment de ce correctif — cf. rapport).

-- 3) Bucket "documents" : l'ordre des instructions du bloc précédent
-- posait un risque en cas d'exécution interrompue en plein milieu (déjà
-- arrivé sur ce projet par le passé) — le bucket pouvait se retrouver
-- marqué "privé" alors que l'ancienne policy "lecture publique" existait
-- encore, qui reste active tant qu'elle n'est pas supprimée (les policies
-- RLS permissives se combinent en OR, le drapeau "public" du bucket ne
-- court-circuite que la voie d'URL publique anonyme, pas la RLS elle-même
-- sur la voie authentifiée/signée). Rejoué ici dans le bon ordre : la
-- nouvelle policy restrictive doit exister et l'ancienne doit être retirée
-- AVANT de couper la voie publique — ainsi, à chaque étape intermédiaire,
-- l'accès n'est jamais plus large qu'avant ce correctif, seulement égal ou
-- plus restreint. Idempotent (rejouable même si la version précédente du
-- bloc a déjà tourné).
drop policy if exists "documents-bucket: lecture publique" on storage.objects;
drop policy if exists "documents-bucket: lecture par école" on storage.objects;
create policy "documents-bucket: lecture par école" on storage.objects
  for select using (
    bucket_id = 'documents' and (storage.foldername(name))[1] = current_school_id()::text
  );
update storage.buckets set public = false where id = 'documents';

-- ---------- Migration : cohérence multi-école sur payments/grades/attendance_records ----------
-- Audit ciblé demandé après le lot précédent : mêmes principe que le
-- correctif school_year_id/classe_id sur create_student_with_enrollment,
-- mais au niveau RLS pour ces trois tables, en INSERT et en UPDATE quand la
-- policy existe. Jusqu'ici seul school_id (le tenant de la ligne elle-même)
-- était vérifié — rien ne garantissait que student_id/subject_id/
-- school_year_id référencés appartiennent à CE MÊME school_id. Une policy
-- UPDATE sans "with check" explicite reprend automatiquement son "using"
-- pour la nouvelle valeur (comportement Postgres standard) — donc sans ce
-- correctif, un update pouvait réassigner ces colonnes vers une ressource
-- d'une autre école sans qu'aucune vérification ne s'y oppose.
--
-- ⚠️ Cette policy ne revalide PAS les lignes déjà existantes (une policy
-- RLS insert/update n'agit que sur les futures écritures, jamais
-- rétroactivement) : elle n'a donc aucun effet destructeur sur les données
-- actuelles. Avant de l'exécuter, vérifie si des lignes existantes sont
-- déjà incohérentes avec cette requête (elle ne modifie rien, juste un
-- diagnostic) :
--
-- select 'payments' as table_name, p.id from payments p
--   left join students s on s.id = p.student_id and s.school_id = p.school_id
--   left join school_years sy on sy.id = p.school_year_id and sy.school_id = p.school_id
--   where s.id is null or sy.id is null
-- union all
-- select 'grades', g.id from grades g
--   left join students s on s.id = g.student_id and s.school_id = g.school_id
--   left join subjects sub on sub.id = g.subject_id and sub.school_id = g.school_id
--   left join school_years sy on sy.id = g.school_year_id and sy.school_id = g.school_id
--   where s.id is null or sub.id is null or sy.id is null
-- union all
-- select 'attendance_records', a.id from attendance_records a
--   left join students s on s.id = a.student_id and s.school_id = a.school_id
--   left join school_years sy on sy.id = a.school_year_id and sy.school_id = a.school_id
--   where s.id is null or sy.id is null;
--
-- Si cette requête renvoie des lignes, ne les modifie/supprime pas
-- automatiquement — signale-les, elles demandent un arbitrage au cas par
-- cas (donnée corrompue à corriger à la main, ou raison légitime oubliée).

drop policy if exists "payments: insert" on payments;
create policy "payments: insert" on payments
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
    and created_by = auth.uid()
    and exists (select 1 from students s where s.id = payments.student_id and s.school_id = payments.school_id)
    and exists (select 1 from school_years sy where sy.id = payments.school_year_id and sy.school_id = payments.school_id)
  );
-- Pas de policy "payments: update" dans ce schéma (voir Migration 6 :
-- ledger append-only, une correction passe par insert/delete, jamais par
-- update) — rien à durcir ici, conforme à l'intégrité financière voulue.

drop policy if exists "grades: insert" on grades;
create policy "grades: insert" on grades
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
    and exists (select 1 from students s where s.id = grades.student_id and s.school_id = grades.school_id)
    and exists (select 1 from subjects sub where sub.id = grades.subject_id and sub.school_id = grades.school_id)
    and exists (select 1 from school_years sy where sy.id = grades.school_year_id and sy.school_id = grades.school_id)
  );
drop policy if exists "grades: update" on grades;
create policy "grades: update" on grades
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  )
  with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
    and exists (select 1 from students s where s.id = grades.student_id and s.school_id = grades.school_id)
    and exists (select 1 from subjects sub where sub.id = grades.subject_id and sub.school_id = grades.school_id)
    and exists (select 1 from school_years sy where sy.id = grades.school_year_id and sy.school_id = grades.school_id)
  );

drop policy if exists "attendance_records: insert" on attendance_records;
create policy "attendance_records: insert" on attendance_records
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
    and exists (select 1 from students s where s.id = attendance_records.student_id and s.school_id = attendance_records.school_id)
    and exists (select 1 from school_years sy where sy.id = attendance_records.school_year_id and sy.school_id = attendance_records.school_id)
  );
drop policy if exists "attendance_records: update" on attendance_records;
create policy "attendance_records: update" on attendance_records
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  )
  with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
    and exists (select 1 from students s where s.id = attendance_records.student_id and s.school_id = attendance_records.school_id)
    and exists (select 1 from school_years sy where sy.id = attendance_records.school_year_id and sy.school_id = attendance_records.school_id)
  );

-- ---------- Correctif : provision_school ne créait jamais d'année scolaire ----------
-- Toute l'appli (Tableau de bord, Élèves, Argent, ...) attend qu'une ligne
-- school_years avec is_current=true existe pour l'école avant de charger
-- quoi que ce soit (voir useCurrentSchoolYear). Les écoles créées avant la
-- migration "Année scolaire, grille tarifaire, inscriptions" avaient reçu
-- cette ligne via une bascule ponctuelle (script one-off, voir plus haut
-- dans ce fichier) — mais provision_school, utilisée à chaque inscription
-- depuis, n'avait jamais été mise à jour pour la créer elle aussi. Résultat :
-- toute nouvelle école reste bloquée sur "Chargement..." indéfiniment, sans
-- aucune erreur visible. On calcule un libellé par défaut ("2026-2027" style,
-- rentrée en septembre) — modifiable ensuite par le fondateur si besoin.
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
  v_year int;
  v_label text;
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

  v_year := extract(year from now())::int;
  v_label := case
    when extract(month from now())::int >= 9 then v_year::text || '-' || (v_year + 1)::text
    else (v_year - 1)::text || '-' || v_year::text
  end;
  insert into school_years (school_id, label, is_current) values (v_school_id, v_label, true);

  return v_school_id;
end;
$$;

-- Écoles déjà créées entre l'apparition de la table school_years et ce
-- correctif (bloquées sur "Chargement..." faute d'année scolaire) : on leur
-- donne la même année par défaut, sans toucher aux écoles qui en ont déjà une.
insert into school_years (school_id, label, is_current)
select id, '2026-2027', true from schools
where not exists (select 1 from school_years sy where sy.school_id = schools.id and sy.is_current);

-- ---------- Migration : audit architectural — pertes de données par cascade/orphelinage ----------
-- Suite à l'audit "Années scolaires & modèle de données" (P0-2, P1-4, P1-5,
-- P1-6). Ne touche ni à school_years, ni au changement d'année, ni à la RLS
-- déjà validée — uniquement les deux relations FK identifiées comme
-- destructrices et la contrainte d'unicité des présences.
--
-- Les deux blocs ci-dessous localisent le nom réel de la contrainte FK
-- existante via le catalogue système (pg_constraint) plutôt que de deviner
-- le nom auto-généré par Postgres — plus robuste, et surtout rejouable :
-- exécuté une seconde fois, le bloc retrouve la contrainte qu'il vient de
-- créer (elle référence toujours la même table/colonne) et la remplace par
-- une identique, sans erreur ni double contrainte.

-- 1) subjects → grades : ON DELETE CASCADE remplacé par RESTRICT.
-- Avant ce correctif, supprimer une matière supprimait silencieusement
-- toutes les notes jamais saisies pour elle, sur toutes les années — aucune
-- ligne existante n'est touchée par ce changement, seul le comportement
-- d'une FUTURE suppression change (RESTRICT ne s'applique qu'au moment du
-- DELETE, jamais rétroactivement).
do $$
declare
  v_conname text;
begin
  select con.conname into v_conname
  from pg_constraint con
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
  where con.contype = 'f'
    and con.conrelid = 'grades'::regclass
    and con.confrelid = 'subjects'::regclass
    and att.attname = 'subject_id'
  limit 1;

  if v_conname is not null then
    execute format('alter table grades drop constraint %I', v_conname);
  end if;

  alter table grades add constraint grades_subject_id_fkey
    foreign key (subject_id) references subjects(id) on delete restrict;
end $$;

-- 2) classes → enrollments : ON DELETE SET NULL remplacé par RESTRICT.
-- Avant ce correctif, supprimer une classe mettait classe_id = null sur
-- toute inscription (même passée) qui la référençait, faisant perdre
-- silencieusement l'information "quelle classe" pour cet historique. Même
-- principe : aucune ligne existante modifiée, seul le comportement d'une
-- future suppression change.
do $$
declare
  v_conname text;
begin
  select con.conname into v_conname
  from pg_constraint con
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
  where con.contype = 'f'
    and con.conrelid = 'enrollments'::regclass
    and con.confrelid = 'classes'::regclass
    and att.attname = 'classe_id'
  limit 1;

  if v_conname is not null then
    execute format('alter table enrollments drop constraint %I', v_conname);
  end if;

  alter table enrollments add constraint enrollments_classe_id_fkey
    foreign key (classe_id) references classes(id) on delete restrict;
end $$;

-- Vérifié : ce sont les DEUX SEULES références à subjects(id)/classes(id)
-- dans tout le schéma (grep sur "references subjects" / "references
-- classes(") — aucune autre cascade ou set null ne présente le même risque
-- pour ces deux tables.

-- 3) attendance_records : unique(student_id, date) remplacé par
-- unique(student_id, school_year_id, date), cohérent avec le reste du
-- modèle multi-année (enrollments/payments/grades le sont déjà).
--
-- Diagnostic AVANT modification (lecture seule, à exécuter séparément si tu
-- veux vérifier par toi-même) — par construction, ne peut renvoyer aucune
-- ligne : l'ancienne contrainte unique(student_id, date) est STRICTEMENT
-- plus restrictive que la nouvelle (elle porte sur moins de colonnes), donc
-- aucun doublon incompatible ne peut exister pour la nouvelle contrainte :
--
-- select student_id, school_year_id, date, count(*)
-- from attendance_records
-- group by student_id, school_year_id, date
-- having count(*) > 1;
-- -- Attendu : 0 ligne.
do $$
declare
  v_conname text;
begin
  select con.conname into v_conname
  from pg_constraint con
  where con.contype = 'u'
    and con.conrelid = 'attendance_records'::regclass
    and (
      select array_agg(att.attname order by att.attname)
      from unnest(con.conkey) k(attnum)
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
    ) = array['date', 'student_id']::name[]
  limit 1;

  if v_conname is not null then
    execute format('alter table attendance_records drop constraint %I', v_conname);
  end if;
end $$;

create unique index if not exists attendance_records_student_year_date_uidx
  on attendance_records(student_id, school_year_id, date);

-- 4) Index manquants sur school_id : chaque policy RLS de ces tables filtre
-- "school_id = current_school_id()" sur CHAQUE lecture — sans index, c'est
-- un scan complet de la table à l'échelle de plusieurs dizaines/centaines
-- d'écoles. Additif, sans risque, aucune donnée modifiée.
create index if not exists students_school_id_idx on students(school_id);
create index if not exists classes_school_id_idx on classes(school_id);
create index if not exists subjects_school_id_idx on subjects(school_id);
create index if not exists staff_school_id_idx on staff(school_id);
create index if not exists documents_school_id_idx on documents(school_id);
create index if not exists announcements_school_id_idx on announcements(school_id);
create index if not exists expenses_school_id_idx on expenses(school_id);
create index if not exists salary_advances_school_id_idx on salary_advances(school_id);
create index if not exists schedule_entries_school_id_idx on schedule_entries(school_id);
create index if not exists parent_access_school_id_idx on parent_access(school_id);

-- ---------- Migration : cycle de vie des années scolaires (rollover P0-1) ----------
-- Suite de la conception validée. Ne touche pas à classes/subjects (restent
-- permanentes, Option B), ni au portail parent, ni aux paiements/RLS déjà
-- en place au-delà de ce qui est strictement nécessaire ici.

-- 1) school_years : cycle de vie explicite.
-- Toutes les lignes existantes ont aujourd'hui is_current soit true (une
-- par école), soit... en fait jamais false avant ce chantier (aucune école
-- n'a jamais pu avoir plus d'une ligne) — le défaut 'active' est donc
-- correct à 100% pour les données déjà en place, sans backfill à écrire.
alter table school_years add column if not exists statut text not null default 'active'
  check (statut in ('preparation', 'active', 'cloturee'));
alter table school_years add column if not exists date_debut date;
alter table school_years add column if not exists date_fin date;

-- Empêche deux préparations simultanées pour la même école, au niveau base
-- (pas seulement applicatif) — même principe que school_years_one_current_per_school.
create unique index if not exists school_years_one_preparation_per_school
  on school_years(school_id) where statut = 'preparation';

-- 2) Décisions de réinscription, prises pendant la préparation — persistées
-- en base (pas en mémoire navigateur) pour qu'une préparation quittée en
-- cours de route soit reprenable telle quelle. Ce n'est PAS une inscription
-- définitive : "enrollments" n'est créée qu'à l'activation, à partir de ces
-- décisions — jamais un recopiage de l'ancienne inscription.
create table if not exists enrollment_decisions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  school_year_id uuid not null references school_years(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  decision text not null default 'a_traiter' check (decision in ('a_traiter', 'passe', 'redouble', 'part')),
  classe_id uuid references classes(id) on delete set null,
  montant_du numeric not null default 0,
  frais_connexe_du numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  unique (school_year_id, student_id)
);
create index if not exists enrollment_decisions_year_idx on enrollment_decisions(school_year_id);
alter table enrollment_decisions enable row level security;

-- Réservé fondateur/directeur (décision validée), et uniquement pour une
-- année encore en préparation — écrire ici sur une année déjà activée ou
-- clôturée n'a plus de sens.
drop policy if exists "enrollment_decisions: select" on enrollment_decisions;
create policy "enrollment_decisions: select" on enrollment_decisions
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
  );
drop policy if exists "enrollment_decisions: insert" on enrollment_decisions;
create policy "enrollment_decisions: insert" on enrollment_decisions
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
    and exists (select 1 from school_years sy where sy.id = enrollment_decisions.school_year_id and sy.school_id = enrollment_decisions.school_id and sy.statut = 'preparation')
    and exists (select 1 from students s where s.id = enrollment_decisions.student_id and s.school_id = enrollment_decisions.school_id)
    and (enrollment_decisions.classe_id is null or exists (select 1 from classes c where c.id = enrollment_decisions.classe_id and c.school_id = enrollment_decisions.school_id))
  );
drop policy if exists "enrollment_decisions: update" on enrollment_decisions;
create policy "enrollment_decisions: update" on enrollment_decisions
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
  )
  with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
    and exists (select 1 from school_years sy where sy.id = enrollment_decisions.school_year_id and sy.school_id = enrollment_decisions.school_id and sy.statut = 'preparation')
    and exists (select 1 from students s where s.id = enrollment_decisions.student_id and s.school_id = enrollment_decisions.school_id)
    and (enrollment_decisions.classe_id is null or exists (select 1 from classes c where c.id = enrollment_decisions.classe_id and c.school_id = enrollment_decisions.school_id))
  );
drop policy if exists "enrollment_decisions: delete" on enrollment_decisions;
create policy "enrollment_decisions: delete" on enrollment_decisions
  for delete using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
  );

-- 3) Démarrer une préparation. security invoker : soumise à la même RLS
-- qu'un insert direct (aucune élévation de privilège) — le rôle est revérifié
-- ici en plus, seulement pour donner un message clair plutôt qu'une erreur
-- RLS brute. school_id toujours pris de current_school_id(), jamais reçu du
-- client.
create or replace function start_school_year_preparation(
  p_label text,
  p_date_debut date default null,
  p_date_fin date default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_school_id uuid := current_school_id();
  v_new_year_id uuid;
  v_old_year_id uuid;
begin
  if current_role_name() not in ('fondateur', 'directeur') then
    raise exception 'Réservé au fondateur ou au directeur.';
  end if;
  if v_school_id is null then
    raise exception 'Non authentifié.';
  end if;
  if p_label is null or trim(p_label) = '' then
    raise exception 'Le nom de l''année est obligatoire.';
  end if;

  if exists (select 1 from school_years where school_id = v_school_id and statut = 'preparation') then
    raise exception 'Une préparation est déjà en cours pour cette école.';
  end if;

  begin
    insert into school_years (school_id, label, is_current, statut, date_debut, date_fin)
    values (v_school_id, trim(p_label), false, 'preparation', p_date_debut, p_date_fin)
    returning id into v_new_year_id;
  exception when unique_violation then
    -- Deux préparations lancées en même temps (double clic, deux onglets) :
    -- school_years_one_preparation_per_school tranche, le perdant reçoit ce
    -- message plutôt qu'une erreur Postgres brute.
    raise exception 'Une préparation est déjà en cours pour cette école.';
  end;

  -- Pré-remplit une ligne "à traiter" par élève actuellement inscrit (hors
  -- élèves déjà "parti"), pour que l'écran de traitement liste directement
  -- tout le monde sans étape de synchronisation séparée. Ne préjuge d'aucune
  -- décision : classe/montant restent à zéro tant que le personnel ne les a
  -- pas choisis explicitement — jamais un recopiage de l'ancienne inscription.
  select id into v_old_year_id from school_years where school_id = v_school_id and is_current = true;
  if v_old_year_id is not null then
    insert into enrollment_decisions (school_id, school_year_id, student_id, decision)
    select v_school_id, v_new_year_id, e.student_id, 'a_traiter'
    from enrollments e
    where e.school_year_id = v_old_year_id and e.statut <> 'parti'
    on conflict (school_year_id, student_id) do nothing;
  end if;

  return v_new_year_id;
end;
$$;

grant execute on function start_school_year_preparation(text, date, date) to authenticated;

-- 4) Activer une préparation : crée les inscriptions définitives à partir
-- des décisions validées, clôture l'ancienne année, active la nouvelle —
-- tout dans une seule transaction implicite (fonction plpgsql). Un échec à
-- n'importe quelle étape annule tout (aucune activation partielle possible).
create or replace function activate_school_year(p_school_year_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_school_id uuid := current_school_id();
  v_year school_years%rowtype;
  v_old_year_id uuid;
  v_pending_count integer;
  v_incoherent_count integer;
  r record;
begin
  if current_role_name() not in ('fondateur', 'directeur') then
    raise exception 'Réservé au fondateur ou au directeur.';
  end if;
  if v_school_id is null then
    raise exception 'Non authentifié.';
  end if;

  -- Verrou de ligne : sérialise deux tentatives d'activation concurrentes
  -- sur la MÊME année (double clic, deux onglets) — la seconde attend que
  -- la première commite, relit alors statut='active' et échoue proprement
  -- sur la vérification suivante plutôt que de rejouer l'activation.
  select * into v_year from school_years where id = p_school_year_id for update;
  if v_year.id is null or v_year.school_id <> v_school_id then
    raise exception 'Année scolaire introuvable pour cette école.';
  end if;
  if v_year.statut <> 'preparation' then
    raise exception 'Cette année n''est plus en préparation (déjà activée ou clôturée).';
  end if;

  select id into v_old_year_id from school_years where school_id = v_school_id and is_current = true;

  -- Élève de l'ancienne année (encore actif, pas déjà "parti") sans décision
  -- explicite (absente, ou encore 'a_traiter') pour la nouvelle année :
  -- bloque l'activation. Vérifié en base, pas seulement côté frontend.
  if v_old_year_id is not null then
    select count(*) into v_pending_count
    from enrollments old_e
    where old_e.school_year_id = v_old_year_id
      and old_e.statut <> 'parti'
      and coalesce((
        select ed.decision from enrollment_decisions ed
        where ed.school_year_id = p_school_year_id and ed.student_id = old_e.student_id
      ), 'a_traiter') = 'a_traiter';
    if v_pending_count > 0 then
      raise exception 'Il reste % élève(s) à traiter avant l''activation.', v_pending_count;
    end if;
  end if;

  -- Cohérence : un passage ou un redoublement sans classe choisie ne peut
  -- pas devenir une inscription valide (enrollments.classe_id est optionnel
  -- au niveau colonne, mais pas pour ces deux décisions-ci).
  select count(*) into v_incoherent_count
  from enrollment_decisions
  where school_year_id = p_school_year_id
    and decision in ('passe', 'redouble')
    and classe_id is null;
  if v_incoherent_count > 0 then
    raise exception '% décision(s) de passage/redoublement sans classe choisie.', v_incoherent_count;
  end if;

  for r in
    select * from enrollment_decisions
    where school_year_id = p_school_year_id and decision in ('passe', 'redouble')
  loop
    insert into enrollments (
      school_id, school_year_id, student_id, classe_id,
      montant_du, montant_paye, frais_connexe_du, frais_connexe_paye, statut
    ) values (
      v_school_id, p_school_year_id, r.student_id, r.classe_id,
      coalesce(r.montant_du, 0), 0, coalesce(r.frais_connexe_du, 0), 0,
      case when r.decision = 'redouble' then 'redouble' else 'inscrit' end
    )
    on conflict (school_year_id, student_id) do nothing;
    -- on conflict do nothing : permet de rejouer l'activation sans erreur si
    -- elle avait déjà partiellement écrit avant un échec précédent — dans
    -- les faits jamais nécessaire (une seule transaction), gardé par prudence.
  end loop;

  -- L'ancienne année d'abord (is_current=false), la nouvelle ensuite
  -- (is_current=true) : dans cet ordre, l'index partiel unique
  -- school_years_one_current_per_school n'est jamais violé, même
  -- momentanément — c'est lui, pas cette fonction, la protection finale
  -- contre deux années courantes.
  if v_old_year_id is not null then
    update school_years set is_current = false, statut = 'cloturee' where id = v_old_year_id;
  end if;
  update school_years set is_current = true, statut = 'active' where id = p_school_year_id;
end;
$$;

grant execute on function activate_school_year(uuid) to authenticated;

-- ---------- Migration : classification automatique passe/redouble ----------
-- Suite au test du rollover V1 : la décision passe/redouble ne doit pas
-- reposer sur un clic manuel élève par élève (ingérable à l'échelle d'une
-- école de plusieurs centaines d'élèves) — elle doit se déduire
-- automatiquement de la moyenne annuelle de l'élève comparée à un seuil que
-- l'école configure une fois. Un élève reste "à traiter" seulement s'il n'a
-- pas assez de notes pour calculer une moyenne fiable, ou si aucune classe
-- cible n'existe encore — jamais par défaut aveugle.

-- 1) Seuil de passage : réglage permanent par école (pas par année scolaire
-- — la politique de passage change rarement d'une rentrée à l'autre), avec
-- possibilité de override par niveau. niveau = null représente le seuil par
-- défaut de l'école ; une ligne avec un niveau précis le surcharge pour ce
-- niveau seulement. Deux index uniques partiels plutôt qu'un unique(school_id,
-- niveau) classique : NULL n'est jamais égal à NULL pour une contrainte
-- unique standard, ce qui aurait permis plusieurs lignes "par défaut" pour
-- la même école.
create table if not exists passage_thresholds (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  niveau text,
  seuil numeric not null,
  created_at timestamptz not null default now()
);
create unique index if not exists passage_thresholds_default_per_school
  on passage_thresholds(school_id) where niveau is null;
create unique index if not exists passage_thresholds_niveau_per_school
  on passage_thresholds(school_id, niveau) where niveau is not null;
alter table passage_thresholds enable row level security;

drop policy if exists "passage_thresholds: select" on passage_thresholds;
create policy "passage_thresholds: select" on passage_thresholds
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
drop policy if exists "passage_thresholds: insert" on passage_thresholds;
create policy "passage_thresholds: insert" on passage_thresholds
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
  );
drop policy if exists "passage_thresholds: update" on passage_thresholds;
create policy "passage_thresholds: update" on passage_thresholds
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
  )
  with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
  );
drop policy if exists "passage_thresholds: delete" on passage_thresholds;
create policy "passage_thresholds: delete" on passage_thresholds
  for delete using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur')
  );

-- 2) next_niveau : même ordre pédagogique que NIVEAUX côté frontend
-- (src/lib/utils.js) — dupliqué ici volontairement (pas d'import cross-
-- langage possible) ; à maintenir en cohérence si NIVEAUX change un jour.
-- Renvoie null pour 'Tle' (aucun niveau supérieur), comme un accès de
-- tableau hors bornes en Postgres.
create or replace function next_niveau(p_niveau text)
returns text
language sql
immutable
set search_path = public
as $$
  select (array['Maternelle','CI','CP','CE1','CE2','CM1','CM2','6e','5e','4e','3e','2nde','1ere','Tle'])[
    array_position(array['Maternelle','CI','CP','CE1','CE2','CM1','CM2','6e','5e','4e','3e','2nde','1ere','Tle'], p_niveau) + 1
  ]
$$;

-- 3) Moyenne annuelle d'un élève pour une année scolaire donnée : réplique
-- exactement la formule déjà utilisée dans Bulletins (src/pages/Grades.jsx)
-- — moyenne par matière sur chaque trimestre (matières de "niveau" nul
-- comptant pour toutes les classes), pondérée par le coefficient de la
-- matière, puis moyenne des trimestres qui ont effectivement des notes
-- (un trimestre sans aucune note n'est jamais compté comme 0, il est
-- simplement ignoré). Renvoie null si l'élève n'a absolument aucune note
-- sur les 3 trimestres — c'est ce qui déclenche "reste à traiter".
create or replace function student_annual_average(p_student_id uuid, p_school_year_id uuid, p_niveau text)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select avg(per_trimestre.trimestre_moyenne)
  from (
    select
      per_subject.periode,
      sum(per_subject.subject_moyenne * per_subject.coefficient) / nullif(sum(per_subject.coefficient), 0) as trimestre_moyenne
    from (
      select
        g.periode,
        g.subject_id,
        sub.coefficient,
        avg(g.note / g.sur * 20) as subject_moyenne
      from grades g
      join subjects sub on sub.id = g.subject_id
      where g.student_id = p_student_id
        and g.school_year_id = p_school_year_id
        and g.periode in ('Trimestre 1', 'Trimestre 2', 'Trimestre 3')
        and (sub.niveau is null or sub.niveau = p_niveau)
      group by g.periode, g.subject_id, sub.coefficient
    ) per_subject
    group by per_subject.periode
  ) per_trimestre
$$;

-- 4) start_school_year_preparation : remplacée pour classer automatiquement
-- chaque élève au lieu de toujours pré-remplir "à traiter". Reste "à
-- traiter" uniquement si (a) pas assez de notes pour une moyenne fiable, ou
-- (b) passe proposé depuis le niveau le plus élevé (aucun niveau supérieur
-- n'existe). La classe et le montant proposés viennent de la même logique
-- que le bouton de masse déjà existant (niveau cible + classe de même
-- section si possible + grille tarifaire de la nouvelle année) — jamais un
-- recopiage de l'ancienne inscription.
create or replace function start_school_year_preparation(
  p_label text,
  p_date_debut date default null,
  p_date_fin date default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_school_id uuid := current_school_id();
  v_new_year_id uuid;
  v_old_year_id uuid;
  r record;
  v_moyenne numeric;
  v_seuil numeric;
  v_niveau_cible text;
  v_decision text;
  v_classe_id uuid;
  v_montant numeric;
  v_frais numeric;
begin
  if current_role_name() not in ('fondateur', 'directeur') then
    raise exception 'Réservé au fondateur ou au directeur.';
  end if;
  if v_school_id is null then
    raise exception 'Non authentifié.';
  end if;
  if p_label is null or trim(p_label) = '' then
    raise exception 'Le nom de l''année est obligatoire.';
  end if;

  if exists (select 1 from school_years where school_id = v_school_id and statut = 'preparation') then
    raise exception 'Une préparation est déjà en cours pour cette école.';
  end if;

  begin
    insert into school_years (school_id, label, is_current, statut, date_debut, date_fin)
    values (v_school_id, trim(p_label), false, 'preparation', p_date_debut, p_date_fin)
    returning id into v_new_year_id;
  exception when unique_violation then
    raise exception 'Une préparation est déjà en cours pour cette école.';
  end;

  select id into v_old_year_id from school_years where school_id = v_school_id and is_current = true;
  if v_old_year_id is not null then
    for r in
      select e.student_id, c.niveau as niveau_actuel, c.section as section_actuelle
      from enrollments e
      left join classes c on c.id = e.classe_id
      where e.school_year_id = v_old_year_id and e.statut <> 'parti'
    loop
      v_decision := 'a_traiter';
      v_classe_id := null;
      v_montant := 0;
      v_frais := 0;

      if r.niveau_actuel is not null then
        v_moyenne := student_annual_average(r.student_id, v_old_year_id, r.niveau_actuel);
        if v_moyenne is not null then
          v_seuil := coalesce(
            (select seuil from passage_thresholds where school_id = v_school_id and niveau = r.niveau_actuel),
            (select seuil from passage_thresholds where school_id = v_school_id and niveau is null),
            10
          );
          if v_moyenne >= v_seuil then
            v_niveau_cible := next_niveau(r.niveau_actuel);
            v_decision := case when v_niveau_cible is not null then 'passe' else 'a_traiter' end;
          else
            v_niveau_cible := r.niveau_actuel;
            v_decision := 'redouble';
          end if;

          if v_decision in ('passe', 'redouble') then
            select c.id into v_classe_id from classes c
              where c.school_id = v_school_id and c.niveau = v_niveau_cible
              order by (c.section is not distinct from r.section_actuelle) desc, c.nom
              limit 1;
            select fs.montant_scolarite, fs.montant_connexe into v_montant, v_frais
              from fee_schedules fs where fs.school_year_id = v_new_year_id and fs.niveau = v_niveau_cible;
          end if;
        end if;
      end if;

      insert into enrollment_decisions (school_id, school_year_id, student_id, decision, classe_id, montant_du, frais_connexe_du)
      values (v_school_id, v_new_year_id, r.student_id, v_decision, v_classe_id, coalesce(v_montant, 0), coalesce(v_frais, 0))
      on conflict (school_year_id, student_id) do nothing;
    end loop;
  end if;

  return v_new_year_id;
end;
$$;

grant execute on function start_school_year_preparation(text, date, date) to authenticated;

-- Frais de scolarité paramétrables par tranche (1ère/2ème/3ème) dans la
-- grille tarifaire, plutôt qu'un seul montant global. montant_scolarite
-- reste la somme des 3 tranches (recalculée côté frontend à chaque
-- enregistrement) : tout le code existant qui lit montant_scolarite pour
-- pré-remplir enrollments.montant_du (NewStudentModal, PrepareSchoolYear,
-- start_school_year_preparation) continue de fonctionner sans changement.
alter table fee_schedules add column if not exists montant_tranche1 numeric not null default 0;
alter table fee_schedules add column if not exists montant_tranche2 numeric not null default 0;
alter table fee_schedules add column if not exists montant_tranche3 numeric not null default 0;

-- Backfill : les lignes déjà configurées avant l'ajout des tranches avaient
-- seulement montant_scolarite. On verse tout dans la 1ère tranche pour ne
-- pas perdre le montant total déjà saisi — l'école redistribue ensuite si
-- besoin. Condition sur les 3 tranches à 0 : ne touche jamais une ligne
-- déjà répartie par l'école, donc ce bloc reste sûr à ré-exécuter.
update fee_schedules
  set montant_tranche1 = montant_scolarite
  where montant_tranche1 = 0 and montant_tranche2 = 0 and montant_tranche3 = 0 and montant_scolarite > 0;

-- Frais d'inscription (montant fixe, non négociable, par niveau) dans la
-- grille tarifaire — payé en entier à l'inscription ou la réinscription,
-- pas suivi comme un "dû" qui s'étale dans le temps (contrairement à la
-- scolarité) : pas de colonne _du/_paye associée sur enrollments, juste un
-- montant à encaisser en une fois au moment de l'inscription.
alter table fee_schedules add column if not exists montant_inscription numeric not null default 0;

-- Inscription d'un élève : le parent paie souvent sur place au même
-- moment (tout ou partie de la 1ère tranche, plus les frais d'inscription
-- non négociables) — jusqu'ici il fallait rouvrir Argent juste après pour
-- ressaisir ce même paiement séparément. La fonction accepte maintenant ces
-- paiements en paramètres optionnels et les enregistre dans la même
-- transaction que l'élève et son inscription ("security invoker", donc
-- toujours soumis à la RLS de "payments" — aucune élévation de privilège).
--
-- CREATE OR REPLACE FUNCTION ne remplace une fonction en place que si sa
-- liste de types d'arguments est identique à l'ancienne ; avec 4
-- paramètres en plus ici, ce serait sinon une simple surcharge qui laisse
-- l'ancienne version à 12 arguments orpheline en base. D'où le drop
-- explicite de l'ancienne signature avant de recréer — sûr à ré-exécuter
-- (le "if exists" ne trouve plus rien à supprimer dès la 2e fois).
drop function if exists create_student_with_enrollment(uuid, text, text, text, text, text, text, uuid, uuid, numeric, numeric, uuid);

create or replace function create_student_with_enrollment(
  p_school_id uuid,
  p_nom text,
  p_prenom text,
  p_full_name text,
  p_parent_phone text,
  p_photo_url text,
  p_matricule text,
  p_school_year_id uuid,
  p_classe_id uuid,
  p_montant_du numeric,
  p_frais_connexe_du numeric,
  p_existing_parent_access_id uuid default null,
  p_paiement_montant numeric default null,
  p_paiement_tranche text default null,
  p_paiement_mode text default null,
  p_frais_inscription_montant numeric default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  if not exists (select 1 from school_years sy where sy.id = p_school_year_id and sy.school_id = p_school_id) then
    raise exception 'Année scolaire invalide pour cette école.';
  end if;
  if p_classe_id is not null and not exists (select 1 from classes c where c.id = p_classe_id and c.school_id = p_school_id) then
    raise exception 'Classe invalide pour cette école.';
  end if;

  insert into students (school_id, full_name, nom, prenom, parent_phone, photo_url, matricule)
  values (p_school_id, p_full_name, p_nom, p_prenom, p_parent_phone, p_photo_url, p_matricule)
  returning id into v_student_id;

  insert into enrollments (school_id, school_year_id, student_id, classe_id, montant_du, montant_paye, frais_connexe_du, frais_connexe_paye)
  values (p_school_id, p_school_year_id, v_student_id, p_classe_id, coalesce(p_montant_du, 0), 0, coalesce(p_frais_connexe_du, 0), 0);

  if p_existing_parent_access_id is not null then
    insert into parent_access_students (parent_access_id, student_id)
    values (p_existing_parent_access_id, v_student_id);
  end if;

  if p_paiement_montant is not null and p_paiement_montant > 0 then
    insert into payments (school_id, school_year_id, student_id, type_frais, montant, mode, tranche, date)
    values (p_school_id, p_school_year_id, v_student_id, 'scolarite', p_paiement_montant, coalesce(p_paiement_mode, 'especes'), coalesce(p_paiement_tranche, 'complet'), current_date);
  end if;

  if p_frais_inscription_montant is not null and p_frais_inscription_montant > 0 then
    insert into payments (school_id, school_year_id, student_id, type_frais, montant, mode, tranche, date)
    values (p_school_id, p_school_year_id, v_student_id, 'inscription', p_frais_inscription_montant, coalesce(p_paiement_mode, 'especes'), 'complet', current_date);
  end if;

  return v_student_id;
end;
$$;

grant execute on function create_student_with_enrollment(uuid, text, text, text, text, text, text, uuid, uuid, numeric, numeric, uuid, numeric, text, text, numeric) to authenticated;

-- Frais de réinscription (élève déjà inscrit l'année précédente), distinct
-- du frais d'inscription (nouvel élève) — souvent moins cher. Même logique
-- que montant_inscription : montant fixe par niveau, encaissé en une fois,
-- pas de colonne _du/_paye dédiée sur enrollments.
alter table fee_schedules add column if not exists montant_reinscription numeric not null default 0;

-- ---------- Migration : annonces — contenu, statut, ciblage fiable par année ----------
-- Le modèle d'annonce ne portait jusqu'ici qu'un titre, jamais de contenu ;
-- aucun statut (tout était publié immédiatement, pas de brouillon ni
-- d'archivage) ; aucune policy update/delete (aucune modification n'était
-- possible côté base, même si l'écran l'avait permis) ; et le ciblage par
-- classe stockait un nom de classe en texte libre, sans lien avec une
-- année scolaire précise — une classe "CP A" ne contient pas les mêmes
-- élèves d'une année à l'autre, donc une annonce ciblée doit être
-- rattachée à l'année dans laquelle ce ciblage a un sens.
alter table announcements add column if not exists contenu text not null default '';
alter table announcements add column if not exists statut text not null default 'publiee' check (statut in ('brouillon', 'publiee', 'archivee'));
alter table announcements add column if not exists date_expiration date;
alter table announcements add column if not exists school_year_id uuid references school_years(id) on delete set null;
alter table announcements add column if not exists classe_cible_id uuid references classes(id) on delete set null;
alter table announcements add column if not exists created_by uuid references profiles(id);
alter table announcements alter column created_by set default auth.uid();
alter table announcements add column if not exists published_at timestamptz;

-- Les annonces déjà existantes étaient toutes immédiatement visibles :
-- published_at = created_at pour elles (jamais réécrit ensuite, donc sûr à
-- ré-exécuter). classe_cible (texte) reste en base pour l'affichage des
-- anciennes lignes, jamais réalimentée après cette migration.
update announcements set published_at = created_at where statut = 'publiee' and published_at is null;

create index if not exists announcements_school_year_idx on announcements(school_year_id);

-- Publication réservée à fondateur/directeur/secrétaire (même périmètre
-- que les autres actions administratives de l'appli, ex. Comptes/Argent)
-- — un enseignant pouvait jusqu'ici publier librement à toute l'école,
-- ce n'est plus le cas. La lecture (policy "select" existante,
-- non modifiée) reste ouverte à l'enseignant.
drop policy if exists "announcements: insert" on announcements;
create policy "announcements: insert" on announcements
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
    and (classe_cible_id is null or exists (select 1 from classes c where c.id = announcements.classe_cible_id and c.school_id = announcements.school_id))
    and (school_year_id is null or exists (select 1 from school_years sy where sy.id = announcements.school_year_id and sy.school_id = announcements.school_id))
  );

drop policy if exists "announcements: update" on announcements;
create policy "announcements: update" on announcements
  for update using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  )
  with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
    and (classe_cible_id is null or exists (select 1 from classes c where c.id = announcements.classe_cible_id and c.school_id = announcements.school_id))
    and (school_year_id is null or exists (select 1 from school_years sy where sy.id = announcements.school_year_id and sy.school_id = announcements.school_id))
  );

-- Suppression réservée aux brouillons jamais publiés (rien à perdre pour
-- personne) — une annonce déjà publiée ou archivée se retire seulement en
-- l'archivant, pour garder l'historique consultable (voir Argent/Bulletins
-- : même principe déjà établi ailleurs dans l'appli).
drop policy if exists "announcements: delete" on announcements;
create policy "announcements: delete" on announcements
  for delete using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
    and statut = 'brouillon'
  );

-- ---------- WhatsApp Business : configuration par école + historique ----------
-- Canal de communication optionnel, découplé du reste d'EcoGès : aucune
-- autre table/fonction n'en dépend, seul le contenu (élève, paiement,
-- annonce déjà existants) est lu pour construire les messages.
--
-- whatsapp_configs porte le jeton d'accès Meta (access_token) — un secret
-- réel, pas seulement une donnée "privée". Volontairement AUCUNE policy RLS
-- n'est créée sur cette table : RLS activée + zéro policy = accès refusé
-- par défaut à anon ET authenticated, quel que soit le rôle, y compris le
-- fondateur de l'école propriétaire. Seul service_role (donc uniquement les
-- Edge Functions whatsapp-config et whatsapp-send, jamais le navigateur)
-- contourne RLS et peut lire/écrire cette table. C'est ce qui garantit
-- qu'une école ne peut ni lire ni halluciner la configuration d'une autre :
-- même en cas de bug côté client, aucune requête directe vers cette table
-- ne peut jamais aboutir.
create table if not exists whatsapp_configs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references schools(id) on delete cascade,
  provider text not null default 'meta_cloud_api' check (provider in ('meta_cloud_api')),
  phone_number_id text,
  waba_id text,
  display_phone_number text,
  access_token text,
  -- { "relance_paiement": {"name": "...", "lang": "fr"}, "echeance": {...},
  --   "annonce": {...}, "vie_scolaire": {...}, "message_individuel": {...} }
  -- Noms de templates déjà approuvés côté Meta Business Manager par
  -- l'école — EcoGès ne crée ni n'approuve aucun template lui-même.
  templates jsonb not null default '{}'::jsonb,
  quota_quotidien integer not null default 200,
  statut text not null default 'non_configure' check (statut in ('non_configure', 'actif', 'erreur')),
  derniere_erreur text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table whatsapp_configs enable row level security;

create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  parent_access_id uuid references parent_access(id) on delete set null,
  student_id uuid references students(id) on delete set null,
  announcement_id uuid references announcements(id) on delete set null,
  type text not null check (type in ('relance_paiement', 'echeance', 'annonce', 'vie_scolaire', 'message_individuel')),
  destinataire_phone text not null,
  contenu text,
  template_name text,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'envoye', 'livre', 'lu', 'echec')),
  provider_message_id text,
  erreur text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists whatsapp_messages_school_created_idx on whatsapp_messages(school_id, created_at desc);
create index if not exists whatsapp_messages_student_idx on whatsapp_messages(student_id);
-- Recherche par id fournisseur : c'est la seule clé fournie par un webhook
-- entrant pour retrouver la ligne à mettre à jour (jamais un school_id fourni
-- par le webhook lui-même, qui n'est pas fiable).
create index if not exists whatsapp_messages_provider_message_id_idx on whatsapp_messages(provider_message_id);

alter table whatsapp_messages enable row level security;

-- Lecture directe (historique) ouverte au personnel habilité de la même
-- école — même périmètre que les autres actions administratives
-- (Comptes/Argent/Annonces). Volontairement AUCUNE policy insert/update
-- pour authenticated : seule whatsapp-send (service_role) écrit ici, pour
-- garantir que le statut vient réellement du fournisseur et jamais d'une
-- prétention du frontend ("la requête est partie" ne veut pas dire "envoyé").
drop policy if exists "whatsapp_messages: select" on whatsapp_messages;
create policy "whatsapp_messages: select" on whatsapp_messages
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );

-- ---------- Documents imprimables : identité complète de l'établissement ----------
-- Les documents imprimés (bulletin, reçu, situation financière) ont besoin
-- de plus que le nom/logo déjà présents sur schools — adresse/téléphone/
-- email pour un en-tête institutionnel correct. Déjà couvertes par la
-- policy "schools: le fondateur modifie son école" (update ligne entière,
-- pas colonne par colonne) — aucune nouvelle policy nécessaire.
alter table schools add column if not exists adresse text;
alter table schools add column if not exists telephone text;
alter table schools add column if not exists email text;

-- ---------- Dashboard de direction : moyenne par classe, agrégée serveur ----------
-- Le dashboard a besoin de la moyenne générale par classe pour une année
-- scolaire — la calculer élève par élève côté navigateur obligerait à
-- rapatrier toutes les notes de l'école. Cette fonction reste security
-- invoker : elle ne fait qu'appeler student_annual_average (déjà la seule
-- source de vérité pour une moyenne annuelle, utilisée aussi par le
-- rollover) à l'intérieur d'une requête groupée par classe, sans jamais
-- dupliquer sa logique. Étant security invoker, les policies RLS
-- (enrollments/classes/grades/subjects, déjà limitées à current_school_id())
-- s'appliquent normalement selon le rôle de l'appelant — un enseignant qui
-- peut déjà lire les notes de son école ailleurs dans l'appli obtient le
-- même résultat ici, jamais plus. Les filtres school_id explicites
-- ci-dessous sont une redondance volontaire avec RLS, pas un contournement.
create or replace function dashboard_class_results(p_school_year_id uuid)
returns table(classe_id uuid, classe_nom text, effectif bigint, nb_avec_notes bigint, moyenne_generale numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id as classe_id,
    c.nom as classe_nom,
    count(e.id) as effectif,
    count(m.moyenne) as nb_avec_notes,
    avg(m.moyenne) as moyenne_generale
  from enrollments e
  join classes c on c.id = e.classe_id
  join school_years sy on sy.id = e.school_year_id
  left join lateral (
    select student_annual_average(e.student_id, e.school_year_id, c.niveau) as moyenne
  ) m on true
  where e.school_year_id = p_school_year_id
    and sy.school_id = current_school_id()
    and c.school_id = current_school_id()
  group by c.id, c.nom
  order by c.nom
$$;

grant execute on function dashboard_class_results(uuid) to authenticated;

-- ---------- Personnel : statut, salaires, avances ----------
-- Jusqu'ici "staff" n'avait ni statut ni salaire : un départ se traduisait
-- par une suppression pure (delete), qui aurait aussi supprimé — via le
-- on delete cascade de salary_advances.staff_id — tout l'historique de ses
-- avances sur salaire. On remplace la suppression par un statut actif/
-- inactif (jamais de perte d'historique financier) et on protège la
-- référence côté avances (cascade → restrict, comme déjà fait pour
-- subjects→grades et classes→enrollments).
alter table staff add column if not exists statut text not null default 'actif';
alter table staff add column if not exists date_entree date;
alter table staff add column if not exists salaire_mensuel numeric;

-- staff_salaries : le journal des salaires réellement versés, sur le même
-- principe que "payments" pour l'écolage (jamais un solde recalculé à la
-- main : chaque versement est une ligne, le total se somme). Écriture
-- réservée à fondateur/directeur/secrétaire — même périmètre que les
-- policies "payments: insert/delete" déjà en place, jamais l'enseignant
-- pour un mouvement d'argent réel (à la différence d'une simple DEMANDE
-- d'avance ci-dessous, elle laissée ouverte à tous comme aujourd'hui).
create table if not exists staff_salaries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete restrict,
  school_year_id uuid references school_years(id),
  montant numeric not null,
  mois text not null,
  date date not null default current_date,
  mode text not null default 'especes',
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists staff_salaries_staff_idx on staff_salaries(staff_id);
create index if not exists staff_salaries_year_idx on staff_salaries(school_year_id);
alter table staff_salaries enable row level security;

drop policy if exists "staff_salaries: select" on staff_salaries;
create policy "staff_salaries: select" on staff_salaries
  for select using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire', 'enseignant')
  );
drop policy if exists "staff_salaries: insert" on staff_salaries;
create policy "staff_salaries: insert" on staff_salaries
  for insert with check (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
    and created_by = auth.uid()
    and exists (select 1 from staff st where st.id = staff_salaries.staff_id and st.school_id = staff_salaries.school_id)
    and (staff_salaries.school_year_id is null or exists (
      select 1 from school_years sy where sy.id = staff_salaries.school_year_id and sy.school_id = staff_salaries.school_id
    ))
  );
drop policy if exists "staff_salaries: delete" on staff_salaries;
create policy "staff_salaries: delete" on staff_salaries
  for delete using (
    school_id = current_school_id()
    and current_role_name() in ('fondateur', 'directeur', 'secretaire')
  );
-- Pas de policy update : ledger append-only, comme "payments" (une
-- correction passe par un nouvel insert et/ou une suppression, jamais une
-- modification silencieuse d'une ligne déjà versée).

-- salary_advances : rattachement à une année scolaire (pour les rapports
-- annuels), motif facultatif, et remboursement — jusqu'ici "solde" était
-- figé au montant de la demande dès la création, jamais redécrémenté nulle
-- part dans le code : un remboursement partiel n'avait aucun moyen d'être
-- enregistré.
alter table salary_advances add column if not exists school_year_id uuid references school_years(id);
alter table salary_advances add column if not exists motif text;
alter table salary_advances add column if not exists montant_rembourse numeric not null default 0;

create or replace function recompute_advance_solde()
returns trigger
language plpgsql
as $$
begin
  new.solde := new.montant - coalesce(new.montant_rembourse, 0);
  return new;
end;
$$;
drop trigger if exists trg_recompute_advance_solde on salary_advances;
create trigger trg_recompute_advance_solde
before insert or update on salary_advances
for each row execute function recompute_advance_solde();

-- expenses : même rattachement à une année scolaire, pour pouvoir les
-- inclure dans les rapports annuels (masse salariale + dépenses) sans
-- mélanger les années entre elles.
alter table expenses add column if not exists school_year_id uuid references school_years(id);

create index if not exists salary_advances_year_idx on salary_advances(school_year_id);
create index if not exists expenses_year_idx on expenses(school_year_id);

-- Bascule des données existantes : comme pour payments/grades/attendance_records
-- (Migration "Année scolaire"), on rattache les avances et dépenses déjà
-- enregistrées à l'année scolaire actuellement en cours de chaque école —
-- ces deux tables n'ont jamais eu de notion d'année avant aujourd'hui, donc
-- l'année en cours est la meilleure estimation possible sans historique.
update salary_advances a set school_year_id = sy.id
from school_years sy
where sy.school_id = a.school_id and sy.is_current and a.school_year_id is null;

update expenses e set school_year_id = sy.id
from school_years sy
where sy.school_id = e.school_id and sy.is_current and e.school_year_id is null;

-- staff_id sur salary_advances : cascade → restrict, pour qu'un archivage
-- (nouveau statut ci-dessus) ou malgré tout une suppression d'un membre du
-- personnel ne puisse plus jamais emporter silencieusement son historique
-- d'avances (même correctif déjà appliqué à subjects→grades et
-- classes→enrollments — voir Migration "audit sécurité/intégrité").
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'salary_advances'::regclass
    and confrelid = 'staff'::regclass
    and contype = 'f'
  limit 1;

  if v_conname is not null then
    execute format('alter table salary_advances drop constraint %I', v_conname);
  end if;

  alter table salary_advances add constraint salary_advances_staff_id_fkey
    foreign key (staff_id) references staff(id) on delete restrict;
end $$;

-- ---------- Administration plateforme : statut des écoles ----------
-- Jusqu'ici une école n'avait aucun statut : le seul levier de
-- l'administrateur de la plateforme (PlatformAdmin.jsx) était une
-- suppression complète et immédiate, irréversible, sans étape intermédiaire
-- — le même problème que "staff" avant son propre statut actif/inactif
-- (voir migration "Personnel" ci-dessus), en pire (ça supprime aussi tous
-- les comptes Supabase Auth du personnel). On ajoute un statut de cycle de
-- vie, et la suppression définitive n'est plus possible que sur une école
-- déjà suspendue.
--
-- 'essai'/'actif' se comportent IDENTIQUEMENT aujourd'hui (aucune logique
-- de facturation ni d'expiration d'essai n'existe encore) — la distinction
-- n'est là que pour que l'administrateur puisse déjà classer ses écoles.
-- 'note_administrative' est un champ libre pour l'admin plateforme (plan
-- convenu, contact, motif de suspension...), jamais visible ni modifiable
-- par l'école elle-même.
alter table schools add column if not exists statut text not null default 'actif';
alter table schools drop constraint if exists schools_statut_check;
alter table schools add constraint schools_statut_check
  check (statut in ('essai', 'actif', 'suspendu', 'resilie'));
alter table schools add column if not exists note_administrative text;

-- current_school_id() est la fonction "security definer" que TOUTES les
-- policies RLS de l'application appellent (school_id = current_school_id()),
-- directement ou via current_role_name()/les fonctions qui en dépendent —
-- la faire renvoyer NULL pour un utilisateur dont l'école est suspendue ou
-- résiliée coupe donc IMMÉDIATEMENT tout accès à TOUTES les tables de
-- l'application pour cette école, sans modifier une seule autre policy.
-- Un school_id ne peut jamais valoir NULL (comparaison toujours fausse),
-- donc "= current_school_id()" échoue partout pour ce compte.
create or replace function current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.school_id
  from profiles p
  join schools s on s.id = p.school_id
  where p.id = auth.uid() and s.statut not in ('suspendu', 'resilie')
$$;

-- ---------- Administration plateforme : journal d'activité, comptes admin ----------
-- Un administrateur de la plateforme peut désormais suspendre/réactiver/
-- supprimer une école, se connecter à la place d'un compte, ou générer un
-- lien de réinitialisation de mot de passe (voir Edge Function
-- platform-admin) — aucune de ces actions n'était tracée nulle part. On
-- journalise systématiquement qui a fait quoi, quand, sur quelle école.
--
-- school_name/target_label sont des COPIES figées au moment de l'action
-- (pas juste des FK) : si l'école ou le compte visé est supprimé plus tard,
-- la ligne de journal reste lisible au lieu de pointer dans le vide.
create table if not exists platform_admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  school_id uuid references schools(id) on delete set null,
  school_name text,
  target_profile_id uuid references profiles(id) on delete set null,
  target_label text,
  details text,
  created_at timestamptz not null default now()
);
create index if not exists platform_admin_actions_created_idx on platform_admin_actions(created_at desc);
alter table platform_admin_actions enable row level security;

-- Lecture ouverte à TOUT administrateur de la plateforme (pas seulement
-- l'auteur de chaque ligne) — c'est un journal d'oversight mutuel, pas un
-- historique personnel. Écriture : uniquement l'Edge Function (service_role),
-- jamais authenticated — même un platform_admin ne doit jamais pouvoir
-- écrire directement une ligne de journal depuis le navigateur, ce qui
-- viderait son utilité de preuve.
create policy "platform_admin_actions: lecture par un admin plateforme" on platform_admin_actions
  for select using (exists (select 1 from platform_admins pa where pa.user_id = auth.uid()));

-- Résolution e-mail → uuid pour ajouter un administrateur de plateforme par
-- e-mail (la personne doit déjà avoir un compte EcoGès) — auth.users n'est
-- lisible directement par aucun rôle, donc en passant par une fonction
-- security definer, comme le reste des accès à auth.users dans ce fichier
-- (provision_school, etc.). Exécution volontairement PAS ouverte à
-- "authenticated" : seule l'Edge Function platform-admin (via service_role,
-- qui n'est pas soumis à ces grants) doit pouvoir l'appeler — sinon
-- n'importe quel compte pourrait vérifier si un e-mail donné est inscrit et
-- récupérer son uuid.
create or replace function find_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;
revoke execute on function find_user_id_by_email(text) from public;
grant execute on function find_user_id_by_email(text) to service_role;

-- ---------- Création d'un compte administrateur, indépendante d'une école ----------
-- Jusqu'ici le seul moyen de créer un compte avec mot de passe était
-- "Créer une école" (SignUp.jsx) — un administrateur de la plateforme
-- n'avait donc pas d'autre choix que d'être aussi fondateur d'une école
-- fantôme (voir la migration précédente qui masque ces écoles-artefacts).
-- On sépare complètement les deux : un compte administrateur se crée sur
-- un écran dédié (/inscription-administrateur), protégé par un code à usage
-- unique — même principe que les codes d'accès parent (parent_access),
-- même alphabet (voir generateAccessCode dans src/lib/utils.js), généré
-- côté client par un administrateur déjà en place puis communiqué hors
-- système (téléphone, WhatsApp...) à la personne à inviter.
create table if not exists platform_admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);
alter table platform_admin_invites enable row level security;

-- Lecture/création/révocation : réservées aux administrateurs de la
-- plateforme déjà en place — même garde que partout ailleurs dans
-- PlatformAdmin.jsx. Pas de policy "update" pour authenticated : seule
-- l'Edge Function platform-admin-signup (service_role) marque une
-- invitation "used_at" au moment de la création du compte, jamais le
-- client — une invitation consommée doit rester la preuve fiable qu'un
-- compte a bien été créé par ce chemin, pas une simple déclaration.
create policy "platform_admin_invites: lecture par un admin plateforme" on platform_admin_invites
  for select using (exists (select 1 from platform_admins pa where pa.user_id = auth.uid()));
create policy "platform_admin_invites: création par un admin plateforme" on platform_admin_invites
  for insert with check (
    exists (select 1 from platform_admins pa where pa.user_id = auth.uid())
    and created_by = auth.uid()
  );
create policy "platform_admin_invites: révocation par un admin plateforme" on platform_admin_invites
  for delete using (exists (select 1 from platform_admins pa where pa.user_id = auth.uid()));

-- ---------- Préparation production : index manquants sur les FK les plus interrogées ----------
-- payments/grades/enrollments n'avaient qu'un index sur school_year_id —
-- suffisant pour les écrans annuels agrégés (Dashboard, Rapports), mais pas
-- pour les lectures PAR ÉLÈVE (fiche élève, bulletin, portail parent),
-- exécutées à chaque ouverture de ces écrans et qui filtrent d'abord par
-- student_id. enrollments a bien un index unique, mais sur
-- (school_year_id, student_id) : school_year_id en tête ne sert à rien à
-- une requête qui ne filtre que par student_id (ex. Reports.jsx,
-- effectifsMouvement ; parent-portal, liste des années d'un élève).
create index if not exists payments_student_idx on payments(student_id);
create index if not exists grades_student_idx on grades(student_id);
create index if not exists enrollments_student_idx on enrollments(student_id);

-- ---------- Préparation production : anti-abus sur la création de compte admin ----------
-- platform-admin-signup est un endpoint public (aucune session requise,
-- comme parent-portal) qui crée de vrais comptes Supabase Auth à partir
-- d'un code à 8 caractères — sans protection, il était exposé au même
-- risque de brute-force que parent-portal avant son propre rate-limiting,
-- en pire (un succès crée un compte réel au lieu de juste révéler des
-- données). Même mécanisme, même seuils, que parent_access_attempts :
-- seules les tentatives à CODE INVALIDE comptent (un vrai code, même
-- retenté par erreur, ne pénalise jamais son destinataire légitime).
create table if not exists platform_admin_signup_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists platform_admin_signup_attempts_ip_time_idx on platform_admin_signup_attempts (ip, created_at);
alter table platform_admin_signup_attempts enable row level security;
-- Aucune policy : ni lecture ni écriture pour authenticated/anon — cette
-- table n'est manipulée que par platform-admin-signup via service_role,
-- exactement comme parent_access_attempts.
