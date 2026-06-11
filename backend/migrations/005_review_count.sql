ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS review_count INTEGER;

CREATE INDEX IF NOT EXISTS idx_restaurants_popularity
  ON restaurants (review_count DESC NULLS LAST, rating DESC NULLS LAST);
