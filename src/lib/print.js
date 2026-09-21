// Déclenche l'impression (et, via "Enregistrer en PDF" dans la boîte de
// dialogue du navigateur, l'export PDF — EcoGès n'a pas de moteur PDF
// serveur séparé, voir supabase/schema.sql/CLAUDE et le rapport du
// chantier Documents) en donnant temporairement au document un titre
// propre : la plupart des navigateurs s'en servent comme nom de fichier
// suggéré, ce qui évite qu'un reçu ou un bulletin s'enregistre sous le
// titre générique de l'onglet.
export function printDocument(fileTitle) {
  const previousTitle = document.title;
  document.title = fileTitle;
  const restore = () => {
    document.title = previousTitle;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
}

// Nom de fichier stable et sans données personnelles excessives : type de
// document + repères utiles (classe, période, année), jamais un nom complet
// d'élève en clair dans le nom de fichier.
export function slug(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
