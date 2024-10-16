#!/usr/bin/sh

set -e
set -u
set -x # remove

node cli.js --expires "$(date --iso-8601=seconds --date="@$(echo "$VDV_454_AUS_SUBSCRIPTION_TTL + $(date '+%s')" | bc)")" AUS
