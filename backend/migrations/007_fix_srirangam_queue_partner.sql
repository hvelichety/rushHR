-- SriRangam is the queue partner; Yelp also lists "Mango Tree" on the same phone and was overwriting the name.
-- Idempotent: safe to re-run on every deploy (migrations are not tracked).

UPDATE restaurants SET
  name = 'SriRangam Veg Restaurant',
  address = '102 US-206, Ste 102',
  city = 'Hillsborough Township',
  state = 'NJ',
  latitude = 40.506595,
  longitude = -74.6381933,
  cuisine = 'Indian',
  queue_enabled = true
WHERE phone = '+19088293169'
   OR LOWER(name) LIKE '%srirangam%'
   OR id = 2;

UPDATE restaurants SET queue_enabled = true
WHERE LOWER(TRIM(name)) = 'test';

UPDATE restaurants SET queue_enabled = false
WHERE LOWER(name) LIKE '%mango tree%';
