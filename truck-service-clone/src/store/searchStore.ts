import { create } from 'zustand';
import type { Region, ServiceType } from '@models/index';

interface SearchState {
  region: Region | null;
  activeServiceTypes: ServiceType[];
  radiusMiles: number;
  onlyMyVendors: boolean;
  setRegion: (region: Region) => void;
  toggleServiceType: (type: ServiceType) => void;
  setRadius: (miles: number) => void;
  setOnlyMyVendors: (value: boolean) => void;
  reset: () => void;
}

/** Client state for the search/map surface — the live filter the query keys off. */
export const useSearchStore = create<SearchState>((set) => ({
  region: null,
  activeServiceTypes: [],
  radiusMiles: 50,
  onlyMyVendors: false,
  setRegion: (region) => set({ region }),
  toggleServiceType: (type) =>
    set((s) => ({
      activeServiceTypes: s.activeServiceTypes.includes(type)
        ? s.activeServiceTypes.filter((t) => t !== type)
        : [...s.activeServiceTypes, type],
    })),
  setRadius: (radiusMiles) => set({ radiusMiles }),
  setOnlyMyVendors: (onlyMyVendors) => set({ onlyMyVendors }),
  reset: () => set({ activeServiceTypes: [], radiusMiles: 50, onlyMyVendors: false }),
}));
