// Portail parent : la bannière « nouvelle version » n'apparaît que sur les appareils où un service worker existe déjà (sinon le
// parent reçoit la dernière version à chaque ouverture et n'a rien à mettre à jour). Pas de connexion temps réel pour les parents.
import { useEffect, useState } from 'react';
import UpdateButton from './UpdateButton.jsx';
import { serviceWorkerDejaInscrit } from '../lib/miseAJour.js';

export default function MiseAJourSiInscrit() {
  const [inscrit, setInscrit] = useState(false);
  useEffect(() => {
    let annule = false;
    serviceWorkerDejaInscrit().then((oui) => { if (!annule) setInscrit(oui); });
    return () => { annule = true; };
  }, []);
  return inscrit ? <UpdateButton tempsReel={false} /> : null;
}
