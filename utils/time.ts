export function minutesSince(lastUpdatedAt: number): number {
  if (!lastUpdatedAt) return 0;
  // convert seconds → ms only if needed
  if (lastUpdatedAt < 1e12) lastUpdatedAt *= 1000;
  return Math.floor((Date.now() - lastUpdatedAt) / 60000);
}

export function formatTimeAgo(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(minutes / 60);
  return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
}


  