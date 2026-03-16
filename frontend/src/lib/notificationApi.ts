import type { AppNotification, AlertPreference } from '@/types/notification';
import axios from 'axios';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function getNotifications(params?: {
  limit?: number;
  offset?: number;
  type?: string;
  unread_only?: boolean;
}): Promise<AppNotification[]> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.type) query.set('type', params.type);
  if (params?.unread_only) query.set('unread_only', 'true');

  const headers = await authHeaders();
  const { data } = await axios.get(`${API_URL}/api/notifications?${query.toString()}`, { headers });
  return data.data || [];
}

export async function getUnreadCount(): Promise<number> {
  const headers = await authHeaders();
  const { data } = await axios.get(`${API_URL}/api/notifications/unread-count`, { headers });
  return data.count || 0;
}

export async function markAsRead(id: string): Promise<void> {
  const headers = await authHeaders();
  await axios.patch(`${API_URL}/api/notifications/${id}/read`, {}, { headers });
}

export async function markAllAsRead(): Promise<void> {
  const headers = await authHeaders();
  await axios.post(`${API_URL}/api/notifications/read-all`, {}, { headers });
}

export async function getAlertPreferences(): Promise<AlertPreference[]> {
  const headers = await authHeaders();
  const { data } = await axios.get(`${API_URL}/api/notifications/preferences`, { headers });
  return data.data || [];
}

export async function updateAlertPreferences(preferences: AlertPreference[]): Promise<void> {
  const headers = await authHeaders();
  await axios.put(`${API_URL}/api/notifications/preferences`, { preferences }, { headers });
}
