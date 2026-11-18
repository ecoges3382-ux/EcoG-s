// Règles communes aux messages WhatsApp envoyés aux parents, présentes en copie dans openwa-send et cron-reminders :
//  - la formule de politesse et le nom de l'école en bas de chaque message ;
//  - la normalisation des numéros de téléphone.
import { describe, it, expect } from 'vitest';
import { lireFonctionServeur, extraireFonction, extraireConstante, compiler } from './helpers/extraire.js';

const FONCTIONS = ['openwa-send', 'cron-reminders'];

function charger(nomFonction) {
  const source = lireFonctionServeur(nomFonction);
  return compiler([
    extraireConstante(source, 'DEFAULT_DIAL'), extraireFonction(source, 'onlyDigits'), extraireFonction(source, 'composePhone'),
    extraireFonction(source, 'normalizePhone'), extraireFonction(source, 'withSignature'),
  ], ['normalizePhone', 'withSignature']);
}

for (const nom of FONCTIONS) {
  describe(`${nom} : signature des messages`, () => {
    const { withSignature } = charger(nom);

    it('ajoute la formule de politesse puis le nom de l\'école, sur deux lignes', () => {
      expect(withSignature('Bonjour, votre enfant est absent.', 'Collège Les Palmiers'))
        .toBe('Bonjour, votre enfant est absent.\n\nMerci de votre confiance.\nCollège Les Palmiers');
    });

    it('supprime les espaces et retours à la ligne en fin de message avant d\'ajouter la signature', () => {
      expect(withSignature('Message  \n\n  ', 'Les Palmiers')).toBe('Message\n\nMerci de votre confiance.\nLes Palmiers');
    });

    it('sans nom d\'école : la formule seule, jamais « undefined » ni « null »', () => {
      for (const vide of [null, undefined, '', '   ']) {
        const t = withSignature('Message', vide);
        expect(t).toBe('Message\n\nMerci de votre confiance.');
        expect(t).not.toMatch(/undefined|null/);
      }
    });

    it('ne signe pas deux fois un message qui se termine déjà par le nom de l\'école', () => {
      const deja = 'Bonjour\n\nMerci de votre confiance.\nLes Palmiers';
      expect(withSignature(deja, 'Les Palmiers')).toBe(deja);
    });

    it('un texte vide ne produit pas de message cassé', () => {
      expect(withSignature(null, 'Les Palmiers')).toBe('\n\nMerci de votre confiance.\nLes Palmiers');
    });
  });

  describe(`${nom} : numéros de téléphone`, () => {
    const { normalizePhone } = charger(nom);
    const valides = [
      ['+22997000001', '+22997000001'],
      ['+229 97 00 00 01', '+22997000001'],
      ['+229-97-00-00-01', '+22997000001'],
      ['(+229) 97 00 00 01', '+22997000001'],
      ['0022997000001', '+22997000001'],
      ['  +22997000001  ', '+22997000001'],
      ['+33612345678', '+33612345678'],
    ];
    for (const [entree, attendu] of valides) {
      it(`accepte « ${entree} »`, () => expect(normalizePhone(entree)).toBe(attendu));
    }

    const invalides = [null, undefined, '', '   ', 'abc', '12345', '+12', '+0229970000', '++22997000001', '+229 97 00 00 01 99 99 99 99 99'];
    for (const entree of invalides) {
      it(`refuse ${JSON.stringify(entree)}`, () => expect(normalizePhone(entree)).toBeNull());
    }

    // Numéro sans indicatif : celui du pays de l'école est ajouté (Bénin par défaut, avec le « 01 » depuis nov. 2024).
    it('ajoute l\'indicatif de l\'école à un numéro local', () => {
      expect(normalizePhone('97000001')).toBe('+2290197000001');
      expect(normalizePhone('0197000001')).toBe('+2290197000001');
      expect(normalizePhone('22997000001')).toBe('+2290197000001');
      expect(normalizePhone('90123456', '228')).toBe('+22890123456');
      expect(normalizePhone('08031234567', '234')).toBe('+2348031234567');
    });
  });
}

describe('les deux copies de normalizePhone sont identiques', () => {
  it('même résultat sur une série de numéros variés', () => {
    const [a, b] = FONCTIONS.map((n) => charger(n).normalizePhone);
    const cas = ['+22997000001', '0022997000001', '+229 97 00 00 01', '97000001', '', null, 'abc', '+33 6 12 34 56 78', '00 229 97 00 00 01', '+1 (555) 123-4567'];
    for (const c of cas) expect(a(c), String(c)).toBe(b(c));
  });
});
