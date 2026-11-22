// Nom d'une personne connue par son compte (Comptes utilisateurs, Chat) : si sa fiche du personnel existe (rapprochée par e-mail,
// téléphone ou nom, voir src/lib/fichePersonnel.js), le nom ouvre cette fiche ; sinon c'est du texte simple.
import { Link } from 'react-router-dom';
import LienPersonnel from './LienPersonnel.jsx';
import { usePersonnel, trouverFiche } from '../lib/fichePersonnel.js';

export function useFichePersonnel(personne) {
  const personnel = usePersonnel();
  return personnel ? trouverFiche(personne, personnel) : null;
}

export default function NomPersonnel({ nom, email, phone, style }) {
  const id = useFichePersonnel({ nom, email, phone });
  return <LienPersonnel id={id} nom={nom} style={style} />;
}

// Petite icône « fiche » à côté d'un nom dont le clic fait déjà autre chose (ex. ouvrir une conversation) : n'apparaît que si la fiche existe.
export function LienFiche({ nom, email, phone }) {
  const id = useFichePersonnel({ nom, email, phone });
  if (!id) return null;
  return (
    <Link to={`/personnel/${id}`} title="Ouvrir la fiche" aria-label={`Ouvrir la fiche de ${nom}`} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, color: 'var(--forest-text)', textDecoration: 'none' }}>
      <i className="ti ti-id" style={{ fontSize: 17 }} aria-hidden="true"></i>
    </Link>
  );
}
