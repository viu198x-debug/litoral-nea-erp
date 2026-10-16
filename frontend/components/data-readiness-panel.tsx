"use client";

import { useState } from "react";
import { toast } from "sonner";

interface DataReadiness {
  status: "READY_FOR_REVIEW" | "ACTION_REQUIRED";
  generatedAt: string;
  connection: "verified_by_server";
  migrations: {
    expected: number;
    applied: number;
    missing: string[];
    incomplete: string[];
  };
  modules: {
    expected: number;
    configured: number;
    active: number;
    fieldDefinitions: number;
    missing: string[];
    inactive: string[];
    withoutFields: string[];
  };
  migrationAppliedByThisRequest: false;
  productionReady: false;
  note: string;
}

export function DataReadinessPanel({
  request,
  demoMode,
}: {
  request: (path: string, init?: RequestInit) => Promise<Response>;
  demoMode: boolean;
}) {
  const [result, setResult] = useState<DataReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const check = async () => {
    if (demoMode || loading) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const response = await request("/system/data-readiness");
      if (!response.ok) {
        throw new Error(
          response.status === 503
            ? "No se puede comprobar la base desde la conexión del backend."
            : "El servidor rechazó el diagnóstico. Verificá los permisos de administración.",
        );
      }
      const data = await response.json() as DataReadiness;
      setResult(data);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Error de conexión";
      setError(message);
      toast.error("Diagnóstico no disponible", { description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel module-panel">
      <div className="panel-heading">
        <div><span className="panel-kicker">Base de datos / Ingeniería</span><h2>Estado de Prisma y módulos</h2></div>
        <button type="button" className="button secondary" onClick={() => void check()} disabled={demoMode || loading}>
          {loading ? "Verificando…" : "Ejecutar diagnóstico"}
        </button>
      </div>
      <p>Consulta administrativa de solo lectura. No migra el esquema, no cambia permisos y no comprueba por sí sola los respaldos.</p>
      {demoMode && <p>Modo demostración: sin conexión a PostgreSQL.</p>}
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <p><strong>Resultado:</strong> {result.status === "READY_FOR_REVIEW" ? "Esquema apto para revisión funcional" : "Acciones requeridas"}</p>
          <div className="sector-kpi-grid">
            <article><small>Migraciones aplicadas / esperadas</small><strong>{result.migrations.applied} / {result.migrations.expected}</strong><p>Desde _prisma_migrations</p></article>
            <article><small>Módulos configurados</small><strong>{result.modules.configured} / {result.modules.expected}</strong><p>{result.modules.active} activos</p></article>
            <article><small>Definiciones de campos</small><strong>{result.modules.fieldDefinitions}</strong><p>Campos activos en la configuración</p></article>
          </div>
          {[
            ["Migraciones faltantes", result.migrations.missing],
            ["Migraciones incompletas", result.migrations.incomplete],
            ["Módulos sin configurar", result.modules.missing],
            ["Módulos inactivos", result.modules.inactive],
            ["Módulos sin campos", result.modules.withoutFields],
          ].map(([label, values]) => (
            <p key={label as string}><strong>{label as string}:</strong> {(values as string[]).join(", ") || "Ninguno"}</p>
          ))}
          <p>{result.note}</p>
        </>
      )}
    </section>
  );
}
