# LITORAL NEA ERP

Aplicación web integral para **LITORAL NEA SRL**, orientada al control de obras,
ingeniería, administración, abastecimiento, finanzas, flota y recursos humanos.

La portada pública presenta la empresa, sus capacidades, contacto y áreas de
experiencia. Desde allí se accede al ERP con usuario/contraseña o con una cuenta
Google o Microsoft/Hotmail previamente aprobada por el Administrador General.

La solución se entrega como monorepo:

- **frontend/**: Next.js, React y TypeScript; interfaz responsive.
- **backend/**: API REST modular con NestJS.
- **database/**: modelo PostgreSQL, Prisma, migraciones y seed.
- **docker/**: proxy, imágenes, backups y scripts de arranque.
- **docker-compose.production.yml**: despliegue VPS con PostgreSQL privado y HTTPS automático.
- **docs/**: arquitectura, API, seguridad, instalación y producción.

## Inicio rápido con Docker

1. Copiar **.env.example** como **.env**.
2. Reemplazar contraseñas y los tres secretos de seguridad.
3. Ejecutar:

   ~~~bash
   docker compose up --build -d
   ~~~

4. Abrir http://localhost:8080.
5. Verificar la API en http://localhost:8080/api/v1/health.

El primer arranque aplica migraciones y, con **SEED_DEMO=true**, carga siete
usuarios, roles/permisos, catálogos y ocho obras.

## Acceso demo

- Usuario: **admin@litoralnea.com**
- Contraseña: **Litoral#Admin26**

Estas credenciales son exclusivamente demostrativas. Deben cambiarse antes de
usar información real.

## Comandos de desarrollo

~~~bash
npm install
npm run prisma:generate
npm run dev
~~~

Servicios por defecto:

- Frontend: http://localhost:3000
- API: http://localhost:4000/api/v1
- PostgreSQL: disponible dentro de la red Docker
- Aplicación unificada: http://localhost:8080

## Alcance implementado

- Navegación completa de los 33 módulos solicitados y dashboard por obra.
- Ocho obras demo con información física, financiera y documental.
- API especializada para autenticación, dashboard, obras, documentos, sistema
  y aprobaciones.
- API de registros extensible para el resto de los módulos.
- PostgreSQL + Prisma, baja lógica, auditoría, versiones documentales y hash
  SHA-256.
- RBAC por usuario, rol, módulo, acción y obra.
- JWT de corta duración, renovación revocable, cookies HttpOnly, bloqueo por
  intentos y recuperación de contraseña preparada.
- OAuth/OIDC con Google y Microsoft, Authorization Code + PKCE, estado y nonce;
  todo usuario nuevo queda pendiente hasta la aprobación administrativa.
- Protección CSRF firmada, rate limiting, encabezados seguros, validación de
  origen, sesiones revocables, detección de replay y carga documental validada
  por extensión y firma binaria.
- Docker Compose, Nginx, persistencia, healthcheck y backups automáticos.

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md)
- [Instalación](docs/INSTALACION.md)
- [API REST](docs/API.md)
- [Seguridad y RBAC](docs/SEGURIDAD.md)
- [Producción](docs/PRODUCCION.md)
- [Usuarios demo](docs/USUARIOS_DEMO.md)
- [Validación de entrega](docs/VALIDACION.md)

## Alcance de la demo publicada

La dirección pública entregada al finalizar ejecuta el frontend navegable con
datos ficticios y no almacena información real. La API NestJS, PostgreSQL,
OAuth real, documentos persistentes y backups se activan desplegando este mismo
repositorio con la guía `docs/PRODUCCION.md`. La instalación real requiere un
VPS, un dominio apuntado a su IP y secretos suministrados fuera de Git.
Google Drive se usa para conservar el paquete fuente, no como servidor de
ejecución de PostgreSQL/NestJS.

## Criterio contable e impositivo

Los importes del seed son datos de demostración. La estimación de IVA, ARCA,
Ganancias, Seguridad Social e Ingresos Brutos no reemplaza la liquidación de un
profesional matriculado ni la presentación ante los organismos correspondientes.
