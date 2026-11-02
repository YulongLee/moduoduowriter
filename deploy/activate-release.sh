#!/usr/bin/env bash
set -euo pipefail

# Activate only a prepared, immutable release of this application.
# Root-owned releases and the existing dedicated systemd unit must be installed first.
[[ "${EUID}" -eq 0 ]] || { echo 'Run this release switch as root.' >&2; exit 1; }
[[ "$#" -eq 1 && "$1" =~ ^[a-f0-9]{7,40}$ ]] || { echo 'Usage: activate-release.sh COMMIT_SHA' >&2; exit 1; }
app_root=/opt/moduoduowriter
revision=$1
release="$app_root/releases/$revision"
node_runtime="$app_root/runtime/node/bin/node"
unit=moduoduowriter.service
[[ -d "$release" && -f "$release/server/http.mjs" && -f "$release/dist/index.html" && -d "$release/node_modules" && -x "$node_runtime" ]] || { echo 'Prepared release or dedicated Node runtime is incomplete.' >&2; exit 1; }
[[ "$(realpath "$release")" == "$release" ]] || { echo 'Release must be a real directory inside the application releases folder.' >&2; exit 1; }
[[ ! -e "$app_root/current" || -L "$app_root/current" ]] || { echo 'Refusing to replace a non-symlink current path.' >&2; exit 1; }
[[ -f /etc/moduoduowriter.env ]] || { echo 'Dedicated service environment file is missing.' >&2; exit 1; }

unsafe_path=$(find "$release" -xdev \( -type f -o -type d \) \( ! -user root -o -perm /022 \) -print -quit)
[[ -z "$unsafe_path" ]] || { echo 'Release must be root-owned and not group/other writable.' >&2; exit 1; }
while IFS= read -r -d '' link; do
    resolved=$(realpath -e "$link")
    [[ "$resolved" == "$release/"* ]] || { echo 'Release contains a symlink outside its own directory.' >&2; exit 1; }
done < <(find "$release" -xdev -type l -print0)


exec 9>/run/lock/moduoduowriter-deploy.lock
flock -n 9 || { echo 'Another Moduoduo release operation is in progress.' >&2; exit 1; }
previous=''
if [[ -L "$app_root/current" ]]; then
    previous=$(readlink -f "$app_root/current")
    [[ "$previous" == "$app_root/releases/"* && -d "$previous" ]] || { echo 'Current release target is outside this application.' >&2; exit 1; }
fi
next_link="$app_root/.current.next.$$"
switched=0
stopped=0
was_active=0
if systemctl is-active --quiet "$unit"; then was_active=1; fi

switch_link() {
    ln -s "$1" "$next_link"
    mv -Tf "$next_link" "$app_root/current"
}
on_exit() {
    local status=$?
    rm -f "$next_link"
    if [[ "$status" -ne 0 && "$stopped" -eq 1 ]]; then
        if [[ "$switched" -eq 1 && -n "$previous" ]]; then
            switch_link "$previous"
            systemctl restart "$unit" || true
            echo 'Previous application symlink restored; verify the dedicated service status.' >&2
        elif [[ "$switched" -eq 1 ]]; then
            systemctl stop "$unit" || true
            rm -f "$app_root/current"
            echo 'First activation failed; the prepared release and data snapshot remain available.' >&2
        elif [[ "$was_active" -eq 1 ]]; then
            systemctl start "$unit" || true
        fi
    fi
    exit "$status"
}
trap on_exit EXIT

# Stop this service only; other applications and nginx remain running.
systemctl stop "$unit"
stopped=1
"$node_runtime" "$release/deploy/backup-data.mjs" "$revision"
switch_link "$release"
switched=1
systemctl start "$unit"

healthy=0
for attempt in {1..20}; do
    if systemctl is-active --quiet "$unit" && curl --fail --silent --max-time 3 -H 'Host: moduoduowriter.com' http://127.0.0.1:18731/healthz > /dev/null; then
        healthy=1
        break
    fi
    sleep 1
done
[[ "$healthy" -eq 1 ]] || { echo 'Dedicated application health check failed.' >&2; exit 1; }
sleep 1
systemctl is-active --quiet "$unit" || { echo 'Dedicated service exited after startup.' >&2; exit 1; }
curl --fail --silent --show-error --max-time 5 -H 'Host: moduoduowriter.com' http://127.0.0.1:18731/api/auth/status | "$node_runtime" -e 'let input="";process.stdin.on("data",part=>input+=part);process.stdin.on("end",()=>{try{if(JSON.parse(input).configured!==true)process.exit(1);}catch{process.exit(1);}});' || { echo 'Administrator account initialization is not ready.' >&2; exit 1; }
install -d -m 0700 "$app_root/state"
if [[ -n "$previous" ]]; then
    printf '%s\n' "$previous" > "$app_root/state/previous-release.tmp"
    chmod 0600 "$app_root/state/previous-release.tmp"
    mv -f "$app_root/state/previous-release.tmp" "$app_root/state/previous-release"
fi
printf 'Activated Moduoduo release %s\n' "$revision"
