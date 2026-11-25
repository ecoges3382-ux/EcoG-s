// Couleur personnelle enregistrée sur le profil : lecture/écriture tolérantes (la colonne peut ne pas exister encore).
import { describe, it, expect } from 'vitest';
import { lireCouleurServeur, ecrireCouleurServeur } from '../src/lib/couleurServeur.js';

function faux({ lecture, ecriture }) {
  const appels = [];
  return {
    appels,
    from(table) {
      const q = {
        select() { return q; },
        update(payload) { appels.push({ table, payload }); q.ecrit = true; return q; },
        eq() { return q.ecrit ? Promise.resolve(ecriture) : q; },
        maybeSingle: () => Promise.resolve(lecture),
      };
      return q;
    },
  };
}

describe('lireCouleurServeur', () => {
  it('renvoie la couleur du profil', async () => {
    const r = await lireCouleurServeur(faux({ lecture: { data: { couleur_perso: '#6d28d9' }, error: null } }), 'u1');
    expect(r).toEqual({ disponible: true, couleur: '#6d28d9' });
  });
  it('profil sans couleur : disponible, mais vide (couleur de l’école)', async () => {
    const r = await lireCouleurServeur(faux({ lecture: { data: { couleur_perso: null }, error: null } }), 'u1');
    expect(r).toEqual({ disponible: true, couleur: null });
  });
  it('colonne absente (script SQL pas lancé) : indisponible, on reste en local', async () => {
    const r = await lireCouleurServeur(faux({ lecture: { data: null, error: { code: '42703', message: 'column profiles.couleur_perso does not exist' } } }), 'u1');
    expect(r.disponible).toBe(false);
  });
  it('réseau en panne : indisponible, on garde le choix local', async () => {
    const client = { from: () => { throw new Error('offline'); } };
    expect((await lireCouleurServeur(client, 'u1')).disponible).toBe(false);
  });
  it('valeur abîmée dans la base : ignorée', async () => {
    const r = await lireCouleurServeur(faux({ lecture: { data: { couleur_perso: 'rouge' }, error: null } }), 'u1');
    expect(r).toEqual({ disponible: true, couleur: null });
  });
});

describe('ecrireCouleurServeur', () => {
  it('enregistre la couleur', async () => {
    const client = faux({ ecriture: { error: null } });
    expect(await ecrireCouleurServeur(client, 'u1', '#1D4ED8')).toBe(true);
    expect(client.appels[0]).toEqual({ table: 'profiles', payload: { couleur_perso: '#1D4ED8' } });
  });
  it('null efface la couleur', async () => {
    const client = faux({ ecriture: { error: null } });
    await ecrireCouleurServeur(client, 'u1', null);
    expect(client.appels[0].payload).toEqual({ couleur_perso: null });
  });
  it('colonne absente : renvoie false sans planter', async () => {
    expect(await ecrireCouleurServeur(faux({ ecriture: { error: { code: '42703', message: 'x' } } }), 'u1', '#1D4ED8')).toBe(false);
  });
});
