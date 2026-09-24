"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarClock,
  Check,
  CircleDollarSign,
  Landmark,
  Plus,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DemoUser, Work } from "@frontend/lib/types";

type Requester = (path: string, init?: RequestInit) => Promise<Response>;
type AccountType = "BANK_CURRENT" | "BANK_SAVINGS" | "VIRTUAL_WALLET" | "CASH";
type DialogMode = "account" | "movement" | "cheque" | "reconciliation" | "cash-count" | "close" | null;

type TreasuryAccount = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  institution?: string | null;
  accountNumber?: string | null;
  cbu?: string | null;
  alias?: string | null;
  balance: number | string;
  availableBalance: number | string;
  overdraftLimit?: number | string;
};

type TreasuryMovement = {
  id: string;
  type: string;
  status: string;
  concept: string;
  amount: number | string;
  occurredAt: string;
  counterparty?: string | null;
  reference?: string | null;
  sourceAccount?: TreasuryAccount | null;
  destinationAccount?: TreasuryAccount | null;
  work?: { code: string; name: string } | null;
};

type TreasuryCheque = {
  id: string;
  kind: "OWN" | "THIRD_PARTY";
  status: string;
  number: string;
  bankName: string;
  issuerName: string;
  beneficiary?: string | null;
  amount: number | string;
  dueDate: string;
};

type TreasuryDashboard = {
  position: { total: number; available: number; byType: Record<AccountType, number> };
  today: { income: number; expense: number };
  pendingApprovals: number;
  unreconciled: number;
  accounts: TreasuryAccount[];
  movements: TreasuryMovement[];
  cheques: TreasuryCheque[];
};

const accountLabels: Record<AccountType, string> = {
  BANK_CURRENT: "Cuentas corrientes",
  BANK_SAVINGS: "Cajas de ahorro",
  VIRTUAL_WALLET: "Billeteras virtuales",
  CASH: "Efectivo",
};

const typeIcons = {
  BANK_CURRENT: Landmark,
  BANK_SAVINGS: Building2,
  VIRTUAL_WALLET: Smartphone,
  CASH: Banknote,
};

const movementLabels: Record<string, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Egreso",
  TRANSFER: "Transferencia",
  DEPOSIT: "Depósito",
  WITHDRAWAL: "Extracción",
  FEE: "Comisión",
  INTEREST: "Interés",
  CHECK_ISSUE: "Cheque emitido",
  CHECK_RECEIPT: "Cheque recibido",
  CHECK_DEPOSIT: "Depósito de cheque",
  CHECK_PAYMENT: "Pago de cheque",
  ADJUSTMENT: "Ajuste",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  EXECUTED: "Ejecutado",
  RECONCILED: "Conciliado",
  VOID: "Anulado",
  PORTFOLIO: "En cartera",
  ISSUED: "Emitido",
  RECEIVED: "Recibido",
  DEPOSITED: "Depositado",
  DEFERRED: "Diferido",
  CLEARED: "Cobrado",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
  ENDORSED: "Endosado",
};

const money = (value: number | string) => new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
}).format(Number(value));

const isoDate = () => new Date().toISOString().slice(0, 10);

