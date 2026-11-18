import { defineConfig } from 'vitest/config';

// Configuration des tests séparée de vite.config.js : on n'a pas besoin du plugin PWA pour tester du calcul.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
