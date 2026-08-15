/**
 * The paged directory query behind the Results list and the Map. Reads the live
 * filters (radius, active service types, "only my vendors") off the search store
 * and the origin from the passed-in coordinate, then drives a react-query infinite
 * query through `vendorRepository.search`. The query key includes every filter so
 * changing a chip transparently refetches; pages are flattened for the consumer.
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import type { Coordinate, Vendor, VendorQuery } from '@models/index';
import { vendorRepository } from '@/data/repositories/vendorRepository';
import { queryKeys } from '@store/queryClient';
import { useSearchStore } from '@store/searchStore';

export function useNearbyVendors(coordinate: Coordinate | null) {
  const radiusMiles = useSearchStore((s) => s.radiusMiles);
  const activeServiceTypes = useSearchStore((s) => s.activeServiceTypes);
  const onlyMyVendors = useSearchStore((s) => s.onlyMyVendors);

  // Everything that changes the result set is part of the cache key.
  const filters = {
    latitude: coordinate?.latitude,
    longitude: coordinate?.longitude,
    radiusMiles,
    serviceTypes: activeServiceTypes,
    onlyMyVendors,
  };

  const query = useInfiniteQuery({
    queryKey: queryKeys.vendorSearch(filters),
    enabled: coordinate != null,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const request: VendorQuery = {
        latitude: coordinate!.latitude,
        longitude: coordinate!.longitude,
        radiusMiles,
        serviceTypes: activeServiceTypes,
        onlyMyVendors,
        cursor: pageParam,
      };
      return vendorRepository.search(request);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const vendors: Vendor[] = query.data?.pages.flatMap((page) => page.items) ?? [];

  return {
    vendors,
    isLoading: query.isLoading,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    refetch: query.refetch,
  };
}
