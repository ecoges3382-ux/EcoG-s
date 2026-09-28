import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// Filet minimal, pas un guide de style : le but unique est d'attraper les
// bugs qu'un `npm run build` laisse passer en silence (JSX/variables
// utilisées sans être définies — voir Settings.jsx, où SkeletonTableRows
// avait été oublié à l'import et n'a explosé qu'à l'exécution). Volontairement
// sans les règles de mise en forme/style de eslint-plugin-react (prop-types,
// etc.), qui ne détectent rien de cassé et n'auraient produit que du bruit
// sur un code jamais passé au crible jusqu'ici.
export default [
  {
    ignores: ['dist/**'],
  },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      'react/jsx-no-undef': 'error',
      'react/jsx-key': 'error',
      // Sans cette règle, le no-unused-vars natif d'ESLint ne voit pas
      // qu'une balise JSX <Truc /> "utilise" la variable Truc, et signale
      // à tort des centaines d'imports pourtant bien utilisés dans le JSX.
      'react/jsx-uses-vars': 'error',
      'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      // Seule 'rules-of-hooks' (hooks appelés dans une condition/boucle —
      // un vrai bug) est reprise du préréglage recommandé du plugin.
      // 'set-state-in-effect', elle, signale en erreur le classique
      // "charger au montage puis stocker avec setState" utilisé partout
      // dans ce code de façon parfaitement légitime : pas activée ici.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
