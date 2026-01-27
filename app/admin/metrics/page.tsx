"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type MetricsResponse = {
  ok: boolean;
  totals: {
    qr_open: number;
    purchase: number;
    otp_login?: number;
    conversion_percent?: number;
  };
  byDay: {
    day: string;
    qr_open: number;
    purchase: number;
    otp_login?: number;
  }[];
};

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// helpers de data (UTC simples)
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function startOfMonthISO() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function startOfYearISO() {
  const d = new Date();
  d.setMonth(0, 1);
  return d.toISOString().slice(0, 10);
}

type ViewMode = "all" | "bought" | "not_bought";

function csvEscape(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  const needsQuotes = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export default function AdminMetricsPage() {
  const [exp, setExp] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>("all");

  const [loading, setLoading] = useState(false);
  const [exportingMetrics, setExportingMetrics] = useState(false);
  const [exportingMailing, setExportingMailing] = useState(false);
  const [exportingRaw, setExportingRaw] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MetricsResponse | null>(null);

  function buildParams() {
    const params = new URLSearchParams();
    if (exp) params.set("exp", exp);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params;
  }

  async function load() {
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { data: session } = await supabase.auth.getSession();

      const token = session?.session?.access_token;
      if (!token) {
        setError("Sessão inválida. Faça login novamente no admin.");
        setLoading(false);
        return;
      }

      const params = buildParams();

      const res = await fetch(`/api/admin/metrics?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error || "Erro ao carregar métricas.");
        setLoading(false);
        return;
      }

      setData(json);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function downloadCsv(url: string, token: string, fallbackName: string) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const maybeJson = await res.json().catch(() => null);
      throw new Error(maybeJson?.error || "Erro ao exportar CSV.");
    }

    const blob = await res.blob();
    const disposition = res.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || fallbackName;

    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  }

  function downloadClientCsv(csvText: string, filename: string) {
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  }

  const filteredByDay = useMemo(() => {
    if (!data) return [];
    if (viewMode === "all") return data.byDay;

    if (viewMode === "bought") {
      return data.byDay.filter((d) => (d.purchase ?? 0) > 0);
    }

    return data.byDay.filter((d) => (d.qr_open ?? 0) > 0 && (d.purchase ?? 0) === 0);
  }, [data, viewMode]);

  async function exportMetricsCsv() {
    setError(null);
    setExportingMetrics(true);

    try {
      const supabase = getSupabaseClient();
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Sessão inválida. Faça login novamente no admin.");

      const params = buildParams();

      if (viewMode === "all") {
        await downloadCsv(`/api/admin/metrics/export?${params.toString()}`, token, "metrics.csv");
        return;
      }

      if (!data) throw new Error("Nenhum dado carregado para exportar.");

      const conversion = data.totals.conversion_percent ?? 0;

      const header = [
        "day",
        "qr_open",
        "purchase",
        "otp_login",
        "conversion_percent",
        "filter_exp",
        "filter_from",
        "filter_to",
        "view_mode",
      ];

      const lines: string[] = [];
      lines.push(header.join(","));

      for (const d of filteredByDay) {
        lines.push(
          [
            csvEscape(d.day),
            csvEscape(d.qr_open ?? 0),
            csvEscape(d.purchase ?? 0),
            csvEscape(d.otp_login ?? 0),
            csvEscape(conversion),
            csvEscape(exp || ""),
            csvEscape(from || ""),
            csvEscape(to || ""),
            csvEscape(viewMode),
          ].join(",")
        );
      }

      const modeLabel = viewMode === "bought" ? "comprou" : "nao_comprou";
      const filenameParts = [
        "metrics",
        modeLabel,
        exp ? `exp-${exp}` : null,
        from ? `from-${from}` : null,
        to ? `to-${to}` : null,
      ].filter(Boolean);

      downloadClientCsv(lines.join("\n"), `${filenameParts.join("_")}.csv`);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setExportingMetrics(false);
    }
  }

  async function exportMailingCsv() {
    setError(null);
    setExportingMailing(true);

    try {
      const supabase = getSupabaseClient();
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Sessão inválida. Faça login novamente no admin.");

      const params = buildParams();
      await downloadCsv(`/api/admin/mailing/export?${params.toString()}`, token, "mailing.csv");
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setExportingMailing(false);
    }
  }

  async function exportRawEventsCsv() {
    setError(null);
    setExportingRaw(true);

    try {
      const supabase = getSupabaseClient();
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Sessão inválida. Faça login novamente no admin.");

      const params = buildParams();
      await downloadCsv(`/api/admin/metrics/export-raw?${params.toString()}`, token, "events_raw.csv");
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setExportingRaw(false);
    }
  }

  // atalhos de data
  function applyRange(f: string, t: string) {
    setFrom(f);
    setTo(t);
    setTimeout(load, 0);
  }

  // UI helpers
  const Card = ({
    label,
    value,
    hint,
  }: {
    label: string;
    value: string | number;
    hint?: string;
  }) => (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 12,
        padding: 14,
        background: "#fff",
        minWidth: 180,
      }}
    >
      <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 700, letterSpacing: 0.2 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{value}</div>
      {hint ? <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{hint}</div> : null}
    </div>
  );

  const chipStyle = (active: boolean) => ({
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    background: active ? "#111827" : "#fff",
    color: active ? "#fff" : "#111827",
    fontWeight: active ? 800 : 500,
    cursor: "pointer",
  });

  const buttonPrimary = (disabled?: boolean) => ({
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #111827",
    background: disabled ? "#111827" : "#111827",
    color: "#fff",
    opacity: disabled ? 0.7 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  const buttonGhost = (disabled?: boolean) => ({
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "#fff",
    color: "#111827",
    opacity: disabled ? 0.7 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 800, letterSpacing: 0.2 }}>
            ADMIN
          </div>
          <h1 style={{ margin: "6px 0 0", fontSize: 28 }}>Métricas</h1>
          <div style={{ marginTop: 6, color: "#6B7280" }}>
            Entraram × Compraram (por período e experience_id)
          </div>
        </div>

        <div
          style={{
            border: "1px solid rgba(0,0,0,0.10)",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
            minWidth: 320,
          }}
        >
          <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 800, letterSpacing: 0.2 }}>
            EXPORTAR
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button style={buttonPrimary(exportingMetrics)} onClick={exportMetricsCsv} disabled={exportingMetrics}>
              {exportingMetrics ? "Exportando…" : "CSV Métricas"}
            </button>
            <button style={buttonGhost(exportingMailing)} onClick={exportMailingCsv} disabled={exportingMailing}>
              {exportingMailing ? "Exportando…" : "CSV Mailing"}
            </button>
            <button style={buttonGhost(exportingRaw)} onClick={exportRawEventsCsv} disabled={exportingRaw}>
              {exportingRaw ? "Exportando…" : "CSV Eventos brutos"}
            </button>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <section
        style={{
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 14,
          padding: 14,
          background: "#F9FAFB",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>experience_id</div>
            <input
              placeholder="ex: teste_01"
              value={exp}
              onChange={(e) => setExp(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.14)",
                minWidth: 220,
                background: "#fff",
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>de</div>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.14)",
                background: "#fff",
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>até</div>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.14)",
                background: "#fff",
              }}
            />
          </div>

          <button style={buttonPrimary(loading)} onClick={load} disabled={loading}>
            {loading ? "Carregando…" : "Aplicar"}
          </button>
        </div>

        {/* Atalhos */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button style={buttonGhost(false)} onClick={() => applyRange(todayISO(), todayISO())}>
            Hoje
          </button>
          <button style={buttonGhost(false)} onClick={() => applyRange(daysAgoISO(6), todayISO())}>
            Últimos 7 dias
          </button>
          <button style={buttonGhost(false)} onClick={() => applyRange(daysAgoISO(29), todayISO())}>
            Últimos 30 dias
          </button>
          <button style={buttonGhost(false)} onClick={() => applyRange(startOfMonthISO(), todayISO())}>
            Este mês
          </button>
          <button style={buttonGhost(false)} onClick={() => applyRange(startOfYearISO(), todayISO())}>
            Este ano
          </button>
        </div>

        {/* Ver */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 800, letterSpacing: 0.2 }}>VER</div>
          <button style={chipStyle(viewMode === "all")} onClick={() => setViewMode("all")}>
            Todos
          </button>
          <button style={chipStyle(viewMode === "bought")} onClick={() => setViewMode("bought")}>
            Comprou
          </button>
          <button style={chipStyle(viewMode === "not_bought")} onClick={() => setViewMode("not_bought")}>
            Não comprou
          </button>
        </div>
      </section>

      {error && (
        <div
          style={{
            border: "1px solid rgba(220, 38, 38, 0.35)",
            background: "rgba(220, 38, 38, 0.08)",
            borderRadius: 12,
            padding: 12,
            color: "#991B1B",
            marginBottom: 16,
          }}
        >
          <b>Erro:</b> {error}
        </div>
      )}

      {data && (
        <>
          {/* Cards */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <Card label="ENTRARAM" value={data.totals.qr_open} hint="no período selecionado" />
            <Card label="COMPRARAM" value={data.totals.purchase} hint="no período selecionado" />
            <Card
              label="CONVERSÃO"
              value={`${data.totals.conversion_percent ?? 0}%`}
              hint="compras / entradas"
            />
            <Card label="LINHAS (TABELA)" value={filteredByDay.length} hint="após filtro VER" />
          </div>

          {/* Tabela */}
          <div
            style={{
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: 14,
              overflowX: "auto",
              background: "#fff",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  <th
                    align="left"
                    style={{ padding: 12, fontSize: 12, color: "#6B7280", letterSpacing: 0.2 }}
                  >
                    DIA
                  </th>
                  <th
                    align="right"
                    style={{ padding: 12, fontSize: 12, color: "#6B7280", letterSpacing: 0.2 }}
                  >
                    ENTRARAM
                  </th>
                  <th
                    align="right"
                    style={{ padding: 12, fontSize: 12, color: "#6B7280", letterSpacing: 0.2 }}
                  >
                    COMPRARAM
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredByDay.map((d) => (
                  <tr key={d.day} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    <td style={{ padding: 12 }}>{d.day}</td>
                    <td style={{ padding: 12 }} align="right">
                      {d.qr_open}
                    </td>
                    <td style={{ padding: 12 }} align="right">
                      {d.purchase}
                    </td>
                  </tr>
                ))}

                {filteredByDay.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: 14, color: "#6B7280" }}>
                      Nenhum dia corresponde a este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
