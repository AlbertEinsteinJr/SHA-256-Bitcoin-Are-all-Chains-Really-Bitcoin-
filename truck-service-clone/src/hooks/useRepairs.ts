/**
 * react-query bindings for the repair-ticket workflow. Reads flow through
 * `repairRepository` (which is offline-first against SQLite), and the create
 * mutation invalidates the tickets list so the new ticket appears immediately.
 * The repository already writes optimistically + best-effort syncs, so these
 * hooks stay thin: they only own caching, loading state, and invalidation.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NewRepairTicket, RepairTicket } from '@models/index';
import { repairRepository } from '@/data/repositories/repairRepository';
import { queryKeys } from '@store/queryClient';
import { useAuthStore } from '@store/authStore';

export function useRepairs() {
  return useQuery({
    queryKey: queryKeys.repairs,
    queryFn: () => repairRepository.list(),
  });
}

export function useRepair(id: string) {
  return useQuery({
    queryKey: [...queryKeys.repairs, id] as const,
    queryFn: () => repairRepository.get(id),
    enabled: !!id,
  });
}

export function useCreateRepair() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NewRepairTicket): Promise<RepairTicket> => {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) throw new Error('You must be signed in to start a repair.');
      return repairRepository.create(input, userId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.repairs });
    },
  });
}
