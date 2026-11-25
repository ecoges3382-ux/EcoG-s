-- =====================================================================================================================
-- COULEUR PERSONNELLE : chaque utilisateur retrouve sa couleur d'application sur tous ses appareils.
-- =====================================================================================================================
-- Une colonne sur le profil (couleur_perso, au format #RRGGBB). Chaque utilisateur ne peut modifier que la sienne (la règle « modification
-- de son propre profil » existe déjà ; le rôle, l'école et les permissions restent verrouillés). Vide = couleur de l'école.
-- À lancer dans Supabase (SQL Editor). Rejouable sans danger. L'application marche avant comme après.
-- =====================================================================================================================
alter table profiles add column if not exists couleur_perso text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_couleur_perso_format' and conrelid = 'public.profiles'::regclass) then
    alter table profiles add constraint profiles_couleur_perso_format check (couleur_perso is null or couleur_perso ~ '^#[0-9a-fA-F]{6}$');
  end if;
end $$;
