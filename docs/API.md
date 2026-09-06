# API REST

Base: **/api/v1**

La API acepta el JWT en cookie HttpOnly `lnea_access` —con prefijo `__Host-` en
producción— y, para integraciones servidor a servidor, también en
`Authorization: Bearer TOKEN`.

Las mutaciones autenticadas por cookie requieren el valor de la cookie CSRF en
el encabezado `X-CSRF-Token`. El frontend lo gestiona automáticamente. Los
clientes que usen exclusivamente Bearer, sin cookie de sesión, no requieren
CSRF porque el navegador no agrega ese encabezado por sí solo.

## Autenticación

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | /auth/csrf | Emite el par CSRF firmado. |
| POST | /auth/login | Inicia sesión y crea una sesión revocable. |
| POST | /auth/refresh | Renueva el token de acceso. |
| POST | /auth/logout | Revoca la sesión y limpia cookies. |
| GET | /auth/me | Devuelve la identidad y roles vigentes. |
| POST | /auth/forgot-password | Solicita recuperación. |
| POST | /auth/reset-password | Define una nueva contraseña. |
| GET | /auth/oauth/google/start | Inicia Google OIDC con PKCE. |
| GET | /auth/oauth/google/callback | Valida el callback de Google. |
| GET | /auth/oauth/microsoft/start | Inicia Microsoft/Hotmail OIDC con PKCE. |
| GET | /auth/oauth/microsoft/callback | Valida el callback de Microsoft. |

Ejemplo:

~~~json
{
  "username": "admin@litoralnea.com",
  "password": "Litoral#Admin26"
}
~~~

## Dashboard y obras

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET | /dashboard | dashboard.view |
| GET | /works | works.view |
| GET | /works/:id | works.view |
| GET | /works/:id/dashboard | works.view |
| POST | /works | works.create |
| PATCH | /works/:id | works.modify |
| DELETE | /works/:id | works.void |

DELETE aplica baja lógica.

## Documentos

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | /documents | Lista por obra y módulo. |
| POST | /documents | Crea ficha y primera versión multipart. |
| POST | /documents/:id/versions | Agrega una versión. |
| GET | /documents/:id/download | Descarga la versión vigente o indicada. |
| DELETE | /documents/:id | Baja lógica. |

Campos multipart: file, module, title, workId, description, entityType y
entityId.

## Registros modulares

Las rutas siguientes habilitan persistencia desde el primer día para los
módulos sin controlador especializado:

| Método | Ruta |
| --- | --- |
| GET | /records/:module |
| POST | /records/:module |
| PATCH | /records/:module/:id |
| DELETE | /records/:module/:id |

El valor **:module** se usa en la autorización dinámica.

## Aprobaciones

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | /approvals | Bandeja de aprobaciones. |
| POST | /approvals | Inicia el workflow aplicable. |
| POST | /approvals/:id/decision | Aprueba o rechaza el paso vigente. |

Los flujos demo cubren compras, pagos, viáticos, presupuestos, certificados,
documentos, horas extra y órdenes de trabajo.

## Sistema

| Método | Ruta |
| --- | --- |
| GET | /system/users |
| PATCH | /system/users/:id/status |
| GET | /system/roles |
| GET | /system/registration-requests |
| POST | /system/registration-requests/:id/approve |
| POST | /system/registration-requests/:id/reject |
| GET | /system/audit |

Las dos decisiones de registración requieren `system.admin`. La aprobación
crea o vincula el usuario y asigna por defecto el rol mínimo `TEC_JEFE_OBRA`; la
interfaz administrativa permite procesar la bandeja pendiente.

## Salud

**GET /health** es público y verifica que PostgreSQL responda.
