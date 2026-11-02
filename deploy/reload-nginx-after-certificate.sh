#!/usr/bin/env bash
set -euo pipefail

# Certbot deploy hook: validate all currently installed sites before graceful reload.
# This does not restart nginx or any application process.
/usr/sbin/nginx -t
/usr/bin/systemctl reload nginx
