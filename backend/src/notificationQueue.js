const pendingNotifications = [];

export function enqueueNotifications(notifications) {
  if (!notifications?.length) return;
  for (const n of notifications) {
    pendingNotifications.push({
      ...n,
      id: `${Date.now()}-${Math.random()}`,
      createdAt: new Date().toISOString(),
    });
  }
}

export async function getPendingNotificationsForDevice(deviceId, { getQueueStatus }) {
  if (!deviceId) return [...pendingNotifications];

  const relevant = [];
  for (const n of pendingNotifications) {
    if (n.callId && n.deviceId === deviceId) {
      relevant.push(n);
    } else if (n.entryId) {
      const entry = await getQueueStatus(n.entryId);
      if (entry?.deviceId === deviceId) relevant.push(n);
    }
  }
  return relevant;
}

export function clearPendingNotifications(ids) {
  if (!Array.isArray(ids)) return;
  for (let i = pendingNotifications.length - 1; i >= 0; i--) {
    if (ids.includes(pendingNotifications[i].id)) {
      pendingNotifications.splice(i, 1);
    }
  }
}
