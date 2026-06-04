/**
 * Modular wait time calculation — replace with Toast/AI predictions later.
 */
export function calculateEstimatedWait(
  peopleAhead: number,
  averageServiceTimeMinutes: number
): number {
  return Math.max(0, peopleAhead * averageServiceTimeMinutes);
}
