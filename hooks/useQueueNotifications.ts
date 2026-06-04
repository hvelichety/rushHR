import { clearPendingNotifications, fetchPendingNotifications } from '@/utils/queueApi';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';

const shownNotificationIds = new Set<string>();

export function useQueueNotifications(deviceId: string | null) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!deviceId) return;

    async function poll() {
      try {
        const pending = await fetchPendingNotifications(deviceId!);
        const newOnes = pending.filter((n) => !shownNotificationIds.has(n.id));

        for (const notification of newOnes) {
          shownNotificationIds.add(notification.id);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Queue Update',
              body: notification.message,
              data: { entryId: notification.entryId, type: notification.type },
            },
            trigger: null,
          });
        }

        if (newOnes.length > 0) {
          await clearPendingNotifications(newOnes.map((n) => n.id));
        }
      } catch {
        // Backend may be offline in dev
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 4000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [deviceId]);
}
