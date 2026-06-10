import { query } from './db.js';
import { normalizePartySize } from './partySize.js';
import { formatPhoneE164, isValidPhone } from './phone.js';
import { calculateEstimatedWait, updateLocationWaitTime } from './waitTime.js';

const ACTIVE_STATUSES = ['waiting', 'fifth_in_line', 'next_in_line', 'called', 'checked_in'];
const MAX_ACTIVE_QUEUES = 2;
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

const ACTIVE_STATUS_SQL = `('waiting', 'fifth_in_line', 'next_in_line', 'called', 'checked_in')`;
const WAITING_STATUS_SQL = `('waiting', 'fifth_in_line', 'next_in_line')`;

export async function generateCheckInCode() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const digits = String(Math.floor(100 + Math.random() * 900));
    const code = `${letter}${digits}`;

    const { rows } = await query(
      `SELECT id FROM queue_entries WHERE check_in_code = $1 AND status = 'checked_in'`,
      [code]
    );
    if (rows.length === 0) return code;
  }
  throw new Error('Failed to generate unique check-in code');
}

function mapEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    locationId: row.restaurant_id,
    customerName: row.customer_name,
    customerContact: row.customer_contact,
    partySize: row.party_size,
    position: row.position,
    status: row.status,
    notification5thSent: Boolean(row.notification_5th_sent),
    notificationNextSent: Boolean(row.notification_next_sent),
    notificationTurnSent: Boolean(row.notification_turn_sent),
    extensionUsed: Boolean(row.extension_used),
    calledAt: row.called_at,
    responseDeadline: row.response_deadline,
    extensionDeadline: row.extension_deadline,
    checkInCode: row.check_in_code,
    checkedInAt: row.checked_in_at,
    servedAt: row.served_at,
    deviceId: row.device_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLocation(row) {
  if (!row) return null;
  const addressParts = [row.address, row.city, row.state].filter(Boolean);
  return {
    id: row.id,
    name: row.name,
    address: addressParts.join(', ') || row.address,
    category: row.cuisine,
    isQueueOpen: row.is_queue_open !== false,
    averageServiceTimeMinutes: Number(row.average_service_time_minutes ?? 2),
    currentWaitTime: Number(row.current_wait_time ?? 0),
    queueCount: Number(row.queue_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getLocations({ includeAll = false } = {}) {
  const whereClause = includeAll ? '' : 'WHERE r.is_queue_open IS NOT FALSE';
  const { rows } = await query(
    `SELECT r.*,
      (SELECT COUNT(*)::int FROM queue_entries qe
       WHERE qe.restaurant_id = r.id AND qe.status IN ${ACTIVE_STATUS_SQL}
      ) AS queue_count
     FROM restaurants r
     ${whereClause}
     ORDER BY r.name`
  );
  return rows.map(mapLocation);
}

export async function getLocation(locationId) {
  const { rows } = await query(
    `SELECT r.*,
      (SELECT COUNT(*)::int FROM queue_entries qe
       WHERE qe.restaurant_id = r.id AND qe.status IN ${ACTIVE_STATUS_SQL}
      ) AS queue_count
     FROM restaurants r WHERE r.id = $1`,
    [locationId]
  );
  return mapLocation(rows[0]);
}

export async function getLocationQueue(locationId) {
  const { rows } = await query(
    `SELECT * FROM queue_entries
     WHERE restaurant_id = $1 AND status IN ${ACTIVE_STATUS_SQL}
     ORDER BY position ASC`,
    [locationId]
  );
  return rows.map(mapEntry);
}

export async function getQueueEntry(entryId) {
  const { rows } = await query('SELECT * FROM queue_entries WHERE id = $1', [entryId]);
  return mapEntry(rows[0]);
}

async function getActiveEntriesForLocation(locationId) {
  const { rows } = await query(
    `SELECT * FROM queue_entries
     WHERE restaurant_id = $1 AND status IN ${ACTIVE_STATUS_SQL}
     ORDER BY position ASC, created_at ASC`,
    [locationId]
  );
  return rows;
}

async function getWaitingEntries(locationId) {
  const { rows } = await query(
    `SELECT * FROM queue_entries
     WHERE restaurant_id = $1 AND status IN ${WAITING_STATUS_SQL}
     ORDER BY position ASC, created_at ASC`,
    [locationId]
  );
  return rows;
}

export async function recalculatePositions(locationId) {
  const entries = await getActiveEntriesForLocation(locationId);

  for (let index = 0; index < entries.length; index++) {
    await query(
      `UPDATE queue_entries SET position = $1, updated_at = NOW() WHERE id = $2`,
      [index + 1, entries[index].id]
    );
  }

  await updateStatusesAndNotifications(locationId);
  await updateLocationWaitTime(locationId);
}

async function updateStatusesAndNotifications(locationId) {
  const waitingEntries = await getWaitingEntries(locationId);
  const { rows: locRows } = await query(
    'SELECT is_queue_open FROM restaurants WHERE id = $1',
    [locationId]
  );
  const location = locRows[0];
  if (!location?.is_queue_open) return [];

  const pendingNotifications = [];

  for (let index = 0; index < waitingEntries.length; index++) {
    const entry = waitingEntries[index];
    const position = index + 1;

    if (position === 5 && !entry.notification_5th_sent) {
      await query(
        `UPDATE queue_entries SET status = 'fifth_in_line', notification_5th_sent = true, updated_at = NOW() WHERE id = $1`,
        [entry.id]
      );
      pendingNotifications.push({
        entryId: entry.id,
        type: 'fifth_in_line',
        message: "You're now 5th in line. Please start heading toward the location.",
        pushToken: entry.push_token,
      });
    } else if (position === 1 && !entry.notification_next_sent) {
      await query(
        `UPDATE queue_entries SET status = 'next_in_line', notification_next_sent = true, updated_at = NOW() WHERE id = $1`,
        [entry.id]
      );
      pendingNotifications.push({
        entryId: entry.id,
        type: 'next_in_line',
        message: "You're next in line. Please be ready.",
        pushToken: entry.push_token,
      });
    } else if (position > 1 && position !== 5) {
      await query(
        `UPDATE queue_entries SET status = 'waiting', updated_at = NOW() WHERE id = $1`,
        [entry.id]
      );
    } else if (position > 5) {
      await query(
        `UPDATE queue_entries SET status = 'waiting', updated_at = NOW() WHERE id = $1`,
        [entry.id]
      );
    }
  }

  return pendingNotifications;
}

export async function findActiveEntry(restaurantId, { deviceId, customerContact } = {}) {
  if (deviceId) {
    const { rows } = await query(
      `SELECT * FROM queue_entries
       WHERE restaurant_id = $1 AND device_id = $2 AND status IN ${ACTIVE_STATUS_SQL}
       LIMIT 1`,
      [restaurantId, deviceId]
    );
    if (rows[0]) return mapEntry(rows[0]);
  }

  if (customerContact?.trim()) {
    const { rows } = await query(
      `SELECT * FROM queue_entries
       WHERE restaurant_id = $1
         AND customer_contact = $2
         AND status IN ${ACTIVE_STATUS_SQL}
       LIMIT 1`,
      [restaurantId, customerContact.trim()]
    );
    if (rows[0]) return mapEntry(rows[0]);
  }

  return null;
}

export async function getActiveEntriesForDevice(deviceId) {
  if (!deviceId) return [];
  const { rows } = await query(
    `SELECT * FROM queue_entries
     WHERE device_id = $1 AND status IN ${ACTIVE_STATUS_SQL}
     ORDER BY created_at DESC`,
    [deviceId]
  );
  return rows.map(mapEntry);
}

async function countActiveQueuesForCustomer({ deviceId, customerContact }) {
  if (deviceId && customerContact) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count FROM queue_entries
       WHERE status IN ${ACTIVE_STATUS_SQL}
         AND (device_id = $1 OR customer_contact = $2)`,
      [deviceId, customerContact]
    );
    return rows[0].count;
  }

  if (deviceId) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count FROM queue_entries
       WHERE device_id = $1 AND status IN ${ACTIVE_STATUS_SQL}`,
      [deviceId]
    );
    return rows[0].count;
  }

  if (customerContact) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count FROM queue_entries
       WHERE customer_contact = $1 AND status IN ${ACTIVE_STATUS_SQL}`,
      [customerContact]
    );
    return rows[0].count;
  }

  return 0;
}

export async function joinQueue({ locationId, customerName, customerContact, partySize, deviceId, pushToken }) {
  const { rows: locRows } = await query('SELECT * FROM restaurants WHERE id = $1', [locationId]);
  const location = locRows[0];
  if (!location) throw new Error('Location not found');
  if (!location.is_queue_open) throw new Error('Queue is currently closed');

  if (!isValidPhone(customerContact)) {
    throw new Error('Please enter a valid US phone number');
  }
  const normalizedContact = formatPhoneE164(customerContact);
  const normalizedPartySize = normalizePartySize(partySize);

  const existing = await findActiveEntry(locationId, { deviceId, customerContact: normalizedContact });
  if (existing) {
    const err = new Error('You are already in this queue');
    err.code = 'ALREADY_IN_QUEUE';
    err.existingEntryId = existing.id;
    throw err;
  }

  const activeQueueCount = await countActiveQueuesForCustomer({
    deviceId,
    customerContact: normalizedContact,
  });
  if (activeQueueCount >= MAX_ACTIVE_QUEUES) {
    const err = new Error('You can only be in 2 queues at a time');
    err.code = 'MAX_QUEUES_REACHED';
    throw err;
  }

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS count FROM queue_entries
     WHERE restaurant_id = $1 AND status IN ${ACTIVE_STATUS_SQL}`,
    [locationId]
  );

  const position = countRows[0].count + 1;

  const { rows } = await query(
    `INSERT INTO queue_entries
     (restaurant_id, customer_name, customer_contact, party_size, position, status, device_id, push_token)
     VALUES ($1, $2, $3, $4, $5, 'waiting', $6, $7)
     RETURNING id`,
    [
      locationId,
      customerName,
      normalizedContact,
      normalizedPartySize,
      position,
      deviceId || null,
      pushToken || null,
    ]
  );

  await recalculatePositions(locationId);
  return enrichEntryWithWait(await getQueueEntry(rows[0].id));
}

