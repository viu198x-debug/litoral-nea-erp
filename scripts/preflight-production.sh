#!/bin/sh
set -eu

required="ERP_DOMAIN POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD JWT_ACCESS_SECRET JWT_REFRESH_SECRET CSRF_SECRET"
for name in $required; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "Falta la variable obligatoria: $name" >&2
    exit 1
  fi
done

for name in POSTGRES_PASSWORD JWT_ACCESS_SECRET JWT_REFRESH_SECRET CSRF_SECRET; do
  eval "value=\${$name}"
  if [ "${#value}" -lt 32 ]; then
    echo "$name debe contener al menos 32 caracteres" >&2
    exit 1
  fi
done

if [ "$JWT_ACCESS_SECRET" = "$JWT_REFRESH_SECRET" ] || [ "$JWT_ACCESS_SECRET" = "$CSRF_SECRET" ] || [ "$JWT_REFRESH_SECRET" = "$CSRF_SECRET" ]; then
  echo "Los tres secretos de autenticación deben ser diferentes" >&2
  exit 1
fi

case "$ERP_DOMAIN" in
  http://*|https://*|*/*|localhost|*.local) echo "ERP_DOMAIN debe ser sólo un dominio público, sin protocolo ni ruta" >&2; exit 1 ;;
esac

echo "Preflight correcto para $ERP_DOMAIN"
