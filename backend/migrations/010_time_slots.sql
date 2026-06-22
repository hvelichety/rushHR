-- Scheduled arrival time slots (hybrid with digital queue)

CREATE TABLE IF NOT EXISTS time_slots (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 10 CHECK (capacity > 0),
  booked_count INTEGER NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_slot_bookings (
  id SERIAL PRIMARY KEY,
  time_slot_id INTEGER NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1 CHECK (party_size > 0),
  confirmation_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'arrived', 'cancelled', 'no_show')),
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_slots_restaurant ON time_slots (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_start ON time_slots (start_time);
CREATE INDEX IF NOT EXISTS idx_time_slot_bookings_slot ON time_slot_bookings (time_slot_id);
CREATE INDEX IF NOT EXISTS idx_time_slot_bookings_restaurant ON time_slot_bookings (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_time_slot_bookings_device ON time_slot_bookings (device_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_slot_bookings_code ON time_slot_bookings (confirmation_code);

-- Seed sample slots for queue-enabled partners (today + tomorrow, 30-min windows)
INSERT INTO time_slots (restaurant_id, start_time, end_time, capacity, booked_count, status)
SELECT r.id, slot.start_time, slot.end_time, slot.capacity, 0, 'open'
FROM restaurants r
CROSS JOIN LATERAL (
  SELECT
    (date_trunc('day', NOW() AT TIME ZONE 'America/New_York') + interval '17 hours' + (n * interval '30 minutes')) AT TIME ZONE 'America/New_York' AS start_time,
    (date_trunc('day', NOW() AT TIME ZONE 'America/New_York') + interval '17 hours' + ((n + 1) * interval '30 minutes')) AT TIME ZONE 'America/New_York' AS end_time,
    CASE WHEN n = 0 THEN 8 WHEN n = 1 THEN 6 ELSE 10 END AS capacity
  FROM generate_series(0, 5) AS n
  UNION ALL
  SELECT
    (date_trunc('day', NOW() AT TIME ZONE 'America/New_York') + interval '1 day' + interval '17 hours' + (n * interval '30 minutes')) AT TIME ZONE 'America/New_York',
    (date_trunc('day', NOW() AT TIME ZONE 'America/New_York') + interval '1 day' + interval '17 hours' + ((n + 1) * interval '30 minutes')) AT TIME ZONE 'America/New_York',
    10
  FROM generate_series(0, 5) AS n
) AS slot
WHERE r.queue_enabled IS TRUE
  AND NOT EXISTS (
    SELECT 1 FROM time_slots ts
    WHERE ts.restaurant_id = r.id
      AND ts.start_time = slot.start_time
  );
