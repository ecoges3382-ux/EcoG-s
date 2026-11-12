import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Les données sont considérées "fraîches" pendant 5 minutes
      cacheTime: 1000 * 60 * 15, // On garde en mémoire pendant 15 minutes
      retry: 1, // Si ça échoue, on retente 1 fois (au lieu de 3 par défaut)
      refetchOnWindowFocus: false, // Ne recharge pas si on change juste d'onglet navigateur
    },
  },
});