const demoDashboard: TreasuryDashboard = {
  position: {
    total: 169_250_000,
    available: 181_250_000,
    byType: { BANK_CURRENT: 108_000_000, BANK_SAVINGS: 36_500_000, VIRTUAL_WALLET: 8_750_000, CASH: 16_000_000 },
  },
  today: { income: 18_500_000, expense: 6_500_000 },
  pendingApprovals: 1,
  unreconciled: 2,
  accounts: [
    { id: "demo-current", code: "BCO-CTES-CC", name: "Cuenta corriente principal", type: "BANK_CURRENT", institution: "Banco de Corrientes", accountNumber: "001-000184/7", alias: "LITORAL.CORRIENTES", balance: 108_000_000, availableBalance: 120_000_000, overdraftLimit: 12_000_000 },
    { id: "demo-savings", code: "BNA-CA-ARS", name: "Caja de ahorro operativa", type: "BANK_SAVINGS", institution: "Banco Nación", accountNumber: "45800912", alias: "LITORAL.NACION", balance: 36_500_000, availableBalance: 36_500_000 },
    { id: "demo-wallet", code: "MP-CORP", name: "Billetera corporativa", type: "VIRTUAL_WALLET", institution: "Mercado Pago", accountNumber: "CVU-DEMO-001", alias: "LITORALNEA.MP", balance: 8_750_000, availableBalance: 8_750_000 },
    { id: "demo-cash", code: "EF-CENTRAL", name: "Efectivo · Caja central", type: "CASH", institution: "Tesorería central", balance: 12_000_000, availableBalance: 12_000_000 },
    { id: "demo-cash-admin", code: "EF-ADM", name: "Efectivo · Caja administrativa", type: "CASH", institution: "Administración", balance: 4_000_000, availableBalance: 4_000_000 },
  ],
  movements: [
    { id: "mov-1", type: "INCOME", status: "EXECUTED", concept: "Cobro certificado Nº 4", amount: 18_500_000, occurredAt: "2026-09-24T10:00:00Z", counterparty: "SENASA", reference: "OP-2026-441", destinationAccount: { id: "demo-current", code: "BCO-CTES-CC", name: "Cuenta corriente principal", type: "BANK_CURRENT", balance: 108_000_000, availableBalance: 120_000_000 }, work: { code: "OB-2026-001", name: "SENASA El Sombrero" } },
    { id: "mov-2", type: "EXPENSE", status: "EXECUTED", concept: "Pago parcial OC-2026-0048", amount: 6_500_000, occurredAt: "2026-09-24T11:00:00Z", counterparty: "Proveedor Demo SRL", reference: "TR-8841", sourceAccount: { id: "demo-current", code: "BCO-CTES-CC", name: "Cuenta corriente principal", type: "BANK_CURRENT", balance: 108_000_000, availableBalance: 120_000_000 }, work: { code: "OB-2026-005", name: "Loteo El Perichón" } },
    { id: "mov-3", type: "TRANSFER", status: "PENDING", concept: "Reposición de caja central", amount: 900_000, occurredAt: "2026-09-24T12:00:00Z", reference: "TES-PEND-001", sourceAccount: { id: "demo-wallet", code: "MP-CORP", name: "Billetera corporativa", type: "VIRTUAL_WALLET", balance: 8_750_000, availableBalance: 8_750_000 }, destinationAccount: { id: "demo-cash", code: "EF-CENTRAL", name: "Efectivo · Caja central", type: "CASH", balance: 12_000_000, availableBalance: 12_000_000 } },
  ],
  cheques: [
    { id: "ch-1", kind: "OWN", status: "ISSUED", number: "00018451", bankName: "Banco de Corrientes", issuerName: "LITORAL NEA SRL", beneficiary: "Proveedor Demo SRL", amount: 6_850_000, dueDate: "2026-09-30T00:00:00Z" },
    { id: "ch-2", kind: "THIRD_PARTY", status: "PORTFOLIO", number: "75810329", bankName: "Banco Macro", issuerName: "Comitente Demo", beneficiary: "LITORAL NEA SRL", amount: 12_400_000, dueDate: "2026-10-05T00:00:00Z" },
    { id: "ch-3", kind: "THIRD_PARTY", status: "DEPOSITED", number: "91002614", bankName: "Banco Galicia", issuerName: "Municipalidad Demo", beneficiary: "LITORAL NEA SRL", amount: 8_200_000, dueDate: "2026-09-24T00:00:00Z" },
  ],
};

const initialForm = {
  code: "", name: "", accountType: "BANK_CURRENT", institution: "", accountNumber: "", cbu: "", alias: "", openingBalance: "", overdraftLimit: "",
  movementType: "EXPENSE", sourceAccountId: "", destinationAccountId: "", amount: "", concept: "", counterparty: "", paymentMethod: "Transferencia", reference: "", occurredAt: isoDate(), workId: "",
  chequeKind: "OWN", chequeNumber: "", bankName: "", issuerName: "LITORAL NEA SRL", beneficiary: "", issueDate: isoDate(), dueDate: isoDate(),
  accountId: "", statementOpening: "", statementClosing: "", bookOpening: "", bookClosing: "", periodFrom: isoDate(), periodTo: isoDate(), countedBalance: "", den20000: "", den10000: "", den2000: "", den1000: "", coins: "", notes: "", closedDate: isoDate(),
};

