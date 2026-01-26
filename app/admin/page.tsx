"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

type MailingContact = {
  user_id: string;
  email: string;
  first_login_at: string | null;
  first_purchase_at: string | null;
  last_purchase_at: string | null;
  purchases_count: number | null;
  source: string | null;
  created_at: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type FilterMode = "all" | "bought" | "not_bought";

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<MailingContact[]>([]);
  const [filter, setFilter] = useState<FilterMode>("all");

  async function logout() {
    setError(null);
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  async function loadMailing() {
    setError(null);
    setLoadingList(true);

    try {
      const { data: sessionData, error: sessionErr } =
        await supabase.auth.getSession();

      if (sessionErr) {
        setError(sessionErr.message);
        router.replace("/admin/login");
        return;
      }

      const token = sessionData.session?.access_token;
      if (!token) {
        router.replace("/admin/login");
        return;
      }

      const res = await fetch("/api/admin/mailing", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "failed_to_load");
        // se a sessão ficou inválida por algum motivo, manda pro login
        if (json?.error === "invalid_session" || json?.error === "missing_token") {
          router.replace("/admin/login");
        }
        return;
      }

      setData(Array.isArray(json.data) ? json.data : []);
    } catch (e: any) {
      setError(e?.message ?? "unexpected_error");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    // gate simples: se não tiver sessão, manda pro login
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/admin/login");
        return;
      }
      setLoading(false);
      loadMailing();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return data;
    if (filter === "bought") return data.filter((c) => (c.purchases_count ?? 0) > 0);
    return data.filter((c) => (c.purchases_count ?? 0) === 0);
  }, [data, filter]);

  if (loading) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <p>Carregando Admin…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 6 }}>Admin — Mailing</h1>
          <p style={{ margin: 0, opacity: 0.8 }}>
            Lista read-only (via <code>/api/admin/mailing</code>)
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={loadMailing} disabled={loadingList} style={{ padding: "10px 12px" }}>
            {loadingList ? "Atualizando…" : "Atualizar"}
          </button>
          <button onClick={logout} style={{ padding: "10px 12px" }}>
            Sair
          </button>
        </div>
      </header>

      <section style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ opacity: 0.8 }}>Filtro:</span>

        <button
          onClick={() => setFilter("all")}
          style={{ padding: "8px 10px", fontWeight: filter === "all" ? 700 : 400 }}
        >
          Todos ({data.length})
        </button>

        <button
          onClick={() => setFilter("bought")}
          style={{ padding: "8px 10px", fontWeight: filter === "bought" ? 700 : 400 }}
        >
          Comprou ({data.filter((c) => (c.purchases_count ?? 0) > 0).length})
        </button>

        <button
          onClick={() => setFilter("not_bought")}
          style={{ padding: "8px 10px", fontWeight: filter === "not_bought" ? 700 : 400 }}
        >
          Não comprou ({data.filter((c) => (c.purchases_count ?? 0) === 0).length})
        </button>
      </section>

      {error && (
        <p style={{ marginTop: 12, color: "red" }}>
          Erro: {error}
        </p>
      )}

      <section style={{ marginTop: 16 }}>
        <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr>
                {[
                  "email",
                  "purchases_count",
                  "first_login_at",
                  "first_purchase_at",
                  "last_purchase_at",
                  "source",
                  "created_at",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: 10,
                      borderBottom: "1px solid rgba(0,0,0,0.12)",
                      background: "rgba(0,0,0,0.03)",
                      fontSize: 12,
                      letterSpacing: 0.2,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filtered.map((c) => (
                <tr key={c.user_id}>
                  <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>{c.email}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                    {c.purchases_count ?? 0}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                    {c.first_login_at ?? "-"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                    {c.first_purchase_at ?? "-"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                    {c.last_purchase_at ?? "-"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                    {c.source ?? "-"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                    {c.created_at ?? "-"}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 14, opacity: 0.8 }}>
                    Nenhum contato para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
