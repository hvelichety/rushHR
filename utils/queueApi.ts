import { Platform } from 'react-native';
import { QueueApiError } from './queueErrors';
import {
  BusinessLocation,
  JoinQueuePayload,
  LocationQueueResponse,
  QueueEntry,
  QueueNotification,
  VerifyCodeResult,
} from './queueTypes';

/** Local fallback only when EXPO_PUBLIC_QUEUE_API_URL is not set (optional dev) */
const DEV_QUEUE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:5001' : 'http://localhost:5001';

/**
 * Queue API — deploy backend/ to Railway and set EXPO_PUBLIC_QUEUE_API_URL to that service URL.
 * Falls back to localhost in dev if unset (legacy local server).
 */
export const QUEUE_API_BASE_URL =
  process.env.EXPO_PUBLIC_QUEUE_API_URL?.replace(/\/$/, '') ||
  (__DEV__ ? DEV_QUEUE_URL : '');

export function getQueueApiConfigError(): string | null {
  if (QUEUE_API_BASE_URL) return null;
  return 'Set EXPO_PUBLIC_QUEUE_API_URL in .env to your Railway queue service URL';
}

async function queueFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const configError = getQueueApiConfigError();
  if (configError) {
    throw new QueueApiError(configError);
  }

  const response = await fetch(`${QUEUE_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  let data: Record<string, unknown> = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const msg = (typeof data.error === 'string' && data.error) || `Request failed (${response.status})`;
    const existingEntryId =
      typeof data.existingEntryId === 'number' ? data.existingEntryId : undefined;
    const code = typeof data.code === 'string' ? data.code : undefined;
    throw new QueueApiError(msg, existingEntryId, code);
  }

  return data as T;
}

export async function fetchLocations(includeAll = false): Promise<BusinessLocation[]> {
  const suffix = includeAll ? '?all=1' : '';
  return queueFetch<BusinessLocation[]>(`/locations${suffix}`);
}

export async function fetchLocationQueue(locationId: number): Promise<LocationQueueResponse> {
  return queueFetch<LocationQueueResponse>(`/locations/${locationId}/queue`);
}

export async function fetchActiveQueueEntries(deviceId: string): Promise<QueueEntry[]> {
  return queueFetch<QueueEntry[]>(
    `/queue/active?deviceId=${encodeURIComponent(deviceId)}`
  );
}

export async function joinQueue(payload: JoinQueuePayload): Promise<QueueEntry> {
  return queueFetch<QueueEntry>('/queue/join', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchQueueStatus(entryId: number): Promise<QueueEntry> {
  return queueFetch<QueueEntry>(`/queue/${entryId}/status`);
}

export async function customerCheckIn(entryId: number): Promise<QueueEntry> {
  return queueFetch<QueueEntry>(`/queue/${entryId}/check-in`, { method: 'POST' });
}

export async function requestExtension(entryId: number): Promise<QueueEntry> {
  return queueFetch<QueueEntry>(`/queue/${entryId}/extension`, { method: 'POST' });
}

export async function callNextCustomer(locationId: number): Promise<QueueEntry> {
  return queueFetch<QueueEntry>(`/locations/${locationId}/call-next`, { method: 'POST' });
}

export async function markServed(entryId: number): Promise<QueueEntry> {
  return queueFetch<QueueEntry>(`/queue/${entryId}/served`, { method: 'POST' });
}

export async function markNoShow(entryId: number): Promise<QueueEntry> {
  return queueFetch<QueueEntry>(`/queue/${entryId}/no-show`, { method: 'POST' });
}

export async function removeQueueEntry(entryId: number): Promise<QueueEntry> {
  return queueFetch<QueueEntry>(`/queue/${entryId}`, { method: 'DELETE' });
}

export async function verifyCheckInCode(
  locationId: number,
  code: string
): Promise<VerifyCodeResult> {
  return queueFetch<VerifyCodeResult>(`/locations/${locationId}/verify-code`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function updateLocationSettings(
  locationId: number,
  settings: { isQueueOpen?: boolean; averageServiceTimeMinutes?: number }
): Promise<BusinessLocation> {
  return queueFetch<BusinessLocation>(`/locations/${locationId}/settings`, {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });
}

export async function fetchPendingNotifications(deviceId: string): Promise<QueueNotification[]> {
  return queueFetch<QueueNotification[]>(`/notifications/pending?deviceId=${encodeURIComponent(deviceId)}`);
}

export async function clearPendingNotifications(ids: string[]): Promise<void> {
  await queueFetch('/notifications/pending', {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  });
}
