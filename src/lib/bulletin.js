export const PERIODES_BULLETIN = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];

// Les calculs de moyenne cherchent les notes d'un élève dans un « index » (un dictionnaire élève_matière_période → notes),
// bien plus rapide que de reparcourir toute la liste à chaque calcul. Toutes les fonctions ci-dessous acceptent
// AUSSI la simple liste de notes : on construit l'index une seule fois pour cette liste et on le réutilise.
// (Une version précédente n'acceptait que l'index : les écrans Notes, Bulletins et le portail parent, qui passent la
// liste, n'affichaient plus aucune moyenne.)
export function indexGrades(grades) {
  const index = {};
  grades.forEach((g) => {
    const key = `${g.student_id}_${g.subject_id}_${g.periode}`;
    if (!index[key]) index[key] = [];
    index[key].push(g);
  });
  return index;
}

const INDEX_CACHE = new WeakMap();
function asIndex(grades) {
  if (!Array.isArray(grades)) return grades || {};
  const hit = INDEX_CACHE.get(grades);
  if (hit && hit.length === grades.length) return hit.index; // la longueur change si on ajoute ou retire une note
  const index = indexGrades(grades);
  INDEX_CACHE.set(grades, { length: grades.length, index });
  return index;
}

export function subjectPeriodeMoyenne(gradesIndex, studentId, subjectId, periode) {
  const key = `${studentId}_${subjectId}_${periode}`;
  const notes = asIndex(gradesIndex)[key] || [];
  
  const interros = notes.filter((g) => g.type === 'controle');
  const devoirs = notes.filter((g) => g.type === 'devoir');
  const composantes = [];
  
  if (interros.length > 0) {
    composantes.push(interros.reduce((a, g) => a + (Number(g.note) / Number(g.sur)) * 20, 0) / interros.length);
  }
  devoirs.forEach((g) => composantes.push((Number(g.note) / Number(g.sur)) * 20));
  
  if (composantes.length === 0) return null;
  return composantes.reduce((a, v) => a + v, 0) / composantes.length;
}

export function periodeMoyenneGenerale(subjects, gradesIndex, studentId, periode) {
  const avecNotes = subjects
    .map((su) => ({ coefficient: Number(su.coefficient) || 0, moyenne: subjectPeriodeMoyenne(gradesIndex, studentId, su.id, periode) }))
    .filter((l) => l.moyenne != null);
  const sommeCoef = avecNotes.reduce((a, l) => a + l.coefficient, 0);
  if (sommeCoef <= 0) return null;
  return avecNotes.reduce((a, l) => a + l.moyenne * l.coefficient, 0) / sommeCoef;
}

export function annualMoyenneGenerale(subjects, gradesIndex, studentId) {
  const valeurs = PERIODES_BULLETIN
    .map((p) => periodeMoyenneGenerale(subjects, gradesIndex, studentId, p))
    .filter((v) => v != null);
  if (valeurs.length === 0) return null;
  return valeurs.reduce((a, v) => a + v, 0) / valeurs.length;
}

export function subjectAnnualMoyenne(gradesIndex, studentId, subjectId) {
  const valeurs = PERIODES_BULLETIN
    .map((p) => subjectPeriodeMoyenne(gradesIndex, studentId, subjectId, p))
    .filter((v) => v != null);
  if (valeurs.length === 0) return null;
  return valeurs.reduce((a, v) => a + v, 0) / valeurs.length;
}

export function appreciation(moyenne) {
  if (moyenne == null) return null;
  if (moyenne >= 16) return 'Excellent';
  if (moyenne >= 14) return 'Très bien';
  if (moyenne >= 12) return 'Bien';
  if (moyenne >= 10) return 'Passable';
  return 'Insuffisant';
}

export function computeRang(subjects, gradesIndex, classmateIds, studentId, periode) {
  const moyenneOf = (id) => (periode === 'annuel'
    ? annualMoyenneGenerale(subjects, gradesIndex, id)
    : periodeMoyenneGenerale(subjects, gradesIndex, id, periode));
  const classes = classmateIds
    .map((id) => ({ id, moyenne: moyenneOf(id) }))
    .filter((c) => c.moyenne != null)
    .sort((a, b) => b.moyenne - a.moyenne);
  if (classes.length === 0) return null;
  const index = classes.findIndex((c) => c.id === studentId);
  if (index === -1) return null;
  return { rang: index + 1, total: classes.length };
}
