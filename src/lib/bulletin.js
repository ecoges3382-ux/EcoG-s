// Calcul des moyennes de bulletin — seule source de vérité côté frontend.
// La fonction SQL student_annual_average (voir supabase/schema.sql, utilisée
// pour la classification automatique passe/redouble au moment du rollover)
// réplique exactement annualMoyenneGenerale ci-dessous : les deux doivent
// rester strictement équivalentes, sans quoi le bulletin affiché et la
// décision de passage divergeraient pour le même élève.
//
// Règle constante dans tout ce module, jamais dérogée : une période ou une
// matière sans aucune note n'est jamais comptée comme 0 — elle est
// simplement exclue du calcul (moyenne sur les seules données existantes).
// Un null en sortie signifie toujours "pas de donnée", jamais "zéro".
//
// Limite connue et déjà présente côté serveur (student_annual_average) :
// seules les notes saisies sur 'Trimestre 1/2/3' entrent dans ces calculs.
// Une école qui saisirait des notes par semestre ("Semestre 1/2", proposé
// dans le formulaire de saisie) n'aurait pas de bulletin ni de moyenne
// annuelle pour ces notes-là — limitation pré-existante, pas introduite ici.
export const PERIODES_BULLETIN = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];

// Moyenne d'une matière pour un élève sur une période donnée, sur 20.
// Règle de l'école (pas une simple moyenne de toutes les notes confondues) :
// les interrogations ("controle") comptent ensemble comme UNE seule
// composante (leur moyenne), et chaque devoir ("devoir") compte comme sa
// propre composante — typiquement 1 (moyenne des interros) + 2 (devoirs) =
// 3 composantes, d'où la division par 3 dans le cas courant. Les notes de
// type "examen" ne rentrent pas dans ce calcul. Généralisé à un nombre
// quelconque de devoirs (0, 1, 3…) plutôt que de figer "exactement 2" en
// dur, pour ne pas casser un trimestre où le compte réel diffère.
export function subjectPeriodeMoyenne(grades, studentId, subjectId, periode) {
  const notes = grades.filter((g) => g.student_id === studentId && g.subject_id === subjectId && g.periode === periode);
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

// Moyenne générale d'un élève pour une période, pondérée par le coefficient
// des seules matières qui ont au moins une note cette période — les
// matières sans note ne comptent ni pour 0 ni pour leur coefficient. null
// si aucune matière n'a de note cette période.
export function periodeMoyenneGenerale(subjects, grades, studentId, periode) {
  const avecNotes = subjects
    .map((su) => ({ coefficient: Number(su.coefficient) || 0, moyenne: subjectPeriodeMoyenne(grades, studentId, su.id, periode) }))
    .filter((l) => l.moyenne != null);
  const sommeCoef = avecNotes.reduce((a, l) => a + l.coefficient, 0);
  if (sommeCoef <= 0) return null;
  return avecNotes.reduce((a, l) => a + l.moyenne * l.coefficient, 0) / sommeCoef;
}

// Moyenne annuelle d'un élève : moyenne des moyennes générales des
// trimestres qui ont effectivement des notes (identique à
// student_annual_average côté SQL). null si aucun trimestre n'a de note.
export function annualMoyenneGenerale(subjects, grades, studentId) {
  const valeurs = PERIODES_BULLETIN
    .map((p) => periodeMoyenneGenerale(subjects, grades, studentId, p))
    .filter((v) => v != null);
  if (valeurs.length === 0) return null;
  return valeurs.reduce((a, v) => a + v, 0) / valeurs.length;
}

// Moyenne annuelle d'une matière pour un élève : moyenne de ses moyennes de
// trimestre qui ont des notes. null si jamais notée sur l'année.
export function subjectAnnualMoyenne(grades, studentId, subjectId) {
  const valeurs = PERIODES_BULLETIN
    .map((p) => subjectPeriodeMoyenne(grades, studentId, subjectId, p))
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

// Classement d'un élève parmi une liste de camarades (typiquement sa
// classe), pour une période donnée ou 'annuel'. Seuls les élèves ayant une
// moyenne calculable sont classés — un élève sans note n'est ni premier ni
// dernier, simplement non classé (retour null). Classement toujours
// recalculé à la volée à partir des mêmes fonctions ci-dessus : jamais une
// deuxième logique de moyenne.
export function computeRang(subjects, grades, classmateIds, studentId, periode) {
  const moyenneOf = (id) => (periode === 'annuel'
    ? annualMoyenneGenerale(subjects, grades, id)
    : periodeMoyenneGenerale(subjects, grades, id, periode));
  const classes = classmateIds
    .map((id) => ({ id, moyenne: moyenneOf(id) }))
    .filter((c) => c.moyenne != null)
    .sort((a, b) => b.moyenne - a.moyenne);
  if (classes.length === 0) return null;
  const index = classes.findIndex((c) => c.id === studentId);
  if (index === -1) return null;
  return { rang: index + 1, total: classes.length };
}
