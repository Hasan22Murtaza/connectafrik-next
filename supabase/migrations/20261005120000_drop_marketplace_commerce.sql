-- TradeHub is a Facebook-style marketplace: listings and direct chat only.
-- Checkout, orders, payouts, reviews, and disputes are no longer part of the product.

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN (
      'marketplace-release-escrow',
      'marketplace-release-payouts',
      'marketplace-escalate-disputes'
    );
  END IF;
END
$cron$;

DROP VIEW IF EXISTS public.order_with_parties CASCADE;
DROP VIEW IF EXISTS public.orders_with_parties CASCADE;
DROP VIEW IF EXISTS public.seller_earnings_summary CASCADE;
DROP VIEW IF EXISTS public.platform_revenue_summary CASCADE;

ALTER TABLE IF EXISTS public.orders
  DROP CONSTRAINT IF EXISTS fk_orders_dispute;

DROP TABLE IF EXISTS public.dispute_messages CASCADE;
DROP TABLE IF EXISTS public.dispute_evidence CASCADE;
DROP TABLE IF EXISTS public.disputes CASCADE;
DROP TABLE IF EXISTS public.refund_transactions CASCADE;
DROP TABLE IF EXISTS public.order_ledger CASCADE;
DROP TABLE IF EXISTS public.seller_payouts CASCADE;
DROP TABLE IF EXISTS public.payment_transactions CASCADE;
DROP TABLE IF EXISTS public.chargeback_events CASCADE;
DROP TABLE IF EXISTS public.seller_reserve_ledger CASCADE;
DROP TABLE IF EXISTS public.stripe_payment_methods CASCADE;
DROP TABLE IF EXISTS public.review_helpful CASCADE;
DROP TABLE IF EXISTS public.product_reviews CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
