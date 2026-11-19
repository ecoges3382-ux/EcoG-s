// Notes d'un élève, rangées par matière pour la fiche élève : ce que l'élève a eu, la moyenne de chaque matière, la moyenne
// générale. Mêmes formules que les bulletins (src/lib/bulletin.js) : une moyenne affichée ici est la même que sur le bulletin.
import {
  PERIODES_BULLETIN, subjectPeriodeMoyenne, subjectAnnualMoyenne, periodeMoyenneGenerale, annualMoyenneGenerale, appreciation,
} from './bulletin.js';

export const ORDRE_PERIODES = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3', 'Semestre 1', 'Semestre 2'];
// Une note telle qu'on l'affiche dans une pastille : « 14 » pour une note sur 20 (le /20 est dit une fois pour toutes sous le
// tableau, ce qui laisse la place d'en mettre trois par ligne), « 8/10 » quand le barème est différent.
export function libelleNote(n) {
  const note = Number(n.note);
  const sur = Number(n.sur);
  return !(sur > 0) || sur === 20 ? String(note) : `${note}/${sur}`;
}

export const TYPES_NOTE = { controle: 'Interro', devoir: 'Devoir', examen: 'Examen' };

// Périodes où l'élève a au moins une note, dans l'ordre de l'année.
export function periodesAvecNotes(grades) {
  const presentes = new Set((grades || []).map((g) => g.periode));
  const connues = ORDRE_PERIODES.filter((p) => presentes.has(p));
  const autres = [...presentes].filter((p) => !ORDRE_PERIODES.includes(p)).sort();
  return [...connues, ...autres];
}

// Période à montrer en premier : la plus récente qui a des notes (un parent veut voir le dernier trimestre d'abord).
export function periodeParDefaut(grades) {
  const trimestres = periodesAvecNotes(grades).filter((p) => PERIODES_BULLETIN.includes(p));
  return trimestres[trimestres.length - 1] || periodesAvecNotes(grades)[0] || null;
}

const parDate = (a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''));

// periode : un nom de période, ou 'annuel' (moyenne des trimestres qui ont des notes).
export function resumeNotesEleve(grades, subjects, studentId, periode) {
  const toutes = grades || [];
  const annuel = periode === 'annuel';
  // Les matières dans lesquelles l'élève a des notes : une note n'est jamais cachée parce que sa matière est réservée à une
  // autre classe (par exemple après un changement de classe).
  const matieres = (subjects || []).filter((su) => toutes.some((g) => g.subject_id === su.id));

  const lignes = matieres
    .map((su) => {
      const notes = toutes
        .filter((g) => g.subject_id === su.id && (annuel ? PERIODES_BULLETIN.includes(g.periode) : g.periode === periode))
        .sort(parDate);
      return {
        matiere: su,
        coefficient: Number(su.coefficient) || 0,
        notes,
        moyenne: annuel ? subjectAnnualMoyenne(toutes, studentId, su.id) : subjectPeriodeMoyenne(toutes, studentId, su.id, periode),
        parTrimestre: annuel ? PERIODES_BULLETIN.map((p) => ({ periode: p, moyenne: subjectPeriodeMoyenne(toutes, studentId, su.id, p) })) : null,
      };
    })
    .filter((l) => l.notes.length > 0)
    .sort((a, b) => (a.matiere.nom || '').localeCompare(b.matiere.nom || ''));

  const generale = annuel ? annualMoyenneGenerale(matieres, toutes, studentId) : periodeMoyenneGenerale(matieres, toutes, studentId, periode);
  return { lignes, generale, appreciation: appreciation(generale), nbNotes: lignes.reduce((a, l) => a + l.notes.length, 0) };
}

// Points de la courbe d'évolution : la moyenne générale de chaque trimestre.
export function pointsEvolution(grades, subjects, studentId) {
  const matieres = (subjects || []).filter((su) => (grades || []).some((g) => g.subject_id === su.id));
  return PERIODES_BULLETIN.map((p) => ({ name: p.replace('Trimestre ', 'T'), label: p, value: periodeMoyenneGenerale(matieres, grades || [], studentId, p) }));
}
