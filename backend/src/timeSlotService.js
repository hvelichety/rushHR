import { query, withTransaction } from './db.js';
import { normalizePartySize } from './partySize.js';
import { formatPhoneE164, isValidPhone } from './phone.js';

const ACTIVE_BOOKING_STATUSES = ['booked'];
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function mapSlot(row, restaurantName) {
  if (!row) return null;
  const capacity = Number(row.capacity);
  const bookedCount = Number(row.booked_count);
  const spotsAvailable = Math.max(0, capacity - bookedCount);
  const displayStatus = computeDisplayStatus(row);

  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    restaurantName: restaurantName || row.restaurant_name || undefined,
    startTime: row.start_time,
    endTime: row.end_time,
    capacity,
    bookedCount,
    spotsAvailable,
    status: row.status,
    displayStatus,
    arrivalWindowMinutes: 10,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBooking(row, extras = {}) {
  if (!row) return null;
  return {
    id: row.id,
    timeSlotId: row.time_slot_id,
    restaurantId: row.restaurant_id,
    customerName: row.customer_name,
    phoneNumber: row.phone_number,
    partySize: row.party_size,
    confirmationCode: row.confirmation_code,
    status: row.status,
    deviceId: row.device_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    restaurantName: extras.restaurantName,
    slotStartTime: extras.slotStartTime,
    slotEndTime: extras.slotEndTime,
  };
}

export function computeDisplayStatus(row) {
  if (row.status === 'closed') return 'full';
  const capacity = Number(row.capacity);
  const bookedCount = Number(row.booked_count);
  const available = capacity - bookedCount;
  if (available <= 0) return 'full';
  if (available / capacity <= 0.3) return 'almost_full';
  return 'available';
}

async function generateConfirmationCode() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const digits = String(Math.floor(1000 + Math.random() * 9000));
    const code = `TS-${letter}${digits}`;
    const { rows } = await query(
      `SELECT id FROM time_slot_bookings WHERE confirmation_code = $1`,
      [code]
    );
    if (rows.length === 0) return code;
  }
  throw new Error('Failed to generate confirmation code');
}

export async function getTimeSlotsForRestaurant(restaurantId, { from, to } = {}) {
  const params = [restaurantId];
  let dateFilter = 'ts.start_time >= NOW() - interval \'1 hour\'';

  if (from) {
    dateFilter = `ts.start_time >= $2::timestamptz`;
    params.push(from);
  }
  if (to) {
    const idx = params.length + 1;
    dateFilter += ` AND ts.start_time <= $${idx}::timestamptz`;
    params.push(to);
  }

  const { rows } = await query(
    `SELECT ts.*, r.name AS restaurant_name
     FROM time_slots ts
     JOIN restaurants r ON r.id = ts.restaurant_id
     WHERE ts.restaurant_id = $1
       AND ${dateFilter}
     ORDER BY ts.start_time ASC`,
    params
  );

  return rows.map((row) => mapSlot(row));
}

export async function getTimeSlotById(slotId) {
  const { rows } = await query(
    `SELECT ts.*, r.name AS restaurant_name
     FROM time_slots ts
     JOIN restaurants r ON r.id = ts.restaurant_id
     WHERE ts.id = $1`,
    [slotId]
  );
  return mapSlot(rows[0]);
}

export async function createTimeSlot(restaurantId, { startTime, endTime, capacity }) {
  if (!startTime || !endTime) {
    throw new Error('startTime and endTime are required');
  }

  const cap = Number(capacity);
  if (!Number.isFinite(cap) || cap <= 0) {
    throw new Error('capacity must be a positive number');
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new Error('Invalid start or end time');
  }

  const { rows } = await query(
    `INSERT INTO time_slots (restaurant_id, start_time, end_time, capacity)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [restaurantId, start.toISOString(), end.toISOString(), cap]
  );

  const location = await query('SELECT name FROM restaurants WHERE id = $1', [restaurantId]);
  return mapSlot(rows[0], location.rows[0]?.name);
}

export async function updateTimeSlot(slotId, { capacity, status }) {
  const updates = [];
  const params = [];
  let idx = 1;

  if (capacity != null) {
    const cap = Number(capacity);
    if (!Number.isFinite(cap) || cap <= 0) throw new Error('capacity must be positive');
    updates.push(`capacity = $${idx++}`);
    params.push(cap);
  }

  if (status != null) {
    if (!['open', 'closed'].includes(status)) throw new Error('Invalid status');
    updates.push(`status = $${idx++}`);
    params.push(status);
  }

  if (updates.length === 0) throw new Error('No updates provided');

  updates.push('updated_at = NOW()');
  params.push(slotId);

  const { rows } = await query(
    `UPDATE time_slots SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );

  if (!rows[0]) throw new Error('Time slot not found');
  return mapSlot(rows[0]);
}

export async function closeTimeSlot(slotId) {
  return updateTimeSlot(slotId, { status: 'closed' });
}

export async function getBookingsForSlot(slotId) {
  const { rows } = await query(
    `SELECT * FROM time_slot_bookings
     WHERE time_slot_id = $1
     ORDER BY created_at ASC`,
    [slotId]
  );
  return rows.map((row) => mapBooking(row));
}

