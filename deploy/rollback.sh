#!/usr/bin/env bash
set -euo pipefail

# Code-only rollback. Data restoration is a separate, explicit maintenance action.
[[ "${EUID}" -eq 0 ]] || { echo 'Run this rollback as root.' >&2; exit 1; }
app_root=/opt/moduoduowriter
if [[ "$#" -eq 0 ]]; then
    [[ -f "$app_root/state/previous-release" ]] || { echo 'No previous application release was recorded.' >&2; exit 1; }
    previous=$(cat "$app_root/state/previous-release")
    [[ "$previous" == "$app_root/releases/"* ]] || { echo 'Invalid previous release metadata.' >&2; exit 1; }
    revision=${previous##*/}
elif [[ "$#" -eq 1 ]]; then
    revision=$1
else
    echo 'Usage: rollback.sh [COMMIT_SHA]' >&2
    exit 1
fi
[[ "$revision" =~ ^[a-f0-9]{7,40}$ ]] || { echo 'Invalid release revision.' >&2; exit 1; }
exec /bin/bash "$app_root/releases/$revision/deploy/activate-release.sh" "$revision"
