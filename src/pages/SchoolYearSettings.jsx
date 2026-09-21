import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';

const CAN_MANAGE_ROLES = ['fondateur', 'directeur'];

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : null;
}

// Point d'entrée du cycle de vie des années scolaires : année active,
// historique des années clôturées, et accès à une préparation en cours ou
// à démarrer. Le vrai travail (créer/traiter/activer) vit dans
// PrepareSchoolYear.jsx — cet écran ne fait que refléter l'état actuel.
export default function SchoolYearSettings() {
  const { profile } = useAuth();
  const canManage = CAN_MANAGE_ROLES.includes(profile.role);
  const [years, setYears] = useState(null);
  const [error, setError] = useState('');

  async function reload() {
    const { data, error: fetchError } = await supabase
      .from('school_years')
      .select('id, label, statut, is_current, date_debut, date_fin, created_at')
      .order('created_at', { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setYears(data);
  }

  useEffect(() => { reload(); }, []);

  if (error) return <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>;
  if (!years) return <p style={{ color: 'var(--muted)' }}>Chargement…</p>;

  const active = years.find((y) => y.statut === 'active');
  const preparation = years.find((y) => y.statut === 'preparation');
  const historique = years.filter((y) => y.statut === 'cloturee');

  return (
    <div>
      <Link to="/parametres" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--forest)', fontWeight: 600, fontSize: 13, marginBottom: 18, textDecoration: 'none', width: 'fit-content' }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 15 }} aria-hidden="true"></i>Retour aux paramètres
      </Link>
      <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Année scolaire</p>

      {active && (
        <div className="card-bold" style={{ padding: '18px 20px', marginBottom: 16, maxWidth: 520 }}>
          <p style={{ margin: '0 0 3px', fontSize: '11.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Année active</p>
          <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600 }}>{active.label}</p>
          {(active.date_debut || active.date_fin) && (
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--muted)' }}>
              {formatDate(active.date_debut) || '—'} → {formatDate(active.date_fin) || '—'}
            </p>
          )}
        </div>
      )}

      {preparation && (
        <Link
          to="/parametres/annee-scolaire/preparation"
          className="card-bold"
          style={{ display: 'block', padding: '16px 20px', marginBottom: 16, maxWidth: 520, textDecoration: 'none', color: 'inherit', background: 'var(--gold-light)', borderColor: 'var(--gold)' }}
        >
          <p style={{ margin: '0 0 3px', fontSize: '11.5px', fontWeight: 700, color: 'var(--clay-dark)', textTransform: 'uppercase' }}>Préparation en cours</p>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600 }}>{preparation.label}</p>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--clay-dark)', fontWeight: 600 }}>Continuer la préparation →</p>
        </Link>
      )}

      {!preparation && canManage && (
        <Link
          to="/parametres/annee-scolaire/preparation"
          className="card-bold"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', marginBottom: 16, maxWidth: 520, textDecoration: 'none', background: 'var(--forest)', borderColor: 'var(--forest)' }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
            <i className="ti ti-calendar-plus" style={{ fontSize: 16, verticalAlign: '-3px', marginRight: 8 }} aria-hidden="true"></i>
            Préparer la prochaine année
          </span>
          <i className="ti ti-chevron-right" style={{ fontSize: 18, color: '#fff' }} aria-hidden="true"></i>
        </Link>
      )}

      {!preparation && !canManage && (
        <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 520 }}>
          Seuls le fondateur et le directeur peuvent préparer une nouvelle année scolaire.
        </p>
      )}

      {historique.length > 0 && (
        <>
          <p style={{ margin: '22px 0 10px', fontSize: '11.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Historique</p>
          <div className="card-bold" style={{ overflow: 'hidden', maxWidth: 520 }}>
            {historique.map((y, i) => (
              <div key={y.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: i < historique.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{y.label}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Clôturée</span>
              </div>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--muted)', maxWidth: 520, lineHeight: 1.6 }}>
            Les notes, présences, paiements et inscriptions de ces années restent conservés tels quels — rien n'est jamais réécrit par la préparation d'une nouvelle année.
          </p>
        </>
      )}
    </div>
  );
}
