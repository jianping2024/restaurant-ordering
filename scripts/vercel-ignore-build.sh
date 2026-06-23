#!/usr/bin/env bash
# Deprecated: use scripts/vercel-ignore-web.sh for the mesa-web Vercel project.
exec "$(dirname "$0")/vercel-ignore-web.sh" "$@"
