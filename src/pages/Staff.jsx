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
          placeholder="Rechercher un membre…"
          style={{ 
            padding: '7px 12px', // 👈 Padding réduit (hauteur plus fine)
            borderRadius: 20, // 👈 Bords arrondis comme sur les autres pages
            border: '1px solid var(--line-strong)', 
            fontSize: 12.5, // 👈 Texte plus petit
            width: 220, // 👈 Largeur contenue
            boxSizing: 'border-box', 
            color: 'var(--ink)',
            marginLeft: 'auto' // 👈 Force la barre à s'aligner tout à droite
          }}
        />
      </div>
