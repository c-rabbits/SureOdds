'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { MatchWithOdds, TableRow, QuotaInfo } from '@/types';
import { getMatchesWithOdds, getArbitrage, triggerCollection, getApiQuota } from '@/lib/api';
import { flattenMatchesToRows } from '@/lib/utils';
import { getAlertService } from '@/lib/alertService';
import { useFilters } from '@/hooks/useFilters';
import Toolbar from '@/components/Toolbar';
import MatchTable from '@/components/MatchTable';
import DetailPanel from '@/components/DetailPanel';
import AlertSettings from '@/components/AlertSettings';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function HomePage() {
  const [matches, setMatches] = useState<MatchWithOdds[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null);
  const [alertSettingsOpen, setAlertSettingsOpen] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  const { filters, toggleSport, toggleMarketType, setMinProfit, setSort, setSourceFilter } = useFilters();

  // Flatten matches to table rows
  const rows = useMemo(() => flattenMatchesToRows(matches), [matches]);

  // Stats
  const arbCount = useMemo(() => rows.filter((r) => r.isArbitrage).length, [rows]);
  const topProfit = useMemo(() => {
    const arbRows = rows.filter((r) => r.isArbitrage && r.profitPercent !== null);
    return arbRows.length > 0 ? Math.max(...arbRows.map((r) => r.profitPercent!)) : 0;
  }, [rows]);
  const uniqueMatches = useMemo(() => new Set(rows.map((r) => r.matchId)).size, [rows]);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [matchData, quotaData] = await Promise.all([
        getMatchesWithOdds({ limit: 100 }),
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
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner message="SureOdds 로딩 중..." />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <Toolbar
        filters={filters}
        onToggleSport={toggleSport}
        onToggleMarketType={toggleMarketType}
        onSetMinProfit={setMinProfit}
        onSetSort={(field) => setSort(field)}
        onSetSourceFilter={setSourceFilter}
        matchCount={uniqueMatches}
        arbCount={arbCount}
        topProfit={topProfit}
        lastUpdated={lastUpdated}
        loading={refreshing}
        onRefresh={handleRefresh}
        quota={quota}
        onOpenAlertSettings={() => setAlertSettingsOpen(true)}
      />

      {/* Main content: table + detail split */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Table panel */}
        <div className={`${selectedRow ? 'h-[60%]' : 'flex-1'} overflow-hidden`}>
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
            <div className="h-[40%] overflow-hidden">
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
