import { Component } from 'react';

// Filet de sécurité en production : sans lui, une exception de rendu
// n'importe où dans l'arbre (une donnée inattendue, un champ manquant sur
// une réponse Supabase...) fait disparaître silencieusement toute l'appli
// — page blanche, sans aucune indication pour l'utilisateur. Volontairement
// un seul boundary tout en haut (voir main.jsx) plutôt qu'un par écran :
// le but ici est d'éviter la page blanche, pas de isoler chaque widget.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // console.error, jamais console.log : reste visible dans les outils de
    // suivi d'erreurs frontend (Sentry et équivalents s'y raccrochent
    // généralement automatiquement) sans qu'on ait à le câbler nous-mêmes
    // ici. Jamais de détail technique envoyé ailleurs qu'à la console.
    console.error('Erreur non interceptée :', error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center', background: 'var(--cream, #FAF8F4)' }}>
        <div style={{ maxWidth: 420 }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 600, marginBottom: 10, color: '#1A2E27' }}>
            Une erreur est survenue
          </p>
          <p style={{ color: '#6B7A73', fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
            Recharge la page. Si le problème persiste, contacte l'administrateur.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '11px 20px', borderRadius: 10, border: 'none', background: '#0F4C3A', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            Recharger la page
          </button>
        </div>
      </div>
    );
  }
}
