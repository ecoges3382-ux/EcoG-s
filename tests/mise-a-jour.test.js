// Mise à jour de l'application : quand chercher une nouvelle version, et que le signal envoyé par GitHub corresponde bien à
// ce qu'écoute l'application.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CANAL_VERSION, EVENEMENT_DEPLOIEMENT, DELAI_VERIFICATION, DELAI_RAPPEL, ECART_MINIMUM, DELAIS_APRES_SIGNAL,
  creerVerificateur, planifierApresSignal,
} from '../src/lib/miseAJour.js';

describe('vérificateur de nouvelle version', () => {
  it('demande une mise à jour au service worker', async () => {
    const update = vi.fn().mockResolvedValue();
    const verifier = creerVerificateur({ donneInscription: () => ({ update }), maintenant: () => 1000 });
    expect(await verifier()).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien tant que le service worker n\'est pas inscrit', async () => {
    const verifier = creerVerificateur({ donneInscription: () => null });
    expect(await verifier()).toBe(false);
    expect(await verifier({ force: true })).toBe(false);
  });

  it('deux demandes rapprochées (retour au premier plan + réseau retrouvé) ne font qu\'une vérification', async () => {
    let t = 10_000;
    const update = vi.fn().mockResolvedValue();
    const verifier = creerVerificateur({ donneInscription: () => ({ update }), maintenant: () => t });
    await verifier();
    t += ECART_MINIMUM - 1;
    await verifier();
    expect(update).toHaveBeenCalledTimes(1);
    t += 2;
    await verifier();
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('« force » passe outre l\'écart minimum (signal de déploiement)', async () => {
    const update = vi.fn().mockResolvedValue();
    const verifier = creerVerificateur({ donneInscription: () => ({ update }), maintenant: () => 5000 });
    await verifier();
    await verifier({ force: true });
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('une erreur (hors connexion) ne casse rien et la vérification suivante est tentée', async () => {
    let t = 0;
    const update = vi.fn().mockRejectedValueOnce(new Error('réseau coupé')).mockResolvedValue();
    const verifier = creerVerificateur({ donneInscription: () => ({ update }), maintenant: () => t });
    expect(await verifier()).toBe(false);
    t += ECART_MINIMUM + 1;
    expect(await verifier()).toBe(true);
    expect(update).toHaveBeenCalledTimes(2);
  });
});

describe('vérifications après un signal de déploiement', () => {
  it('cherche tout de suite (forcé), puis encore deux fois', () => {
    vi.useFakeTimers();
    const verifier = vi.fn();
    planifierApresSignal(verifier);
    expect(verifier).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(verifier).toHaveBeenCalledTimes(1);
    expect(verifier).toHaveBeenLastCalledWith({ force: true });
    vi.advanceTimersByTime(DELAIS_APRES_SIGNAL[2]);
    expect(verifier).toHaveBeenCalledTimes(DELAIS_APRES_SIGNAL.length);
    vi.useRealTimers();
  });

  it('un nouveau signal peut annuler les vérifications en attente', () => {
    vi.useFakeTimers();
    const verifier = vi.fn();
    const annuler = planifierApresSignal(verifier);
    vi.advanceTimersByTime(0);
    annuler();
    vi.advanceTimersByTime(60_000);
    expect(verifier).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('réglages', () => {
  it('la vérification régulière reste d\'une minute, le rappel de « Plus tard » est de 10 minutes', () => {
    expect(DELAI_VERIFICATION).toBe(60_000);
    expect(DELAI_RAPPEL).toBe(10 * 60_000);
  });
});

describe('signal envoyé par GitHub', () => {
  const workflow = readFileSync(new URL('../.github/workflows/prevenir-mise-a-jour.yml', import.meta.url), 'utf8');
  const composant = readFileSync(new URL('../src/components/UpdateButton.jsx', import.meta.url), 'utf8');

  it('le workflow envoie sur le même canal et le même événement que ceux qu\'écoute l\'application', () => {
    expect(workflow).toContain(`topic: "${CANAL_VERSION}"`);
    expect(workflow).toContain(`event: "${EVENEMENT_DEPLOIEMENT}"`);
    expect(composant).toContain('CANAL_VERSION');
    expect(composant).toContain('EVENEMENT_DEPLOIEMENT');
  });

  it('le workflow ne part que pour une publication réussie de la production (ou à la demande)', () => {
    expect(workflow).toMatch(/deployment_status:/);
    expect(workflow).toContain("github.event.deployment_status.state == 'success'");
    expect(workflow).toContain("github.event.deployment.environment == 'Production'");
    expect(workflow).toMatch(/workflow_dispatch:/);
  });

  it('le workflow ne laisse pas apparaître la clé dans les journaux et n\'écrit aucune clé en clair', () => {
    expect(workflow).toContain('::add-mask::');
    expect(workflow).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/); // jeton JWT en clair
    expect(workflow).not.toMatch(/sb_(secret|publishable)_/);
  });

  it('le workflow lit la clé dans les secrets GitHub (deux noms acceptés), sans la demander au jeton de déploiement', () => {
    expect(workflow).toContain('secrets.SUPABASE_ANON_KEY');
    expect(workflow).toContain('secrets.VITE_SUPABASE_ANON_KEY');
    expect(workflow).not.toContain('supabase projects api-keys');
  });

  it('sans clé : échec visible quand on le lance à la main, simple avertissement quand une publication le déclenche', () => {
    expect(workflow).toContain('::error::');
    expect(workflow).toContain('::warning::');
    expect(workflow).toMatch(/MANUEL: \$\{\{ github\.event_name == 'workflow_dispatch' \}\}/);
  });

  it('le workflow utilise l\'adresse du projet Supabase déjà utilisée par le déploiement des fonctions', () => {
    const fonctions = readFileSync(new URL('../.github/workflows/deploy-functions.yml', import.meta.url), 'utf8');
    const ref = fonctions.match(/--project-ref ([a-z0-9]+)/)[1];
    expect(workflow).toContain(`PROJET: ${ref}`);
  });
});
