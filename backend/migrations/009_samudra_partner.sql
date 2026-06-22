-- Samudra (Yelp: Samudhra) — manual partner.
-- Yelp often categorizes this as a lounge (excluded from auto-import) and the name
-- uses "Samudhra", so searching "samudra" did not match. Idempotent.

INSERT INTO restaurants (
  name,
  phone,
  cuisine,
  latitude,
  longitude,
  address,
  city,
  state,
  zip_code,
  call_eligible,
  queue_enabled,
  is_queue_open,
  timezone,
  open_hour,
  close_hour,
  last_updated_at
)
SELECT
  'Samudra Premium Restaurant',
  '+17323699942',
  'Indian',
  40.428493,
  -74.562721,
  '3391 State Route 27, Unit 107',
  'Franklin Park',
  'NJ',
  '08823',
  true,
  true,
  true,
  'America/New_York',
  11,
  24,
  (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
WHERE NOT EXISTS (
  SELECT 1 FROM restaurants WHERE phone = '+17323699942'
);

UPDATE restaurants SET
  name = 'Samudra Premium Restaurant',
  phone = '+17323699942',
  cuisine = 'Indian',
  latitude = 40.428493,
  longitude = -74.562721,
  address = '3391 State Route 27, Unit 107',
  city = 'Franklin Park',
  state = 'NJ',
  zip_code = '08823',
  call_eligible = true,
  queue_enabled = true,
  is_queue_open = true
WHERE phone = '+17323699942'
   OR LOWER(name) LIKE '%samudhra%'
   OR LOWER(name) LIKE '%samudra%';
