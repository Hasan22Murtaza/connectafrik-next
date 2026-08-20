#!/usr/bin/env bash
# Digital Ocean droplet crontab helper.
# Install (hourly):
#   crontab -e
#   0 * * * * APP_URL=https://YOUR_DOMAIN CRON_SECRET=YOUR_SECRET /path/to/connectafrik/scripts/digital-ocean-cron.sh
#
# Prefer the in-process scheduler (instrumentation.ts) unless you set
# MARKETPLACE_IN_PROCESS_CRON=false.

set -euo pipefail

APP_URL="${APP_URL:?APP_URL is required, e.g. https://connectafrik.com}"
CRON_SECRET="${CRON_SECRET:-${MARKETPLACE_CRON_SECRET:-}}"

if [[ -z "$CRON_SECRET" ]]; then
  echo "CRON_SECRET or MARKETPLACE_CRON_SECRET is required" >&2
  exit 1
fi

curl -fsS -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL}/api/internal/cron/release-escrow"

curl -fsS -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL}/api/internal/cron/escalate-disputes"
