# Catálogo de campos de los 45 módulos — LITORAL NEA ERP

Fecha de revisión de código: 2026-10-16. Estado: rama de desarrollo, pendiente de integración y pruebas productivas.

## Cobertura
- **45/45** módulos de navegación tienen una definición tipada en `frontend/lib/module-field-catalog.ts`.
- **41** módulos transaccionales conservan `frontend/lib/record-definitions.ts`; incluye **Obras**, cuyo formulario especializado utiliza `/works`.
- **4** módulos no transaccionales, con definición separada: `dashboard`, `management`, `approvals`, `system`.
- El catálogo incluye clave, etiqueta, tipo, sección y obligatoriedad según corresponda. Para módulos especiales incluye naturaleza, descripción y endpoints asociados.

## Integración de pantallas (sin CRUD artificial)
| Módulo | Datos y operaciones | Implementación |
|---|---|---|
| Dashboard | KPIs calculados, obras, alertas | `GET /dashboard`; pantalla general existente |
| Gerencia | KPIs calculados por contrato, costos, certificados, caja/bancos e impuestos estimados | `ManagementOverviewPanel` consulta `GET /dashboard` |
| Aprobaciones | Listado, filtro de estado, comentario, aprobación y rechazo | `ApprovalsPage` usa `GET /approvals` y `POST /approvals/:id/decision` |
| Sistema | Configuración de módulos/campos, flujos, usuarios, roles, altas y auditoría | Paneles administrativos actuales y endpoints `/system/*` |

Las cuatro fichas quedan **fuera de `GenericRecord`** en el frontend, pues necesitan reglas de autorización y servicios propios. No son formularios de alta de registros operativos. La API sigue verificando los permisos de cada solicitud; ocultar un botón no constituye autorización.

## Integridad funcional
- Una aprobación requiere rol autorizado, estado pendiente y separación solicitante/aprobador según el servicio existente. El rechazo exige motivo desde el frontend y el servidor mantiene su control independiente.
- Dashboard y Gerencia **no** editan saldos; muestran indicadores derivados de los registros de la API.
- Sistema mantiene permisos por roles y ámbito de obra; no se codifican secretos, claves ni tokens en un formulario configurable.
- El configurador de campos dinámicos de registros continúa sin cambios para los 41 módulos transaccionales y los módulos futuros creados por administración.

## Pruebas y límites
Archivo agregado: `frontend/test/module-fields.test.mjs`. Comprueba cobertura de los 45 slugs, unicidad, 41+4, y que las pantallas especiales no se enruten mediante CRUD genérico.
Este cambio de código no ejecuta migraciones Prisma, no altera BD, no despliega ni confirma funcionalidad de producción. Es necesario ejecutar `npm ci`, `npm run lint --workspace=@litoral-nea/frontend`, `npm run test --workspace=@litoral-nea/frontend` y pruebas de API autorizada con PostgreSQL antes de fusionar a producción.

## Próximo contrato
Mantener catálogos especializados por dominio y crear pruebas E2E: obra→presupuesto→compra→stock→costo; certificados→factura→cobro; tesorería→conciliación→contabilidad; asistencia→nómina; usuario→roles→aprobaciones→auditoría. No ampliar la BD en esta rama.


## Actualización de dependencias seguras — 16/10/2026
En la misma rama, luego de la especificación de los 45 módulos, se corrigieron las cinco alertas detectadas por `npm audit` en producción:
- `next`: 16.3.4 → **16.4.2**.
- `multer`: 2.3.0 → **2.4.0** (dependencia directa y resolución de NestJS).
- `proxy-addr`: resolución segura **2.0.8**.
- `sharp`: resolución segura **0.35.5**.
- `source-map-js`: resolución segura **1.2.2**.

Se actualizaron `frontend/package.json`, `backend/package.json`, `package.json` (overrides) y el `package-lock.json` generado por npm, sin desactivar las reglas de seguridad. Se añadió el workflow `.github/workflows/security-dependency-remediation.yml` para reconstruir y verificar reproduciblemente el bloqueo de dependencias.

**Prueba reproducible aprobada:** https://github.com/viu198x-debug/litoral-nea-erp/actions/runs/38907427379 . Este flujo obtuvo éxito en: regeneración de lock, verificación exacta de cinco versiones, `npm ci`, `npm audit --omit=dev --audit-level=moderate`, validación/generación Prisma, TypeScript, pruebas backend/frontend y compilación de ambas aplicaciones.

El `npm audit` de producción se ejecutó con umbral **moderate**, más estricto que el umbral `high` del CI principal. No equivale a una certificación de seguridad absoluta ni reemplaza las pruebas con bases y usuarios de producción. Se debe validar el CI del commit final y realizar una revisión técnica del PR antes de integrar a `main`.
