# LITORAL NEA ERP — Entorno LOCAL y privado (Fase 2)

**Situación:** desarrollo interno. No se publica el ERP, no se conecta con Render ni se aplican cambios a bases reales. Todos los datos generados aquí pertenecen a un contenedor PostgreSQL separado.

## Requisitos
- Windows 10/11 con Docker Desktop + WSL2, o Linux/macOS con Docker Engine y Docker Compose V2.
- Node.js 22 para los comandos `npm run local:*`.
- Un puerto TCP libre **8080** y espacio para dos imágenes, PostgreSQL y archivos.
- No abrir puertos del router, crear túneles públicos ni cambiar el cortafuegos para compartir el ERP.

## Instalación: comandos Windows PowerShell

```powershell
git clone https://github.com/viu198x-debug/litoral-nea-erp.git
cd litoral-nea-erp
git fetch origin
git switch feature/phase2-data-readiness-api-20261016
npm run local:init
npm run local:up
npm run local:ps
```

Acceder únicamente desde la misma computadora: **http://127.0.0.1:8080** (alternativamente http://localhost:8080). Verificar `http://127.0.0.1:8080/api/v1/health`.

**La inicialización crea `.env.local`** con contraseñas y secretos aleatorios, sin imprimirlos. El archivo está ignorado por Git, no debe compartirse, subir a Drive ni agregarse a capturas de pantalla. `local:init` es deliberadamente no destructivo: se niega a sobrescribir un `.env.local` existente. El puerto se puede cambiar modificando `APP_PORT` en ese archivo.

## Alta inicial sin datos ficticios (recomendado)

Después del primer arranque de los contenedores, inicializar empresa, roles, permisos, campos y **un único administrador local**:

```powershell
npm run local:bootstrap
```

Este comando crea **45 módulos**, los permisos del Administrador General y campos configurables sin crear obras, compras, pagos, activos ni empleados ficticios. Es específico de la conexión local `postgres/litoral_nea_erp_local` y se niega a modificar una base con otra empresa previamente registrada.

Ingresar con usuario `admin.local@litoralnea.invalid` y contraseña `LOCAL_ADMIN_PASSWORD` de `.env.local`. La empresa inicial tiene CUIT marcador `LOCAL-ONLY-NO-CUIT`; no utilizarla como identificación fiscal real ni facturar con ella. El aprovisionamiento sólo crea un administrador y no reemplaza el proceso futuro de alta legal y fiscal.

## Datos de prueba: acción explícita

La base arranca **vacía** y sólo se aplican las migraciones del repositorio local. Por defecto `SEED_DEMO=false`, por lo que no se insertan obras, personal ni usuarios ficticios automáticamente. **Alternativa para una instalación de laboratorio completamente vacía, en lugar de `local:bootstrap`:** si se desean datos de demostración, ejecutar una única vez:

```powershell
npm run local:seed-demo
```

Acceso al entorno de prueba: usuario `admin@litoralnea.com`. La contraseña es el valor de **SEED_ADMIN_PASSWORD** en el archivo local `.env.local`; los otros usuarios utilizan `SEED_USER_PASSWORD`. Las credenciales demo no son aptas para uso real ni para publicación. **El comando rechaza una base que ya contenga una empresa. El seed también modifica datos al repetirse**; no ejecutarlo sobre información que se desee preservar. No sirve para migrar registros reales.

Para usar registros propios de prueba se recomienda `local:bootstrap`; la identificación fiscal definitiva, los catálogos profesionales y las validaciones completas siguen pendientes. Una instalación creada con `local:bootstrap` no debe recibir `local:seed-demo`.

## Separación técnica

| Componente | Localización | Acceso |
|---|---|---|
| Gateway Nginx | 127.0.0.1:8080 | Sólo esta computadora |
| API NestJS | backend:4000 en red Docker privada | No expone puerto al host |
| PostgreSQL 16 | postgres:5432 en red Docker privada | No expone puerto al host |
| Frontend Next.js | frontend:8080 en red Docker privada | A través del gateway |
| Archivos | volumen `document_local_data` | Persistente, exclusivo de la pila local |
| Datos | volumen `postgres_local_data` | Persistente, exclusivo de la pila local |

La red Docker se define `internal: true` y los nombres de servicios se resuelven dentro del proyecto `litoral-nea-erp-local`. `DATABASE_URL` se construye internamente y siempre apunta al servicio `postgres`; no se leen URLs productivas ni credenciales de Render o Neon. El entorno utiliza HTTP exclusivamente sobre loopback; si luego se permite acceso por LAN o internet, deberá rediseñarse TLS, cookies y seguridad.

## Operación cotidiana

```powershell
npm run local:ps
npm run local:logs
npm run local:backup
npm run local:down
npm run local:up
```

`local:down` **no borra los volúmenes**. No ejecutar `docker compose down -v` ni borrar `.env.local` sin un respaldo recuperable. Si se pierde `.env.local`, las contraseñas de la BD guardada no se regeneran automáticamente.

### Respaldo y restauración controlada

`npm run local:backup` ejecuta `pg_dump -Fc`, conserva un archivo `.dump` en `backups/local/` y crea un manifest `.sha256`. Los respaldos no se incluyen en Git y están pensados para pruebas; para información real también respaldar el volumen documental y conservar copias cifradas fuera del equipo.

Para restaurar una copia **en la misma base local**:

```powershell
npm run local:restore -- backups/local/lnea_local_AAAAMMDDTHHMMSSZ.dump --confirm-local-restore
```

Reemplazar el nombre por uno realmente creado. Antes de restaurar: (1) verificar hash; (2) crear un nuevo backup preventivo; (3) detener la API local; (4) ejecutar `pg_restore` contra `litoral_nea_erp_local`; (5) volver a iniciar la API. La restauración **reemplaza los datos de la base local**; requiere confirmación explícita y no apunta a ninguna base externa.

## Controles y API de ingeniería

- `GET /api/v1/health`: informa conectividad, no es un diagnóstico completo de integridad.
- `GET /api/v1/system/data-readiness`: requiere sesión y permiso `system.admin`; sólo lectura, comprueba migraciones y catálogo de los 45 módulos en la base local.
- La fuente de los 45 módulos y sus modelos se detalla en [FASE2_MODELO_DATOS_API.md](FASE2_MODELO_DATOS_API.md).
- Para pasar a base real: desarrollar alta inicial sin demo, verificar RBAC, completar contratos de módulos, pruebas transaccionales y respaldo/restauración integral.

## Pendientes antes de considerar la instalación «terminada»

1. Completar alta fiscal definitiva y administración de usuarios: el bootstrap local sólo crea un administrador y un identificador tributario marcador.
2. Validar todos los 45 módulos con registraciones reales y consistencia referencial.
3. Probar concurrencia, idempotencia, reversos, liquidaciones y rendición de fondos.
4. Ejecutar smoke test de Docker Compose, creación de backup y restauración.
5. Verificar recuperación de archivos documentales junto a PostgreSQL.
6. Recién una vez validados los puntos anteriores, planificar servidor, dominio, conectores, HTTPS y publicación.

**Desarrollo local ≠ despliegue productivo.** Está prohibido integrar en `main` mientras los servicios Render que escuchan esa rama tengan autodespliegue habilitado, salvo que se desactive esa automatización antes de fusionar.
