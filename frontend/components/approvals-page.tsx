"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { specializedModuleDefinitions } from "@frontend/lib/module-field-catalog";

type ApiRequest = (path: string, options?: RequestInit) => Promise<Response>;
type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
interface ApprovalInstance {
  id: string;
  module: string;
  entityType: string;
  entityId: string;
  status: ApprovalStatus;
  requestedAt: string;
  currentStep: number;
  requestedById: string;
  work?: { code: string; name: string } | null;
  workflow?: { code: string; name?: string } | null;
  decisions?: Array<{ id: string; step: number; decision: string; comments?: string | null }>;
}

const statusLabels: Record<ApprovalStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

export function ApprovalsPage({
  request,
  demoMode,
  canApprove,
}: {
  request: ApiRequest;
  demoMode: boolean;
  canApprove: boolean;
}) {
  const [status, setStatus] = useState<ApprovalStatus | "ALL">("PENDING");
  const [items, setItems] = useState<ApprovalInstance[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(!demoMode);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) {
      setItems([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const query = status === "ALL" ? "" : `?status=${status}`;
    void request(`/approvals${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("La API no autorizó la consulta de aprobaciones.");
        return response.json() as Promise<ApprovalInstance[]>;
      })
      .then((data) => { if (!controller.signal.aborted) setItems(data); })
      .catch((cause) => {
        if ((cause as { name?: string }).name !== "AbortError" && !controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "No se pudieron leer las aprobaciones.");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status, refresh, demoMode, request]);

  const decide = async (item: ApprovalInstance, decision: "APPROVED" | "REJECTED") => {
    if (!canApprove || busyId || demoMode || item.status !== "PENDING") return;
    const reason = (comments[item.id] ?? "").trim();
    if (decision === "REJECTED" && !reason) {
      toast.error("Para rechazar, ingresá el motivo de la decisión.");
      return;
    }
    if (!window.confirm(`¿Confirmar ${decision === "APPROVED" ? "aprobación" : "rechazo"} de ${item.module} / ${item.entityId}?`)) return;
    setBusyId(item.id);
    try {
      const response = await request(`/approvals/${encodeURIComponent(item.id)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comments: reason || undefined }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
        const message = Array.isArray(body?.message) ? body.message.join(". ") : body?.message;
        throw new Error(message || "La API rechazó la decisión.");
      }
      toast.success(decision === "APPROVED" ? "Aprobación registrada" : "Rechazo registrado");
      setComments((current) => ({ ...current, [item.id]: "" }));
      setRefresh((value) => value + 1);
    } catch (cause) {
      toast.error("No se pudo registrar la decisión", {
        description: cause instanceof Error ? cause.message : "Error de conexión",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <section className="panel module-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Control de autorizaciones</span>
            <h2>Bandeja de aprobaciones</h2>
          </div>
        </div>
        <p>Las solicitudes se crean desde sus módulos de origen. Las decisiones conservan trazabilidad y el servidor comprueba el rol y la separación entre solicitante y aprobador.</p>
        <div className="module-toolbar">
          <label htmlFor="approval-status">Estado</label>
          <select id="approval-status" value={status} onChange={(event) => setStatus(event.target.value as ApprovalStatus | "ALL")}>
            <option value="PENDING">Pendientes</option>
            <option value="APPROVED">Aprobadas</option>
            <option value="REJECTED">Rechazadas</option>
            <option value="CANCELLED">Canceladas</option>
            <option value="ALL">Todas</option>
          </select>
          {!demoMode && <button className="button secondary" type="button" onClick={() => setRefresh((value) => value + 1)}>Actualizar</button>}
        </div>
        {demoMode ? (
          <p className="sector-dashboard-empty">Modo demostración: conectá la API para consultar solicitudes reales. No se simulan decisiones.</p>
        ) : error ? (
          <p className="sector-dashboard-empty" role="alert">{error}</p>
        ) : loading ? (
          <p className="sector-dashboard-empty">Consultando aprobaciones…</p>
        ) : items.length === 0 ? (
          <p className="sector-dashboard-empty">No hay solicitudes en este estado.</p>
        ) : (
          <div className="table-scroll" role="region" aria-label="Solicitudes de aprobación" tabIndex={0}>
            <table className="erp-table module-table">
              <thead><tr><th>Origen</th><th>Registro</th><th>Obra</th><th>Fecha</th><th>Circuito / paso</th><th>Estado</th><th>Resolución</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.module}</td>
                    <td><strong>{item.entityType}</strong><small>{item.entityId}</small></td>
                    <td>{item.work?.code ?? "General"}</td>
                    <td>{Number.isNaN(Date.parse(item.requestedAt)) ? "—" : new Intl.DateTimeFormat("es-AR").format(new Date(item.requestedAt))}</td>
                    <td>{item.workflow?.code ?? "—"} / {item.currentStep}</td>
                    <td>{statusLabels[item.status] ?? item.status}</td>
                    <td>
                      {item.status === "PENDING" && canApprove ? (
                        <div className="row-actions">
                          <label>
                            <span className="sr-only">Fundamento de la decisión</span>
                            <textarea
                              aria-label={`Fundamento para ${item.entityId}`}
                              rows={2}
                              maxLength={2000}
                              placeholder="Motivo (obligatorio para rechazar)"
                              value={comments[item.id] ?? ""}
                              onChange={(event) => setComments((prev) => ({ ...prev, [item.id]: event.target.value }))}
                              disabled={busyId === item.id}
                            />
                          </label>
                          <button className="button secondary" disabled={Boolean(busyId)} type="button" onClick={() => void decide(item, "APPROVED")}>Aprobar</button>
                          <button className="button secondary" disabled={Boolean(busyId)} type="button" onClick={() => void decide(item, "REJECTED")}>Rechazar</button>
                        </div>
                      ) : <span>Consulta</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel module-panel">
        <div className="panel-heading"><div><span className="panel-kicker">Esquema especializado</span><h2>Campos de aprobaciones</h2></div></div>
        <p>{specializedModuleDefinitions.approvals.description}</p>
        <div className="feature-grid">
          {specializedModuleDefinitions.approvals.fields.map((field) => (
            <div className="feature-card" key={field.key}><small>{field.section}</small><strong>{field.label}</strong><small>{field.required ? "Obligatorio" : "Según operación"}</small></div>
          ))}
        </div>
      </section>
    </>
  );
}
