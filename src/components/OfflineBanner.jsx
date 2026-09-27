// Affiché à la place d'une erreur bloquante quand une donnée n'a pas pu
// être rafraîchie mais qu'une version déjà vue est disponible — la page
// reste consultable plutôt que de basculer sur un écran vide.
export default function OfflineBanner() {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '9px 14px',
        borderRadius: 9, background: 'var(--amber-light)', color: 'var(--amber)', fontSize: 12.5, fontWeight: 600,
      }}
    >
      <i className="ti ti-wifi-off" style={{ fontSize: 15 }} aria-hidden="true"></i>
      Connexion instable — dernières données connues affichées, pas forcément à jour.
    </div>
  );
}
