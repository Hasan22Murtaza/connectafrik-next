-- TradeHub categories + dedicated subcategory column
-- Fixes: products_category_check rejecting new category values

-- 1) Dedicated subcategory field (not tags)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS subcategory text;

CREATE INDEX IF NOT EXISTS idx_products_subcategory
  ON products (subcategory);

CREATE INDEX IF NOT EXISTS idx_products_category_subcategory
  ON products (category, subcategory);

-- 2) Expand category check: keep legacy values + TradeHub values
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;

ALTER TABLE products
  ADD CONSTRAINT products_category_check
  CHECK (
    category IS NULL
    OR category = ANY (
      ARRAY[
        -- Legacy marketplace categories
        'fashion',
        'crafts',
        'electronics',
        'food',
        'beauty',
        'home',
        'books',
        'art',
        'jewelry',
        'services',
        'other',
        -- TradeHub categories
        'furniture',
        'appliances',
        'clothing-accessories',
        'baby-kids',
        'sports-recreation',
        'home-garden',
        'tools-hardware',
        'books-movies-music',
        'collectibles-antiques',
        'vehicles-parts',
        'pet-supplies',
        'free-items',
        'handmade-crafts',
        'business-office',
        'community-giveaways',
        'miscellaneous'
      ]::text[]
    )
  );

-- 3) Allow "for-parts" condition (TradeHub)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_condition_check;

ALTER TABLE products
  ADD CONSTRAINT products_condition_check
  CHECK (
    condition IS NULL
    OR condition = ANY (
      ARRAY[
        'new',
        'like-new',
        'good',
        'fair',
        'for-parts'
      ]::text[]
    )
  );

-- 4) Backfill subcategory from legacy reserved tags when present
UPDATE products AS p
SET subcategory = replace(t.tag, 'subcat:', '')
FROM (
  SELECT id, unnest(tags) AS tag
  FROM products
  WHERE tags IS NOT NULL
) AS t
WHERE p.id = t.id
  AND p.subcategory IS NULL
  AND t.tag LIKE 'subcat:%';
