#!/bin/sh
set -eu

schedule="${BACKUP_CRON:-0 2 * * *}"
printf '%s /usr/local/bin/backup >> /var/log/backup.log 2>&1\n' "$schedule" > /etc/crontabs/root

/usr/local/bin/backup
exec crond -f -l 2
