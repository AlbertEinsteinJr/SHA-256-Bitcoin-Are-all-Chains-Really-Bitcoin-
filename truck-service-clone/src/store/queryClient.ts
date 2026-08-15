import { QueryClient } from '@tanstack/react-query';

/**
 * react-query owns all *server* state (vendor search, vendor detail, categories):
 * caching, dedupe, background refetch, pagination. Zustand (authStore/searchStore)
 * owns *client* state (session, active filters, map region). Keeping the two
 * concerns separate is the core state-management decision of this build.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  categories: ['categories'] as const,
  vendorSearch: (q: object) => ['vendors', 'search', q] as const,
  vendor: (id: string) => ['vendors', id] as const,
  repairs: ['repairs'] as const,
};
