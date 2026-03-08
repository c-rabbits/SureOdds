'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getUsers, createUser, updateUser, deleteUser } from '@/lib/api';
import { UserProfile } from '@/types';

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // 사용자 생성 폼 상태
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // 비관리자 리다이렉트
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push('/');
    }
  }, [user, isAdmin, authLoading, router]);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  // 사용자 생성
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
      await createUser({
        email: newEmail,
        password: newPassword,
        display_name: newName || undefined,
        role: newRole,
      });
      // 폼 초기화
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewRole('user');
      setShowCreateForm(false);
      await loadUsers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setCreateError(error.response?.data?.error || '사용자 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  }

  // 활성화/비활성화 토글
  async function handleToggleActive(u: UserProfile) {
    try {
      await updateUser(u.id, { is_active: !u.is_active });
      await loadUsers();
    } catch (err) {
      console.error('Toggle active failed:', err);
    }
  }

  // 역할 변경
  async function handleToggleRole(u: UserProfile) {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    try {
      await updateUser(u.id, { role: newRole });
      await loadUsers();
    } catch (err) {
      console.error('Toggle role failed:', err);
    }
  }

  // 사용자 삭제
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

  // 날짜 포맷
  function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-sm">로딩 중...</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="h-full overflow-auto p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-white">회원 관리</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            총 {users.length}명의 회원
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn-primary text-sm py-1.5 px-3"
        >
          {showCreateForm ? '취소' : '+ 새 회원'}
        </button>
      </div>

      {/* 회원 생성 폼 */}
      {showCreateForm && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">새 회원 생성</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">이메일 *</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">비밀번호 *</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                placeholder="최소 6자"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">이름</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">역할</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              >
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
            <button
              onClick={handleCreate}
              disabled={creating}
              className="btn-primary text-sm py-1.5 px-4"
            >
              {creating ? '생성 중...' : '회원 생성'}
            </button>
          </div>
        </div>
      )}

      {/* 회원 목록 테이블 */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
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
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          u.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
                        }`}
                      >
                        {u.role === 'admin' ? '관리자' : '사용자'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                          u.is_active ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.is_active ? 'bg-green-400' : 'bg-red-400'
                          }`}
                        />
                        {u.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="text-gray-500">{formatDate(u.created_at)}</td>
                    <td className="text-gray-500">{formatDate(u.last_sign_in_at)}</td>
                    <td className="pr-4">
                      <div className="flex items-center justify-center gap-1">
                        {/* 활성화/비활성화 */}
                        {u.id !== user?.id && (
                          <button
                            onClick={() => handleToggleActive(u)}
                            className={`btn-sm ${
                              u.is_active
                                ? 'text-yellow-400 hover:bg-yellow-500/10'
                                : 'text-green-400 hover:bg-green-500/10'
                            }`}
                            title={u.is_active ? '비활성화' : '활성화'}
                          >
                            {u.is_active ? '비활성화' : '활성화'}
                          </button>
                        )}

                        {/* 역할 변경 */}
                        {u.id !== user?.id && (
                          <button
                            onClick={() => handleToggleRole(u)}
                            className="btn-sm text-purple-400 hover:bg-purple-500/10"
                            title={u.role === 'admin' ? '사용자로 변경' : '관리자로 변경'}
                          >
                            {u.role === 'admin' ? '→사용자' : '→관리자'}
                          </button>
                        )}

                        {/* 삭제 */}
                        {u.id !== user?.id && (
                          <button
                            onClick={() => handleDelete(u)}
                            className="btn-sm text-red-400 hover:bg-red-500/10"
                            title="삭제"
                          >
                            삭제
                          </button>
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
    </div>
  );
}
