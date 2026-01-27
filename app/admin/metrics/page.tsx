"use client";

import { useEffect, useState } from "react";
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

export default function AdminMetricsPage() {
  const [exp, setExp] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [loading, setLoading] = useState(false);
  const [exportingMetrics, setExportingMetrics] = useState(false);
  const [exportingMailing, setExportingMailing] = useState(false);

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

  async function exportMetricsCsv() {
    setError(null);
    setExportingMetrics(true);
    try {
      const supabase = getSupabaseClient();
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Sessão inválida.");

      const params = buildParams();
      await downloadCsv(`/api/admin/metrics/export?${params.toString()}`, token, "metrics.csv");
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
      if (!token) throw new Error("Sessão inválida.");

      const params = buildParams();
      await downloadCsv(`/api/admin/mailing/export?${params.toString()}`, token, "mailing.csv");
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setExportingMailing(false);
    }
  }

  // atalhos de data
  function applyRange(f: string, t: string) {
    setFrom(f);
    setTo(t);
    // chama load no próximo tick para usar os novos estados
    setTimeout(load, 0);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Admin · Métricas</h1>

      {/* Filtros */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
          alignItems: "center",
        }}
      >
        <input
          placeholder="experience_id"
          value={exp}
          onChange={(e) => setExp(e.target.value)}
          style={{ padding: "8px 10px" }}
        />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />

        <button onClick={load} disabled={loading}>
          {loading ? "Carregando…" : "Aplicar filtros"}
        </button>

        <button onClick={exportMetricsCsv} disabled={exportingMetrics}>
          {exportingMetrics ? "Exportando…" : "Exportar CSV (métricas)"}
        </button>

        <button onClick={exportMailingCsv} disabled={exportingMailing}>
          {exportingMailing ? "Exportando…" : "Exportar CSV (mailing)"}
        </button>
      </div>

      {/* Atalhos de data */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={() => applyRange(todayISO(), todayISO())}>Hoje</button>
        <button onClick={() => applyRange(daysAgoISO(6), todayISO())}>Últimos 7 dias</button>
        <button onClick={() => applyRange(daysAgoISO(29), todayISO())}>Últimos 30 dias</button>
        <button onClick={() => applyRange(startOfMonthISO(), todayISO())}>Este mês</button>
        <button onClick={() => applyRange(startOfYearISO(), todayISO())}>Este ano</button>
      </div>

      {error && (
        <div style={{ color: "crimson", marginBottom: 16 }}>
          <b>Erro:</b> {error}
        </div>
      )}

      {data && (
        <>
          {/* Totais — SEMPRE refletem o período selecionado */}
          <div style={{ display: "flex", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
            <div>
              <b>Entraram</b>
              <div>{data.totals.qr_open}</div>
            </div>
            <div>
              <b>Compraram</b>
              <div>{data.totals.purchase}</div>
            </div>
            <div>
              <b>Conversão</b>
              <div>{data.totals.conversion_percent ?? 0}%</div>
            </div>
          </div>

          {/* Tabela por dia */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Dia</th>
                <th align="right">Entraram</th>
                <th align="right">Compraram</th>
              </tr>
            </thead>
            <tbody>
              {data.byDay.map((d) => (
                <tr key={d.day}>
                  <td>{d.day}</td>
                  <td align="right">{d.qr_open}</td>
                  <td align="right">{d.purchase}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