export function TreasuryPage({ request, demoMode, user, workItems }: { request: Requester; demoMode: boolean; user: DemoUser; workItems: Work[] }) {
  const [data, setData] = useState<TreasuryDashboard>(demoDashboard);
  const [loading, setLoading] = useState(!demoMode);
  const [mode, setMode] = useState<DialogMode>(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const canCreate = user.allowedActions.includes("create") && (user.allowedModules.includes("*") || user.allowedModules.includes("treasury"));
  const canApprove = user.allowedActions.includes("approve") && (user.allowedModules.includes("*") || user.allowedModules.includes("treasury"));
  const cashAccounts = useMemo(() => data.accounts.filter((account) => account.type === "CASH"), [data.accounts]);

  const load = async () => {
    if (demoMode) return;
    setLoading(true);
    try {
      const response = await request("/treasury/dashboard");
      if (!response.ok) throw new Error("No se pudo consultar la posición de Tesorería");
      setData(await response.json() as TreasuryDashboard);
    } catch (cause) {
      toast.error("Tesorería no disponible", { description: cause instanceof Error ? cause.message : "Error de conexión" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [demoMode]);

  const open = (nextMode: Exclude<DialogMode, null>) => {
    setForm({ ...initialForm, sourceAccountId: data.accounts[0]?.id ?? "", destinationAccountId: data.accounts[1]?.id ?? "", accountId: nextMode === "cash-count" ? cashAccounts[0]?.id ?? "" : data.accounts[0]?.id ?? "" });
    setMode(nextMode);
  };

  const update = (key: keyof typeof initialForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mode) return;
    setSaving(true);
    try {
      const amount = Number(form.amount || 0);
      let path = "";
      let payload: Record<string, unknown> = {};
      if (mode === "account") {
        path = "/treasury/accounts";
        payload = { code: form.code, name: form.name, type: form.accountType, institution: form.institution || undefined, accountNumber: form.accountNumber || undefined, cbu: form.cbu || undefined, alias: form.alias || undefined, openingBalance: Number(form.openingBalance || 0), overdraftLimit: Number(form.overdraftLimit || 0), currency: "ARS" };
      } else if (mode === "movement") {
        path = "/treasury/movements";
        const needsSource = ["EXPENSE", "TRANSFER", "WITHDRAWAL", "FEE", "CHECK_ISSUE", "CHECK_PAYMENT"].includes(form.movementType);
        const needsDestination = ["INCOME", "TRANSFER", "DEPOSIT", "INTEREST", "CHECK_RECEIPT", "CHECK_DEPOSIT"].includes(form.movementType);
        payload = { type: form.movementType, sourceAccountId: needsSource ? form.sourceAccountId : undefined, destinationAccountId: needsDestination ? form.destinationAccountId : undefined, amount, concept: form.concept, counterparty: form.counterparty || undefined, paymentMethod: form.paymentMethod, reference: form.reference || undefined, occurredAt: `${form.occurredAt}T12:00:00.000Z`, workId: form.workId || undefined, currency: "ARS" };
      } else if (mode === "cheque") {
        path = "/treasury/cheques";
        payload = { kind: form.chequeKind, number: form.chequeNumber, bankName: form.bankName, issuerName: form.issuerName, beneficiary: form.beneficiary || undefined, amount, issueDate: `${form.issueDate}T12:00:00.000Z`, dueDate: `${form.dueDate}T12:00:00.000Z`, accountId: form.accountId || undefined, workId: form.workId || undefined };
      } else if (mode === "reconciliation") {
        path = "/treasury/reconciliations";
        payload = { accountId: form.accountId, periodFrom: `${form.periodFrom}T00:00:00.000Z`, periodTo: `${form.periodTo}T23:59:59.000Z`, statementOpening: Number(form.statementOpening), statementClosing: Number(form.statementClosing), bookOpening: Number(form.bookOpening), bookClosing: Number(form.bookClosing), notes: form.notes || undefined, items: [] };
      } else if (mode === "cash-count") {
        path = "/treasury/cash-counts";
        const denominations = [
          [20_000, Number(form.den20000 || 0)], [10_000, Number(form.den10000 || 0)],
          [2_000, Number(form.den2000 || 0)], [1_000, Number(form.den1000 || 0)],
          [1, Number(form.coins || 0)],
        ].filter(([, quantity]) => quantity > 0).map(([denomination, quantity]) => ({ denomination, quantity, subtotal: denomination * quantity }));
        const counted = denominations.reduce((sum, item) => sum + item.subtotal, 0);
        payload = { accountId: form.accountId, countedBalance: counted, denominations, notes: form.notes || undefined };
      } else {
        path = "/treasury/daily-closes";
        payload = { closedDate: `${form.closedDate}T00:00:00.000Z`, notes: form.notes || undefined };
      }
      if (!demoMode) {
        const response = await request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
          throw new Error(Array.isArray(body?.message) ? body?.message.join(". ") : body?.message ?? "No se pudo registrar la operación");
        }
        await load();
      } else if (mode === "movement") {
        setData((current) => ({ ...current, pendingApprovals: current.pendingApprovals + 1, movements: [{ id: `demo-${Date.now()}`, type: form.movementType, status: "PENDING", concept: form.concept, amount, occurredAt: new Date().toISOString(), counterparty: form.counterparty, reference: form.reference, sourceAccount: current.accounts.find((item) => item.id === form.sourceAccountId), destinationAccount: current.accounts.find((item) => item.id === form.destinationAccountId), work: workItems.find((item) => item.id === form.workId) ? { code: workItems.find((item) => item.id === form.workId)!.code, name: workItems.find((item) => item.id === form.workId)!.name } : null }, ...current.movements] }));
      }
      toast.success("Registración guardada", { description: mode === "movement" ? "El movimiento quedó pendiente de aprobación y conserva trazabilidad completa." : "La operación de Tesorería quedó registrada." });
      setMode(null);
    } catch (cause) {
      toast.error("No se pudo guardar", { description: cause instanceof Error ? cause.message : "Verificá los datos ingresados" });
    } finally {
      setSaving(false);
    }
  };

  const approve = async (movement: TreasuryMovement) => {
    try {
      if (!demoMode) {
        const response = await request(`/treasury/movements/${movement.id}/approve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ comments: "Aprobado desde el panel de Tesorería" }) });
        if (!response.ok) throw new Error("La aprobación fue rechazada por el control de permisos");
        await load();
      } else {
        setData((current) => ({ ...current, pendingApprovals: Math.max(0, current.pendingApprovals - 1), movements: current.movements.map((item) => item.id === movement.id ? { ...item, status: "EXECUTED" } : item) }));
      }
      toast.success("Movimiento aprobado y ejecutado");
    } catch (cause) {
      toast.error("No se pudo aprobar", { description: cause instanceof Error ? cause.message : "Control de segregación activo" });
    }
  };

  const netToday = data.today.income - data.today.expense;
  return (
    <>
      <section className="treasury-heading">
        <div><span className="panel-kicker">FINANZAS · CONTROL CENTRAL</span><h1>Tesorería</h1><p>Bancos, cajas de ahorro, billeteras, efectivo y cheques bajo una sola posición auditada.</p></div>
        <div className="treasury-heading-actions"><button className="button secondary" onClick={() => void load()} disabled={loading}><RefreshCcw size={17} /> Actualizar</button>{canCreate && <button className="button primary" onClick={() => open("movement")}><Plus size={17} /> Nuevo movimiento</button>}</div>
      </section>

      <section className="treasury-position panel">
        <div className="treasury-total"><span className="treasury-main-icon"><CircleDollarSign size={28} /></span><div><small>Posición financiera total</small><strong>{money(data.position.total)}</strong><p>Disponible: {money(data.position.available)}</p></div></div>
        <div className="treasury-type-grid">
          {(Object.keys(accountLabels) as AccountType[]).map((type) => {
            const Icon = typeIcons[type];
            return <article key={type}><span><Icon size={19} /></span><div><small>{accountLabels[type]}</small><strong>{money(data.position.byType[type] ?? 0)}</strong></div></article>;
          })}
        </div>
      </section>

      <section className="treasury-kpis">
        <article><ArrowDownLeft size={21} /><div><small>Ingresos de hoy</small><strong className="positive-text">{money(data.today.income)}</strong></div></article>
        <article><ArrowUpRight size={21} /><div><small>Egresos de hoy</small><strong>{money(data.today.expense)}</strong></div></article>
        <article><ArrowLeftRight size={21} /><div><small>Flujo neto de hoy</small><strong className={netToday >= 0 ? "positive-text" : "warning-text"}>{money(netToday)}</strong></div></article>
        <article><ShieldCheck size={21} /><div><small>Pendientes de aprobación</small><strong>{data.pendingApprovals}</strong></div></article>
      </section>

      {canCreate && <section className="treasury-actions panel">
        <button onClick={() => open("account")}><Building2 size={19} /><span><strong>Nueva cuenta</strong><small>Banco, ahorro, billetera o caja</small></span></button>
        <button onClick={() => open("cheque")}><ReceiptText size={19} /><span><strong>Registrar cheque</strong><small>Propio o de terceros</small></span></button>
        <button onClick={() => open("reconciliation")}><Check size={19} /><span><strong>Conciliar</strong><small>Extracto contra libro</small></span></button>
        <button onClick={() => open("cash-count")}><Banknote size={19} /><span><strong>Arqueo de caja</strong><small>Efectivo y diferencias</small></span></button>
        <button onClick={() => open("close")}><CalendarClock size={19} /><span><strong>Cierre diario</strong><small>Foto de posición y cheques</small></span></button>
      </section>}

      <section className="treasury-layout">
        <article className="panel treasury-accounts">
          <div className="panel-heading"><div><span className="panel-kicker">CUENTAS</span><h2>Disponibilidades</h2></div><span className="updated">{data.accounts.length} activas</span></div>
          <div className="treasury-account-list">
            {data.accounts.map((account) => { const Icon = typeIcons[account.type]; return <div key={account.id} className="treasury-account-row"><span className={`account-type-icon ${account.type.toLowerCase()}`}><Icon size={20} /></span><div><strong>{account.name}</strong><small>{account.institution ?? accountLabels[account.type]} · {account.accountNumber ?? account.code}</small><em>{account.alias ?? account.cbu ?? account.code}</em></div><span><strong>{money(account.balance)}</strong><small>Disponible {money(account.availableBalance)}</small></span></div>; })}
          </div>
        </article>
        <article className="panel treasury-controls">
          <div className="panel-heading"><div><span className="panel-kicker orange">CONTROL</span><h2>Alertas del tesorero</h2></div></div>
          <div className="treasury-control-row warning"><span>{data.pendingApprovals}</span><div><strong>Movimientos pendientes</strong><small>Requieren aprobación de otro usuario habilitado.</small></div></div>
          <div className="treasury-control-row"><span>{data.unreconciled}</span><div><strong>Movimientos sin conciliar</strong><small>Comparar contra extractos bancarios.</small></div></div>
          <div className="treasury-control-row"><span>{data.cheques.length}</span><div><strong>Cheques abiertos</strong><small>En cartera, emitidos, depositados o diferidos.</small></div></div>
          <div className="treasury-security"><ShieldCheck size={20} /><p><strong>Segregación activa.</strong> Quien registra no aprueba su propio movimiento; todos los cambios quedan en Auditoría.</p></div>
        </article>
      </section>

      <section className="panel treasury-table-panel">
        <div className="panel-heading"><div><span className="panel-kicker">MOVIMIENTOS</span><h2>Últimas operaciones</h2></div></div>
        <Table className="erp-table"><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Operación</TableHead><TableHead>Concepto</TableHead><TableHead>Origen / destino</TableHead><TableHead>Obra</TableHead><TableHead>Importe</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader><TableBody>
          {data.movements.map((movement) => <TableRow key={movement.id}><TableCell>{new Intl.DateTimeFormat("es-AR").format(new Date(movement.occurredAt))}</TableCell><TableCell><span className="table-primary">{movementLabels[movement.type] ?? movement.type}</span></TableCell><TableCell><span className="table-primary">{movement.concept}</span><small className="table-subline">{movement.counterparty ?? movement.reference ?? "Sin contraparte"}</small></TableCell><TableCell>{movement.sourceAccount?.code ?? "—"}{movement.destinationAccount ? ` → ${movement.destinationAccount.code}` : ""}</TableCell><TableCell>{movement.work?.code ?? "General"}</TableCell><TableCell><strong>{money(movement.amount)}</strong></TableCell><TableCell><span className={`treasury-status ${movement.status.toLowerCase()}`}>{statusLabels[movement.status] ?? movement.status}</span></TableCell><TableCell>{movement.status === "PENDING" && canApprove && <button className="mini-approve" onClick={() => void approve(movement)}><Check size={15} /> Aprobar</button>}</TableCell></TableRow>)}
        </TableBody></Table>
      </section>

      <section className="panel treasury-cheques">
        <div className="panel-heading"><div><span className="panel-kicker">VALORES</span><h2>Cheques propios y de terceros</h2></div></div>
        <div className="cheque-grid">{data.cheques.map((cheque) => <article key={cheque.id}><div><span>{cheque.kind === "OWN" ? "PROPIO" : "TERCERO"}</span><strong>#{cheque.number}</strong></div><p>{cheque.bankName} · {cheque.kind === "OWN" ? cheque.beneficiary : cheque.issuerName}</p><strong>{money(cheque.amount)}</strong><footer><small>Vence {new Intl.DateTimeFormat("es-AR").format(new Date(cheque.dueDate))}</small><span className={`treasury-status ${cheque.status.toLowerCase()}`}>{statusLabels[cheque.status] ?? cheque.status}</span></footer></article>)}</div>
      </section>

      <Dialog open={mode !== null} onOpenChange={(value) => !value && setMode(null)}><DialogContent className="treasury-dialog"><form onSubmit={submit}><DialogHeader><DialogTitle>{dialogTitle(mode)}</DialogTitle><DialogDescription>{dialogDescription(mode)}</DialogDescription></DialogHeader><div className="treasury-form">{renderFields(mode, form, update, data.accounts, cashAccounts, workItems)}</div><DialogFooter><button type="button" className="button secondary" onClick={() => setMode(null)}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? "Guardando…" : "Guardar registración"}</button></DialogFooter></form></DialogContent></Dialog>
    </>
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={wide ? "wide" : ""}><span>{label}</span>{children}</label>;
}

function renderFields(mode: DialogMode, form: typeof initialForm, update: (key: keyof typeof initialForm, value: string) => void, accounts: TreasuryAccount[], cashAccounts: TreasuryAccount[], works: Work[]) {
  const input = (key: keyof typeof initialForm, required = false, type = "text") => <input type={type} required={required} value={form[key]} onChange={(event) => update(key, event.target.value)} />;
  const accountsSelect = (key: "sourceAccountId" | "destinationAccountId" | "accountId", source = accounts) => <select required value={form[key]} onChange={(event) => update(key, event.target.value)}>{source.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select>;
  const workSelect = <select value={form.workId} onChange={(event) => update("workId", event.target.value)}><option value="">General / sin obra</option>{works.map((work) => <option key={work.id} value={work.id}>{work.code} · {work.name}</option>)}</select>;
  if (mode === "account") return <><Field label="Código">{input("code", true)}</Field><Field label="Nombre">{input("name", true)}</Field><Field label="Tipo"><select value={form.accountType} onChange={(event) => update("accountType", event.target.value)}>{Object.entries(accountLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Banco / institución">{input("institution")}</Field><Field label="Número de cuenta / CVU">{input("accountNumber")}</Field><Field label="CBU">{input("cbu")}</Field><Field label="Alias">{input("alias")}</Field><Field label="Saldo inicial">{input("openingBalance", true, "number")}</Field><Field label="Límite de descubierto">{input("overdraftLimit", false, "number")}</Field></>;
  if (mode === "movement") return <><Field label="Operación"><select value={form.movementType} onChange={(event) => update("movementType", event.target.value)}>{Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Importe">{input("amount", true, "number")}</Field><Field label="Cuenta de origen">{accountsSelect("sourceAccountId")}</Field><Field label="Cuenta de destino">{accountsSelect("destinationAccountId")}</Field><Field label="Fecha">{input("occurredAt", true, "date")}</Field><Field label="Medio"><select value={form.paymentMethod} onChange={(event) => update("paymentMethod", event.target.value)}>{["Transferencia", "Cheque", "Efectivo", "Billetera virtual", "Débito automático"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Contraparte">{input("counterparty")}</Field><Field label="Referencia / comprobante">{input("reference")}</Field><Field label="Obra / centro de costo">{workSelect}</Field><Field label="Concepto" wide><textarea required value={form.concept} onChange={(event) => update("concept", event.target.value)} /></Field></>;
  if (mode === "cheque") return <><Field label="Tipo"><select value={form.chequeKind} onChange={(event) => update("chequeKind", event.target.value)}><option value="OWN">Cheque propio</option><option value="THIRD_PARTY">Cheque de terceros</option></select></Field><Field label="Número">{input("chequeNumber", true)}</Field><Field label="Banco">{input("bankName", true)}</Field><Field label="Cuenta asociada">{accountsSelect("accountId")}</Field><Field label="Librador">{input("issuerName", true)}</Field><Field label="Beneficiario">{input("beneficiary")}</Field><Field label="Importe">{input("amount", true, "number")}</Field><Field label="Fecha de emisión">{input("issueDate", true, "date")}</Field><Field label="Fecha de pago">{input("dueDate", true, "date")}</Field><Field label="Obra">{workSelect}</Field></>;
  if (mode === "reconciliation") return <><Field label="Cuenta">{accountsSelect("accountId")}</Field><Field label="Período desde">{input("periodFrom", true, "date")}</Field><Field label="Período hasta">{input("periodTo", true, "date")}</Field><Field label="Extracto inicial">{input("statementOpening", true, "number")}</Field><Field label="Extracto final">{input("statementClosing", true, "number")}</Field><Field label="Libro inicial">{input("bookOpening", true, "number")}</Field><Field label="Libro final">{input("bookClosing", true, "number")}</Field><Field label="Observaciones" wide><textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} /></Field></>;
  if (mode === "cash-count") return <><Field label="Caja de efectivo">{accountsSelect("accountId", cashAccounts)}</Field><Field label="Billetes de $20.000">{input("den20000", false, "number")}</Field><Field label="Billetes de $10.000">{input("den10000", false, "number")}</Field><Field label="Billetes de $2.000">{input("den2000", false, "number")}</Field><Field label="Billetes de $1.000">{input("den1000", false, "number")}</Field><Field label="Monedas / otros valores">{input("coins", false, "number")}</Field><Field label="Detalle del arqueo" wide><textarea required value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Vales, comprobantes y observaciones de la caja" /></Field></>;
  return <><Field label="Fecha de cierre">{input("closedDate", true, "date")}</Field><Field label="Observaciones" wide><textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Novedades, saldos a verificar y valores pendientes" /></Field></>;
}

function dialogTitle(mode: DialogMode) {
  return ({ account: "Nueva cuenta de Tesorería", movement: "Nuevo movimiento", cheque: "Registrar cheque", reconciliation: "Conciliación bancaria", "cash-count": "Arqueo de caja", close: "Cierre diario" } as Record<string, string>)[mode ?? ""] ?? "Tesorería";
}

function dialogDescription(mode: DialogMode) {
  return mode === "movement" ? "La registración quedará pendiente hasta que otro usuario autorizado la apruebe." : "Completá los datos característicos; usuario, fecha y cambios quedarán auditados.";
}
