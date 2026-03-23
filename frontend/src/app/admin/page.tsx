'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  changeUserPassword,
  getAdminSiteRegistrations,
  updateAdminSiteRegistration,
  getAdminSiteRequests,
  updateAdminSiteRequest,
  getAdminAvailableSites,
  createAvailableSite,
  updateAvailableSite,
  deleteAvailableSite,
  getAdminSettings,
  updateAdminSetting,
} from '@/lib/api';
import { UserProfile, UserRole, SiteRegistration, SiteRequest, AvailableSite } from '@/types';
import dynamic from 'next/dynamic';

const UserDetailPanel = dynamic(() => import('@/components/admin/UserDetailPanel'), {
  loading: () => <div className="h-96 bg-gray-800/50 rounded-lg animate-pulse" />,
});
const UnmatchedTeamsPanel = dynamic(() => import('@/components/admin/UnmatchedTeamsPanel'), {
  loading: () => <div className="h-64 bg-gray-800/50 rounded-lg animate-pulse" />,
});

type AdminTab = 'users' | 'sites' | 'requests' | 'teams' | 'settings';

const ROLE_OPTIONS: { value: UserRole; label: string; color: string }[] = [
  { value: 'admin', label: '관리자', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { value: 'vip5', label: 'VIP 5', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'vip4', label: 'VIP 4', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'vip3', label: 'VIP 3', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'vip2', label: 'VIP 2', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'vip1', label: 'VIP 1', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'test_vip5', label: 'T-VIP5', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { value: 'test_vip4', label: 'T-VIP4', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { value: 'test_vip3', label: 'T-VIP3', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { value: 'test_vip2', label: 'T-VIP2', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { value: 'test_vip1', label: 'T-VIP1', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
];

function getRoleStyle(role: string) {
  return ROLE_OPTIONS.find(r => r.value === role) || ROLE_OPTIONS[ROLE_OPTIONS.length - 1];
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '대기중', color: 'bg-yellow-900/30 text-yellow-400 border-yellow-800' },
  approved: { label: '승인', color: 'bg-blue-900/30 text-blue-400 border-blue-800' },
  active: { label: '운영중', color: 'bg-green-900/30 text-green-400 border-green-800' },
  paused: { label: '일시정지', color: 'bg-gray-700/50 text-gray-400 border-gray-600' },
  rejected: { label: '반려', color: 'bg-red-900/30 text-red-400 border-red-800' },
  completed: { label: '완료', color: 'bg-green-900/30 text-green-400 border-green-800' },
};

type SiteRegWithProfile = SiteRegistration & { profiles?: { email: string; display_name: string | null; username: string | null } };
type SiteReqWithProfile = SiteRequest & { profiles?: { email: string; display_name: string | null; username: string | null } };

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  // ─── 회원 관리 ───
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('vip1');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  // 비밀번호 변경
  const [detailUser, setDetailUser] = useState<UserProfile | null>(null);
  const [pwUserId, setPwUserId] = useState<string | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // ─── 사이트 관리 ───
  const [sites, setSites] = useState<SiteRegWithProfile[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [siteSearchUser, setSiteSearchUser] = useState('');
  const [siteFilterSite, setSiteFilterSite] = useState('');
  const [siteFilterStatus, setSiteFilterStatus] = useState('');
  const [selectedSiteIds, setSelectedSiteIds] = useState<Set<string>>(new Set());

  // ─── 마스터 사이트 목록 ───
  const [availableSites, setAvailableSites] = useState<AvailableSite[]>([]);
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteDesc, setNewSiteDesc] = useState('');
  const [addingSite, setAddingSite] = useState(false);

  // ─── 작업요청 관리 ───
  const [requests, setRequests] = useState<SiteReqWithProfile[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [editingReqId, setEditingReqId] = useState<string | null>(null);
  const [editAdminNotes, setEditAdminNotes] = useState('');

  // ─── 설정 ───
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingSaving, setSettingSaving] = useState<string | null>(null);

  // 비관리자 리다이렉트
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push('/');
    }
  }, [user, isAdmin, authLoading, router]);

  // ─── 데이터 로드 ───
  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadAvailableSites = useCallback(async () => {
    try {
      const data = await getAdminAvailableSites();
      setAvailableSites(data);
    } catch (err) {
      console.error('Failed to load available sites:', err);
    }
  }, []);

  const loadSites = useCallback(async () => {
    try {
      setSitesLoading(true);
      const [regData] = await Promise.all([
        getAdminSiteRegistrations(),
        loadAvailableSites(),
      ]);
      setSites(regData);
    } catch (err) {
      console.error('Failed to load sites:', err);
    } finally {
      setSitesLoading(false);
    }
  }, [loadAvailableSites]);

  const loadRequests = useCallback(async () => {
    try {
      setRequestsLoading(true);
      const data = await getAdminSiteRequests();
      setRequests(data);
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const data = await getAdminSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === 'users') loadUsers();
    else if (activeTab === 'sites') loadSites();
    else if (activeTab === 'requests') loadRequests();
    else if (activeTab === 'settings') loadSettings();
  }, [isAdmin, activeTab, loadUsers, loadSites, loadRequests, loadSettings]);

  // ─── 회원 관리 핸들러 ───
  async function handleCreate() {
    setCreateError('');
    const isAdminRole = newRole === 'admin';
    if (isAdminRole && !newEmail) {
      setCreateError('관리자는 이메일이 필수입니다.');
      return;
    }
    if (!isAdminRole && !newUsername) {
      setCreateError('아이디는 필수입니다.');
      return;
    }
    if (!isAdminRole && !/^[a-zA-Z0-9_]{3,20}$/.test(newUsername)) {
      setCreateError('아이디는 영문, 숫자, 밑줄(_)만 사용하여 3~20자로 입력하세요.');
      return;
    }
    if (newPassword.length < 6) {
      setCreateError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }
    setCreating(true);
    try {
      const payload = isAdminRole
        ? { email: newEmail, password: newPassword, display_name: newName || undefined, role: newRole }
        : { username: newUsername, password: newPassword, display_name: newName || undefined, role: newRole };
      await createUser(payload);
      setNewEmail(''); setNewUsername(''); setNewPassword(''); setNewName(''); setNewRole('vip1');
      setShowCreateForm(false);
      await loadUsers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setCreateError(error.response?.data?.error || '사용자 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(u: UserProfile) {
    try {
      await updateUser(u.id, { is_active: !u.is_active });
      await loadUsers();
    } catch (err) {
      console.error('Toggle active failed:', err);
    }
  }

  async function handleChangePassword() {
    if (!pwUserId || pwValue.length < 6) {
      alert('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }
    setPwSaving(true);
    try {
      await changeUserPassword(pwUserId, pwValue);
      alert('비밀번호가 변경되었습니다.');
      setPwUserId(null);
      setPwValue('');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      alert(error.response?.data?.error || '비밀번호 변경에 실패했습니다.');
    } finally {
      setPwSaving(false);
    }
  }

  async function handleRoleChange(u: UserProfile, newRole: UserRole) {
    if (u.role === newRole) return;
    try {
      await updateUser(u.id, { role: newRole });
      await loadUsers();
    } catch (err) {
      console.error('Role change failed:', err);
    }
  }

  async function handleDelete(u: UserProfile) {
    const displayId = u.role === 'admin' ? u.email : (u.username || u.email);
    if (!confirm(`정말 "${displayId}" 사용자를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await deleteUser(u.id);
      await loadUsers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      alert(error.response?.data?.error || '삭제에 실패했습니다.');
    }
  }

  // ─── 마스터 사이트 핸들러 ───
  async function handleAddAvailableSite() {
    if (!newSiteUrl.trim() || !newSiteName.trim()) return;
    setAddingSite(true);
    try {
      await createAvailableSite({ siteUrl: newSiteUrl.trim(), siteName: newSiteName.trim(), description: newSiteDesc.trim() || undefined });
      setNewSiteUrl(''); setNewSiteName(''); setNewSiteDesc('');
      await loadAvailableSites();
    } catch (err) {
      console.error('Add available site failed:', err);
    } finally {
      setAddingSite(false);
    }
  }

  async function handleToggleAvailableSite(site: AvailableSite) {
    try {
      await updateAvailableSite(site.id, { isActive: !site.is_active });
      await loadAvailableSites();
    } catch (err) {
      console.error('Toggle available site failed:', err);
    }
  }

  async function handleDeleteAvailableSite(site: AvailableSite) {
    if (!confirm(`"${site.site_name}" 사이트를 삭제하시겠습니까?\n해당 사이트를 등록한 유저의 사이트도 함께 삭제됩니다.`)) return;
    try {
      await deleteAvailableSite(site.id);
      await Promise.all([loadAvailableSites(), loadSites()]);
    } catch (err) {
      console.error('Delete available site failed:', err);
    }
  }

  // ─── 사이트 등록 관리 핸들러 ───
  async function handleSiteStatusChange(siteId: string, status: string) {
    try {
      await updateAdminSiteRegistration(siteId, { status });
      await loadSites();
    } catch (err) {
      console.error('Site status update failed:', err);
    }
  }

  async function handleSiteToggleActive(site: SiteRegWithProfile) {
    try {
      await updateAdminSiteRegistration(site.id, { isActive: !site.is_active });
      await loadSites();
    } catch (err) {
      console.error('Site toggle active failed:', err);
    }
  }

  // ─── 사이트 일괄 액션 ───
  async function handleBulkSiteAction(action: 'pause' | 'resume') {
    if (selectedSiteIds.size === 0) return;
    const newStatus = action === 'pause' ? 'paused' : 'active';
    try {
      await Promise.all(
        Array.from(selectedSiteIds).map((id) =>
          updateAdminSiteRegistration(id, { status: newStatus })
        )
      );
      setSelectedSiteIds(new Set());
      await loadSites();
    } catch (err) {
      console.error('Bulk action failed:', err);
    }
  }

  function toggleSiteSelection(id: string) {
    setSelectedSiteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllSites(filteredSites: SiteRegWithProfile[]) {
    if (selectedSiteIds.size === filteredSites.length) {
      setSelectedSiteIds(new Set());
    } else {
      setSelectedSiteIds(new Set(filteredSites.map((s) => s.id)));
    }
  }

  // 사이트별 사용자 수 계산
  function getSiteUserCount(siteUrl: string): number {
    return sites.filter((s) => s.site_url === siteUrl && s.status === 'active').length;
  }

  // 필터링된 사이트 목록
  function getFilteredSites(): SiteRegWithProfile[] {
    return sites.filter((s) => {
      if (siteSearchUser) {
        const q = siteSearchUser.toLowerCase();
        const name = (s.profiles?.display_name || '').toLowerCase();
        const uname = (s.profiles?.username || '').toLowerCase();
        const email = (s.profiles?.email || '').toLowerCase();
        if (!name.includes(q) && !uname.includes(q) && !email.includes(q)) return false;
      }
      if (siteFilterSite && s.site_name !== siteFilterSite) return false;
      if (siteFilterStatus && s.status !== siteFilterStatus) return false;
      return true;
    });
  }

  // ─── 작업요청 관리 핸들러 ───
  async function handleRequestStatusChange(reqId: string, status: string) {
    try {
      await updateAdminSiteRequest(reqId, { status });
      await loadRequests();
    } catch (err) {
      console.error('Request status update failed:', err);
    }
  }

  async function handleSaveAdminNotes(reqId: string) {
    try {
      await updateAdminSiteRequest(reqId, { adminNotes: editAdminNotes });
      setEditingReqId(null);
      setEditAdminNotes('');
      await loadRequests();
    } catch (err) {
      console.error('Save admin notes failed:', err);
    }
  }

  // ─── 설정 핸들러 ───
  function getSettingBool(key: string, defaultVal = false): boolean {
    const val = settings[key];
    if (val === undefined || val === null) return defaultVal;
    try { return JSON.parse(val); } catch { return defaultVal; }
  }

  async function handleToggleSetting(key: string, currentVal: boolean) {
    setSettingSaving(key);
    try {
      await updateAdminSetting(key, !currentVal);
      setSettings((prev) => ({ ...prev, [key]: JSON.stringify(!currentVal) }));
    } catch (err) {
      console.error('Setting update failed:', err);
    } finally {
      setSettingSaving(null);
    }
  }

  // 유틸
  function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-sm">로딩 중...</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const tabs: { key: AdminTab; label: string; count: number }[] = [
    { key: 'users', label: '회원 관리', count: users.length },
    { key: 'sites', label: '사이트 관리', count: sites.length },
    { key: 'requests', label: '작업요청', count: requests.filter((r) => r.status === 'pending').length },
    { key: 'teams', label: '팀매핑', count: 0 },
    { key: 'settings', label: '설정', count: 0 },
  ];

  return (
    <div className="p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-white">관리자</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            회원, 사이트 등록, 작업요청을 관리합니다.
          </p>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex mb-4 border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-2 py-2.5 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === tab.key
                ? 'text-green-400 border-b-2 border-green-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full leading-none ${
                  activeTab === tab.key
                    ? 'bg-green-500/20 text-green-400'
                    : tab.key === 'requests' && tab.count > 0
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: 회원 관리 */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'users' && (
        <>
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="btn-primary text-sm py-1.5 px-3"
            >
              {showCreateForm ? '취소' : '+ 새 회원'}
            </button>
          </div>

          {showCreateForm && (
            <div className="card mb-4">
              <h3 className="text-sm font-semibold text-white mb-3">새 회원 생성</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">역할</label>
                  <select value={newRole} onChange={(e) => { setNewRole(e.target.value as UserRole); setNewEmail(''); setNewUsername(''); }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500">
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                {newRole === 'admin' ? (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">이메일 *</label>
                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" placeholder="email@example.com" />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">아이디 *</label>
                    <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" placeholder="영문/숫자 3~20자" />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">비밀번호 *</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" placeholder="최소 6자" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">이름</label>
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" placeholder="홍길동" />
                </div>
              </div>
              {createError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-3">
                  <p className="text-red-400 text-sm">{createError}</p>
                </div>
              )}
              <div className="flex justify-end mt-3">
                <button onClick={handleCreate} disabled={creating} className="btn-primary text-sm py-1.5 px-4">
                  {creating ? '생성 중...' : '회원 생성'}
                </button>
              </div>
            </div>
          )}

          {/* 비밀번호 변경 모달 */}
          {pwUserId && (
            <div className="card mb-4 border-blue-500/30">
              <h3 className="text-sm font-semibold text-white mb-3">비밀번호 변경</h3>
              <p className="text-xs text-gray-400 mb-2">
                대상: {users.find(u => u.id === pwUserId)?.username || users.find(u => u.id === pwUserId)?.email}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={pwValue}
                  onChange={(e) => setPwValue(e.target.value)}
                  placeholder="새 비밀번호 (최소 6자)"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
                />
                <button onClick={handleChangePassword} disabled={pwSaving}
                  className="btn-primary text-sm py-2 px-4">{pwSaving ? '...' : '변경'}</button>
                <button onClick={() => { setPwUserId(null); setPwValue(''); }}
                  className="btn-sm bg-gray-700 text-gray-300 hover:bg-gray-600 py-2 px-3">취소</button>
              </div>
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            {usersLoading ? (
              <div className="text-center py-8 text-gray-500 text-sm">로딩 중...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">등록된 회원이 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="pl-4">아이디/이메일</th>
                      <th>이름</th>
                      <th>역할</th>
                      <th>상태</th>
                      <th>가입일</th>
                      <th>최근 접속</th>
                      <th className="text-center pr-4">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className={`${!u.is_active ? 'opacity-50' : ''} cursor-pointer hover:bg-gray-800/50`}
                        onClick={() => setDetailUser(u)}>
                        <td className="pl-4">
                          <div className="flex items-center gap-1">
                            <span className="text-white">{u.role === 'admin' ? u.email : (u.username || u.email)}</span>
                            {u.admin_memo && <span title={u.admin_memo} className="text-yellow-400 text-[10px]">📝</span>}
                          </div>
                          {u.id === user?.id && (
                            <span className="ml-1.5 text-[10px] text-green-400 font-medium">(나)</span>
                          )}
                        </td>
                        <td>
                          <span className="flex items-center gap-1">
                            {u.display_name || '-'}
                            {u.telegram_chat_id && <span title="텔레그램 연동됨">📱</span>}
                          </span>
                        </td>
                        <td>
                          {u.id === user?.id ? (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getRoleStyle(u.role).color}`}>
                              {getRoleStyle(u.role).label}
                            </span>
                          ) : (
                            <select
                              value={u.role}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                              className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border cursor-pointer focus:outline-none ${getRoleStyle(u.role).color} bg-transparent`}
                            >
                              {ROLE_OPTIONS.map((r) => (
                                <option key={r.value} value={r.value} className="bg-gray-900 text-white">{r.label}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${u.is_active ? 'text-green-400' : 'text-red-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                            {u.is_active ? '활성' : '비활성'}
                          </span>
                        </td>
                        <td className="text-gray-500">{formatDate(u.created_at)}</td>
                        <td className="text-gray-500">{formatDate(u.last_sign_in_at)}</td>
                        <td className="pr-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {u.id !== user?.id && (
                              <>
                                <button onClick={() => { setPwUserId(u.id); setPwValue(''); }}
                                  className="btn-sm text-blue-400 hover:bg-blue-500/10" title="비밀번호 변경">
                                  비번
                                </button>
                                <button onClick={() => handleToggleActive(u)}
                                  className={`btn-sm ${u.is_active ? 'text-yellow-400 hover:bg-yellow-500/10' : 'text-green-400 hover:bg-green-500/10'}`}
                                  title={u.is_active ? '비활성화' : '활성화'}>
                                  {u.is_active ? '비활성' : '활성'}
                                </button>
                                <button onClick={() => handleDelete(u)}
                                  className="btn-sm text-red-400 hover:bg-red-500/10" title="삭제">
                                  삭제
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: 사이트 관리 */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'sites' && (
        <>
          {/* ── 마스터 사이트 목록 관리 ── */}
          <div className="card p-4 mb-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <span>&#x1F4CB;</span> 크롤링 가능 사이트 목록
              <span className="text-[10px] text-gray-500 font-normal">(사용자 드롭다운에 표시)</span>
            </h3>

            {/* 추가 폼 */}
            <div className="flex gap-2 mb-3 items-end">
              <div className="flex-1">
                <label className="block text-[10px] text-gray-500 mb-0.5">사이트 URL</label>
                <input type="text" value={newSiteUrl} onChange={(e) => setNewSiteUrl(e.target.value)} placeholder="https://example.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-green-500 focus:outline-none" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-gray-500 mb-0.5">사이트명</label>
                <input type="text" value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)} placeholder="사이트 이름"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-green-500 focus:outline-none" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-gray-500 mb-0.5">설명 (선택)</label>
                <input type="text" value={newSiteDesc} onChange={(e) => setNewSiteDesc(e.target.value)} placeholder="설명"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-green-500 focus:outline-none" />
              </div>
              <button onClick={handleAddAvailableSite} disabled={addingSite || !newSiteUrl.trim() || !newSiteName.trim()}
                className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap disabled:opacity-40">
                {addingSite ? '추가중...' : '+ 추가'}
              </button>
            </div>

            {/* 목록 — 카드 형태 */}
            {availableSites.length > 0 ? (
              <div className="space-y-2">
                {availableSites.map((as) => (
                  <div key={as.id} className={`bg-gray-800/50 rounded-lg px-3 py-2.5 ${!as.is_active ? 'opacity-40' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      {/* 좌: 토글 + 사이트명 */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button onClick={() => handleToggleAvailableSite(as)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${as.is_active ? 'bg-green-500' : 'bg-gray-600'}`}
                          title={as.is_active ? 'ON' : 'OFF'}>
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${as.is_active ? 'translate-x-[20px]' : 'translate-x-[2px]'}`} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-white font-medium truncate">{as.site_name}</div>
                          <div className="text-[10px] text-gray-500 truncate">{as.site_url}</div>
                        </div>
                      </div>
                      {/* 우: 사용자 수 + 삭제 */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getSiteUserCount(as.site_url) > 0 ? (
                          <span className="text-green-400 text-[10px] font-medium">{getSiteUserCount(as.site_url)}명</span>
                        ) : (
                          <span className="text-gray-600 text-[10px]">0명</span>
                        )}
                        <button onClick={() => handleDeleteAvailableSite(as)}
                          className="text-red-400 hover:text-red-300 text-[10px]">삭제</button>
                      </div>
                    </div>
                    {as.description && (
                      <div className="text-[10px] text-gray-500 mt-1 pl-10 truncate">{as.description}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-3 text-gray-500 text-xs">등록된 사이트가 없습니다.</div>
            )}
          </div>

          {/* ── 사용자 등록 사이트 통계 ── */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="card p-3 text-center">
              <div className="text-xl font-bold text-white">{sites.length}</div>
              <div className="text-[10px] text-gray-400">전체</div>
            </div>
            <div className="card p-3 text-center">
              <div className="text-xl font-bold text-green-400">{sites.filter((s) => s.status === 'active').length}</div>
              <div className="text-[10px] text-gray-400">운영중</div>
            </div>
            <div className="card p-3 text-center">
              <div className="text-xl font-bold text-gray-400">{sites.filter((s) => s.status === 'paused').length}</div>
              <div className="text-[10px] text-gray-400">일시정지</div>
            </div>
          </div>

          {/* ── 필터 + 일괄 액션 ── */}
          {(() => {
            const filteredSites = getFilteredSites();
            const uniqueSiteNames = Array.from(new Set(sites.map((s) => s.site_name))).sort();
            return (
              <>
                <div className="card p-3 mb-4">
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-[10px] text-gray-500 mb-0.5">사용자 검색</label>
                      <input
                        type="text"
                        value={siteSearchUser}
                        onChange={(e) => setSiteSearchUser(e.target.value)}
                        placeholder="아이디, 이름으로 검색"
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-green-500 focus:outline-none"
                      />
                    </div>
                    <div className="min-w-[120px]">
                      <label className="block text-[10px] text-gray-500 mb-0.5">사이트</label>
                      <select
                        value={siteFilterSite}
                        onChange={(e) => setSiteFilterSite(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-green-500 focus:outline-none"
                      >
                        <option value="">전체 사이트</option>
                        {uniqueSiteNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-[100px]">
                      <label className="block text-[10px] text-gray-500 mb-0.5">상태</label>
                      <select
                        value={siteFilterStatus}
                        onChange={(e) => setSiteFilterStatus(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-green-500 focus:outline-none"
                      >
                        <option value="">전체 상태</option>
                        <option value="active">운영중</option>
                        <option value="paused">일시정지</option>
                      </select>
                    </div>
                    {(siteSearchUser || siteFilterSite || siteFilterStatus) && (
                      <button
                        onClick={() => { setSiteSearchUser(''); setSiteFilterSite(''); setSiteFilterStatus(''); }}
                        className="text-gray-400 hover:text-white text-xs py-1.5 px-2"
                      >
                        초기화
                      </button>
                    )}
                  </div>

                  {/* 일괄 액션 */}
                  {selectedSiteIds.size > 0 && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-700">
                      <span className="text-xs text-gray-400">
                        <span className="text-white font-medium">{selectedSiteIds.size}</span>개 선택
                      </span>
                      <button
                        onClick={() => handleBulkSiteAction('pause')}
                        className="btn-sm text-yellow-400 hover:bg-yellow-500/10 text-[10px] border border-yellow-800 px-2 py-1"
                      >
                        일괄 정지
                      </button>
                      <button
                        onClick={() => handleBulkSiteAction('resume')}
                        className="btn-sm text-green-400 hover:bg-green-500/10 text-[10px] border border-green-800 px-2 py-1"
                      >
                        일괄 재개
                      </button>
                      <button
                        onClick={() => setSelectedSiteIds(new Set())}
                        className="btn-sm text-gray-400 hover:bg-gray-500/10 text-[10px] px-2 py-1"
                      >
                        선택 해제
                      </button>
                    </div>
                  )}
                </div>

                <div className="card p-0 overflow-hidden">
                  {sitesLoading ? (
                    <div className="text-center py-8 text-gray-500 text-sm">로딩 중...</div>
                  ) : filteredSites.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      {sites.length === 0 ? '등록된 사이트가 없습니다.' : '검색 결과가 없습니다.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th className="pl-4 w-8">
                              <input
                                type="checkbox"
                                checked={selectedSiteIds.size === filteredSites.length && filteredSites.length > 0}
                                onChange={() => toggleAllSites(filteredSites)}
                                className="rounded border-gray-600 bg-gray-800 text-green-500 focus:ring-green-500 focus:ring-offset-0 cursor-pointer"
                              />
                            </th>
                            <th>상태</th>
                            <th>사용자</th>
                            <th>사이트명</th>
                            <th>URL</th>
                            <th>아이디</th>
                            <th className="text-center">1X2</th>
                            <th className="text-center">핸디</th>
                            <th className="text-center">O/U</th>
                            <th className="text-center">활성</th>
                            <th>등록일</th>
                            <th className="text-center pr-4">작업</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSites.map((site) => {
                            const st = STATUS_MAP[site.status] || STATUS_MAP.pending;
                            return (
                              <tr key={site.id} className={`${!site.is_active ? 'opacity-50' : ''} ${selectedSiteIds.has(site.id) ? 'bg-green-500/5' : ''}`}>
                                <td className="pl-4">
                                  <input
                                    type="checkbox"
                                    checked={selectedSiteIds.has(site.id)}
                                    onChange={() => toggleSiteSelection(site.id)}
                                    className="rounded border-gray-600 bg-gray-800 text-green-500 focus:ring-green-500 focus:ring-offset-0 cursor-pointer"
                                  />
                                </td>
                                <td>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${st.color}`}>{st.label}</span>
                                </td>
                                <td>
                                  <div className="text-xs">
                                    <div className="text-white">{site.profiles?.display_name || '-'}</div>
                                    <div className="text-gray-500">{site.profiles?.username || site.profiles?.email || '-'}</div>
                                  </div>
                                </td>
                                <td className="text-white font-medium text-xs">{site.site_name}</td>
                                <td className="text-gray-500 text-xs max-w-[120px] truncate" title={site.site_url}>{site.site_url}</td>
                                <td className="text-gray-300 text-xs">{site.login_id || '-'}</td>
                                <td className="text-center">{site.enable_cross ? <span className="text-green-400 text-xs">O</span> : <span className="text-gray-600 text-xs">-</span>}</td>
                                <td className="text-center">{site.enable_handicap ? <span className="text-purple-400 text-xs">O</span> : <span className="text-gray-600 text-xs">-</span>}</td>
                                <td className="text-center">{site.enable_ou ? <span className="text-orange-400 text-xs">O</span> : <span className="text-gray-600 text-xs">-</span>}</td>
                                <td className="text-center">
                                  <button
                                    onClick={() => handleSiteToggleActive(site)}
                                    className={`w-2.5 h-2.5 rounded-full ${site.is_active ? 'bg-green-500' : 'bg-red-500'}`}
                                    title={site.is_active ? '활성 → 비활성' : '비활성 → 활성'}
                                  />
                                </td>
                                <td className="text-gray-500 text-xs">{formatDate(site.created_at)}</td>
                                <td className="pr-4">
                                  <div className="flex items-center justify-center gap-1 flex-wrap">
                                    {site.status === 'active' && (
                                      <button onClick={() => handleSiteStatusChange(site.id, 'paused')}
                                        className="btn-sm text-yellow-400 hover:bg-yellow-500/10 text-[10px]">일시정지</button>
                                    )}
                                    {site.status === 'paused' && (
                                      <button onClick={() => handleSiteStatusChange(site.id, 'active')}
                                        className="btn-sm text-green-400 hover:bg-green-500/10 text-[10px]">재개</button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: 작업요청 관리 */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'requests' && (
        <>
          {/* 요청 통계 */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="card p-3 text-center">
              <div className="text-xl font-bold text-white">{requests.length}</div>
              <div className="text-[10px] text-gray-400">전체 요청</div>
            </div>
            <div className="card p-3 text-center">
              <div className="text-xl font-bold text-yellow-400">{requests.filter((r) => r.status === 'pending').length}</div>
              <div className="text-[10px] text-gray-400">대기중</div>
            </div>
            <div className="card p-3 text-center">
              <div className="text-xl font-bold text-blue-400">{requests.filter((r) => r.status === 'approved').length}</div>
              <div className="text-[10px] text-gray-400">승인</div>
            </div>
            <div className="card p-3 text-center">
              <div className="text-xl font-bold text-green-400">{requests.filter((r) => r.status === 'completed').length}</div>
              <div className="text-[10px] text-gray-400">완료</div>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            {requestsLoading ? (
              <div className="text-center py-8 text-gray-500 text-sm">로딩 중...</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">작업요청이 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="pl-4">상태</th>
                      <th>요청자</th>
                      <th>사이트명</th>
                      <th>URL</th>
                      <th>기타사항</th>
                      <th>관리자 메모</th>
                      <th>요청일</th>
                      <th className="text-center pr-4">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => {
                      const st = STATUS_MAP[req.status] || STATUS_MAP.pending;
                      return (
                        <tr key={req.id}>
                          <td className="pl-4">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${st.color}`}>{st.label}</span>
                          </td>
                          <td>
                            <div className="text-xs">
                              <div className="text-white">{req.profiles?.display_name || '-'}</div>
                              <div className="text-gray-500">{req.profiles?.username || req.profiles?.email || '-'}</div>
                            </div>
                          </td>
                          <td className="text-white text-xs">{req.site_name || '-'}</td>
                          <td className="text-gray-400 text-xs max-w-[150px] truncate" title={req.site_url}>{req.site_url}</td>
                          <td className="text-gray-500 text-xs max-w-[120px] truncate" title={req.notes || ''}>{req.notes || '-'}</td>
                          <td className="text-xs max-w-[150px]">
                            {editingReqId === req.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editAdminNotes}
                                  onChange={(e) => setEditAdminNotes(e.target.value)}
                                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white w-full"
                                  placeholder="관리자 메모 입력"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveAdminNotes(req.id);
                                    if (e.key === 'Escape') { setEditingReqId(null); setEditAdminNotes(''); }
                                  }}
                                />
                                <button onClick={() => handleSaveAdminNotes(req.id)} className="text-green-400 text-xs hover:underline">저장</button>
                              </div>
                            ) : (
                              <span
                                className="text-gray-500 cursor-pointer hover:text-gray-300 truncate block"
                                onClick={() => { setEditingReqId(req.id); setEditAdminNotes(req.admin_notes || ''); }}
                                title={req.admin_notes || '클릭하여 메모 입력'}
                              >
                                {req.admin_notes || <span className="text-gray-600 italic">메모 없음</span>}
                              </span>
                            )}
                          </td>
                          <td className="text-gray-500 text-xs">{formatDate(req.created_at)}</td>
                          <td className="pr-4">
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {req.status === 'pending' && (
                                <>
                                  <button onClick={() => handleRequestStatusChange(req.id, 'approved')}
                                    className="btn-sm text-blue-400 hover:bg-blue-500/10 text-[10px]">승인</button>
                                  <button onClick={() => handleRequestStatusChange(req.id, 'rejected')}
                                    className="btn-sm text-red-400 hover:bg-red-500/10 text-[10px]">반려</button>
                                </>
                              )}
                              {req.status === 'approved' && (
                                <button onClick={() => handleRequestStatusChange(req.id, 'completed')}
                                  className="btn-sm text-green-400 hover:bg-green-500/10 text-[10px]">완료 처리</button>
                              )}
                              {(req.status === 'rejected' || req.status === 'completed') && (
                                <button onClick={() => handleRequestStatusChange(req.id, 'pending')}
                                  className="btn-sm text-gray-400 hover:bg-gray-500/10 text-[10px]">재검토</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: 팀매핑 */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'teams' && <UnmatchedTeamsPanel />}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: 설정 */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'settings' && (
        <>
          {settingsLoading ? (
            <div className="text-center py-8 text-gray-500 text-sm">로딩 중...</div>
          ) : (
            <div className="space-y-6">
              {/* 로그인 보안 */}
              <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800">
                  <h3 className="text-sm font-semibold text-white">로그인 보안</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">중복 로그인 및 세션 관련 설정</p>
                </div>
                <div className="divide-y divide-gray-800/50">
                  {/* 중복 로그인 허용 */}
                  <SettingToggleRow
                    label="중복 로그인 허용"
                    description="같은 계정으로 여러 기기/브라우저에서 동시 로그인 허용"
                    checked={getSettingBool('allow_concurrent_login', true)}
                    saving={settingSaving === 'allow_concurrent_login'}
                    onChange={() => handleToggleSetting('allow_concurrent_login', getSettingBool('allow_concurrent_login', true))}
                  />
                  {/* 기존 세션 강제 로그아웃 */}
                  <SettingToggleRow
                    label="신규 로그인 시 기존 세션 종료"
                    description="중복 로그인 불가 시, 새 로그인이 기존 세션을 자동 로그아웃"
                    checked={getSettingBool('force_logout_on_new_login', true)}
                    saving={settingSaving === 'force_logout_on_new_login'}
                    onChange={() => handleToggleSetting('force_logout_on_new_login', getSettingBool('force_logout_on_new_login', true))}
                    disabled={getSettingBool('allow_concurrent_login', true)}
                  />
                  {/* 최대 동시 세션 수 제한 */}
                  <SettingToggleRow
                    label="최대 동시 세션 수 제한"
                    description="중복 로그인 허용 시, 동시 접속 가능한 최대 기기 수 제한 (3대)"
                    checked={getSettingBool('limit_max_sessions', false)}
                    saving={settingSaving === 'limit_max_sessions'}
                    onChange={() => handleToggleSetting('limit_max_sessions', getSettingBool('limit_max_sessions', false))}
                    disabled={!getSettingBool('allow_concurrent_login', true)}
                  />
                </div>
              </div>

              {/* 알림 설정 */}
              <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800">
                  <h3 className="text-sm font-semibold text-white">알림</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">푸시 알림 및 텔레그램 설정</p>
                </div>
                <div className="divide-y divide-gray-800/50">
                  <SettingToggleRow
                    label="웹 푸시 알림"
                    description="브라우저 푸시 알림 전체 활성화/비활성화"
                    checked={getSettingBool('enable_web_push', true)}
                    saving={settingSaving === 'enable_web_push'}
                    onChange={() => handleToggleSetting('enable_web_push', getSettingBool('enable_web_push', true))}
                  />
                  <SettingToggleRow
                    label="텔레그램 알림"
                    description="텔레그램 봇 알림 전체 활성화/비활성화"
                    checked={getSettingBool('enable_telegram', true)}
                    saving={settingSaving === 'enable_telegram'}
                    onChange={() => handleToggleSetting('enable_telegram', getSettingBool('enable_telegram', true))}
                  />
                </div>
              </div>

              {/* 시스템 */}
              <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800">
                  <h3 className="text-sm font-semibold text-white">시스템</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">유지보수 및 접근 제어</p>
                </div>
                <div className="divide-y divide-gray-800/50">
                  <SettingToggleRow
                    label="유지보수 모드"
                    description="활성화 시 관리자 외 모든 접근 차단"
                    checked={getSettingBool('maintenance_mode', false)}
                    saving={settingSaving === 'maintenance_mode'}
                    onChange={() => handleToggleSetting('maintenance_mode', getSettingBool('maintenance_mode', false))}
                  />
                  <SettingToggleRow
                    label="신규 가입 허용"
                    description="새로운 사용자 자체 가입 허용 (관리자 생성은 항상 가능)"
                    checked={getSettingBool('allow_signup', false)}
                    saving={settingSaving === 'allow_signup'}
                    onChange={() => handleToggleSetting('allow_signup', getSettingBool('allow_signup', false))}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {/* 유저 상세 패널 */}
      {detailUser && (
        <UserDetailPanel
          targetUser={detailUser}
          onClose={() => setDetailUser(null)}
          onUserUpdated={(updated) => {
            setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
            setDetailUser(null);
          }}
        />
      )}
    </div>
  );
}

// ─── 설정 토글 행 컴포넌트 ───
function SettingToggleRow({
  label,
  description,
  checked,
  saving,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  saving: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex-1 min-w-0 mr-3">
        <div className="text-sm text-white font-medium">{label}</div>
        <div className="text-[11px] text-gray-500 mt-0.5">{description}</div>
      </div>
      <button
        onClick={onChange}
        disabled={saving || disabled}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
          checked ? 'bg-green-500' : 'bg-gray-600'
        } ${saving ? 'opacity-50' : ''}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-[20px]' : 'translate-x-[2px]'
          }`}
        />
      </button>
    </div>
  );
}
