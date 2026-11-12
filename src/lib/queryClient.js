import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Les données sont considérées "fraîches" pendant 5 minutes
      gcTime: 1000 * 60 * 15,   // 👈 Remplacement de cacheTime par gcTime (React Query V5)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
