// Détection de version indépendante du service worker : lecture de /version.json, comparaison, rechargement propre.
import { describe, it, expect, vi } from 'vitest';
import {
  lireVersionEnLigne, versionPerimee, libelleVersion, rechargementPropre, etatServiceWorker,
  lireEtat, majEtat, abonner, controlerVersion, enregistrerVerification, verifierMaintenant,
} from '../src/lib/versionApp.js';
import { creerVerificateur } from '../src/lib/miseAJour.js';

const reponse = (corps, ok = true) => ({ ok, json: async () => corps });

describe('lecture de la version en ligne', () => {
  it('lit la version et demande une copie fraîche (pas de cache)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(reponse({ version: '1760000000000' }));
    expect(await lireVersionEnLigne({ fetchFn, maintenant: () => 42 })).toBe('1760000000000');
    expect(fetchFn).toHaveBeenCalledWith('/version.json?t=42', { cache: 'no-store' });
  });
  it('renvoie null si illisible : réseau coupé, 404, page de secours HTML, contenu inattendu', async () => {
    expect(await lireVersionEnLigne({ fetchFn: vi.fn().mockRejectedValue(new Error('hors ligne')) })).toBeNull();
    expect(await lireVersionEnLigne({ fetchFn: vi.fn().mockResolvedValue(reponse({}, false)) })).toBeNull();
    expect(await lireVersionEnLigne({ fetchFn: vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error('html'); } }) })).toBeNull();
    expect(await lireVersionEnLigne({ fetchFn: vi.fn().mockResolvedValue(reponse({ version: 5 })) })).toBeNull();
    expect(await lireVersionEnLigne({ fetchFn: null })).toBeNull();
  });
});

describe('version périmée', () => {
  it('seulement si les deux versions sont connues et différentes', () => {
    expect(versionPerimee('1', '2')).toBe(true);
    expect(versionPerimee('2', '2')).toBe(false);
    expect(versionPerimee(null, '2')).toBe(false);
    expect(versionPerimee('1', null)).toBe(false);
  });
});

describe('libellé de version', () => {
  it('met en forme un horodatage et garde le reste tel quel', () => {
    expect(libelleVersion(null)).toBe('inconnue');
    expect(libelleVersion('abc')).toBe('abc');
    expect(libelleVersion('1760000000000')).toMatch(/2025/);
  });
});

describe('rechargement propre', () => {
  it('désinscrit les service workers, vide les caches, puis recharge', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const supprimer = vi.fn().mockResolvedValue(true);
    const recharger = vi.fn();
    const ordre = [];
    await rechargementPropre({
      nav: { serviceWorker: { getRegistrations: async () => [{ unregister: async () => { ordre.push('sw'); return unregister(); } }, { unregister }] } },
      cachesApi: { keys: async () => ['a', 'b'], delete: async (n) => { ordre.push('cache'); return supprimer(n); } },
      recharger: () => { ordre.push('reload'); recharger(); },
    });
    expect(unregister).toHaveBeenCalledTimes(2);
    expect(supprimer).toHaveBeenCalledWith('a');
    expect(supprimer).toHaveBeenCalledWith('b');
    expect(ordre[ordre.length - 1]).toBe('reload');
  });
  it('recharge quand même si le nettoyage échoue', async () => {
    const recharger = vi.fn();
    await rechargementPropre({
      nav: { serviceWorker: { getRegistrations: async () => { throw new Error('x'); } } },
      cachesApi: { keys: async () => { throw new Error('y'); } },
      recharger,
    });
    expect(recharger).toHaveBeenCalledTimes(1);
  });
});

describe('état du service worker', () => {
  const nav = (i) => ({ serviceWorker: { getRegistration: async () => i } });
  it('le décrit', async () => {
    expect(await etatServiceWorker(nav(undefined))).toBe('aucun');
    expect(await etatServiceWorker(nav({ active: {} }))).toBe('actif');
    expect(await etatServiceWorker(nav({ active: {}, waiting: {} }))).toBe('en attente');
    expect(await etatServiceWorker(nav({ installing: {} }))).toBe('installation');
    expect(await etatServiceWorker({})).toBe('inconnu');
  });
});

describe('état partagé du diagnostic', () => {
  it('prévient les abonnés et mémorise la dernière lecture', async () => {
    const ecoute = vi.fn();
    const stop = abonner(ecoute);
    majEtat({ canal: 'SUBSCRIBED' });
    expect(ecoute).toHaveBeenCalledTimes(1);
    expect(lireEtat().canal).toBe('SUBSCRIBED');
    await controlerVersion({ fetchFn: vi.fn().mockResolvedValue(reponse({ version: '9' })) });
    expect(lireEtat().versionEnLigne).toBe('9');
    expect(lireEtat().lectureEchouee).toBe(false);
    await controlerVersion({ fetchFn: vi.fn().mockRejectedValue(new Error('x')) });
    expect(lireEtat().versionEnLigne).toBeNull();
    expect(lireEtat().lectureEchouee).toBe(true);
    stop();
    majEtat({ canal: 'CLOSED' });
    expect(ecoute).toHaveBeenCalledTimes(3);
  });
  it('la vérification manuelle passe par la bannière montée', async () => {
    expect(await verifierMaintenant()).toBe(false);
    const f = vi.fn().mockResolvedValue(true);
    const retirer = enregistrerVerification(f);
    expect(await verifierMaintenant()).toBe(true);
    retirer();
    expect(await verifierMaintenant()).toBe(false);
  });
});

describe('vérificateur avec lecture de version', () => {
  it('lit la version même sans service worker inscrit', async () => {
    const controle = vi.fn().mockResolvedValue('1');
    const verifier = creerVerificateur({ donneInscription: () => null, controlerVersion: controle, maintenant: () => 1 });
    expect(await verifier()).toBe(true);
    expect(controle).toHaveBeenCalledTimes(1);
  });
  it('un service worker qui échoue n\'empêche pas la lecture de version, et inversement', async () => {
    const controle = vi.fn().mockResolvedValue('1');
    const v1 = creerVerificateur({ donneInscription: () => ({ update: () => Promise.reject(new Error('x')) }), controlerVersion: controle, maintenant: () => 1 });
    expect(await v1()).toBe(true);
    expect(controle).toHaveBeenCalledTimes(1);
    const update = vi.fn().mockResolvedValue();
    const v2 = creerVerificateur({ donneInscription: () => ({ update }), controlerVersion: () => Promise.reject(new Error('y')), maintenant: () => 1 });
    expect(await v2()).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
  });
  it('respecte l\'écart minimum pour les deux contrôles', async () => {
    const controle = vi.fn().mockResolvedValue('1');
    const verifier = creerVerificateur({ donneInscription: () => null, controlerVersion: controle, maintenant: () => 100 });
    await verifier(); await verifier();
    expect(controle).toHaveBeenCalledTimes(1);
  });
});
