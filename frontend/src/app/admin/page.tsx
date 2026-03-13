'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getAdminSiteRegistrations,
  updateAdminSiteRegistration,
  getAdminSiteRequests,
  updateAdminSiteRequest,
} from '@/lib/api';
import { UserProfile, SiteRegistration, SiteRequest } from '@/types';

type AdminTab = 'users' | 'sites' | 'requests';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '대기중', color: 'bg-yellow-900/30 text-yellow-400 border-yellow-800' },
  approved: { label: '승인', color: 'bg-blue-900/30 text-blue-400 border-blue-800' },
  active: { label: '운영중', color: 'bg-green-900/30 text-green-400 border-green-800' },
  paused: { label: '일시정지', color: 'bg-gray-700/50 text-gray-400 border-gray-600' },
  rejected: { label: '반려', color: 'bg-red-900/30 text-red-400 border-red-800' },
  completed: { label: '완료', color: 'bg-green-900/30 text-green-400 border-green-800' },
};

type SiteRegWithProfile = SiteRegistration & { profiles?: { email: string; display_name: string | null } };
type SiteReqWithProfile = SiteRequest & { profiles?: { email: string; display_name: string | null } };

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  // ─── 회원 관리 ───
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // ─── 사이트 관리 ───
  const [sites, setSites] = useState<SiteRegWithProfile[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);

  // ─── 작업요청 관리 ───
  const [requests, setRequests] = useState<SiteReqWithProfile[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [editingReqId, setEditingReqId] = useState<string | null>(null);
  const [editAdminNotes, setEditAdminNotes] = useState('');

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

  const loadSites = useCallback(async () => {
    try {
      setSitesLoading(true);
      const data = await getAdminSiteRegistrations();
      setSites(data);
    } catch (err) {
      console.error('Failed to load sites:', err);
    } finally {
      setSitesLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === 'users') loadUsers();
    else if (activeTab === 'sites') loadSites();
    else if (activeTab === 'requests') loadRequests();
  }, [isAdmin, activeTab, loadUsers, loadSites, loadRequests]);

  // ─── 회원 관리 핸들러 ───
  async function handleCreate() {
    setCreateError('');
    if (!newEmail || !newPassword) {
      setCreateError('이메일과 비밀번호는 필수입니다.');
      return;
    }
    if (newPassword.length < 6) {
      setCreateError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }
    setCreating(true);
    try {
      await createUser({ email: newEmail, password: newPassword, display_name: newName || undefined, role: newRole });
      setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('user');
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

  async function handleToggleRole(u: UserProfile) {
    try {
      await updateUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' });
      await loadUsers();
    } catch (err) {
      console.error('Toggle role failed:', err);
    }
  }

  async function handleDelete(u: UserProfile) {
    if (!confirm(`정말 "${u.email}" 사용자를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await deleteUser(u.id);
      await loadUsers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      alert(error.response?.data?.error || '삭제에 실패했습니다.');
    }
  }

  // ─── 사이트 관리 핸들러 ───
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
  ];

  return (
    <div className="h-full overflow-auto p-4">
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
      <div className="flex gap-1 mb-4 border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-green-400 border-b-2 border-green-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
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
                  <label className="block text-xs text-gray-400 mb-1">이메일 *</label>
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" placeholder="email@example.com" />
                </div>
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
                <div>
                  <label className="block text-xs text-gray-400 mb-1">역할</label>
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500">
                    <option value="user">일반 사용자</option>
                    <option value="admin">관리자</option>
                  </select>
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
                      <th className="pl-4">이메일</th>
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
                      <tr key={u.id} className={!u.is_active ? 'opacity-50' : ''}>
                        <td className="pl-4">
                          <span className="text-white">{u.email}</span>
                          {u.id === user?.id && (
                            <span className="ml-1.5 text-[10px] text-green-400 font-medium">(나)</span>
                          )}
                        </td>
                        <td>{u.display_name || '-'}</td>
                        <td>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            u.role === 'admin'
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
                          }`}>
                            {u.role === 'admin' ? '관리자' : '사용자'}
                          </span>
                        </td>
                        <td>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${u.is_active ? 'text-green-400' : 'text-red-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                            {u.is_active ? '활성' : '비활성'}
                          </span>
                        </td>
                        <td className="text-gray-500">{formatDate(u.created_at)}</td>
                        <td className="text-gray-500">{formatDate(u.last_sign_in_at)}</td>
                        <td className="pr-4">
                          <div className="flex items-center justify-center gap-1">
                            {u.id !== user?.id && (
                              <>
                                <button onClick={() => handleToggleActive(u)}
                                  className={`btn-sm ${u.is_active ? 'text-yellow-400 hover:bg-yellow-500/10' : 'text-green-400 hover:bg-green-500/10'}`}
                                  title={u.is_active ? '비활성화' : '활성화'}>
                                  {u.is_active ? '비활성화' : '활성화'}
                                </button>
                                <button onClick={() => handleToggleRole(u)}
                                  className="btn-sm text-purple-400 hover:bg-purple-500/10"
                                  title={u.role === 'admin' ? '사용자로 변경' : '관리자로 변경'}>
                                  {u.role === 'admin' ? '→사용자' : '→관리자'}
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
          {/* 사이트 통계 */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="card p-3 text-center">
              <div className="text-xl font-bold text-white">{sites.length}</div>
              <div className="text-[10px] text-gray-400">전체</div>
            </div>
            <div className="card p-3 text-center">
              <div className="text-xl font-bold text-yellow-400">{sites.filter((s) => s.status === 'pending').length}</div>
              <div className="text-[10px] text-gray-400">승인 대기</div>
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

          <div className="card p-0 overflow-hidden">
            {sitesLoading ? (
              <div className="text-center py-8 text-gray-500 text-sm">로딩 중...</div>
            ) : sites.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">등록된 사이트가 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="pl-4">상태</th>
                      <th>사용자</th>
                      <th>그룹</th>
                      <th>사이트명</th>
                      <th>URL</th>
                      <th>아이디</th>
                      <th className="text-center">간격</th>
                      <th className="text-center">크로스</th>
                      <th className="text-center">핸디</th>
                      <th className="text-center">활성</th>
                      <th>등록일</th>
                      <th className="text-center pr-4">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sites.map((site) => {
                      const st = STATUS_MAP[site.status] || STATUS_MAP.pending;
                      return (
                        <tr key={site.id} className={!site.is_active ? 'opacity-50' : ''}>
                          <td className="pl-4">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${st.color}`}>{st.label}</span>
                          </td>
                          <td>
                            <div className="text-xs">
                              <div className="text-white">{site.profiles?.display_name || '-'}</div>
                              <div className="text-gray-500">{site.profiles?.email || '-'}</div>
                            </div>
                          </td>
                          <td className="text-gray-400 text-xs">{site.group_name}</td>
                          <td className="text-white font-medium text-xs">{site.site_name}</td>
                          <td className="text-gray-500 text-xs max-w-[120px] truncate" title={site.site_url}>{site.site_url}</td>
                          <td className="text-gray-300 text-xs">{site.login_id || '-'}</td>
                          <td className="text-center text-gray-300 text-xs">{site.check_interval}s</td>
                          <td className="text-center">{site.enable_cross ? <span className="text-green-400 text-xs">O</span> : <span className="text-gray-600 text-xs">-</span>}</td>
                          <td className="text-center">{site.enable_handicap ? <span className="text-purple-400 text-xs">O</span> : <span className="text-gray-600 text-xs">-</span>}</td>
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
                              {site.status === 'pending' && (
                                <>
                                  <button onClick={() => handleSiteStatusChange(site.id, 'approved')}
                                    className="btn-sm text-blue-400 hover:bg-blue-500/10 text-[10px]">승인</button>
                                  <button onClick={() => handleSiteStatusChange(site.id, 'rejected')}
                                    className="btn-sm text-red-400 hover:bg-red-500/10 text-[10px]">반려</button>
                                </>
                              )}
                              {site.status === 'approved' && (
                                <button onClick={() => handleSiteStatusChange(site.id, 'active')}
                                  className="btn-sm text-green-400 hover:bg-green-500/10 text-[10px]">운영시작</button>
                              )}
                              {site.status === 'active' && (
                                <button onClick={() => handleSiteStatusChange(site.id, 'paused')}
                                  className="btn-sm text-yellow-400 hover:bg-yellow-500/10 text-[10px]">일시정지</button>
                              )}
                              {site.status === 'paused' && (
                                <button onClick={() => handleSiteStatusChange(site.id, 'active')}
                                  className="btn-sm text-green-400 hover:bg-green-500/10 text-[10px]">재개</button>
                              )}
                              {site.status === 'rejected' && (
                                <button onClick={() => handleSiteStatusChange(site.id, 'pending')}
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
                              <div className="text-gray-500">{req.profiles?.email || '-'}</div>
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
    </div>
  );
}
