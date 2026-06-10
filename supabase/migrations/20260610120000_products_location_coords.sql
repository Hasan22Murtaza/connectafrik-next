-- Marketplace location coordinates for radius-based browse filtering

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_products_location_coords
  ON products (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
