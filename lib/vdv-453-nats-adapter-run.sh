#!/usr/bin/sh

set -e
set -u
set -x # remove

expires_iso8601="$(date --iso-8601=seconds --date="@$(echo "$VDV_454_SUBSCRIPTION_TTL + $(date '+%s')" | bc)")"

node cli.js \
    --ref-aus-expires "$expires_iso8601" \
    --aus-expires "$expires_iso8601" \
    REF_AUS AUS
