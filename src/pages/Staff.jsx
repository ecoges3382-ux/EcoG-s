      {/* 👇 BARRE DE RECHERCHE ET FILTRES CORRIGÉS 👇 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', // Pousse les éléments aux extrémités
        marginBottom: 18, 
        flexWrap: 'wrap', 
        gap: 10 
      }}>
        
        {/* À GAUCHE : Les filtres par rôle ou onglets (si tu en as) */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Tes boutons de filtres (ex: Tous, Enseignants, etc.) vont ici */}
        </div>

        {/* À DROITE : La barre de recherche bien calibrée */}
        <input
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  placeholder="Rechercher…"
  style={{ 
    padding: '8px 12px',           // Espacement intérieur équilibré
    borderRadius: 8,               // Bords arrondis comme l'en-tête
    border: '1px solid var(--line-strong)', 
    fontSize: 13,                  // 👈 Taille de police identique à l'en-tête (13px)
    width: 220,                    // Largeur fixe
    boxSizing: 'border-box', 
    color: 'var(--ink)',
    marginLeft: 'auto'             // 👈 Aligne la barre complètement à droite
  }}
/>
      </div>
