// Calculs qui alimentent les graphiques : recouvrement par classe (tableau de bord) et évolution des moyennes (fiche élève,
// portail parent). Le dessin lui-même est vérifié à l'œil ; ici on vérifie les chiffres.
import { describe, it, expect } from 'vitest';
import { recouvrementParClasse, couleurTaux } from '../src/components/dashboard/RecouvrementChart.jsx';
import { trendSummary } from '../src/components/GradesTrendChart.jsx';

describe('recouvrement par classe', () => {
  const rows = [
    { nom: '6e A', du: 1000000, paye: 900000 },
    { nom: '5e B', du: 500000, paye: 100000 },
    { nom: 'CE1', du: 800000, paye: 800000 },
    { nom: 'CP', du: 0, paye: 0 },
    { nom: '3e', du: 400000, paye: 100000 },
  ];

  it('arrondit le taux payé / dû, et classe de la plus en retard à la mieux payée', () => {
    expect(recouvrementParClasse(rows).map((d) => [d.nom, d.taux])).toEqual([['5e B', 20], ['3e', 25], ['6e A', 90], ['CE1', 100]]);
  });

  it('une classe sans rien à encaisser n\'apparaît pas (pas de division par zéro)', () => {
    expect(recouvrementParClasse(rows).some((d) => d.nom === 'CP')).toBe(false);
    expect(recouvrementParClasse([{ nom: 'X', du: 0, paye: 0 }])).toEqual([]);
  });

  it('accepte des montants reçus en texte, et plafonne à 100 % un trop-perçu', () => {
    const [d] = recouvrementParClasse([{ nom: 'X', du: '1000', paye: '1500' }]);
    expect(d.taux).toBe(100);
    expect(d.paye).toBe(1500);
  });

  it('à taux égal, ordre alphabétique stable', () => {
    expect(recouvrementParClasse([{ nom: 'B', du: 10, paye: 5 }, { nom: 'A', du: 10, paye: 5 }]).map((d) => d.nom)).toEqual(['A', 'B']);
  });

  it('couleurs : vert dès 80 %, doré de 50 à 79 %, rouge en dessous', () => {
    expect(couleurTaux(100)).toBe('var(--success)');
    expect(couleurTaux(80)).toBe('var(--success)');
    expect(couleurTaux(79)).toBe('var(--gold)');
    expect(couleurTaux(50)).toBe('var(--gold)');
    expect(couleurTaux(49)).toBe('var(--danger)');
    expect(couleurTaux(0)).toBe('var(--danger)');
  });
});

describe('évolution des moyennes', () => {
  const p = (label, value) => ({ name: label.slice(-1), label, value });

  it('hausse : compare la première et la dernière période notée', () => {
    const r = trendSummary([p('Trimestre 1', 10.2), p('Trimestre 2', 11), p('Trimestre 3', 12.0)]);
    expect(r.sens).toBe('hausse');
    expect(r.texte).toBe('En progrès : +1,8 point depuis le Trimestre 1');
  });

  it('baisse, avec le pluriel à partir de 2 points', () => {
    const r = trendSummary([p('Trimestre 1', 14), p('Trimestre 2', 11.5)]);
    expect(r.sens).toBe('baisse');
    expect(r.texte).toBe('En baisse : −2,5 points depuis le Trimestre 1');
  });

  it('une période sans note est sautée (le trimestre 2 manque)', () => {
    const r = trendSummary([p('Trimestre 1', 9), p('Trimestre 2', null), p('Trimestre 3', 13)]);
    expect(r.texte).toBe('En progrès : +4,0 points depuis le Trimestre 1');
  });

  it('un écart négligeable est « stable »', () => {
    expect(trendSummary([p('Trimestre 1', 12), p('Trimestre 2', 12.02)]).sens).toBe('stable');
  });

  it('moins de deux périodes notées : pas de tendance à annoncer', () => {
    expect(trendSummary([p('Trimestre 1', 12), p('Trimestre 2', null), p('Trimestre 3', null)])).toBeNull();
    expect(trendSummary([p('Trimestre 1', null)])).toBeNull();
    expect(trendSummary([])).toBeNull();
  });
});
