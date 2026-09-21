// En-tête institutionnel commun à tous les documents imprimables (bulletin,
// reçu, situation financière) — un seul endroit pour l'identité de l'école,
// jamais reconstruite différemment d'un document à l'autre. `school` doit
// venir de la ligne "schools" de l'établissement concerné (jamais d'une
// autre école) : profile.schools côté admin, ou l'objet school renvoyé par
// l'Edge Function parent-portal côté portail parent.
export default function DocumentHeader({ school, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18, paddingBottom: 14, borderBottom: '2px solid var(--ink)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {school?.logo_url ? (
          <img src={school.logo_url} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 16, color: '#fff', flexShrink: 0 }}>
            {(school?.name || 'EG').split(' ').filter((w) => w.length > 1).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'EG'}
          </div>
        )}
        <div>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>{school?.name || 'École'}</p>
          {(school?.adresse || school?.telephone || school?.email) && (
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5 }}>
              {[school?.adresse, school?.telephone, school?.email].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</p>
        {subtitle && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>{subtitle}</p>}
      </div>
    </div>
  );
}
