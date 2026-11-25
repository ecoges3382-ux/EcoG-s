// Apparence personnelle de l'utilisateur connecté (mode clair/sombre et couleur), partagée entre la barre du haut et la page Paramètres.
// Chacun a la sienne : elle n'affecte pas les autres utilisateurs.
import { createContext, useContext } from 'react';

export const ApparenceContext = createContext(null);

// null en dehors de l'application connectée.
export const useApparence = () => useContext(ApparenceContext);
