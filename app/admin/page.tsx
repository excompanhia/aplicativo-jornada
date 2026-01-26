"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "contato@excompanhia.com";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type PassRow = {
  id: string;
  user_id: string;
  status: string;
  duration_minutes: number;
  purchased_at: string;
  expires_at: string;
  payment_provider: string | null;
  payment_id: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const [status, setStatus] = useState<
    "checking" | "not_logged" | "not_admin" | "ok"
  >("checking");
  const [email, setEmail] = useState("");
  const [loadingPasses, setLoadingPasses] = useState(false);
  const [passes, setPasses] = useState<PassRow[]>([]);
  const [passesError, setPassesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data, error } = await supabase.auth.getUser();

      if (cancelled) return;

      if (error || !data?.user) {
        setStatus("not_logged");
        router.replace("/admin/login");
        return;
      }

      const e = (data.user.email || "").toLowerCase();
      setEmail(e);

      if (e !== ADMIN_EMAIL) {
        setStatus("not_admin");
        return;
      }

      setStatus("ok");

      // Buscar passes via API segura (server-side)
      setLoadingPasses(true);
      setPassesError(null);

      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;

      if (!token) {
        setLoadingPasses(false);
        setPassesError("Sessão sem token. Tente sair e logar novamente.");
        return;
      }

      try {
       const res = await fetch("/api/admin/passes", {
  method: "GET",
  headers: { Authorization: `Bearer ${token}` },
  cache: "no-store",
});

const ct = res.headers.get("content-type") || "";

if (!ct.includes("application/json")) {
  const text = await res.text();
  setPassesError(
    `API não retornou JSON (status ${res.status}). content-type: ${ct}. Primeiros caracteres: ${text.slice(
      0,
      120
    )}`
  );
  setPasses([]);
  return;
}

const json = await res.json();

if (!res.ok || !json?.ok) {
  setPassesError(
    `Erro da API (status ${res.status}): ${json?.error || "desconhecido"}`
  );
  setPasses([]);
} else {
  setPasses(json.passes || []);
}
      } catch (err: any) {
        setPassesError(err?.message || "Falha de rede ao carregar passes.");
        setPasses([]);
      } finally {
        if (!cancelled) setLoadingPasses(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === "checking") {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Admin</h1>
        <p style={{ opacity: 0.7 }}>Verificando login…</p>
      </main>
    );
  }

  if (status === "not_admin") {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Sem acesso</h1>
        <p style={{ marginBottom: 8 }}>
          Esta área é restrita ao administrador.
        </p>
        <p style={{ opacity: 0.7 }}>Usuário logado: {email || "(sem e-mail)"}</p>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/admin/login";
          }}
          style={{ marginTop: 16, padding: 10, cursor: "pointer" }}
        >
          Sair
        </button>
      </main>
    );
  }

  // status === "ok"
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Admin (read-only)</h1>

      <p style={{ marginBottom: 8 }}>Bem-vindo, {email}.</p>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/admin/login";
          }}
          style={{ padding: 10, cursor: "pointer" }}
        >
          Sair do Admin
        </button>

        <span style={{ opacity: 0.7 }}>
          {loadingPasses
            ? "Carregando passes…"
            : `Passes carregados: ${passes.length}`}
        </span>
      </div>

      {passesError && (
        <p style={{ marginTop: 12, color: "red" }}>{passesError}</p>
      )}

      <div style={{ marginTop: 16 }}>
        {passes.length === 0 && !loadingPasses ? (
          <p style={{ opacity: 0.7 }}>Nenhum passe encontrado.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {passes.map((p) => (
              <div
                key={p.id}
                style={{
                  border: "1px solid rgba(0,0,0,0.15)",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  {p.status.toUpperCase()} • {p.duration_minutes} min
                </div>

                <div style={{ opacity: 0.85, fontSize: 14 }}>
                  <div>
                    <strong>purchased_at:</strong> {p.purchased_at}
                  </div>
                  <div>
                    <strong>expires_at:</strong> {p.expires_at}
                  </div>
                  <div>
                    <strong>user_id:</strong> {p.user_id}
                  </div>
                  <div>
                    <strong>payment:</strong>{" "}
                    {p.payment_provider || "-"} / {p.payment_id || "-"}
                  </div>
                  <div style={{ opacity: 0.7 }}>
                    <strong>id:</strong> {p.id}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
