# Validación de entrega

Fecha de control: **6 de septiembre de 2026**.

## Resultado

La versión entregada supera los controles ejecutables disponibles en este
entorno: instalación limpia, tipado, pruebas, compilación productiva, modelo
Prisma, exportación estática, auditoría de dependencias y análisis de patrones
inseguros. No se registran errores de compilación ni vulnerabilidades conocidas
reportadas por npm en el árbol instalado.

| Control | Resultado verificado |
| --- | --- |
| Instalación reproducible | `npm ci` completó desde `package-lock.json`. |
| TypeScript | Frontend, backend y seed: sin errores. |
| Pruebas automatizadas | 22/22 aprobadas: 12 backend/seguridad y 10 frontend. |
| Compilación | NestJS y Next.js 16.3.4: compilación productiva correcta. |
| Prisma | `validate`, `generate` y `migrate diff --from-empty`: correctos. |
| Dependencias | `npm audit`: 0 vulnerabilidades conocidas, incluidas devDependencies. |
| Demo | 33 módulos navegables, 8 obras y 7 usuarios definidos. |
| HTTP estático | Portada, bundles, logo e imagen principal respondieron HTTP 200. |
| Paquete Sites | Archivo de despliegue validado con `dist/index.html` y metadatos del proyecto. |
| Docker Compose | Desarrollo y producción: YAML válido; cinco servicios, healthchecks, PostgreSQL privado y HTTPS automático. |
| Scripts operativos | Entry point y scripts de backup: sintaxis POSIX válida. |
| Secretos | Sin claves privadas ni patrones de credenciales reales en archivos versionables. |
| Patrones peligrosos | Sin `eval`, `new Function`, HTML crudo ni consultas Prisma inseguras. |
| Persistencia histórica | Migración con AuditLog append-only y bloqueo de DELETE histórico. |

## Cobertura funcional comprobada

- Portada institucional responsive con empresa, servicios, áreas de experiencia,
  contacto demostrativo y acceso al ERP.
- Login local, recuperación no enumerativa, sesiones revocables y bloqueo.
- Google y Microsoft/Hotmail mediante OIDC + PKCE, con alta pendiente y bandeja
  de aprobación exclusiva de Administración.
- Dashboard general, listado y dashboard de ocho obras.
- Los 33 módulos, creación modular, búsqueda, actualización de tabla y API REST.
- Formularios característicos para los 29 módulos registrables, con campos
  obligatorios, tipos, obra/centro de costo, adjuntos y validación de servidor.
- Configurador auditable de módulos, campos, permisos por rol y ocho workflows.
- Documentos con límite, versionado, firma de archivo, MIME canónico, SHA-256 y
  descarga controlada.
- RBAC por usuario, rol, módulo, acción y obra; workflows configurables.
- Migraciones, seed, proxy, backups con hash y documentación de operación.

## Controles externos que debe completar el responsable del despliegue

El entorno de construcción no dispone del binario Docker ni de un servidor
PostgreSQL, por lo que no fue posible arrancar aquí los cinco contenedores ni
ejecutar las migraciones contra una base viva. Se validaron su estructura,
sintaxis, generación SQL, tipos y compilación. El procedimiento final en el VPS
es `docker compose up --build -d`, seguido por `/api/v1/health` y una prueba de
restauración.

Google y Microsoft exigen credenciales y dominios que pertenecen a LITORAL NEA;
sin ellos no es posible completar legalmente un login real. La aplicación falla
cerrada si un proveedor queda configurado a medias. También deben sustituirse
por datos confirmados el contacto, CUIT, portfolio real y credenciales demo
antes de un lanzamiento público con información empresarial.

Una auditoría limpia no equivale a invulnerabilidad permanente. En producción
se requieren actualizaciones, monitoreo, antivirus documental, pruebas de
restauración y evaluación de penetración periódica, según
[SEGURIDAD.md](SEGURIDAD.md).
