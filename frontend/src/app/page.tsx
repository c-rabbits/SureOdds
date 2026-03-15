'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { MatchWithOdds, TableRow, QuotaInfo } from '@/types';
import { getMatchesWithOdds, getArbitrage, triggerCollection, getApiQuota, invalidateCache } from '@/lib/api';
import { flattenMatchesToRows } from '@/lib/utils';
import { getAlertService } from '@/lib/alertService';
import { useFilters } from '@/hooks/useFilters';
import { useAuth } from '@/contexts/AuthContext';
import Toolbar from '@/components/Toolbar';
import MatchTable from '@/components/MatchTable';
import DetailPanel from '@/components/DetailPanel';
import AlertSettings from '@/components/AlertSettings';
import { DashboardSkeleton } from '@/components/Skeleton';

export default function HomePage() {
  const { isAdmin } = useAuth();
  const [matches, setMatches] = useState<MatchWithOdds[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null);
  const [alertSettingsOpen, setAlertSettingsOpen] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  const { filters, toggleSport, toggleMarketType, setMinProfit, setSort, setSourceFilter, toggleBookmaker } = useFilters();

  // Flatten matches to table rows
  const rows = useMemo(() => flattenMatchesToRows(matches), [matches]);

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
        onOpenAlertSettings={() => setAlertSettingsOpen(true)}
      />

      {/* Main content: table + detail split */}
      <div className="md:flex-1 flex flex-col md:overflow-hidden">
        {/* Table panel */}
        <div className={`${selectedRow ? 'md:h-[60%]' : 'md:flex-1'} md:overflow-hidden`}>
          <MatchTable
            rows={rows}
            filters={filters}
            selectedRowKey={selectedRowKey}
            onSelectRow={handleSelectRow}
          />
        </div>

        {/* Detail panel (only shown when a row is selected) */}
        {selectedRow && (
          <>
            <div className="panel-handle h-1.5 shrink-0" />
            <div className="md:h-[40%] md:overflow-hidden">
              <DetailPanel
                match={selectedRow.matchData}
                initialMarketType={selectedRow.marketType}
                initialHandicapPoint={selectedRow.handicapPoint}
                onClose={() => setSelectedRow(null)}
              />
            </div>
          </>
        )}
      </div>

      {/* Alert settings modal */}
      <AlertSettings
        isOpen={alertSettingsOpen}
        onClose={() => setAlertSettingsOpen(false)}
      />
    </div>
  );
}
