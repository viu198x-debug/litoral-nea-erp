"use client";

import { useEffect, useState } from "react";

type ApiRequest = (path: string, init?: RequestInit) => Promise<Response>;
interface ManagementKpis {
  activeWorks: number;
  contractTotal: number;
  certified: number;
  pendingCollection: number;
  accountsPayable: number;
  cashAndBanks: number;
  actualCost: number;
  targetBudget: number;
  estimatedMargin: number;
  estimatedTaxes: number;
}
interface DashboardSummary {
  generatedAt: string;
  kpis: ManagementKpis;
}

const kpiItems: Array<{ key: keyof ManagementKpis; label: string; unit: "count" | "currency" | "percent" }> = [
  { key: "activeWorks", label: "Obras activas", unit: "count" },
  { key: "contractTotal", label: "Monto contractual", unit: "currency" },
  { key: "targetBudget", label: "Presupuesto objetivo", unit: "currency" },
  { key: "actualCost", label: "Costo ejecutado", unit: "currency" },
  { key: "estimatedMargin", label: "Margen estimado", unit: "percent" },
  { key: "certified", label: "Certificados netos", unit: "currency" },
  { key: "pendingCollection", label: "Certificados por cobrar", unit: "currency" },
  { key: "accountsPayable", label: "Órdenes de compra pendientes", unit: "currency" },
  { key: "cashAndBanks", label: "Cajas y bancos", unit: "currency" },
  { key: "estimatedTaxes", label: "Impuestos estimados", unit: "currency" },
];

const formatValue = (value: number, unit: "count" | "currency" | "percent") => {
  if (unit === "currency") return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value);
  if (unit === "percent") return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)} %`;
  return new Intl.NumberFormat("es-AR").format(value);
};

export function ManagementOverviewPanel({ request, demoMode }: { request: ApiRequest; demoMode: boolean }) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!demoMode);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (demoMode) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void request("/dashboard", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo consultar el tablero consolidado.");
        return response.json() as Promise<DashboardSummary>;
      })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((cause) => {
        if (!controller.signal.aborted && (cause as { name?: string }).name !== "AbortError") {
          setError(cause instanceof Error ? cause.message : "Fallo de consulta");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [demoMode, refresh, request]);

  return (
    <section className="sector-dashboard-shell">
      <div className="sector-dashboard-heading">
        <div>
          <span className="panel-kicker">Gerencia general</span>
          <h2>Indicadores consolidados</h2>
        </div>
        {!demoMode && <button type="button" className="button secondary" onClick={() => setRefresh((value) => value + 1)}>Actualizar</button>}
      </div>
      <p>Los indicadores se calculan desde el origen y corresponden a los importes registrados. Los valores impositivos y de margen son estimaciones, no liquidaciones definitivas.</p>
      {demoMode ? <p className="sector-dashboard-empty">Modo demostración: sin cifras productivas.</p>
        : error ? <p className="sector-dashboard-empty" role="alert">{error}</p>
        : loading ? <p className="sector-dashboard-empty">Consultando indicadores…</p>
        : !data ? <p className="sector-dashboard-empty">Sin resultados disponibles.</p>
        : (
          <>
            <p>Última actualización: {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data.generatedAt))}</p>
            <div className="sector-kpi-grid">
              {kpiItems.map(({ key, label, unit }) => (
                <article key={key}>
                  <small>{label}</small>
                  <strong>{formatValue(Number(data.kpis[key] ?? 0), unit)}</strong>
                  <p>{key === "estimatedTaxes" || key === "estimatedMargin" ? "Estimación" : "Consolidado del sistema"}</p>
                </article>
              ))}
            </div>
          </>
        )}
    </section>
  );
}
