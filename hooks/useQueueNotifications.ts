import { clearPendingNotifications, fetchPendingNotifications } from '@/utils/queueApi';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';

const shownNotificationIds = new Set<string>();
export const handledVoiceCallIds = new Set<number>();

export function useQueueNotifications(deviceId: string | null) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!deviceId) return;

    async function poll() {
      try {
        const pending = await fetchPendingNotifications(deviceId!);
        const newOnes = pending.filter((n) => !shownNotificationIds.has(n.id));

        for (const notification of newOnes) {
          if (notification.type === 'voice_call_ready' && notification.callId) {
            if (handledVoiceCallIds.has(notification.callId)) {
              shownNotificationIds.add(notification.id);
              continue;
            }
          }

          shownNotificationIds.add(notification.id);

          const isVoiceCall = notification.type === 'voice_call_ready';
          await Notifications.scheduleNotificationAsync({
            content: {
              title: isVoiceCall
                ? notification.restaurantName || 'RushHR'
                : 'Queue Update',
              body: isVoiceCall ? 'Your update is ready' : notification.message,
              data: isVoiceCall
                ? {
                    type: notification.type,
                    callId: notification.callId,
                    restaurantId: notification.restaurantId,
                  }
                : { entryId: notification.entryId, type: notification.type },
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