async function getPeopleAhead(entry) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM queue_entries
     WHERE restaurant_id = $1 AND status IN ${WAITING_STATUS_SQL}
     AND position < $2`,
    [entry.locationId, entry.position]
  );
  return rows[0]?.count ?? 0;
}

async function enrichEntryWithWait(entry) {
  if (!entry) return null;

  const { rows } = await query(
    'SELECT average_service_time_minutes, name FROM restaurants WHERE id = $1',
    [entry.locationId]
  );
  const location = rows[0];

  const peopleAhead = await getPeopleAhead(entry);
  const estimatedWaitMinutes = calculateEstimatedWait(
    peopleAhead,
    location?.average_service_time_minutes ?? 2
  );

  return {
    ...entry,
    locationName: location?.name,
    peopleAhead,
    estimatedWaitMinutes,
  };
}

export async function getQueueStatus(entryId) {
  const entry = await getQueueEntry(entryId);
  if (!entry) return null;
  return enrichEntryWithWait(entry);
}

export async function callNextCustomer(locationId) {
  const { rows: locRows } = await query('SELECT * FROM restaurants WHERE id = $1', [locationId]);
  const location = locRows[0];
  if (!location) throw new Error('Location not found');
  if (!location.is_queue_open) throw new Error('Queue is paused');

  const { rows: calledRows } = await query(
    `SELECT id FROM queue_entries WHERE restaurant_id = $1 AND status = 'called'`,
    [locationId]
  );
  if (calledRows.length > 0) throw new Error('A customer is already being called');

  const { rows: nextRows } = await query(
    `SELECT * FROM queue_entries
     WHERE restaurant_id = $1 AND status IN ${WAITING_STATUS_SQL}
     ORDER BY position ASC LIMIT 1`,
    [locationId]
  );
  const next = nextRows[0];
  if (!next) throw new Error('No customers waiting in queue');

  const deadline = new Date(Date.now() + 60 * 1000);

  await query(
    `UPDATE queue_entries SET
      status = 'called',
      called_at = NOW(),
      response_deadline = $1,
      notification_turn_sent = true,
      updated_at = NOW()
     WHERE id = $2`,
    [deadline.toISOString(), next.id]
  );

  await recalculatePositions(locationId);

  const entry = await enrichEntryWithWait(await getQueueEntry(next.id));
  return {
    entry,
    notification: {
      entryId: next.id,
      type: 'turn',
      message: "It's your turn. Please check in now.",
      pushToken: next.push_token,
    },
  };
}

export async function customerCheckIn(entryId) {
  const { rows } = await query('SELECT * FROM queue_entries WHERE id = $1', [entryId]);
  const entry = rows[0];
  if (!entry) throw new Error('Queue entry not found');
  if (entry.status !== 'called') throw new Error('Not your turn to check in');

  const code = await generateCheckInCode();

  await query(
    `UPDATE queue_entries SET
      status = 'checked_in',
      check_in_code = $1,
      checked_in_at = NOW(),
      response_deadline = NULL,
      extension_deadline = NULL,
      updated_at = NOW()
     WHERE id = $2`,
    [code, entryId]
  );

  return enrichEntryWithWait(await getQueueEntry(entryId));
}

export async function requestExtension(entryId) {
  const { rows } = await query('SELECT * FROM queue_entries WHERE id = $1', [entryId]);
  const entry = rows[0];
  if (!entry) throw new Error('Queue entry not found');
  if (entry.status !== 'called') throw new Error('Extension only available when called');
  if (entry.extension_used) throw new Error('Extension already used');

  const deadline = new Date(Date.now() + 2 * 60 * 1000);

  await query(
    `UPDATE queue_entries SET
      extension_used = true,
      extension_deadline = $1,
      response_deadline = NULL,
      updated_at = NOW()
     WHERE id = $2`,
    [deadline.toISOString(), entryId]
  );

  return enrichEntryWithWait(await getQueueEntry(entryId));
}

export async function markServed(entryId) {
  const { rows } = await query('SELECT * FROM queue_entries WHERE id = $1', [entryId]);
  const entry = rows[0];
  if (!entry) throw new Error('Queue entry not found');

  await query(
    `UPDATE queue_entries SET status = 'served', served_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [entryId]
  );

  await recalculatePositions(entry.restaurant_id);
  return enrichEntryWithWait(await getQueueEntry(entryId));
}

