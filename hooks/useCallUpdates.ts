import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CallUpdate,
  voiceCallToUpdate,
} from '@/utils/callUpdates';
import { fetchDeviceCallUpdates, fetchVoiceCall } from '@/utils/voiceApi';
import { VoiceCall } from '@/utils/voiceTypes';

export function useCallUpdates(deviceId: string | null) {
  const [updates, setUpdates] = useState<CallUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const readIdsRef = useRef(new Set<number>());

  const upsertCall = useCallback((call: VoiceCall, restaurantName?: string) => {
    const enriched: VoiceCall = {
      ...call,
      restaurantName: call.restaurantName ?? restaurantName ?? null,
    };
    const isUnread =
      enriched.status === 'completed' && !readIdsRef.current.has(enriched.id);
    const next = voiceCallToUpdate(enriched, isUnread);

    setUpdates((prev) => {
      const rest = prev.filter((u) => u.callId !== next.callId);
      return [next, ...rest].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, []);

  const refreshUpdates = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const calls = await fetchDeviceCallUpdates(deviceId);
      const mapped = calls.map((call) =>
        voiceCallToUpdate(
          call,
          call.status === 'completed' && !readIdsRef.current.has(call.id)
        )
      );
      setUpdates(mapped);
    } catch {
      // Backend may be offline in dev
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  const markRead = useCallback((callId: number) => {
    readIdsRef.current.add(callId);
    setUpdates((prev) =>
      prev.map((u) => (u.callId === callId ? { ...u, isUnread: false } : u))
    );
  }, []);

  useEffect(() => {
    void refreshUpdates();
  }, [refreshUpdates]);

  useEffect(() => {
    if (!deviceId) return;

    const active = updates.filter((u) => u.status === 'calling');
    if (active.length === 0) return;

    const interval = setInterval(async () => {
      for (const item of active) {
        try {
          const call = await fetchVoiceCall(item.callId);
          upsertCall(call, item.restaurantName);
        } catch {
          // ignore transient errors
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [deviceId, updates, upsertCall]);

  const unreadCount = useMemo(
    () => updates.filter((u) => u.isUnread).length,
    [updates]
  );

  const activeCount = useMemo(
    () => updates.filter((u) => u.status === 'calling').length,
    [updates]
  );

  return {
    updates,
    loading,
    unreadCount,
    activeCount,
    refreshUpdates,
    upsertCall,
    markRead,
  };
}
