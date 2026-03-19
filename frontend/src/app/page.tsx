'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { MatchWithOdds, TableRow, QuotaInfo } from '@/types';
import { getMatchesWithOdds, getArbitrage, triggerCollection, getApiQuota, invalidateCache } from '@/lib/api';
import { flattenMatchesToRows } from '@/lib/utils';
import { getAlertService } from '@/lib/alertService';
import { useFilters } from '@/hooks/useFilters';
import { useAuth } from '@/contexts/AuthContext';
import Toolbar from '@/components/Toolbar';
import MatchTable from '@/components/MatchTable';
import DetailPanel from '@/components/DetailPanel';
import { DashboardSkeleton } from '@/components/Skeleton';

export default function HomePage() {
  const { isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const [matches, setMatches] = useState<MatchWithOdds[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const autoSelectedRef = useRef(false);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('sureodds-hidden');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const handleHideRow = useCallback((key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      try { localStorage.setItem('sureodds-hidden', JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }, []);

  const { filters, toggleSport, toggleMarketType, setMinProfit, setSort, setSourceFilter, toggleBookmaker, toggleLeague, setTimeFilter, setRequiredBookmaker, toggleArbOnly } = useFilters();

  // 이전 배당 캐시 (배당 변동 표시용)
  const prevOddsRef = useRef<Map<string, { o1: number | null; o2: number | null; draw: number | null }>>(new Map());

  // Flatten matches to table rows + 배당 변동 계산
  const rows = useMemo(() => {
    const baseRows = flattenMatchesToRows(matches);
    const prevMap = prevOddsRef.current;
    const newMap = new Map<string, { o1: number | null; o2: number | null; draw: number | null }>();

    for (const row of baseRows) {
      const key = `${row.matchId}|${row.marketType}|${row.handicapPoint}`;
      const cur = { o1: row.bestOutcome1?.odds ?? null, o2: row.bestOutcome2?.odds ?? null, draw: row.bestDraw?.odds ?? null };
      newMap.set(key, cur);

      const prev = prevMap.get(key);
      if (prev) {
        row.oddsChange1 = cur.o1 !== null && prev.o1 !== null && cur.o1 !== prev.o1 ? cur.o1 - prev.o1 : null;
        row.oddsChange2 = cur.o2 !== null && prev.o2 !== null && cur.o2 !== prev.o2 ? cur.o2 - prev.o2 : null;
        row.oddsChangeDraw = cur.draw !== null && prev.draw !== null && cur.draw !== prev.draw ? cur.draw - prev.draw : null;
      }
    }

    prevOddsRef.current = newMap;
    return baseRows;
  }, [matches]);

  // Stats
  const arbCount = useMemo(() => rows.filter((r) => r.isArbitrage).length, [rows]);
  const topProfit = useMemo(() => {
    const arbRows = rows.filter((r) => r.isArbitrage && r.profitPercent !== null);
    return arbRows.length > 0 ? Math.max(...arbRows.map((r) => r.profitPercent!)) : 0;
  }, [rows]);
  const uniqueMatches = useMemo(() => new Set(rows.map((r) => r.matchId)).size, [rows]);

  // Latest server-side collection time (from odds updated_at)
  const lastCollected = useMemo(() => {
    let latest = '';
    for (const m of matches) {
      for (const o of m.odds || []) {
        if (o.updated_at > latest) latest = o.updated_at;
      }
    }
    return latest ? new Date(latest) : null;
  }, [matches]);

  // Collect unique bookmakers from current data for filter UI
  const availableBookmakers = useMemo(() => {
    const set = new Set<string>();
    for (const match of matches) {
      for (const odd of match.odds || []) {
        set.add(odd.bookmaker);
      }
    }
    return Array.from(set);
  }, [matches]);

  const availableLeagues = useMemo(() => {
    const set = new Set<string>();
    for (const match of matches) {
      if (match.league) set.add(match.league);
    }
    return Array.from(set).sort();
  }, [matches]);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [matchData, quotaData] = await Promise.all([
        getMatchesWithOdds({ limit: 500 }),
        getApiQuota().catch(() => null),
      ]);

      setMatches(matchData || []);
      if (quotaData) setQuota(quotaData);
      setLastUpdated(new Date());

      // Check for new arbitrage alerts
      const arbOpps = (matchData || []).flatMap((m) => m.arbitrage_opportunities || []);
      if (arbOpps.length > 0) {
        try {
          const alertSvc = getAlertService();
          alertSvc.checkNewOpportunities(arbOpps);
        } catch {
          // Alert service may fail on SSR
        }
      }
    } catch (err) {
      // Toast는 API 인터셉터가 자동으로 표시하므로 여기서는 콘솔만 남김
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-select match from URL query param (e.g., /?match=xxx from notification click)
  useEffect(() => {
    const matchId = searchParams.get('match');
    if (!matchId || autoSelectedRef.current || rows.length === 0) return;
    const targetRow = rows.find((r) => r.matchId === matchId);
    if (targetRow) {
      setSelectedRow(targetRow);
      autoSelectedRef.current = true;
    }
  }, [searchParams, rows]);

  // Auto-refresh every 60s
  useEffect(() => {
    const timer = setInterval(loadData, 60000);
    return () => clearInterval(timer);
  }, [loadData]);

  // Manual refresh (triggers collector then reloads)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    invalidateCache();
    try {
      await triggerCollection();
      await loadData();
    } catch (err) {
      console.error('Refresh failed:', err);
      // Still try to load existing data
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  // Row selection
  const handleSelectRow = useCallback((row: TableRow) => {
    setSelectedRow((prev) => {
      const prevKey = prev ? `${prev.matchId}|${prev.marketType}|${prev.handicapPoint}` : null;
      const newKey = `${row.matchId}|${row.marketType}|${row.handicapPoint}`;
      return prevKey === newKey ? null : row;
    });
  }, []);

  const selectedRowKey = selectedRow
    ? `${selectedRow.matchId}|${selectedRow.marketType}|${selectedRow.handicapPoint ?? 'null'}`
    : null;

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex flex-col md:h-full">
      {/* Toolbar */}
      <Toolbar
        filters={filters}
        onToggleSport={toggleSport}
        onToggleMarketType={toggleMarketType}
        onSetMinProfit={setMinProfit}
        onSetSort={(field) => setSort(field)}
        onSetSourceFilter={setSourceFilter}
        onToggleBookmaker={toggleBookmaker}
        onToggleLeague={toggleLeague}
        onSetTimeFilter={setTimeFilter}
        onSetRequiredBookmaker={setRequiredBookmaker}
        onToggleArbOnly={toggleArbOnly}
        availableLeagues={availableLeagues}
        availableBookmakers={availableBookmakers}
        matchCount={uniqueMatches}
        arbCount={arbCount}
        topProfit={topProfit}
        lastUpdated={lastUpdated}
        lastCollected={lastCollected}
        loading={refreshing}
        onRefresh={handleRefresh}
        quota={quota}
        isAdmin={isAdmin}

      />

      {/* Main content: table */}
      <div className="md:flex-1 flex flex-col md:overflow-hidden">
        <MatchTable
          rows={rows}
          filters={filters}
          selectedRowKey={selectedRowKey}
          onSelectRow={handleSelectRow}
          hiddenKeys={hiddenKeys}
          onHideRow={handleHideRow}
        />
      </div>

      {/* Detail bottom sheet popup */}
      {selectedRow && (
        <DetailPanel
          match={selectedRow.matchData}
          initialMarketType={selectedRow.marketType}
          initialHandicapPoint={selectedRow.handicapPoint}
          onClose={() => setSelectedRow(null)}
        />
      )}

    </div>
  );
}
