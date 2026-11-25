import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials, stickyHeaderStyle } from '../lib/utils.js';
import SchoolTabs from '../layout/SchoolTabs.jsx';
import SelectionBar from '../components/SelectionBar.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DoublonsParents from '../components/DoublonsParents.jsx';
import PlanLocked from '../components/PlanLocked.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { guardedFetch } from '../lib/offlineCache.js';
import { SkeletonRow } from '../components/Skeleton.jsx';
import { translateError } from '../lib/errors.js';
import useHauteurListe from '../lib/useHauteurListe.js';
import { parentCorrespond, parentDansFiltre, FILTRES_PARENTS } from '../lib/parents.js';
import { hasFeature, getPlanLabel, featurePlanRequired } from '../lib/plan.js';

function UsersGroupIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="9" r="3" />
      <circle cx="16" cy="9" r="3" />
      <path d="M2.5 20c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" />
      <path d="M10.5 20c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" />
    </svg>
  );
}

const MANAGER_ROLES = ['fondateur', 'directeur', 'secretaire'];

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7l16 0" />
      <path d="M10 11l0 6" />
      <path d="M14 11l0 6" />
      <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
      <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}

export default function Parents() {
  const { profile } = useAuth();
  const confirm = useConfirm();
  const [parents, setParents] = useState(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState('tous');
  // Ce que la liste montre : la recherche (nom ou numéro) et le filtre choisi
  const visibles = useMemo(
    () => (parents || []).filter((p) => parentDansFiltre(p, filtre) && parentCorrespond(p, recherche)),
    [parents, filtre, recherche],
  );
  // La liste défile dans son cadre (comme la liste des élèves) : le titre et les boutons restent en place
  const [listeRef, hauteurListe] = useHauteurListe([parents !== null, error, offline, selectMode, (parents || []).length, visibles.length > 0]);

  const plan = profile?.schools?.plan || 'decouverte';
  const hasParentAccess = hasFeature(plan, 'parent_portal');
  const canViewRole = MANAGER_ROLES.includes(profile.role);

  async function reload() {
    await guardedFetch({
      cacheKey: `parents_${profile.school_id}`,
      hasData: parents !== null,
      load: async () => {
        const { data, error: fetchError } = await supabase
          .from('parent_access')
          .select('id, full_name, nom, prenom, phone, created_at, parent_access_students ( students ( id ) )')
          .order('full_name');
        return fetchError ? { error: fetchError } : { data };
      },
      setData: setParents,
      setOffline,
      onError: (err) => setError(translateError(err)),
      onSuccess: () => setError(''),
    });
  }

  useEffect(() => {
    if (!canViewRole || !hasParentAccess) return;
    reload();
  }, [profile.role, hasParentAccess]);

  if (!hasParentAccess) {
    return (
      <div>
        <SchoolTabs />
        <p className="page-title" style={{ margin: '0 0 20px', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Parents</p>
        <PlanLocked
          currentPlanLabel={getPlanLabel(plan)}
          requiredPlanLabel={featurePlanRequired('parent_portal')}
          featureDescription="le portail parents (consultation des notes et paiements par les familles)"
        />
      </div>
    );
  }

  if (!canViewRole) {
    return (
      <div className="card-bold" style={{ padding: '16px 20px', maxWidth: 520, background: 'var(--gold-light)', borderColor: 'var(--gold)' }}>
        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--clay-text)', lineHeight: 1.6 }}>
          Seuls le fondateur, le directeur et la secrétaire peuvent consulter les parents.
        </p>
      </div>
    );
  }

  function toggleOne(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const ids = visibles.map((p) => p.id);
      return ids.every((id) => prev.includes(id)) ? [] : ids;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds([]);
  }

  async function handleDeleteOne(id, name) {
    if (!(await confirm(`Supprimer définitivement l'accès de ${name} ? Le lien qu'il a reçu cessera de fonctionner. Attention, tu ne pourras pas revenir en arrière.`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('parent_access').delete().eq('id', id);
    setDeleting(false);
    if (deleteError) { setError(translateError(deleteError)); return; }
    reload();
  }

  async function handleDeleteSelected() {
    if (!(await confirm(`Supprimer définitivement ${selectedIds.length} accès parent${selectedIds.length > 1 ? 's' : ''} ? Attention, tu ne pourras pas revenir en arrière.`, { confirmLabel: 'Supprimer' }))) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('parent_access').delete().in('id', selectedIds);
    setDeleting(false);
    if (deleteError) { setError(translateError(deleteError)); return; }
    exitSelectMode();
    reload();
  }

  return (
    <div>
      <SchoolTabs />
      {offline && <OfflineBanner />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>Parents</p>
        {!selectMode && (
          <button
            onClick={() => setSelectMode(true)}
            style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}
          >
            Sélectionner
          </button>
        )}
      </div>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 14 }}>{error}</p>}
      {parents && !selectMode && <DoublonsParents parents={parents} onDone={reload} />}
      {!parents && !error && <div className="card-bold"><SkeletonRow count={5} /></div>}

      {parents && parents.length === 0 && (
        <div className="card-bold">
          <EmptyState
            icon={<UsersGroupIcon />}
            title="Aucun parent pour l'instant"
            subtitle="Un parent apparaît ici dès qu'il est rattaché à un élève, depuis la fiche d'inscription."
            actionLabel="Aller vers Élèves"
            actionTo="/eleves"
          />
        </div>
      )}
      {parents && parents.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
            {/* Les filtres tiennent sur une seule ligne (qui défile de côté sur téléphone) pour laisser de la place à la liste */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', maxWidth: '100%', paddingBottom: 2 }}>
              {FILTRES_PARENTS.map((f) => {
              const actif = filtre === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltre(f.id)}
                  style={{ padding: '8px 15px', borderRadius: 20, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', border: `1px solid ${actif ? 'var(--forest)' : 'var(--line-strong)'}`, background: actif ? 'var(--forest)' : 'var(--paper)', color: actif ? '#fff' : 'var(--ink)' }}
                >
                  {f.label} <span style={{ opacity: 0.7 }}>{parents.filter((p) => parentDansFiltre(p, f.id)).length}</span>
                </button>
              );
            })}
            </div>
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom ou numéro du parent..."
              aria-label="Rechercher un parent"
              style={{ padding: '8px 12px', borderRadius: 20, border: '1px solid var(--line-strong)', fontSize: 13, flex: '1 1 240px', maxWidth: 360, minWidth: 0, boxSizing: 'border-box', color: 'var(--ink)', marginLeft: 'auto' }}
            />
          </div>

          <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>
            {visibles.length} parent{visibles.length > 1 ? 's' : ''}
            {filtre !== 'tous' && ` · ${FILTRES_PARENTS.find((f) => f.id === filtre).label.toLowerCase()}`}
            {recherche.trim() && ` · recherche "${recherche.trim()}"`}
          </p>

          {visibles.length === 0 ? (
            <div className="card-bold" style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>
              Aucun parent ne correspond{recherche.trim() ? ` à « ${recherche.trim()} »` : ' à ce filtre'}.
            </div>
          ) : (
            <div ref={listeRef} className="card-bold" style={{ maxHeight: hauteurListe ?? 'calc(100vh - 250px)', overflowY: 'auto', scrollbarGutter: 'stable' }}>
              {/* En-tête figé : il reste en haut pendant que la liste défile */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `12px ${selectMode ? 20 : 70}px 12px ${selectMode ? 46 : 20}px`, ...stickyHeaderStyle('var(--forest-light)'), fontSize: '11.5px', fontWeight: 700, color: 'var(--forest-dark-text)', textTransform: 'uppercase' }}>
                <span style={{ paddingLeft: 48 }}>Parent</span>
                <span>Enfants</span>
              </div>
          {visibles.map((p, i) => {
            const childCount = (p.parent_access_students || []).length;
            return (
              <div
                key={p.id}
                className="row-link"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderBottom: i < visibles.length - 1 ? '1px solid var(--line)' : 'none' }}
              >
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleOne(p.id)}
                    style={{ flexShrink: 0 }}
                  />
                )}
                <Link
                  to={selectMode ? '#' : `/parents/${p.id}`}
                  onClick={selectMode ? (e) => { e.preventDefault(); toggleOne(p.id); } : undefined}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--clay-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: '12.5px', fontWeight: 600, color: 'var(--clay-text)', flexShrink: 0 }}>
                      {initials(p.full_name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{p.full_name}</p>
                      <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)' }}>{p.phone || 'Pas de numéro'}</p>
                    </div>
                  </div>
                  <span style={{ background: 'var(--forest-light)', color: 'var(--forest-dark-text)', fontSize: '11.5px', fontWeight: 600, padding: '4px 11px', borderRadius: 20, flexShrink: 0, marginLeft: 10 }}>
                    {childCount} enfant{childCount > 1 ? 's' : ''}
                  </span>
                </Link>
                {!selectMode && (
                  <button
                    type="button"
                    onClick={() => handleDeleteOne(p.id, p.full_name)}
                    title="Supprimer"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, padding: 0, borderRadius: 9, border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            );
          })}
            </div>
          )}
        </>
      )}

      {selectMode && (
        <SelectionBar
          count={selectedIds.length}
          allSelected={visibles.length > 0 && visibles.every((p) => selectedIds.includes(p.id))}
          onCancel={exitSelectMode}
          onToggleAll={toggleAllVisible}
          onDelete={handleDeleteSelected}
          deleting={deleting}
        />
      )}
    </div>
  );
}
