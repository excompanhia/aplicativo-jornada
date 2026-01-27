export default function AdminPwaPage() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Layout PWA</h1>
        <p style={{ marginTop: 6, color: "#6B7280" }}>
          Base do futuro “Wix”: controles à esquerda e preview do app (em frame
          de celular) à direita. (Por enquanto, é estrutura.)
        </p>
      </header>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Controles */}
        <div
          style={{
            width: 380,
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: 14,
            background: "#fff",
          }}
        >
          <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>
            CONTROLES
          </div>

          <div style={{ height: 10 }} />

          <div
            style={{
              border: "1px solid #E5E7EB",
              borderRadius: 10,
              padding: 12,
              background: "#F9FAFB",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Próximo passo obrigatório (futuro)
            </div>
            <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.45 }}>
              Definir o formato dos dados:
              <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18 }}>
                <li>A) Tabelas no Supabase (mais “Wix real”)</li>
                <li>B) Arquivos estáticos (mais simples)</li>
              </ul>
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={{ fontSize: 12, color: "#6B7280" }}>
            (Tudo aqui ainda é placeholder.)
          </div>
        </div>

        {/* Preview */}
        <div
          style={{
            flex: 1,
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: 14,
            background: "#fff",
            minHeight: 560,
          }}
        >
          <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>
            PREVIEW (FRAME DE CELULAR)
          </div>

          <div style={{ height: 12 }} />

          {/* Área central com “celular” */}
          <div
            style={{
              minHeight: 500,
              display: "grid",
              placeItems: "center",
              background: "#F9FAFB",
              border: "1px dashed #D1D5DB",
              borderRadius: 12,
              padding: 18,
            }}
          >
            {/* Frame do celular */}
            <div
              style={{
                width: 360, // largura típica mobile
                maxWidth: "90vw",
                height: 740, // altura típica mobile
                maxHeight: "70vh",
                borderRadius: 32,
                border: "1px solid #E5E7EB",
                background: "#fff",
                boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* “Notch” / topo */}
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 120,
                  height: 24,
                  borderRadius: 16,
                  background: "#111827",
                  opacity: 0.85,
                }}
              />

              {/* Conteúdo do app (placeholder) */}
              <div
                style={{
                  height: "100%",
                  padding: "54px 16px 16px",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
                  Preview do PWA (em breve)
                </div>
                <div style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.5 }}>
                  Aqui vai aparecer o app real, no formato mobile-first.
                  <br />
                  <br />
                  Quando iniciarmos o “Admin Wix”, os controles à esquerda vão
                  editar a experiência selecionada e este preview vai refletir
                  essas mudanças.
                </div>

                <div style={{ height: 14 }} />

                {/* Blocos fake de UI */}
                <div
                  style={{
                    border: "1px solid #E5E7EB",
                    borderRadius: 14,
                    padding: 12,
                    background: "#F9FAFB",
                    marginTop: 12,
                  }}
                >
                  <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>
                    CARD (exemplo)
                  </div>
                  <div style={{ marginTop: 6, fontSize: 14 }}>
                    Conteúdo da experiência…
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid #E5E7EB",
                    borderRadius: 14,
                    padding: 12,
                    background: "#F9FAFB",
                    marginTop: 10,
                  }}
                >
                  <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>
                    ESTAÇÃO (exemplo)
                  </div>
                  <div style={{ marginTop: 6, fontSize: 14 }}>
                    Texto / áudio / imagem…
                  </div>
                </div>
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div style={{ fontSize: 12, color: "#6B7280" }}>
              (Frame ilustrativo — ainda não é o app real.)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
