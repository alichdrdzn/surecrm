#!/usr/bin/env bash
#
# One-time provisioning of the SureCRM log directory.
#
#   sudo ./setup-logdir.sh
#
# Creates /var/log/surecrm owned by the invoking (service) user and installs
# a daily logrotate policy. Override the account with SERVICE_USER, e.g.
#   sudo SERVICE_USER=www-data ./setup-logdir.sh

set -euo pipefail

LOG_DIR="${LOG_DIR:-/var/log/surecrm}"
SERVICE_USER="${SERVICE_USER:-${SUDO_USER:-}}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "error: run with sudo (needs root to write under /var/log)." >&2
  exit 1
fi

if [[ -z "$SERVICE_USER" ]]; then
  echo "error: cannot determine service user; set SERVICE_USER=<account>." >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
chown "$SERVICE_USER":"$(id -gn "$SERVICE_USER")" "$LOG_DIR"
chmod 750 "$LOG_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
install -m 0644 "$SCRIPT_DIR/surecrm.logrotate" "/etc/logrotate.d/surecrm"

echo "OK: $LOG_DIR (owner $SERVICE_USER), logrotate policy installed."