export async function getActiveBookingForDevice(deviceId) {
  if (!deviceId) return null;

  const { rows } = await query(
    `SELECT b.*, r.name AS restaurant_name, ts.start_time, ts.end_time
     FROM time_slot_bookings b
     JOIN restaurants r ON r.id = b.restaurant_id
     JOIN time_slots ts ON ts.id = b.time_slot_id
     WHERE b.device_id = $1
       AND b.status = 'booked'
       AND ts.start_time >= NOW() - interval '2 hours'
     ORDER BY ts.start_time ASC
     LIMIT 1`,
    [deviceId]
  );

  if (!rows[0]) return null;
  return mapBooking(rows[0], {
    restaurantName: rows[0].restaurant_name,
    slotStartTime: rows[0].start_time,
    slotEndTime: rows[0].end_time,
  });
}

export async function getBookingById(bookingId) {
  const { rows } = await query(
    `SELECT b.*, r.name AS restaurant_name, ts.start_time, ts.end_time
     FROM time_slot_bookings b
     JOIN restaurants r ON r.id = b.restaurant_id
     JOIN time_slots ts ON ts.id = b.time_slot_id
     WHERE b.id = $1`,
    [bookingId]
  );

  if (!rows[0]) return null;
  return mapBooking(rows[0], {
    restaurantName: rows[0].restaurant_name,
    slotStartTime: rows[0].start_time,
    slotEndTime: rows[0].end_time,
  });
}

export async function bookTimeSlot({
  timeSlotId,
  customerName,
  phoneNumber,
  partySize,
  deviceId,
}) {
  const name = customerName?.trim();
  if (!name) throw new Error('customerName is required');

  const phone = formatPhoneE164(phoneNumber);
  if (!isValidPhone(phoneNumber)) throw new Error('Valid phone number is required');

  const size = normalizePartySize(partySize);
  if (size == null) throw new Error('Invalid party size');

  if (deviceId) {
    const existing = await getActiveBookingForDevice(deviceId);
    if (existing) {
      const err = new Error('You already have an active time slot booking');
      err.code = 'ALREADY_BOOKED';
      err.existingBookingId = existing.id;
      throw err;
    }
  }

  return withTransaction(async (client) => {
    const slotResult = await client.query(
      `SELECT * FROM time_slots WHERE id = $1 FOR UPDATE`,
      [timeSlotId]
    );
    const slot = slotResult.rows[0];
    if (!slot) throw new Error('Time slot not found');
    if (slot.status === 'closed') throw new Error('This time slot is closed');
    if (slot.booked_count >= slot.capacity) throw new Error('This time slot is full');

    const code = await generateConfirmationCode();

    const bookingResult = await client.query(
      `INSERT INTO time_slot_bookings (
        time_slot_id, restaurant_id, customer_name, phone_number,
        party_size, confirmation_code, status, device_id
      ) VALUES ($1, $2, $3, $4, $5, $6, 'booked', $7)
      RETURNING *`,
      [timeSlotId, slot.restaurant_id, name, phone, size, code, deviceId || null]
    );

    await client.query(
      `UPDATE time_slots SET
        booked_count = booked_count + 1,
        updated_at = NOW()
       WHERE id = $1`,
      [timeSlotId]
    );

    const restaurantResult = await client.query(
      'SELECT name FROM restaurants WHERE id = $1',
      [slot.restaurant_id]
    );

    return mapBooking(bookingResult.rows[0], {
      restaurantName: restaurantResult.rows[0]?.name,
      slotStartTime: slot.start_time,
      slotEndTime: slot.end_time,
    });
  });
}

export async function cancelBooking(bookingId, { deviceId } = {}) {
  return withTransaction(async (client) => {
    const bookingResult = await client.query(
      `SELECT * FROM time_slot_bookings WHERE id = $1 FOR UPDATE`,
      [bookingId]
    );
    const booking = bookingResult.rows[0];
    if (!booking) throw new Error('Booking not found');
    if (booking.status !== 'booked') throw new Error('Booking cannot be cancelled');
    if (deviceId && booking.device_id && booking.device_id !== deviceId) {
      throw new Error('Not authorized to cancel this booking');
    }

    const updated = await client.query(
      `UPDATE time_slot_bookings SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [bookingId]
    );

    await client.query(
      `UPDATE time_slots SET
        booked_count = GREATEST(0, booked_count - 1),
        updated_at = NOW()
       WHERE id = $1`,
      [booking.time_slot_id]
    );

    return mapBooking(updated.rows[0]);
  });
}

export async function markBookingArrived(bookingId) {
  const { rows } = await query(
    `UPDATE time_slot_bookings SET status = 'arrived', updated_at = NOW()
     WHERE id = $1 AND status = 'booked'
     RETURNING *`,
    [bookingId]
  );
  if (!rows[0]) throw new Error('Booking not found or already processed');
  return mapBooking(rows[0]);
}

export async function markBookingNoShow(bookingId) {
  return withTransaction(async (client) => {
    const bookingResult = await client.query(
      `SELECT * FROM time_slot_bookings WHERE id = $1 FOR UPDATE`,
      [bookingId]
    );
    const booking = bookingResult.rows[0];
    if (!booking) throw new Error('Booking not found');
    if (booking.status !== 'booked') throw new Error('Booking is not active');

    const updated = await client.query(
      `UPDATE time_slot_bookings SET status = 'no_show', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [bookingId]
    );

    await client.query(
      `UPDATE time_slots SET
        booked_count = GREATEST(0, booked_count - 1),
        updated_at = NOW()
       WHERE id = $1`,
      [booking.time_slot_id]
    );

    return mapBooking(updated.rows[0]);
  });
}
