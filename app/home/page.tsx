"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ExperienceItem = {
  slug: string;
  title: string | null;
};

function getLastExp(): string {
  try {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("jornada:last_exp") || "";
  } catch {
    return "";
  }
}

export default function HomePublic() {
  const [lastExp, setLastExp] = useState<string>("");
  const [showList, setShowList] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [items, setItems] = useState<ExperienceItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLastExp(getLastExp());
  }, []);

  async function loadExperiences() {
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/experiences", { cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setItems([]);
        setError(
          "Não consegui carregar a lista de experiências agora. (Isso deve ser resolvido quando a tabela 'experiences' e o status 'published' estiverem alinhados.)"
        );
        return;
      }

      const list = Array.isArray(json.items) ? json.items : [];
      // ordem alfabética também no client, por segurança
      list.sort((a: any, b: any) => String(a.slug).localeCompare(String(b.slug)));

      setItems(
        list.map((x: any) => ({
          slug: String(x.slug),
          title: x?.title ? String(x.title) : null,
        }))
      );
    } catch (e: any) {
      setItems([]);
      setError("Falha de rede ao carregar experiências: " + String(e?.message || e));
    } finally {
      setIsLoading(false);
    }
  }

  const hasLast = useMemo(() => Boolean(lastExp && lastExp.trim().length > 0), [lastExp]);

  return (
    <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* B) Logo no topo */}
      <div
        style={{
          borderRadius: 18,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          background: "white",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {/* Troque o src quando seu logo estiver pronto */}
        <img
          src="/logo.png"
          alt="Jornada"
          style={{
            width: 120,
            height: 120,
            objectFit: "contain",
            borderRadius: 18,
            border: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(0,0,0,0.02)",
          }}
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            el.style.display = "none";
          }}
        />

        <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.15 }}>Jornada</h1>

        {/* C) Texto descritivo */}
        <p style={{ margin: 0, lineHeight: 1.45, opacity: 0.92 }}>
          Passeios sonoros por estações: áudio, imagens e texto. Acesse uma experiência
          pelo link/QR e, quando quiser, continue de onde parou.
        </p>
      </div>

      {/* D) Continuar último audiowalk (só se existir) */}
      {hasLast ? (
        <div
          style={{
            borderRadius: 18,
            padding: 16,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 15 }}>Continuar último audiowalk</h2>
            <span style={{ fontSize: 12, opacity: 0.7 }}>histórico do dispositivo</span>
          </div>

          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>
            Última experiência: <b>{lastExp}</b>
          </div>

          <Link
            href={`/journey/${encodeURIComponent(lastExp)}`}
            style={{
              height: 48,
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              color: "black",
            }}
          >
            ENTRAR
          </Link>
        </div>
      ) : null}

      {/* E) Lista de experiências publicadas (mínimo) */}
      <div
        style={{
          borderRadius: 18,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          background: "white",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15 }}>Experiências</h2>

          <button
            onClick={async () => {
              const next = !showList;
              setShowList(next);

              if (next && items.length === 0 && !isLoading) {
                await loadExperiences();
              }
            }}
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {showList ? "Fechar lista" : "Ver experiências"}
          </button>
        </div>

        {showList ? (
          <>
            {isLoading ? (
              <p style={{ margin: 0, opacity: 0.8 }}>Carregando…</p>
            ) : items.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {items.map((x) => (
                  <Link
                    key={x.slug}
                    href={`/journey/${encodeURIComponent(x.slug)}`}
                    style={{
                      borderRadius: 14,
                      border: "1px solid rgba(0,0,0,0.12)",
                      padding: "12px 12px",
                      textDecoration: "none",
                      color: "black",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>
                      {x.title || x.slug}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.2 }}>
                      {x.slug}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, lineHeight: 1.4, opacity: 0.85 }}>
                Nenhuma experiência publicada apareceu ainda.
                <br />
                (Quando o Admin “Wix” publicar um novo audiowalk, ele entra automaticamente aqui.)
              </div>
            )}

            {error ? (
              <div style={{ color: "crimson", fontSize: 13, lineHeight: 1.35 }}>
                <b>Erro:</b> {error}
              </div>
            ) : null}

            <button
              onClick={loadExperiences}
              style={{
                height: 38,
                padding: "0 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                fontSize: 13,
                cursor: "pointer",
                alignSelf: "flex-start",
              }}
            >
              Atualizar lista
            </button>
          </>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.35 }}>
            Toque em <b>“Ver experiências”</b> para abrir a lista.
          </div>
        )}
      </div>

      {/* F) Redes sociais e contato */}
      <div
        style={{
          borderRadius: 18,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          background: "white",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 15 }}>Contato e redes</h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href="#"
            style={{
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              padding: "10px 12px",
              textDecoration: "none",
              color: "black",
              fontSize: 13,
            }}
          >
            Instagram
          </a>
          <a
            href="#"
            style={{
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              padding: "10px 12px",
              textDecoration: "none",
              color: "black",
              fontSize: 13,
            }}
          >
            Site
          </a>
          <a
            href="mailto:contato@excompanhia.com"
            style={{
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              padding: "10px 12px",
              textDecoration: "none",
              color: "black",
              fontSize: 13,
            }}
          >
            contato@excompanhia.com
          </a>
        </div>

        <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.35 }}>
          (Aqui entra também o “rodapé” com logos pequenos, quando você quiser.)
        </div>
      </div>
    </main>
  );
}
