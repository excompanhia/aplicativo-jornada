export default function AdminPwaPage() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Layout PWA</h1>
        <p style={{ marginTop: 6, color: "#6B7280" }}>
          Base do futuro “Wix”: controles à esquerda e preview à direita.
          (Por enquanto, é estrutura.)
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
        </div>

        {/* Preview */}
        <div
          style={{
            flex: 1,
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: 14,
            background: "#fff",
            minHeight: 520,
          }}
        >
          <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>
            PREVIEW
          </div>

          <div style={{ height: 10 }} />

          <div
            style={{
              border: "1px dashed #D1D5DB",
              borderRadius: 12,
              background: "#F9FAFB",
              minHeight: 460,
              display: "grid",
              placeItems: "center",
              padding: 18,
            }}
          >
            <div style={{ textAlign: "center", maxWidth: 520 }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
                Preview do PWA (em breve)
              </div>
              <div style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.5 }}>
                Aqui vai aparecer o app em frame de celular quando iniciarmos o
                “Admin Wix”.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
