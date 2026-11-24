import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { ConfirmProvider } from './components/ConfirmDialog.jsx';
import { getInitialTheme, applyTheme } from './lib/theme.js';
import { demarrerAnimations } from './lib/animations.js';
import './styles.css';

// Si un fichier de page n'existe plus (version déployée entre-temps), on
// recharge une fois pour récupérer la nouvelle version. Le garde-fou évite une
// boucle de rechargements si le problème persiste.
window.addEventListener('vite:preloadError', () => {
  try {
    const last = Number(sessionStorage.getItem('ecoges_preload_reload') || 0);
    if (Date.now() - last < 15000) return;
    sessionStorage.setItem('ecoges_preload_reload', String(Date.now()));
  } catch { /* stockage indisponible : on recharge sans garde-fou */ }
  window.location.reload();
});

// Applique le thème immédiatement avant le rendu de React
applyTheme(getInitialTheme());
// Mode d'animations (complet ou réduit) : posé sur <html data-anim> avant le rendu
demarrerAnimations();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
