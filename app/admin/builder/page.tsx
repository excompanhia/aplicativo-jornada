"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const ADMIN_EMAIL = "contato@excompanhia.com";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminBuilderPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Controles (mock por enquanto)
  const [appTitle, setAppTitle] = useState("Jornada");
  const [tabTitle, setTabTitle] = useState("Início");
  const [buttonLabel, setButtonLabel] = useState("Começar");

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  useEffect(() => {
    (async () => {
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/admin/login");
        return;
      }

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user?.email) {
        router.replace("/admin/login");
        return;
      }

      if (userData.user.email !== ADMIN_EMAIL) {
        setError("not_admin");
        await logout();
        return;
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <p>Carregando Builder…</p>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      {/* Ocupa a tela toda:
          - ESQUERDA: controles (cresce)
          - DIREITA: preview (largura fixa do “celular”) */}
      <div
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr 430px",
          gap: 28,
          alignItems: "start",
        }}
      >
        {/* CONTROLES (ESQUERDA) */}
        <aside
          style={{
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 12,
            padding: 18,
            background: "white",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <h1 style={{ fontSize: 20, margin: 0 }}>Admin — Builder</h1>
            <button onClick={logout} style={{ padding: "8px 10px" }}>
              Sair
            </button>
          </div>

          <p style={{ marginTop: 10, marginBottom: 14, opacity: 0.8 }}>
            Controles à esquerda + preview de celular à direita.
          </p>

          {error && (
            <p style={{ marginTop: 8, color: "red" }}>
              Erro: {error}
            </p>
          )}

          <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Título do app</span>
              <input
                value={appTitle}
                onChange={(e) => setAppTitle(e.target.value)}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.2)",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Nome da aba</span>
              <input
                value={tabTitle}
                onChange={(e) => setTabTitle(e.target.value)}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.2)",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Texto do botão</span>
              <input
                value={buttonLabel}
                onChange={(e) => setButtonLabel(e.target.value)}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.2)",
                }}
              />
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              <button onClick={() => router.push("/admin")} style={{ padding: "10px 12px" }}>
                Ir para Mailing (dados)
              </button>

              <button onClick={() => window.open("/journey", "_blank")} style={{ padding: "10px 12px" }}>
                Abrir Journey (nova aba)
              </button>
            </div>

            <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
              Obs.: depois a gente vai trocar esse “mock” por um preview real (ou por telas reais do app).
            </div>
          </div>
        </aside>

        {/* PREVIEW (DIREITA) */}
        <section
          style={{
            display: "flex",
            justifyContent: "flex-end",
            paddingRight: 8,
          }}
        >
          {/* Moldura do celular */}
          <div
            style={{
              width: 390,
              borderRadius: 28,
              padding: 14,
              border: "1px solid rgba(0,0,0,0.25)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
              background: "rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                borderRadius: 18,
                overflow: "hidden",
                border: "1px solid rgba(0,0,0,0.12)",
                background: "white",
                minHeight: 720,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ padding: 14, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{appTitle || "—"}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Preview de celular</div>
              </div>

              <div style={{ padding: 16, flex: 1, display: "grid", gap: 12 }}>
                <div style={{ fontSize: 14, opacity: 0.8 }}>
                  Aba atual: <strong>{tabTitle || "—"}</strong>
                </div>

                <div
                  style={{
                    height: 220,
                    borderRadius: 14,
                    border: "1px dashed rgba(0,0,0,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: 0.8,
                  }}
                >
                  Área de conteúdo (mock)
                </div>

                <button
                  style={{
                    padding: "14px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.25)",
                    background: "white",
                    fontWeight: 600,
                  }}
                >
                  {buttonLabel || "—"}
                </button>
              </div>

              <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)", padding: 12, display: "flex", gap: 8 }}>
                <div style={{ padding: "8px 10px", borderRadius: 999, background: "rgba(0,0,0,0.06)" }}>
                  {tabTitle || "—"}
                </div>
                <div style={{ padding: "8px 10px", borderRadius: 999, opacity: 0.55 }}>
                  Outra aba
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Ajuste simples para telas menores (mobile):
          se ficar estreito demais, empilha em coluna. */}
      <style jsx>{`
        @media (max-width: 980px) {
          div[style*="grid-template-columns: 1fr 430px"] {
            grid-template-columns: 1fr !important;
          }
          section {
            justify-content: center !important;
            padding-right: 0 !important;
          }
        }
      `}</style>
    </main>
  );
}
