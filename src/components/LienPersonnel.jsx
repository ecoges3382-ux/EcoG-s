// Nom d'un membre du personnel : un clic ouvre sa fiche (/personnel/<id>). Sans identifiant, le nom s'affiche tel quel.
// Le clic ne déclenche pas l'action de la ligne qui le contient (modifier, sélectionner…).
import { Link } from 'react-router-dom';

export default function LienPersonnel({ id, nom, style, vide = '—' }) {
  if (!nom) return <span style={style}>{vide}</span>;
  if (!id) return <span style={style}>{nom}</span>;
  return (
    <Link
      to={`/personnel/${id}`}
      onClick={(e) => e.stopPropagation()}
      title="Ouvrir la fiche"
      // Aucun soulignement au repos (comme les noms d'élèves, voir StudentLink) : la ligne n'apparaît que sous le pointeur, sur ordinateur
      style={{ color: 'inherit', textDecoration: 'none', ...style }}
      onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
    >
      {nom}
    </Link>
  );
}
