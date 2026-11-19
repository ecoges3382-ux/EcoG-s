import { Link } from 'react-router-dom';

// Nom d'élève cliquable qui ouvre sa fiche. `depuis` ({ chemin, libelle }) indique la page d'origine : le bouton « Retour » de
// la fiche y ramène (par exemple « Retour aux notes ») au lieu de la liste des élèves.
export default function StudentLink({ studentId, name, style, depuis }) {
  if (!studentId) return <span style={style}>{name}</span>;

  return (
    <Link
      to={`/eleves/${studentId}`}
      state={depuis ? { depuis } : undefined}
      title={name ? `Voir la fiche de ${name}` : undefined}
      style={{
        color: 'inherit',
        textDecoration: 'none',
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
    >
      {name}
    </Link>
  );
}
