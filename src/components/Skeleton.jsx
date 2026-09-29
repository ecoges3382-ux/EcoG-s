import { Monogram } from './Logo.jsx';

// Écrans de chargement animés — remplace le texte "Chargement…" partout
// dans l'app. Le principe (dégradé qui glisse) existait déjà sur la page
// d'accueil publique (Landing.css, .landing-skeleton) ; repris ici en
// version app-wide, appliqué à l'application elle-même plutôt qu'à sa
// vitrine.

export function SkeletonBar({ width = '100%', height = 14, radius = 6, style = {} }) {
  return <div className="skeleton-shimmer" style={{ width, height, borderRadius: radius, ...style }} />;
}

// Une ligne de liste (avatar rond + deux lignes de texte) — Élèves,
// Personnel, Parents... Largeurs légèrement variées d'une ligne à l'autre
// pour ne pas avoir l'air d'un bloc figé.
export function SkeletonRow({ count = 4, avatar = true }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: i < count - 1 ? '1px solid var(--line)' : 'none' }}>
          {avatar && <SkeletonBar width={36} height={36} radius={10} style={{ flexShrink: 0 }} />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <SkeletonBar width={`${52 + (i % 3) * 12}%`} height={13} />
            <SkeletonBar width={`${26 + (i % 4) * 8}%`} height={10} />
          </div>
        </div>
      ))}
    </>
  );
}

// Une carte-stat (Dashboard.jsx) — label court + grosse valeur.
export function SkeletonCard({ big = false }) {
  return (
    <div className="card-bold" style={{ padding: big ? '22px 24px' : '16px 18px' }}>
      <SkeletonBar width={big ? 140 : 90} height={12} style={{ marginBottom: big ? 16 : 9 }} />
      <SkeletonBar width={big ? 170 : 70} height={big ? 40 : 21} />
    </div>
  );
}

// Une ligne de tableau à colonnes (Classes, Matières, Argent...) — une
// barre par colonne, largeurs décroissantes pour suggérer du texte réel
// plutôt qu'une grille de rectangles identiques.
export function SkeletonTableRows({ count = 4, columns = 4 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '14px 20px', borderBottom: i < count - 1 ? '1px solid var(--line)' : 'none' }}>
          {Array.from({ length: columns }).map((_, c) => (
            <SkeletonBar key={c} width={c === 0 ? `${40 + (i % 3) * 8}%` : `${18 + (c % 3) * 6}%`} height={12} style={{ flex: c === 0 ? '1 1 auto' : '0 0 auto' }} />
          ))}
        </div>
      ))}
    </>
  );
}

// Une ligne de texte isolée — pour les petits chargements secondaires
// (une sous-liste dans un écran déjà affiché, une option de menu...) où un
// squelette complet serait disproportionné.
export function SkeletonLine({ width = '60%' }) {
  return <SkeletonBar width={width} height={13} style={{ margin: '4px 0' }} />;
}

// Tout premier chargement de la session (App.jsx, avant même de savoir si
// quelqu'un est connecté) : rien n'existe encore à imiter, donc seulement
// le repère de marque qui respire doucement plutôt qu'un mot figé. Réutilisé
// (avec un minHeight réduit) comme fallback <Suspense> le temps qu'un
// fichier de page chargé à la demande (voir App.jsx) arrive du réseau —
// à l'intérieur de la coquille de l'app (Shell.jsx), jamais en remplaçant
// toute la page : la barre latérale et la barre du haut restent visibles.
export function SkeletonScreen({ minHeight = '100vh' }) {
  return (
    <div style={{ minHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Monogram size={64} className="skeleton-brand" />
    </div>
  );
}
