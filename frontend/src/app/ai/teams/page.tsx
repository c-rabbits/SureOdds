'use client';

import { useEffect, useState, useMemo } from 'react';
import { getTeamStats, getLeagues, type TeamStats, type LeagueInfo } from '@/lib/aiApi';
import { getKoreanTeamName } from '@/lib/teamNames';

// Form letter colors
function formColor(ch: string) {
  if (ch === 'W') return 'bg-green-500';
  if (ch === 'D') return 'bg-yellow-500';
  if (ch === 'L') return 'bg-red-500';
  return 'bg-gray-600';
}

// Rating bar width (0-2 scale → 0-100%)
function ratingPct(val: number) {
  return Math.min(100, Math.max(0, (val / 2) * 100));
}

// ELO color
function eloColor(elo: number) {
  if (elo >= 1700) return 'text-yellow-400';
  if (elo >= 1600) return 'text-blue-400';
  if (elo >= 1500) return 'text-green-400';
  return 'text-gray-400';
}

type SortField = 'elo_rating' | 'attack_rating' | 'defense_rating' | 'avg_goals_scored' | 'avg_goals_conceded' | 'goals_scored';

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamStats[]>([]);
  const [leagues, setLeagues] = useState<LeagueInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('elo_rating');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [teamsData, leaguesData] = await Promise.all([
          getTeamStats({ sort: 'elo_rating', order: 'desc' }),
          getLeagues(),
        ]);
        setTeams(teamsData);
        setLeagues(leaguesData);
      } catch (err) {
        console.error('Failed to load team stats:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = selectedLeague === 'all' ? teams : teams.filter(t => t.league === selectedLeague);
    list = [...list].sort((a, b) => {
      const av = a[sortField] ?? 0;
      const bv = b[sortField] ?? 0;
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [teams, selectedLeague, sortField, sortAsc]);

  const leagueStats = useMemo(() => {
    if (selectedLeague === 'all' || filtered.length === 0) return null;
    const avgAtk = filtered.reduce((s, t) => s + (t.attack_rating || 0), 0) / filtered.length;
    const avgDef = filtered.reduce((s, t) => s + (t.defense_rating || 0), 0) / filtered.length;
    const avgElo = filtered.reduce((s, t) => s + (t.elo_rating || 0), 0) / filtered.length;
    const avgGoals = filtered.reduce((s, t) => s + (t.avg_goals_scored || 0), 0) / filtered.length;
    return { avgAtk: avgAtk.toFixed(2), avgDef: avgDef.toFixed(2), avgElo: Math.round(avgElo), avgGoals: avgGoals.toFixed(2) };
  }, [filtered, selectedLeague]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'defense_rating'); // defense: lower is better
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <span className="text-gray-600 ml-0.5">↕</span>;
    return <span className="text-blue-400 ml-0.5">{sortAsc ? '↑' : '↓'}</span>;
  }

  if (loading) {
    return (
      <div className="p-4 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-800 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-lg font-bold text-white">📊 팀 분석</h1>
        <p className="text-xs text-gray-500 mt-0.5">5대 리그 {teams.length}팀 통계 · ELO 레이팅 · 공격력/수비력</p>
      </div>

      {/* League Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setSelectedLeague('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            selectedLeague === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          전체 ({teams.length})
        </button>
        {leagues.map((l) => (
          <button
            key={l.league}
            onClick={() => setSelectedLeague(l.league)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              selectedLeague === l.league
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {l.league} ({l.teamCount})
          </button>
        ))}
      </div>

      {/* League Summary */}
      {leagueStats && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-gray-800/60 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500">평균 ELO</div>
            <div className="text-lg font-bold text-white">{leagueStats.avgElo}</div>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500">평균 공격력</div>
            <div className="text-lg font-bold text-blue-400">{leagueStats.avgAtk}</div>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500">평균 수비력</div>
            <div className="text-lg font-bold text-red-400">{leagueStats.avgDef}</div>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500">평균 득점</div>
            <div className="text-lg font-bold text-green-400">{leagueStats.avgGoals}</div>
          </div>
        </div>
      )}

      {/* Team Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[40px_1fr_70px_80px_80px_60px_70px] gap-1 px-3 py-2.5 bg-gray-800/80 text-xs text-gray-400 font-medium">
          <div>#</div>
          <div>팀</div>
          <button onClick={() => handleSort('elo_rating')} className="text-right flex items-center justify-end hover:text-white">
            ELO<SortIcon field="elo_rating" />
          </button>
          <button onClick={() => handleSort('attack_rating')} className="text-right flex items-center justify-end hover:text-white">
            공격력<SortIcon field="attack_rating" />
          </button>
          <button onClick={() => handleSort('defense_rating')} className="text-right flex items-center justify-end hover:text-white">
            수비력<SortIcon field="defense_rating" />
          </button>
          <div className="text-center">폼</div>
          <button onClick={() => handleSort('avg_goals_scored')} className="text-right flex items-center justify-end hover:text-white">
            득/실<SortIcon field="avg_goals_scored" />
          </button>
        </div>

        {/* Team Rows */}
        {filtered.map((team, idx) => (
          <div
            key={team.id}
            className="grid grid-cols-[40px_1fr_70px_80px_80px_60px_70px] gap-1 px-3 py-2.5 border-t border-gray-800/50 hover:bg-gray-800/40 transition-colors items-center"
          >
            {/* Rank */}
            <div className="text-xs text-gray-500 font-mono">{idx + 1}</div>

            {/* Team Name + League Badge */}
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {getKoreanTeamName(team.team_name)}
              </div>
              {selectedLeague === 'all' && (
                <div className="text-[10px] text-gray-500 truncate">{team.league}</div>
              )}
            </div>

            {/* ELO */}
            <div className={`text-right text-sm font-bold font-mono ${eloColor(team.elo_rating)}`}>
              {Math.round(team.elo_rating)}
            </div>

            {/* Attack Rating */}
            <div className="text-right">
              <div className="flex items-center justify-end gap-1">
                <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${ratingPct(team.attack_rating)}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-blue-400 w-8 text-right">
                  {team.attack_rating?.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Defense Rating */}
            <div className="text-right">
              <div className="flex items-center justify-end gap-1">
                <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${ratingPct(2 - team.defense_rating)}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-red-400 w-8 text-right">
                  {team.defense_rating?.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Form */}
            <div className="flex justify-center gap-0.5">
              {(team.form_last5 || '').split('').map((ch, i) => (
                <span
                  key={i}
                  className={`w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-bold text-white ${formColor(ch)}`}
                >
                  {ch}
                </span>
              ))}
            </div>

            {/* Goals */}
            <div className="text-right text-xs font-mono">
              <span className="text-green-400">{team.avg_goals_scored?.toFixed(1)}</span>
              <span className="text-gray-600"> / </span>
              <span className="text-red-400">{team.avg_goals_conceded?.toFixed(1)}</span>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            데이터가 없습니다
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-gray-500">
        <span>공격력: 리그 평균 대비 득점력 (1.0 = 평균, &gt;1 = 강함)</span>
        <span>수비력: 리그 평균 대비 실점률 (&lt;1 = 강함)</span>
        <span className="flex items-center gap-1">
          폼: <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> 승
          <span className="w-3 h-3 rounded-sm bg-yellow-500 inline-block" /> 무
          <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> 패
        </span>
      </div>
    </div>
  );
}
