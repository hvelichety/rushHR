ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS yelp_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_yelp_id
  ON restaurants (yelp_id);

CREATE TABLE IF NOT EXISTS restaurant_sync_regions (
  region_key TEXT PRIMARY KEY,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_count INTEGER NOT NULL DEFAULT 0
);
