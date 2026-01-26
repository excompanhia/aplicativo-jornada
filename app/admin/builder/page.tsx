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

  // Controles (por enquanto só “mock” pra provar o builder)
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

      // 1) precisa ter sessão
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/admin/login");
        return;
      }

      // 2) validar admin por e-mail (client-side)
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user?.email) {
        router.replace("/admin/login");
        return;
      }

      if (userData.user.email !== ADMIN_EMAIL) {
        setError("not_admin");
        // expulsa do admin por segurança
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
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      {/* Layout desktop: esquerda controles / direita preview.
          Layout mobile: vira coluna (normal). */}
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(320px, 420px) 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* CONTROLES (ESQUERDA) */}
        <aside
          style={{
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 12,
            padding: 16,
            background: "white",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <h1 style={{ fontSize: 18, margin: 0 }}>Admin — Builder</h1>
            <button onClick={logout} style={{ padding: "8px 10px" }}>
              Sair
            </button>
          </div>

          <p style={{ marginTop: 10, marginBottom: 14, opacity: 0.8 }}>
            Aqui é o modo “construção do app”: controles + preview de celular.
          </p>

          {error && (
            <p style={{ marginTop: 8, color: "red" }}>
              Erro: {error}
            </p>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Título do app</span>
              <input
                value={appTitle}
                onChange={(e) => setAppTitle(e.target.value)}
                style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Nome da aba</span>
              <input
                value={tabTitle}
                onChange={(e) => setTabTitle(e.target.value)}
                style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Texto do botão</span>
              <input
                value={buttonLabel}
                onChange={(e) => setButtonLabel(e.target.value)}
                style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)" }}
              />
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              <button
                onClick={() => router.push("/admin")}
                style={{ padding: "10px 12px" }}
              >
                Ir para Mailing (dados)
              </button>

              <button
                onClick={() => window.open("/journey", "_blank")}
                style={{ padding: "10px 12px" }}
              >
                Abrir Journey (nova aba)
              </button>
            </div>
          </div>
        </aside>

        {/* PREVIEW (DIREITA) */}
        <section
          style={{
            display: "flex",
            justifyContent: "center",
            padding: 8,
          }}
        >
          {/* “Moldura” do celular */}
          <div
            style={{
              width: 390,
              maxWidth: "100%",
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
              {/* Top bar fake */}
              <div style={{ padding: 14, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{appTitle || "—"}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Preview de celular</div>
              </div>

              {/* Conteúdo fake */}
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

              {/* Bottom tab fake */}
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

      {/* Mobile: se a tela ficar estreita, o grid naturalmente quebra visualmente,
          mas se quiser, depois a gente coloca uma regra mais explícita. */}
    </main>
  );
}