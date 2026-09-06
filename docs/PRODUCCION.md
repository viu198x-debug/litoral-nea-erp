# Despliegue en producción

## VPS recomendado

- Linux LTS actualizado.
- 4 vCPU, 8 GB RAM y SSD con monitoreo.
- Dominio corporativo y certificado TLS.
- Firewall: publicar solamente 80/443 y administración restringida.
- Volumen de PostgreSQL y documentos en disco persistente.

## Procedimiento

1. Clonar el repositorio en el servidor.
2. Crear .env sin usar valores demo.
3. Definir `APP_PORT`, `FRONTEND_URL`, `DOCKER_PUBLIC_URL` con HTTPS,
   `COOKIE_SECURE=true` y tres secretos aleatorios independientes.
4. Definir SEED_DEMO=false.
5. Ejecutar:

   ~~~bash
   docker compose build --pull
   docker compose up -d
   docker compose ps
   ~~~

6. Comprobar /api/v1/health, login, una lectura con permisos y una descarga.

### Instalación segura con dominio y HTTPS automático

La variante recomendada usa `docker-compose.production.yml`. PostgreSQL queda
aislado en la red interna y Caddy obtiene y renueva gratuitamente el certificado
TLS de Let's Encrypt.

~~~bash
cp .env.production.example .env.production
# Completar el archivo sin conservar ningún valor GENERAR_...
set -a
. ./.env.production
set +a
./scripts/preflight-production.sh
docker compose --env-file .env.production -f docker-compose.production.yml build --pull
docker compose --env-file .env.production -f docker-compose.production.yml up -d
docker compose --env-file .env.production -f docker-compose.production.yml ps
~~~

Antes de iniciar, el registro DNS A/AAAA de `ERP_DOMAIN` debe apuntar al VPS y
los puertos 80/443 deben estar habilitados. No se publica el puerto 5432.

El validador de entorno detiene deliberadamente el backend en producción si
detecta HTTP, cookies no seguras, credenciales de ejemplo, comodines CORS,
secretos débiles/repetidos, `SEED_DEMO=true` o pares OAuth incompletos.

## Google OAuth

1. Crear un cliente OAuth 2.0 de tipo aplicación web en Google Cloud.
2. Registrar exactamente esta URI autorizada:

   ~~~text
   https://DOMINIO/api/v1/auth/oauth/google/callback
   ~~~

3. Cargar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en el gestor de secretos
   del servidor. No incorporarlos al repositorio ni a la imagen.

## Microsoft / Hotmail

1. Registrar la aplicación en Microsoft Entra ID.
2. Para permitir Hotmail/Outlook personales, seleccionar el tipo de cuenta que
   incluya cuentas personales de Microsoft y mantener `MICROSOFT_TENANT=common`.
3. Registrar exactamente:

   ~~~text
   https://DOMINIO/api/v1/auth/oauth/microsoft/callback
   ~~~

4. Cargar `MICROSOFT_CLIENT_ID` y `MICROSOFT_CLIENT_SECRET` mediante secretos
   del servidor.

Usar el mismo dominio base para frontend y API (por ejemplo `erp.empresa.com`)
facilita cookies `SameSite=Strict`. Si se separan en sitios distintos, debe
revisarse expresamente el modelo de cookies y CSRF antes del despliegue.

## Backups

El servicio **backup** ejecuta pg_dump, comprime el archivo, genera SHA-256 y
retiene 30 días por defecto. Los archivos se guardan en backups/.

Ejecutar uno manual:

~~~bash
docker compose exec backup /usr/local/bin/backup
~~~

Restauración de ejemplo en una base vacía:

~~~bash
gunzip -c backups/litoral_nea_erp_FECHA.sql.gz | docker compose exec -T postgres psql -U litoral_nea -d litoral_nea_erp
~~~

Antes de restaurar, verificar el hash, detener escrituras y conservar una copia
del estado actual. La restauración debe ensayarse en un entorno aislado.

## Actualizaciones

1. Crear backup verificado.
2. Descargar la versión aprobada.
3. Ejecutar docker compose build.
4. Ejecutar docker compose up -d.
5. Prisma aplica únicamente migraciones pendientes.
6. Verificar salud y revisar logs de migración.

No modificar migraciones ya aplicadas; toda corrección se agrega en una nueva.

## Monitoreo

Supervisar CPU, memoria, disco, latencia, errores HTTP, conexiones PostgreSQL,
estado de backups, vencimientos TLS y espacio de documentos.

Configurar alertas para intentos de acceso repetidos, sesiones revocadas por
replay, decisiones administrativas, cambios de roles, fallos de auditoría,
errores 5xx, vencimientos y ausencia de backups válidos.
