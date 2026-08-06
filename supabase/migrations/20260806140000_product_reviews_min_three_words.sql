-- Allow any review length (short or long). Drop the old length check constraint.

ALTER TABLE public.product_reviews
  DROP CONSTRAINT IF EXISTS product_reviews_review_text_check;
