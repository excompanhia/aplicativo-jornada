export default function AdminPage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Admin (read-only)</h1>
      <p style={{ marginBottom: 8 }}>
        Painel interno do Jornada — leitura apenas.
      </p>
      <p style={{ opacity: 0.7 }}>
        Status: rota /admin criada. Próximo passo: restringir acesso + listar
        passes.
      </p>
    </main>
  );
}