export async function markNoShow(entryId) {
  const { rows } = await query('SELECT * FROM queue_entries WHERE id = $1', [entryId]);
  const entry = rows[0];
  if (!entry) throw new Error('Queue entry not found');

  await query(`UPDATE queue_entries SET status = 'no_show', updated_at = NOW() WHERE id = $1`, [entryId]);

  await recalculatePositions(entry.restaurant_id);
  return enrichEntryWithWait(await getQueueEntry(entryId));
}

export async function removeEntry(entryId) {
  const { rows } = await query('SELECT * FROM queue_entries WHERE id = $1', [entryId]);
  const entry = rows[0];
  if (!entry) throw new Error('Queue entry not found');

  await query(`UPDATE queue_entries SET status = 'removed', updated_at = NOW() WHERE id = $1`, [entryId]);

  await recalculatePositions(entry.restaurant_id);
  return enrichEntryWithWait(await getQueueEntry(entryId));
}

export async function verifyCheckInCode(locationId, code) {
  const normalized = code.trim().toUpperCase();
  const { rows } = await query(
    `SELECT * FROM queue_entries
     WHERE restaurant_id = $1 AND check_in_code = $2 AND status = 'checked_in'`,
    [locationId, normalized]
  );

  if (rows.length === 0) return { verified: false, entry: null };
  return { verified: true, entry: await enrichEntryWithWait(mapEntry(rows[0])) };
}

