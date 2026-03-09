'use client';

import { useState, useCallback, useEffect } from 'react';
import { FilterState, MarketType, SortField, SortDirection, SourceFilter } from '@/types';

const STORAGE_KEY = 'sureodds-filters';

const DEFAULT_FILTERS: FilterState = {
  sports: [],
  marketTypes: ['h2h', 'spreads', 'totals'],
  minProfit: 0,
  bookmakers: [],
  sortBy: 'profit',
  sortDir: 'desc',
  sourceFilter: 'all',
};

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFilters({ ...DEFAULT_FILTERS, ...parsed });
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // ignore storage errors
    }
  }, [filters]);

  const setSportFilter = useCallback((sports: string[]) => {
    setFilters((prev) => ({ ...prev, sports }));
  }, []);

  const toggleSport = useCallback((sport: string) => {
    setFilters((prev) => {
      const sports = prev.sports.includes(sport)
        ? prev.sports.filter((s) => s !== sport)
        : [...prev.sports, sport];
      return { ...prev, sports };
    });
  }, []);

  const setMarketTypes = useCallback((marketTypes: MarketType[]) => {
    setFilters((prev) => ({ ...prev, marketTypes }));
  }, []);

  const toggleMarketType = useCallback((mt: MarketType) => {
    setFilters((prev) => {
      const types = prev.marketTypes.includes(mt)
        ? prev.marketTypes.filter((t) => t !== mt)
        : [...prev.marketTypes, mt];
      return { ...prev, marketTypes: types.length > 0 ? types : prev.marketTypes };
    });
  }, []);

  const setMinProfit = useCallback((minProfit: number) => {
    setFilters((prev) => ({ ...prev, minProfit }));
  }, []);

  const setSort = useCallback((sortBy: SortField, sortDir?: SortDirection) => {
    setFilters((prev) => ({
      ...prev,
      sortBy,
      sortDir: sortDir ?? (prev.sortBy === sortBy && prev.sortDir === 'desc' ? 'asc' : 'desc'),
    }));
  }, []);

  const setSourceFilter = useCallback((sourceFilter: SourceFilter) => {
    setFilters((prev) => ({ ...prev, sourceFilter }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return {
    filters,
    setSportFilter,
    toggleSport,
    setMarketTypes,
    toggleMarketType,
    setMinProfit,
    setSort,
    setSourceFilter,
    resetFilters,
  };
}
