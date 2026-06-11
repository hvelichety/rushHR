-- Queue tab only lists restaurants you manually opt in (separate from Yelp browse/call catalog)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS queue_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_restaurants_queue_enabled ON restaurants (queue_enabled);

-- Existing partners (adjust IDs if your DB differs)
UPDATE restaurants SET queue_enabled = true WHERE id IN (1, 2);

-- Yelp imports must stay off the queue list unless explicitly enabled
UPDATE restaurants SET queue_enabled = false WHERE yelp_id IS NOT NULL AND id NOT IN (1, 2);
