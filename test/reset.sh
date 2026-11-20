#!/bin/sh
# Reinicia la base local y arranca wrangler dev en el puerto 8787
pkill -f "wrangler dev" 2>/dev/null; sleep 1
rm -rf .wrangler/state
npx wrangler d1 migrations apply fire-angel --local >/dev/null 2>&1
(npx wrangler dev --port 8787 --ip 127.0.0.1 > /tmp/wd.log 2>&1 &)
for i in $(seq 1 30); do curl -s localhost:8787/api/arranque >/dev/null 2>&1 && break; sleep 1; done
