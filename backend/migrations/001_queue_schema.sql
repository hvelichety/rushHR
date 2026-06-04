-- Queue columns on existing restaurants table (same Postgres DB as calling logic)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS is_queue_open BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS average_service_time_minutes DOUBLE PRECISION NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS current_wait_time INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS queue_entries (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_contact TEXT NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  notification_5th_sent BOOLEAN NOT NULL DEFAULT false,
  notification_next_sent BOOLEAN NOT NULL DEFAULT false,
  notification_turn_sent BOOLEAN NOT NULL DEFAULT false,
  extension_used BOOLEAN NOT NULL DEFAULT false,
  called_at TIMESTAMPTZ,
  response_deadline TIMESTAMPTZ,
  extension_deadline TIMESTAMPTZ,
  check_in_code TEXT,
  checked_in_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  device_id TEXT,
  push_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_restaurant ON queue_entries(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_queue_status ON queue_entries(status);
CREATE INDEX IF NOT EXISTS idx_queue_check_in_code ON queue_entries(check_in_code);
