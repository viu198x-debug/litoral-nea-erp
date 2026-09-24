# Tesorería de LITORAL NEA ERP

El módulo `Tesorería` consolida la posición financiera de LITORAL NEA SRL y mantiene separados el registro, la aprobación, la ejecución y la conciliación.

## Cuentas controladas

- Cuenta corriente bancaria, con saldo, disponible y límite de descubierto.
- Caja de ahorro bancaria.
- Billetera virtual, CVU y alias.
- Efectivo en caja central, administrativa o futura caja por obra.
- Titular, CUIT, banco o institución, número, CBU/CVU, alias, moneda y tesorero responsable.

El saldo no se edita directamente. Sólo cambia cuando un movimiento pendiente es aprobado y ejecutado dentro de una transacción serializable.

## Operaciones

- Ingreso, egreso, transferencia, depósito y extracción.
- Comisión, interés y ajuste auditado.
- Emisión, recepción, depósito y pago de cheques.
- Imputación opcional por obra y centro de costo.
- Contraparte, medio de pago, referencia, comprobante, fecha operativa y fecha valor.

Un usuario con permiso `create` registra el movimiento. Otro usuario con permiso `approve` lo ejecuta. Salvo el Administrador General, el creador no puede aprobar su propio movimiento.

## Cheques

Se diferencian cheques propios y de terceros. Se registra banco, sucursal, cuenta, número, librador, CUIT, beneficiario, importe, emisión, vencimiento, obra y cadena de endosos. Las transiciones de estado están limitadas: cartera, emitido, recibido, depositado, diferido, cobrado, rechazado, cancelado o endosado.

## Controles del tesorero

- Conciliación por cuenta y período, con saldo de extracto, saldo de libro, diferencias e ítems vinculados.
- Arqueo exclusivo de cuentas de efectivo, con denominaciones, saldo esperado, contado y diferencia.
- Cierre diario idempotente por empresa y fecha, con posición total, ingresos, egresos, bancos, ahorros, billeteras, efectivo y cheques pendientes.
- Auditoría global de cada alta, modificación, aprobación o anulación.
- Baja lógica e inmutabilidad de los movimientos históricos.

## API REST

- `GET /api/treasury/dashboard`
- `GET|POST|PATCH /api/treasury/accounts`
- `GET|POST /api/treasury/movements`
- `POST /api/treasury/movements/:id/approve`
- `POST /api/treasury/movements/:id/void`
- `GET|POST /api/treasury/cheques`
- `PATCH /api/treasury/cheques/:id/status`
- `GET|POST /api/treasury/reconciliations`
- `POST /api/treasury/cash-counts`
- `POST /api/treasury/daily-closes`

Todos los endpoints requieren sesión autenticada, CSRF cuando corresponde y permisos RBAC del módulo `treasury`.
