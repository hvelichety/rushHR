import { query } from './db.js';

/**
 * Modular wait time calculation — replace with Toast/AI predictions later.
 */
export function calculateEstimatedWait(peopleAhead, averageServiceTimeMinutes) {
  return Math.max(0, peopleAhead * averageServiceTimeMinutes);
}

export async function updateLocationWaitTime(restaurantId) {
  const { rows: locRows } = await query(
    'SELECT average_service_time_minutes FROM restaurants WHERE id = $1',
    [restaurantId]
  );
  const location = locRows[0];
  if (!location) return;

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS count FROM queue_entries
     WHERE restaurant_id = $1
       AND status IN ('waiting', 'fifth_in_line', 'next_in_line', 'called', 'checked_in')`,
    [restaurantId]
  );

  const waitMinutes = calculateEstimatedWait(
    Math.max(0, countRows[0].count - 1),
    location.average_service_time_minutes
  );

  await query(`UPDATE restaurants SET current_wait_time = $1 WHERE id = $2`, [
    Math.round(waitMinutes),
    restaurantId,
  ]);
}
