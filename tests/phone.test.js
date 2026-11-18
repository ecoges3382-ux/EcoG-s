// Numéros de téléphone : l'indicatif du pays de l'école est ajouté automatiquement, sauf si la personne a un
// numéro international complet (« + » ou « 00 »).
import { describe, it, expect } from 'vitest';
import { toInternational, composePhone, DEFAULT_DIAL } from '../src/lib/phone.js';

describe('indicatif ajouté automatiquement (école au Bénin)', () => {
  const cas = [
    ['97200909', '+2290197200909'],          // ancien numéro à 8 chiffres : « 01 » complété (réforme de nov. 2024)
    ['0197200909', '+2290197200909'],        // numéro à 10 chiffres
    ['2290197200909', '+2290197200909'],     // indicatif déjà présent, sans « + » : pas doublé
    ['22997200909', '+2290197200909'],       // idem avec un ancien numéro à 8 chiffres
    ['  01-97-20-09-09  ', '+2290197200909'],
  ];
  for (const [entree, attendu] of cas) {
    it(`« ${entree} » devient ${attendu}`, () => expect(toInternational(entree, '229')).toBe(attendu));
  }
  it('« 01 97 20 19 09 » devient +2290197201909', () => expect(toInternational('01 97 20 19 09', '229')).toBe('+2290197201909'));
  it('l\'indicatif par défaut est celui du Bénin', () => {
    expect(DEFAULT_DIAL).toBe('229');
    expect(toInternational('0197200909')).toBe('+2290197200909');
  });
});

describe('numéro international complet : respecté tel quel, quel que soit le pays de l\'école', () => {
  it('« + » devant : conservé, espaces et tirets retirés', () => {
    expect(toInternational('+33 6 12 34 56 78', '229')).toBe('+33612345678');
    expect(toInternational('+229 01 97 20 09 09', '228')).toBe('+2290197200909');
  });
  it('« 00 » devant : devient « + »', () => {
    expect(toInternational('0033612345678', '229')).toBe('+33612345678');
    expect(toInternational('00 228 90 12 34 56', '229')).toBe('+22890123456');
  });
  it('un numéro déjà au bon format n\'est pas modifié (ancien format béninois avec « + » inclus)', () => {
    expect(toInternational('+22997000001', '229')).toBe('+22997000001');
  });
});

describe('autres pays', () => {
  it('Togo (228) : 8 chiffres, sans zéro', () => {
    expect(toInternational('90123456', '228')).toBe('+22890123456');
    expect(toInternational('22890123456', '228')).toBe('+22890123456');
  });
  it('Nigeria (234) : le zéro de tête est retiré', () => {
    expect(toInternational('08031234567', '234')).toBe('+2348031234567');
    expect(toInternational('8031234567', '234')).toBe('+2348031234567');
  });
  it('Ghana (233) et France (33) : le zéro de tête est retiré', () => {
    expect(toInternational('0241234567', '233')).toBe('+233241234567');
    expect(toInternational('0612345678', '33')).toBe('+33612345678');
  });
  it('Côte d\'Ivoire (225) : le préfixe 01/05/07 fait partie du numéro, gardé', () => {
    expect(toInternational('0123456789', '225')).toBe('+2250123456789');
  });
  it('indicatif d\'école invalide : on retombe sur le Bénin, jamais sur un numéro absurde', () => {
    for (const mauvais of [undefined, null, '', 'abc', '2299', '+229']) {
      expect(toInternational('97200909', mauvais), String(mauvais)).toBe('+2290197200909');
    }
  });
});

describe('numéros refusés (plutôt qu\'enregistrés faux)', () => {
  for (const entree of [null, undefined, '', '   ', 'abc', '12', '12345', '123456', '+12', '++22997000001', '97a00909', '+0229970000', '9'.repeat(40)]) {
    it(`refuse ${JSON.stringify(entree)}`, () => expect(toInternational(entree, '229')).toBeNull());
  }
});

describe('cohérence avec le champ de saisie (composePhone)', () => {
  it('même résultat que la saisie dans le formulaire, pour chaque pays de la liste', () => {
    const pays = [['229', '97200909'], ['229', '0197200909'], ['228', '90123456'], ['225', '0123456789'], ['221', '771234567'], ['227', '96123456'], ['226', '70123456'], ['223', '70123456'], ['234', '08031234567'], ['233', '0241234567'], ['33', '0612345678']];
    for (const [dial, local] of pays) expect(toInternational(local, dial), `${dial} ${local}`).toBe(composePhone(dial, local));
  });

  it('idempotent : normaliser deux fois donne le même résultat', () => {
    for (const x of ['97200909', '0197200909', '+22997000001', '0033612345678', '08031234567', '22890123456']) {
      for (const dial of ['229', '228', '234']) {
        const une = toInternational(x, dial);
        if (une) expect(toInternational(une, dial), `${x}/${dial}`).toBe(une);
      }
    }
  });
});
