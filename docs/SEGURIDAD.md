# Seguridad y RBAC

## Controles implementados

- Hash de contraseñas con bcrypt, costo 12 para usuarios demo.
- JWT de acceso corto y JWT de renovación con secretos independientes.
- Algoritmo, emisor y audiencia JWT fijados; el token se contrasta en cada
  petición con la sesión activa y los roles actuales de PostgreSQL.
- Refresh token hasheado en la tabla de sesiones, rotación en cada uso y
  revocación ante replay; máximo de sesiones activas configurable.
- Cookies HttpOnly, SameSite=Strict, `Secure` y prefijo `__Host-` en producción.
- Token CSRF firmado y enlazado a la sesión, comparación en tiempo constante,
  comprobación de Origin/Sec-Fetch-Site y CORS con lista explícita.
- Revocación de una sesión o de todas las sesiones de un usuario.
- Bloqueo temporal después de cinco intentos fallidos configurables.
- Respuesta temporal equivalente para usuarios inexistentes, reduciendo la
  enumeración por tiempo; mensajes de acceso deliberadamente genéricos.
- Rate limiting global y reforzado en login/recuperación, tanto en NestJS como
  en el gateway Nginx.
- Helmet, CSP, HSTS, anti-clickjacking, CORS explícito, validación con lista
  blanca, límites de JSON, formularios y carga de archivos.
- MFA preparado en el modelo y respuesta MFA_REQUIRED.
- Permisos verificados en la API, no solamente en la interfaz.
- RBAC por usuario, rol, módulo, acción y obra; una denegación directa tiene
  prioridad y toda obra se valida contra la empresa del usuario.
- Hash SHA-256 por versión documental.
- Validación de firma binaria de PDF/ZIP/Office/XLS/JPEG/PNG/DWG/DXF, nombre
  aleatorio, rutas canónicas y limpieza del archivo si falla la transacción.
- Auditoría automática y esperada de operaciones mutables, con redacción
  recursiva de secretos y user-agent acotado.
- Baja lógica y triggers que impiden borrar físicamente información histórica.
- Contenedores de aplicación sin root, sin capacidades Linux y con
  `no-new-privileges`; PostgreSQL no se publica al host.

## Google y Microsoft/Hotmail

El flujo usa OAuth 2.0 Authorization Code con PKCE y OIDC. Se verifica estado,
nonce, vencimiento, firma por JWKS, algoritmo, audiencia, emisor y correo
verificado cuando el proveedor lo expone. El estado viaja cifrado con
AES-256-GCM en una cookie HttpOnly de diez minutos.

Una identidad desconocida sólo crea `RegistrationRequest(PENDING)`. No recibe
sesión, roles ni permisos. El Administrador General debe aprobarla en Sistema;
el acceso real se habilita en el siguiente intento del usuario.

## Antes de producción

1. Cambiar todas las credenciales demo.
2. Configurar COOKIE_SECURE=true, TRUST_PROXY=true y servir únicamente por HTTPS.
3. Usar secretos almacenados fuera del repositorio.
4. Definir el CUIT real de la empresa.
5. Desactivar SEED_DEMO.
6. Integrar correo transaccional para recuperación.
7. Conectar un proveedor TOTP/WebAuthn antes de activar MFA a usuarios.
8. Restringir acceso a PostgreSQL a la red interna.
9. Cifrar backups y copiarlos a una ubicación externa.
10. Ejecutar pruebas de restauración trimestrales.
11. Añadir antivirus/EDR o escaneo antimalware en la canalización documental.
12. Centralizar logs, alertar por bloqueos/replays/errores 5xx y contratar una
    prueba de penetración antes de cargar datos productivos.

## Modelo de amenazas y límites

Ningún código puede prometer inmunidad frente a “hackers”. Esta entrega reduce
los riesgos web habituales —fuerza bruta, robo/replay de sesión, CSRF, carga de
archivos engañosa, escalamiento horizontal entre obras, filtración de secretos,
inyección y borrado histórico— mediante controles en varias capas. La seguridad
productiva también depende de TLS, secretos, actualizaciones, firewall, copias,
monitoreo, correo, configuración OAuth y operación humana.

## Política de conservación

No se exponen endpoints de eliminación física para asientos, auditoría,
movimientos financieros o versiones documentales. Una anulación debe registrarse
como nuevo movimiento compensatorio o cambio de estado autorizado.

## Archivos

La extensión, MIME canónico y firma se validan al cargar y el tamaño máximo es
configurable. Para un entorno real se debe añadir análisis antimalware y se
recomienda almacenamiento de objetos con versionado, cifrado e inmutabilidad.
