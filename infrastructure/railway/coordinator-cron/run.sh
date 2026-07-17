#!/bin/sh

set -eu

: "${COORDINATOR_SCAN_URL:?COORDINATOR_SCAN_URL is required}"
: "${CRON_SECRET:?CRON_SECRET is required}"

base_url="${COORDINATOR_SCAN_URL%/}"

case "$base_url" in
  https://*) ;;
  *)
    echo "COORDINATOR_SCAN_URL must be an HTTPS URL" >&2
    exit 64
    ;;
esac

curl \
  --fail-with-body \
  --silent \
  --show-error \
  --retry 3 \
  --retry-connrefused \
  --retry-delay 5 \
  -X POST \
  "${base_url}/internal/coordinator-scan" \
  -H "Authorization: Bearer ${CRON_SECRET}"
