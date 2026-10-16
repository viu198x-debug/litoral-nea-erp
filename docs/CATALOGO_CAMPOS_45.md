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
