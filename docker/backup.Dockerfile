FROM postgres:16-alpine

COPY docker/backup.sh /usr/local/bin/backup
COPY docker/backup-entrypoint.sh /usr/local/bin/backup-entrypoint
RUN chmod +x /usr/local/bin/backup /usr/local/bin/backup-entrypoint

ENTRYPOINT ["backup-entrypoint"]
