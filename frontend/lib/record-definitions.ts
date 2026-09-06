import type { ModuleRecordDefinition, RecordFieldDefinition, RecordFieldType } from "./types";

type FieldTuple = [
  key: string,
  label: string,
  type: RecordFieldType,
  required?: boolean,
  options?: string[],
  placeholder?: string,
  section?: string,
];

const fields = (...items: FieldTuple[]): RecordFieldDefinition[] =>
  items.map(([key, label, type, required, options, placeholder, section]) => ({
    key,
    label,
    type,
    required,
    options,
    placeholder,
    section,
  }));

const statusOptions = ["Borrador", "Pendiente", "Aprobado", "Activo", "Cerrado"];
const yesNo = ["Sí", "No"];

export const recordDefinitions: Record<string, ModuleRecordDefinition> = {
  works: {
    codePrefix: "OB",
    titleLabel: "Nombre de la obra",
    amountField: "contractAmount",
    fields: fields(
      ["client", "Cliente / organismo", "text", true],
      ["organizationType", "Tipo de comitente", "select", true, ["Ministerio", "Municipio", "Organismo público", "Privado"]],
      ["agency", "Organismo", "text"], ["ministry", "Ministerio", "text"], ["municipality", "Municipio", "text"],
      ["contractNumber", "Contrato", "text", true], ["dossierNumber", "Expediente", "text"],
      ["costCenter", "Centro de costo", "text", true], ["address", "Ubicación", "text", true],
      ["city", "Localidad", "text", true], ["latitude", "Latitud", "number"], ["longitude", "Longitud", "number"],
      ["startDate", "Fecha de inicio", "date", true], ["contractualEndDate", "Fin contractual", "date", true],
      ["contractAmount", "Monto contractual", "currency", true], ["targetBudget", "Presupuesto objetivo", "currency", true],
      ["responsibleName", "Responsable", "text", true], ["notes", "Observaciones", "textarea"]
    ),
  },
  architecture: { codePrefix: "ARQ", titleLabel: "Proyecto / documento", requiresWork: true, fields: fields(
    ["projectType", "Tipo de proyecto", "select", true, ["Anteproyecto", "Proyecto ejecutivo", "Conforme a obra"]],
    ["discipline", "Disciplina", "select", true, ["Arquitectura", "Estructuras", "Instalaciones", "Cómputo"]],
    ["drawingNumber", "Número de plano", "text"], ["revision", "Revisión", "text", true], ["version", "Versión", "number", true],
    ["documentStatus", "Estado documental", "select", true, statusOptions], ["approvalRequired", "Requiere aprobación", "select", true, yesNo],
    ["observations", "Observaciones técnicas", "textarea"]
  )},
  engineering: { codePrefix: "ING", titleLabel: "Proyecto / memoria", requiresWork: true, fields: fields(
    ["specialty", "Especialidad", "select", true, ["Eléctrica", "Civil", "Sanitaria", "Mecánica", "Climatización", "Gases medicinales"]],
    ["documentType", "Tipo", "select", true, ["Proyecto", "Memoria", "Cálculo", "Plano", "Especificación"]],
    ["standard", "Norma / reglamento", "text"], ["drawingNumber", "Número de plano", "text"],
    ["revision", "Revisión", "text", true], ["version", "Versión", "number", true],
    ["reviewer", "Revisor", "text"], ["documentStatus", "Estado", "select", true, statusOptions],
    ["observations", "Conclusiones / observaciones", "textarea"]
  )},
  documents: { codePrefix: "DOC", titleLabel: "Título del documento", fields: fields(
    ["documentType", "Tipo de documento", "select", true, ["PDF", "XLSX", "DOCX", "DWG", "DXF", "JPG", "PNG", "ZIP"]],
    ["entityType", "Registro relacionado", "text"], ["revision", "Revisión", "text"], ["versionNotes", "Notas de versión", "textarea"],
    ["approvalRequired", "Requiere aprobación", "select", true, yesNo]
  )},
  budgets: { codePrefix: "PRE", titleLabel: "Nombre del presupuesto", requiresWork: true, amountField: "total", fields: fields(
    ["budgetType", "Tipo", "select", true, ["Contractual", "Objetivo", "Revisión", "Costo real"]],
    ["version", "Versión", "number", true], ["category", "Rubro", "text", true], ["item", "Ítem / subítem", "text", true],
    ["unit", "Unidad", "text", true], ["quantity", "Cantidad", "number", true], ["materialCost", "Materiales", "currency"],
    ["laborCost", "Mano de obra", "currency"], ["equipmentCost", "Equipos", "currency"], ["subcontractCost", "Subcontratos", "currency"],
    ["utilityPct", "Utilidad %", "number"], ["vatPct", "IVA %", "number", true], ["total", "Total", "currency", true],
    ["sourceFile", "Origen / archivo Excel", "text"]
  )},
  planning: { codePrefix: "PLA", titleLabel: "Actividad / hito", requiresWork: true, fields: fields(
    ["activityType", "Tipo", "select", true, ["Actividad", "Hito", "Prórroga", "Neutralización"]],
    ["plannedStart", "Inicio planificado", "date", true], ["plannedEnd", "Fin planificado", "date", true],
    ["actualStart", "Inicio real", "date"], ["actualEnd", "Fin real", "date"], ["plannedPct", "Planificado %", "number", true],
    ["executedPct", "Ejecutado %", "number", true], ["weight", "Incidencia en Curva S %", "number"],
    ["extensionDays", "Días de prórroga / neutralización", "number"], ["deviationReason", "Causa del desvío", "textarea"]
  )},
  progress: { codePrefix: "PAR", titleLabel: "Parte diario / actividad", requiresWork: true, amountField: "economicProgress", fields: fields(
    ["reportDate", "Fecha del parte", "date", true], ["physicalProgress", "Avance físico %", "number", true],
    ["economicProgress", "Avance económico", "currency"], ["weather", "Clima", "select", true, ["Despejado", "Nublado", "Lluvia", "Tormenta", "No laborable"]],
    ["personnelCount", "Personal afectado", "number", true], ["equipmentCount", "Equipos afectados", "number", true],
    ["receivedMaterial", "Material recibido", "textarea"], ["executedWork", "Trabajo ejecutado", "textarea", true],
    ["observations", "Observaciones", "textarea"], ["photosReference", "Fotografías / referencia", "text"]
  )},
  "public-works": { codePrefix: "OP", titleLabel: "Actuación contractual", requiresWork: true, amountField: "amount", fields: fields(
    ["procedure", "Tipo de actuación", "select", true, ["Licitación", "Pliego", "Oferta", "Adjudicación", "Contrato", "Orden de compra", "Acta de inicio", "Anticipo financiero", "Redeterminación", "Adicional", "Economía", "Demasía", "Prórroga", "Neutralización", "Fondo de reparo", "Garantía", "Multa", "Recepción provisoria", "Recepción definitiva"]],
    ["referenceNumber", "Número / referencia", "text", true], ["issueDate", "Fecha", "date", true], ["amount", "Monto", "currency"],
    ["validUntil", "Vigencia / vencimiento", "date"], ["responsible", "Responsable", "text"], ["approvalStatus", "Estado", "select", true, statusOptions],
    ["observations", "Observaciones", "textarea"]
  )},
  certificates: { codePrefix: "CER", titleLabel: "Certificado", requiresWork: true, amountField: "netAmount", fields: fields(
    ["number", "Número", "number", true], ["periodFrom", "Período desde", "date", true], ["periodTo", "Período hasta", "date", true],
    ["progressPct", "Avance certificado %", "number", true], ["grossAmount", "Monto bruto", "currency", true],
    ["advanceDeduction", "Descuento de anticipo", "currency"], ["repairFund", "Fondo de reparo", "currency"],
    ["withholdings", "Retenciones", "currency"], ["netAmount", "Neto", "currency", true],
    ["invoiceNumber", "Factura", "text"], ["dossierNumber", "Expediente", "text"], ["paymentOrder", "Orden de pago", "text"],
    ["collectedAmount", "Cobrado", "currency"]
  )},
  dossiers: { codePrefix: "EXP", titleLabel: "Concepto del expediente", amountField: "amount", fields: fields(
    ["organization", "Organismo", "text", true], ["number", "Número de expediente", "text", true], ["openedAt", "Fecha de alta", "date", true],
    ["responsible", "Responsable", "text", true], ["lastMovement", "Último movimiento", "textarea"], ["lastMovementAt", "Fecha último movimiento", "date"],
    ["amount", "Monto", "currency"], ["paidAmount", "Pagado", "currency"], ["balance", "Saldo", "currency"],
    ["alertDays", "Alerta sin movimiento (días)", "number"], ["paymentStatus", "Estado de pago", "select", true, ["Pendiente", "Parcial", "Pagado"]]
  )},
  purchases: { codePrefix: "COM", titleLabel: "Solicitud / compra", requiresWork: true, amountField: "total", fields: fields(
    ["requestNumber", "Solicitud", "text", true], ["supplier", "Proveedor", "text"], ["quotationCount", "Cotizaciones recibidas", "number"],
    ["comparisonResult", "Resultado comparativa", "textarea"], ["purchaseOrder", "Orden de compra", "text"],
    ["deliveryNote", "Remito", "text"], ["invoice", "Factura", "text"], ["costCenter", "Centro de costo", "text", true],
    ["subtotal", "Subtotal", "currency", true], ["vat", "IVA", "currency"], ["total", "Total", "currency", true],
    ["expectedAt", "Entrega prevista", "date"], ["receivedAt", "Recepción", "date"], ["paymentStatus", "Pago", "select", true, ["Pendiente", "Parcial", "Pagado"]]
  )},
  suppliers: { codePrefix: "PRO", titleLabel: "Razón social", amountField: "accountBalance", fields: fields(
    ["taxId", "CUIT", "tax-id", true], ["vatCondition", "Condición IVA", "select", true, ["Responsable Inscripto", "Monotributo", "Exento", "Consumidor final"]],
    ["contact", "Contacto", "text"], ["email", "Correo", "email"], ["phone", "Teléfono", "text"], ["address", "Domicilio", "text"],
    ["cbu", "CBU / alias", "text"], ["accountBalance", "Saldo cuenta corriente", "currency"], ["documentationDue", "Vencimiento documentación", "date"]
  )},
  logistics: { codePrefix: "LOG", titleLabel: "Pedido / entrega", requiresWork: true, fields: fields(
    ["operationType", "Operación", "select", true, ["Pedido", "Entrega", "Transferencia"]], ["origin", "Origen", "text", true],
    ["destination", "Destino", "text", true], ["transport", "Transporte", "text"], ["responsible", "Responsable", "text", true],
    ["deliveryNote", "Remito", "text"], ["scheduledAt", "Fecha programada", "datetime-local", true], ["deliveredAt", "Fecha entregada", "datetime-local"],
    ["items", "Materiales / detalle", "textarea", true]
  )},
  stock: { codePrefix: "STK", titleLabel: "Material", requiresWork: false, amountField: "totalCost", fields: fields(
    ["sku", "Código de material", "text", true], ["unit", "Unidad", "text", true], ["warehouse", "Depósito", "text", true],
    ["movement", "Movimiento", "select", true, ["Entrada", "Salida", "Transferencia", "Ajuste"]], ["quantity", "Cantidad", "number", true],
    ["currentStock", "Existencia resultante", "number"], ["minimumStock", "Stock mínimo", "number"],
    ["unitCost", "Costo unitario", "currency"], ["totalCost", "Costo total", "currency"], ["reference", "Referencia / remito", "text"]
  )},
  cash: { codePrefix: "CAJ", titleLabel: "Movimiento de caja", amountField: "amount", fields: fields(
    ["cashBox", "Caja", "select", true, ["Central", "Administrativa", "Caja de obra"]], ["direction", "Tipo", "select", true, ["Ingreso", "Egreso", "Entrega", "Rendición"]],
    ["beneficiary", "Responsable / beneficiario", "text", true], ["concept", "Concepto", "textarea", true],
    ["amount", "Importe", "currency", true], ["receipt", "Comprobante", "text"], ["accounted", "Contabilizado", "select", true, yesNo]
  )},
  banks: { codePrefix: "BAN", titleLabel: "Movimiento bancario", amountField: "amount", fields: fields(
    ["bank", "Banco", "text", true], ["account", "Cuenta", "text", true], ["movementType", "Movimiento", "select", true, ["Depósito", "Transferencia", "Débito", "Crédito", "Cheque"]],
    ["counterparty", "Contraparte", "text"], ["reference", "Referencia", "text"], ["amount", "Importe", "currency", true],
    ["bankBalance", "Saldo bancario", "currency"], ["accountingBalance", "Saldo contable", "currency"],
    ["reconciled", "Conciliado", "select", true, yesNo], ["projectedAt", "Fecha de proyección", "date"]
  )},
  payments: { codePrefix: "PAG", titleLabel: "Pago / cobro", amountField: "amount", fields: fields(
    ["operation", "Operación", "select", true, ["Pago a proveedor", "Cobro de cliente"]], ["counterparty", "Proveedor / cliente", "text", true],
    ["account", "Cuenta corriente", "text"], ["receiptType", "Comprobante", "text", true], ["receiptNumber", "Número", "text", true],
    ["amount", "Importe", "currency", true], ["withholding", "Retenciones", "currency"], ["paymentMethod", "Medio", "select", true, ["Transferencia", "Cheque", "Efectivo", "Compensación"]],
    ["allocation", "Imputación / concepto", "textarea", true]
  )},
  accounting: { codePrefix: "ASI", titleLabel: "Asiento contable", amountField: "totalDebit", fields: fields(
    ["entryNumber", "Número de asiento", "number", true], ["entryDate", "Fecha", "date", true], ["sourceModule", "Módulo origen", "text"],
    ["accountDebit", "Cuenta Debe", "text", true], ["debit", "Debe", "currency", true], ["accountCredit", "Cuenta Haber", "text", true],
    ["credit", "Haber", "currency", true], ["costCenter", "Centro de costo", "text"], ["period", "Período", "text", true],
    ["closingType", "Cierre", "select", false, ["Sin cierre", "Mensual", "Anual"]], ["posted", "Mayorizado", "select", true, yesNo]
  )},
  taxes: { codePrefix: "IMP", titleLabel: "Obligación / estimación fiscal", amountField: "estimatedDue", fields: fields(
    ["taxType", "Impuesto", "select", true, ["IVA", "Ganancias", "Seguridad Social", "Ingresos Brutos DGR", "Retención", "Percepción"]],
    ["period", "Período", "text", true], ["debitAmount", "Débito fiscal", "currency"], ["creditAmount", "Crédito fiscal", "currency"],
    ["withholdings", "Retenciones", "currency"], ["perceptions", "Percepciones", "currency"], ["technicalBalance", "Saldo técnico", "currency"],
    ["estimatedDue", "Estimado a pagar", "currency", true], ["dueDate", "Vencimiento", "date"], ["returnNumber", "DDJJ / VEP", "text"],
    ["filed", "Presentado", "select", true, yesNo]
  )},
  fleet: { codePrefix: "FLO", titleLabel: "Vehículo", amountField: "accumulatedCost", fields: fields(
    ["plate", "Dominio", "text", true], ["brand", "Marca", "text", true], ["model", "Modelo", "text", true], ["year", "Año", "number", true],
    ["odometerKm", "Kilometraje", "number", true], ["insuranceDue", "Vencimiento seguro", "date"], ["inspectionDue", "RTO / VTV", "date"],
    ["driver", "Chofer", "text"], ["accumulatedCost", "Costos acumulados", "currency"], ["active", "Activo", "select", true, yesNo]
  )},
  drivers: { codePrefix: "CHO", titleLabel: "Nombre del chofer", fields: fields(
    ["employeeCode", "Legajo", "text", true], ["licenseNumber", "Licencia", "text", true], ["licenseCategory", "Categoría", "text", true],
    ["licenseDue", "Vencimiento", "date", true], ["vehicle", "Vehículo asignado", "text"], ["trips", "Viajes / destinos", "textarea"],
    ["perDiems", "Viáticos asociados", "text"], ["active", "Activo", "select", true, yesNo]
  )},
  fuel: { codePrefix: "COMB", titleLabel: "Carga de combustible", requiresWork: true, amountField: "total", fields: fields(
    ["filledAt", "Fecha", "datetime-local", true], ["assetType", "Destino", "select", true, ["Vehículo", "Máquina"]], ["asset", "Vehículo / máquina", "text", true],
    ["driver", "Chofer / operador", "text"], ["liters", "Litros", "number", true], ["unitPrice", "Precio por litro", "currency", true],
    ["total", "Total", "currency", true], ["odometerKm", "Km", "number"], ["hourMeter", "Horómetro", "number"],
    ["supplier", "Proveedor", "text", true], ["costCenter", "Centro de costo", "text", true], ["performance", "Rendimiento", "number"]
  )},
  machinery: { codePrefix: "MAQ", titleLabel: "Equipo / maquinaria", amountField: "hourlyCost", fields: fields(
    ["equipmentType", "Tipo de equipo", "text", true], ["brand", "Marca", "text", true], ["model", "Modelo", "text", true],
    ["hourMeter", "Horómetro", "number", true], ["operator", "Operador", "text"], ["fuelConsumption", "Consumo de combustible", "number"],
    ["maintenanceDue", "Próximo mantenimiento", "date"], ["repairStatus", "Estado de reparación", "text"], ["hourlyCost", "Costo por hora", "currency", true]
  )},
  concrete: { codePrefix: "HOR", titleLabel: "Orden de producción", requiresWork: true, amountField: "totalCost", fields: fields(
    ["productionDate", "Fecha de producción", "date", true], ["dosage", "Dosificación", "text", true], ["cubicMeters", "Volumen m³", "number", true],
    ["cementKg", "Cemento kg", "number", true], ["sandM3", "Arena m³", "number", true], ["stoneM3", "Piedra m³", "number", true],
    ["additives", "Aditivos", "textarea"], ["truck", "Camión", "text"], ["driver", "Chofer", "text"],
    ["deliveryNote", "Remito", "text"], ["costPerM3", "Costo por m³", "currency", true], ["totalCost", "Costo total", "currency", true]
  )},
  maintenance: { codePrefix: "OT", titleLabel: "Orden de trabajo", amountField: "totalCost", fields: fields(
    ["maintenanceType", "Tipo", "select", true, ["Preventivo", "Correctivo"]], ["assetType", "Activo", "select", true, ["Vehículo", "Máquina", "Instalación"]],
    ["asset", "Equipo / dominio", "text", true], ["description", "Trabajo requerido", "textarea", true], ["scheduledAt", "Fecha programada", "date"],
    ["completedAt", "Fecha de finalización", "date"], ["parts", "Repuestos", "textarea"], ["partsCost", "Costo repuestos", "currency"],
    ["laborCost", "Costo mano de obra", "currency"], ["totalCost", "Costo total", "currency", true], ["nextServiceAt", "Próximo mantenimiento", "date"]
  )},
  mechanics: { codePrefix: "MEC", titleLabel: "Mecánico", fields: fields(
    ["employeeNumber", "Legajo / identificación", "text"], ["fullName", "Nombre completo", "text", true],
    ["specialty", "Especialidad", "text"], ["phone", "Teléfono", "text"], ["email", "Correo", "email"],
    ["internalExternal", "Tipo", "select", true, ["Interno", "Externo"]], ["active", "Activo", "select", true, yesNo],
    ["notes", "Observaciones", "textarea"]
  )},
  "spare-parts": { codePrefix: "REP", titleLabel: "Repuesto", amountField: "stockValue", fields: fields(
    ["sku", "Código / SKU", "text", true], ["description", "Descripción", "text", true], ["brand", "Marca", "text"],
    ["unit", "Unidad", "text", true], ["currentStock", "Stock actual", "number", true], ["minimumStock", "Stock mínimo", "number"],
    ["averageCost", "Costo promedio", "currency"], ["stockValue", "Stock valorizado", "currency"], ["location", "Ubicación", "text"],
    ["active", "Activo", "select", true, yesNo]
  )},
  "fuel-estimates": { codePrefix: "ECO", titleLabel: "Estimación de combustible", requiresWork: true, amountField: "estimatedLiters", fields: fields(
    ["vehicle", "Vehículo / dominio", "text", true], ["period", "Período", "text", true], ["estimatedKm", "Km previstos", "number"],
    ["estimatedHours", "Horas previstas", "number"], ["estimatedLiters", "Litros estimados", "number", true],
    ["basis", "Criterio de estimación", "textarea", true], ["approvedBy", "Aprobado por", "text"], ["actualLiters", "Litros reales", "number"],
    ["deviationPct", "Desvío %", "number"]
  )},
  insurance: { codePrefix: "POL", titleLabel: "Póliza / caución", requiresWork: false, amountField: "premiumAmount", fields: fields(
    ["policyNumber", "Número de póliza", "text", true], ["policyType", "Tipo", "select", true, ["Automotor", "Responsabilidad civil", "Accidentes personales", "Todo riesgo construcción", "Caución de contrato", "Caución de anticipo", "Caución de fondo de reparo", "Otra"]],
    ["insurer", "Compañía emisora", "text", true], ["clientOrPrincipal", "Comitente / beneficiario", "text"], ["contractor", "Tomador / contratista", "text"],
    ["asset", "Vehículo / máquina", "text"], ["issueDate", "Fecha de emisión", "date", true], ["startDate", "Vigencia desde", "date", true], ["endDate", "Vigencia hasta", "date", true],
    ["premiumAmount", "Prima", "currency"], ["paidAmount", "Pagado", "currency"], ["coverageAmount", "Suma asegurada / caucionada", "currency"],
    ["endorsementNumber", "Último endoso", "text"], ["renewalDate", "Próxima renovación", "date"], ["statusPolicy", "Estado", "select", true, ["Activa", "Pendiente", "Vencida", "Renovada", "Anulada", "Baja"]],
    ["receipt", "Comprobante / recibo", "text"], ["actReference", "Acta / referencia", "text"], ["notes", "Observaciones", "textarea"]
  )},
  "unexpected-tasks": { codePrefix: "IMP", titleLabel: "Trabajo imprevisto", requiresWork: false, amountField: "actualCost", fields: fields(
    ["priority", "Prioridad", "select", true, ["Baja", "Normal", "Alta", "Crítica"]], ["source", "Origen / solicitante", "text"],
    ["assignedTo", "Asignado a", "text", true], ["location", "Ubicación", "text"], ["reportedAt", "Fecha de alta", "datetime-local", true],
    ["dueAt", "Vencimiento", "datetime-local"], ["startedAt", "Inicio", "datetime-local"], ["completedAt", "Finalización", "datetime-local"],
    ["vehicleOrMachine", "Vehículo / máquina afectada", "text"], ["estimatedCost", "Costo estimado", "currency"], ["actualCost", "Costo real", "currency"],
    ["evidence", "Evidencias / actas / fotos", "textarea"], ["notes", "Observaciones", "textarea"]
  )},
  hr: { codePrefix: "RRHH", titleLabel: "Empleado", amountField: "baseSalary", fields: fields(
    ["employeeNumber", "Legajo", "text", true], ["taxId", "CUIL", "tax-id", true], ["category", "Categoría", "text", true],
    ["position", "Puesto", "text", true], ["hireDate", "Fecha de ingreso", "date", true], ["attendance", "Asistencia / novedad", "textarea"],
    ["hours", "Horas normales", "number"], ["overtime", "Horas extra", "number"], ["baseSalary", "Básico", "currency"],
    ["documentationDue", "Vencimiento documental", "date"], ["active", "Activo", "select", true, yesNo]
  )},
  payroll: { codePrefix: "SUE", titleLabel: "Liquidación de sueldo", amountField: "companyCost", fields: fields(
    ["employee", "Empleado", "text", true], ["period", "Período", "text", true], ["baseAmount", "Básico", "currency", true],
    ["additions", "Adicionales", "currency"], ["overtime", "Horas extra", "currency"], ["perDiems", "Viáticos", "currency"],
    ["advances", "Anticipos", "currency"], ["deductions", "Descuentos", "currency"], ["employerContributions", "Cargas sociales", "currency", true],
    ["companyCost", "Costo empresa", "currency", true], ["allocationPct", "Distribución a obra %", "number", true]
  )},
  "per-diems": { codePrefix: "VIA", titleLabel: "Solicitud de viático", requiresWork: true, amountField: "advance", fields: fields(
    ["employee", "Empleado", "text", true], ["destination", "Destino", "text", true], ["startDate", "Desde", "date", true], ["endDate", "Hasta", "date", true],
    ["reason", "Motivo", "textarea", true], ["advance", "Anticipo", "currency", true], ["expenses", "Gastos rendidos", "currency"],
    ["receipts", "Comprobantes", "textarea"], ["balance", "Saldo", "currency"], ["authorization", "Autorización", "select", true, statusOptions]
  )},
  lodging: { codePrefix: "ALO", titleLabel: "Alojamiento", requiresWork: true, amountField: "total", fields: fields(
    ["hotel", "Hotel / alojamiento", "text", true], ["people", "Personas", "textarea", true], ["peopleCount", "Cantidad", "number", true],
    ["checkIn", "Ingreso", "date", true], ["checkOut", "Salida", "date", true], ["nights", "Noches", "number", true],
    ["nightlyRate", "Precio por noche", "currency", true], ["total", "Total", "currency", true], ["invoice", "Factura", "text"],
    ["paymentStatus", "Pago", "select", true, ["Pendiente", "Parcial", "Pagado"]]
  )},
};

export const fallbackRecordDefinition: ModuleRecordDefinition = {
  codePrefix: "REG",
  titleLabel: "Descripción",
  fields: fields(["detail", "Detalle", "textarea", true]),
};
