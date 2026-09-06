# Arquitectura de LITORAL NEA ERP

## Vista general

~~~mermaid
flowchart TD
    U["Usuarios corporativos"] --> G["Nginx / HTTPS"]
    G --> F["Next.js · React · TypeScript"]
    G --> A["API REST · NestJS"]
    U --> I["Google / Microsoft OIDC"]
    I --> A
    A --> P["Prisma ORM"]
    P --> DB["PostgreSQL"]
    A --> D["Documentos versionados"]
    DB --> B["Backups pg_dump + SHA-256"]
~~~

La interfaz se entrega como exportación estática para simplificar la operación
en VPS y servidor local. Las mutaciones se realizan exclusivamente contra la
API. El backend mantiene las reglas de autorización; ocultar un botón en el
frontend nunca se considera un control de seguridad.

## Capas

| Capa | Responsabilidad |
| --- | --- |
| Presentación | Login, navegación, dashboards, formularios, tablas y responsive. |
| API | Validación, autenticación, permisos, workflows y reglas de aplicación. |
| Identidad | Credenciales locales y OAuth/OIDC con aprobación administrativa. |
| Dominio | Obras, documentos, finanzas, expedientes, activos, personal y registros. |
| Persistencia | PostgreSQL, transacciones y Prisma ORM. |
| Archivos | Bytes en volumen protegido; metadatos y hash en PostgreSQL. |
| Operación | Docker, Nginx, healthcheck, migraciones y backups. |

## Modelo de permisos

La autorización se evalúa con la tupla:

~~~text
usuario + rol + módulo + acción + obra opcional
~~~

Las acciones disponibles son **view**, **create**, **modify**, **approve**,
**void**, **download**, **export** y **admin**. Un permiso directo denegado
tiene precedencia sobre un permiso heredado. El rol **ADMIN_GENERAL** conserva
acceso integral.

## Auditoría y baja lógica

- Los movimientos mutables generan un AuditLog con usuario, acción, módulo,
  entidad, obra, IP, agente, fecha y valores posteriores sanitizados.
- Contraseñas, tokens y códigos MFA se eliminan del cuerpo auditado.
- La escritura de auditoría se espera antes de responder; la base impide
  actualizar o borrar físicamente AuditLog.
- Obras, documentos, presupuestos, certificados, compras, partes y registros
  utilizan deletedAt; la baja no destruye datos históricos.
- Triggers de PostgreSQL bloquean el borrado físico de asientos, líneas,
  movimientos financieros y de stock, nómina, certificados, decisiones de
  aprobación, movimientos de expediente y versiones documentales.

## Documentos

Document mantiene la ficha lógica y DocumentVersion cada archivo físico,
versión, tamaño, MIME, usuario, fecha y SHA-256. La lista admitida inicialmente
es PDF, XLS/XLSX, DOCX, DWG, DXF, JPG/JPEG, PNG y ZIP.

El servidor no confía solamente en la extensión o en el MIME declarado por el
navegador: inspecciona firmas binarias conocidas, genera un nombre aleatorio,
calcula SHA-256 en streaming y verifica que la ruta final quede dentro del
directorio permitido.

En una instalación distribuida, el volumen local puede reemplazarse por S3/R2
sin modificar el modelo relacional.

## Extensión de módulos

Los dominios centrales tienen tablas específicas. GenericRecord permite
activar flujos operativos en todos los módulos desde el primer despliegue y
migrarlos luego a tablas especializadas sin romper auditoría ni permisos.
