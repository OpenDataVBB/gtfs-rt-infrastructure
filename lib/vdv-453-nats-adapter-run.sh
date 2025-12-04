#!/usr/bin/sh

set -e
set -u
set -x # remove

expires_iso8601="$(date --iso-8601=seconds --date="@$(echo "$VDV_454_SUBSCRIPTION_TTL + $(date '+%s')" | bc)")"

node cli.js \
    --aus-expires "$expires_iso8601" \
    AUS
# We skip REF-AUS fetching for now because either VBB's endpoint or vdv-453-nats-adapter is buggy.
# todo: fix this!
#    --ref-aus-expires "$expires_iso8601" \
#    REF_AUS AUS
