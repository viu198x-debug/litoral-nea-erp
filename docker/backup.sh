#!/bin/sh
set -eu

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="/backups/litoral_nea_erp_${timestamp}.sql.gz"
retention="${BACKUP_RETENTION_DAYS:-30}"

umask 077
pg_dump --format=plain --no-owner --no-privileges | gzip -9 > "$target"
sha256sum "$target" > "$target.sha256"
find /backups -type f -name 'litoral_nea_erp_*.sql.gz*' -mtime "+$retention" -delete

printf 'Backup creado: %s\n' "$target"
