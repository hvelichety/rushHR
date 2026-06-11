-- Mark restaurants that should appear in Call & Ask (curated, not fast-food chains)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS call_eligible BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_restaurants_call_eligible ON restaurants (call_eligible);