export async function updateLocationSettings(locationId, settings) {
  const { rows: locRows } = await query('SELECT * FROM restaurants WHERE id = $1', [locationId]);
  if (locRows.length === 0) throw new Error('Location not found');

  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (settings.isQueueOpen !== undefined) {
    updates.push(`is_queue_open = $${paramIndex++}`);
    values.push(settings.isQueueOpen);
  }
  if (settings.averageServiceTimeMinutes !== undefined) {
    updates.push(`average_service_time_minutes = $${paramIndex++}`);
    values.push(settings.averageServiceTimeMinutes);
  }

  if (updates.length === 0) return getLocation(locationId);

  values.push(locationId);
  await query(`UPDATE restaurants SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);

  await updateLocationWaitTime(locationId);
  return getLocation(locationId);
}

export async function processExpiredDeadlines() {
  const now = new Date().toISOString();
  const expired = [];

  const { rows: responseExpired } = await query(
    `SELECT * FROM queue_entries
     WHERE status = 'called' AND extension_used = false
       AND response_deadline IS NOT NULL AND response_deadline < $1`,
    [now]
  );

  for (const entry of responseExpired) {
    await query(`UPDATE queue_entries SET status = 'no_show', updated_at = NOW() WHERE id = $1`, [
      entry.id,
    ]);
    await recalculatePositions(entry.restaurant_id);
    expired.push(entry.id);
  }

  const { rows: extensionExpired } = await query(
    `SELECT * FROM queue_entries
     WHERE status = 'called' AND extension_used = true
       AND extension_deadline IS NOT NULL AND extension_deadline < $1`,
    [now]
  );

  for (const entry of extensionExpired) {
    await query(`UPDATE queue_entries SET status = 'no_show', updated_at = NOW() WHERE id = $1`, [
      entry.id,
    ]);
    await recalculatePositions(entry.restaurant_id);
    expired.push(entry.id);
  }

  return expired;
}

export async function collectPendingNotifications() {
  const notifications = [];
  const { rows: locations } = await query('SELECT id FROM restaurants');
  for (const { id } of locations) {
    const pending = await updateStatusesAndNotifications(id);
    notifications.push(...pending);
  }
  return notifications;
}
