// Création d'un compte : créer aussi la fiche du personnel, reliée au compte.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../src/lib/supabase.js', () => ({ supabase: {} }));
const { ficheDepuisCompte, nextMatricule, creerFicheDepuisCompte, ROLE_FICHE } = await import('../src/lib/ficheDepuisCompte.js');

const base = { schoolId: 'S', profileId: 'P', email: 'dorcas@x.bj', phone: '+2290197000001', existingStaff: [] };

describe('fiche depuis un compte', () => {
  it('Dorcas ALIMATIN, secrétaire : nom de famille en majuscules détecté, rôle écrit comme sur les fiches, reliée au compte', () => {
    const f = ficheDepuisCompte({ ...base, fullName: 'Dorcas ALIMATIN', role: 'secretaire' });
    expect(f).toMatchObject({ school_id: 'S', profile_id: 'P', full_name: 'ALIMATIN Dorcas', nom: 'ALIMATIN', prenom: 'Dorcas', role: 'Secrétaire', email: 'dorcas@x.bj', phone: '+2290197000001', classes: [] });
    expect(f.matricule).toBe('SEC-0001');
  });
  it('« ALIMATIN Dorcas » donne le même résultat (ordre des mots libre)', () => {
    expect(ficheDepuisCompte({ ...base, fullName: 'ALIMATIN Dorcas', role: 'secretaire' }).full_name).toBe('ALIMATIN Dorcas');
  });
  it('nom sans majuscules : le premier mot est le nom de famille', () => {
    const f = ficheDepuisCompte({ ...base, fullName: 'Koffi Agossou', role: 'enseignant' });
    expect(f.nom).toBe('Koffi');
    expect(f.prenom).toBe('Agossou');
  });
  it('un seul mot (ex. « Rey ») : nom seul, sans planter', () => {
    const f = ficheDepuisCompte({ ...base, fullName: 'Rey', role: 'directeur' });
    expect(f).toMatchObject({ nom: 'Rey', prenom: '', full_name: 'REY', role: 'Directeur' });
  });
  it('tous les rôles de compte ont un rôle de fiche', () => {
    for (const r of ['directeur', 'censeur', 'secretaire', 'enseignant']) expect(ROLE_FICHE[r]).toBeTruthy();
  });
  it('matricule suivant : compte les fiches du même rôle', () => {
    expect(nextMatricule([{ role: 'Secrétaire' }, { role: 'Secrétaire' }, { role: 'Enseignant' }], 'Secrétaire')).toBe('SEC-0003');
    expect(nextMatricule([], 'Enseignant')).toBe('ENS-0001');
    expect(nextMatricule(undefined, 'Inconnu')).toBe('PER-0001');
  });
});

describe('création de la fiche', () => {
  function client({ erreur = null, roles = [{ role: 'Secrétaire' }] } = {}) {
    const insertions = [];
    return {
      insertions,
      from: () => ({
        select: async () => ({ data: roles, error: null }),
        insert: async (ligne) => { insertions.push(ligne); return { error: erreur }; },
      }),
    };
  }
  it('enregistre la fiche avec le bon matricule et le lien vers le compte', async () => {
    const c = client();
    const r = await creerFicheDepuisCompte(c, { schoolId: 'S', profileId: 'P', fullName: 'Dorcas ALIMATIN', role: 'secretaire', email: 'd@x.bj', phone: '' });
    expect(r).toEqual({ ok: true });
    expect(c.insertions[0]).toMatchObject({ profile_id: 'P', matricule: 'SEC-0002', full_name: 'ALIMATIN Dorcas' });
  });
  it('échec d\'enregistrement : rendu sans lever d\'exception (le compte existe déjà)', async () => {
    const r = await creerFicheDepuisCompte(client({ erreur: { message: 'forfait' } }), { schoolId: 'S', profileId: 'P', fullName: 'A B', role: 'enseignant' });
    expect(r.ok).toBe(false);
  });
});

describe('code', () => {
  const lire = (f) => fs.readFileSync(path.resolve(import.meta.dirname, '..', f), 'utf8');
  it('le formulaire de compte propose la fiche à la création seulement, et seulement si le forfait inclut le personnel', () => {
    const s = lire('src/components/accounts/StaffAccountsTab.jsx');
    expect(s).toMatch(/const peutCreerFiche = !isEditing && hasFeature\(profile\?\.schools\?\.plan \|\| 'decouverte', 'personnel'\);/);
    expect(s).toMatch(/Créer aussi sa fiche du personnel/);
    expect(s).toMatch(/else if \(peutCreerFiche && creerFiche && data\?\.profile_id\)/);
  });
  it('rien n\'est créé si le serveur a déjà relié le compte à une fiche existante (pas de doublon)', () => {
    const s = lire('src/components/accounts/StaffAccountsTab.jsx');
    expect(s.indexOf('data?.fiche_reliee')).toBeLessThan(s.indexOf('peutCreerFiche && creerFiche'));
  });
  it('la fonction serveur annonce le compte créé et si une fiche existante a été reliée', () => {
    const s = lire('supabase/functions/manage-staff-account/index.ts');
    expect(s).toMatch(/return jsonResponse\(\{ ok: true, profile_id: created\.user\.id, fiche_reliee: ficheReliee \}\)/);
  });
  it('le formulaire du personnel utilise le même calcul de matricule (une seule règle)', () => {
    expect(lire('src/components/NewStaffModal.jsx')).toMatch(/import \{ nextMatricule \} from '\.\.\/lib\/ficheDepuisCompte\.js'/);
  });
});

describe('bouton « Créer la fiche » (comptes existants)', () => {
  const lire = (f) => fs.readFileSync(path.resolve(import.meta.dirname, '..', f), 'utf8');
  it('visible seulement pour le fondateur, si le forfait inclut le personnel, une fois la liste lue, et si le compte n\'a pas de fiche', () => {
    const s = lire('src/components/accounts/StaffAccountsTab.jsx');
    expect(s).toMatch(/peutCreerFiche=\{isFondateur && hasFeature\(profile\?\.schools\?\.plan \|\| 'decouverte', 'personnel'\)\}/);
    expect(s).toMatch(/const afficherCreerFiche = peutCreerFiche && pret && !ficheId && account\.role !== 'parent';/);
  });
  it('les écrans se remettent à jour quand le personnel change', () => {
    const s = lire('src/lib/fichePersonnel.js');
    expect(s).toMatch(/abonnes\.forEach\(\(recharger\) => recharger\(\)\)/);
    expect(s).toMatch(/abonnes\.delete\(charger\)/); // pas de fuite : l'abonnement est retiré au démontage
  });
});
