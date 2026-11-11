import { supabase } from '../lib/supabase.js'; // 👈 NOUVEL IMPORT

// 👇 FONCTION POUR RÉPARER L'AFFICHAGE DU LOGO 👇
function getDisplayUrl(val) {
  if (!val) return '';
  if (val.startsWith('http')) return val;
  // Si c'est un ancien chemin, on le convertit en URL publique
  return supabase.storage.from('photos').getPublicUrl(val).data.publicUrl;
}

// En-tête institutionnel commun à tous les documents imprimables (bulletin,
// reçu, situation financière). Le prop `compact` permet de réduire la taille
// pour les reçus A6 imprimés 4 fois sur une page A4.
export default function DocumentHeader({ school, title, subtitle, compact = false }) {
  const logoSize = compact ? 26 : 48;
  const nameSize = compact ? 10.5 : 18;
  const contactSize = compact ? 6.5 : 11;
  const titleSize = compact ? 9.5 : 15;
  const subtitleSize = compact ? 7 : 11.5;
  const gap = compact ? 6 : 16;
  const marginBottom = compact ? 6 : 18;
  const paddingBottom = compact ? 5 : 14;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap,
      marginBottom,
      paddingBottom,
      borderBottom: compact ? '1.5px solid var(--ink)' : '2px solid var(--ink)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 5 : 12, minWidth: 0 }}>
        {school?.logo_url ? (
          // 👇 ON UTILISE LA FONCTION ICI 👇
          <img 
            src={getDisplayUrl(school.logo_url)} 
            alt="" 
            style={{ width: logoSize, height: logoSize, borderRadius: compact ? 5 : 10, objectFit: 'cover', flexShrink: 0 }} 
            onError={(e) => { e.target.style.display = 'none'; }} // Cache l'image si elle est introuvable
          />
        ) : (
          <div style={{
            width: logoSize, height: logoSize, borderRadius: compact ? 5 : 10,
            background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--serif)', fontWeight: 700, fontSize: compact ? 8 : 16, color: '#fff', flexShrink: 0,
          }}>
            {(school?.name || 'EG').split(' ').filter((w) => w.length > 1).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'EG'}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: nameSize, fontWeight: 600, lineHeight: compact ? 1.2 : 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: compact ? 'nowrap' : 'normal' }}>
            {school?.name || 'École'}
          </p>
          {(school?.adresse || school?.telephone || school?.email) && (
            <p style={{
              margin: compact ? '1px 0 0' : '2px 0 0', fontSize: contactSize, color: 'var(--muted)',
              lineHeight: compact ? 1.3 : 1.5,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: compact ? 'nowrap' : 'normal',
            }}>
              {[school?.adresse, school?.telephone, school?.email].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: titleSize, fontWeight: 700 }}>{title}</p>
        {subtitle && <p style={{ margin: compact ? '1px 0 0' : '2px 0 0', fontSize: subtitleSize, color: 'var(--muted)' }}>{subtitle}</p>}
      </div>
    </div>
  );
}
