#!/bin/sh
set -eu
if [ -z "${AUTH_PASSWORD:-}" ]; then
  echo 'Set AUTH_PASSWORD before starting the public extension server.' >&2
  exit 1
fi
export BIND_PORT="${PORT:-4567}"
# Docker volumes may mount as root; give the application its data directory.
teramanga_data_path=/home/suwayomi/.local/share/Tachidesk
mkdir -p "$teramanga_data_path"
chown suwayomi:suwayomi "$teramanga_data_path"
exec runuser -u suwayomi -- /home/suwayomi/startup_script.sh
