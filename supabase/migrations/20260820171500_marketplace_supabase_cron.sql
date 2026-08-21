-- Marketplace payout-hold / dispute cron via pg_cron + pg_net HTTP to the Next.js API.
-- The Digital Ocean app keeps the Stripe payout logic; Supabase only triggers it.
--
-- Before the first successful run, create Vault secrets (SQL Editor):
--   select vault.create_secret('https://connectafrik.com', 'marketplace_app_url');
--   select vault.create_secret('YOUR_CRON_SECRET', 'marketplace_cron_secret');
-- YOUR_CRON_SECRET must match CRON_SECRET (or MARKETPLACE_CRON_SECRET) on the app server.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.invoke_marketplace_http_cron(p_path text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault
AS $$
DECLARE
  app_url text;
  cron_secret text;
  request_id bigint;
BEGIN
  IF p_path IS NULL OR left(p_path, 1) <> '/' THEN
    RAISE EXCEPTION 'p_path must start with /';
  END IF;

  SELECT decrypted_secret INTO app_url
  FROM vault.decrypted_secrets
  WHERE name = 'marketplace_app_url'
  LIMIT 1;

  SELECT decrypted_secret INTO cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'marketplace_cron_secret'
  LIMIT 1;

  IF app_url IS NULL OR btrim(app_url) = '' THEN
    RAISE EXCEPTION 'Vault secret marketplace_app_url is missing';
  END IF;

  IF cron_secret IS NULL OR btrim(cron_secret) = '' THEN
    RAISE EXCEPTION 'Vault secret marketplace_cron_secret is missing';
  END IF;

  SELECT net.http_post(
    url := rtrim(app_url, '/') || p_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  )
  INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_marketplace_http_cron(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoke_marketplace_http_cron(text) TO postgres;
GRANT EXECUTE ON FUNCTION public.invoke_marketplace_http_cron(text) TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN (
      'marketplace-release-escrow',
      'marketplace-release-payouts',
      'marketplace-escalate-disputes'
    );

    PERFORM cron.schedule(
      'marketplace-release-payouts',
      '*/15 * * * *',
      $$SELECT public.invoke_marketplace_http_cron('/api/internal/cron/release-payouts')$$
    );

    PERFORM cron.schedule(
      'marketplace-escalate-disputes',
      '*/15 * * * *',
      $$SELECT public.invoke_marketplace_http_cron('/api/internal/cron/escalate-disputes')$$
    );
  END IF;
END
$cron$;
