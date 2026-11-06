// ... (Les imports et fonctions du haut restent identiques)
// ... (Les composants IdBadgeIcon, ArchiveIcon, etc. restent identiques)

export default function Staff() {
  const { profile } = useAuth();
  const confirm = useConfirm();
  // NOUVEAU : On récupère les permissions
  const canAccessFinance = profile?.role === 'fondateur' || profile?.permissions?.finance !== false;
  const canManageStaff = profile?.role === 'fondateur' || profile?.permissions?.personnel !== false;
  
  const [tab, setTab] = useState('annuaire'); 
  // ... (le reste des states reste identique)

  // ... (les fonctions reload, reloadAdvances, etc. restent identiques)

  return (
    <div>
      <SchoolTabs />
      {offline && <OfflineBanner />}
      {tour.Runner}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <p className="page-title" style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>
            Personnel
          </p>
          <tour.Button />
        </div>
      </div>

      {/* NOUVEAU : On n'affiche l'onglet Salaires que si on a la permission Finance */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setTab('annuaire')}
          style={{ padding: '9px 18px', borderRadius: 10, fontSize: '13.5px', fontWeight: 600, border: `1px solid ${tab === 'annuaire' ? 'var(--forest)' : 'var(--line-strong)'}`, background: tab === 'annuaire' ? 'var(--forest)' : 'var(--paper)', color: tab === 'annuaire' ? '#fff' : 'var(--ink)', cursor: 'pointer' }}
        >
          Annuaire
        </button>
        {canAccessFinance && (
          <button
            onClick={() => setTab('salaires')}
            style={{ padding: '9px 18px', borderRadius: 10, fontSize: '13.5px', fontWeight: 600, border: `1px solid ${tab === 'salaires' ? 'var(--forest)' : 'var(--line-strong)'}`, background: tab === 'salaires' ? 'var(--forest)' : 'var(--paper)', color: tab === 'salaires' ? '#fff' : 'var(--ink)', cursor: 'pointer' }}
          >
            Salaires
          </button>
        )}
      </div>

      {tab === 'annuaire' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, flexWrap: 'wrap', marginBottom: 16 }}>
            {staff && (
              <>
                <button onClick={exportCsv} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
                  <i className="ti ti-upload" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Exporter
                </button>
                
                {/* NOUVEAU : Bouton Ajouter caché si pas la permission */}
                {canManageStaff && (
                  <button onClick={() => { setEditingStaff(null); setModalOpen(true); }} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--forest)', color: '#fff' }}>
                    <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true"></i>Ajouter
                  </button>
                )}
                
                {canDelete && !selectMode && (
                  <button onClick={() => setSelectMode(true)} style={{ fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', color: 'var(--ink)' }}>
                    Sélectionner
                  </button>
                )}
              </>
            )}
          </div>
          
          {/* ... (Le reste de la liste du personnel reste exactement identique) ... */}
