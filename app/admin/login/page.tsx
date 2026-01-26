export default function AdminLoginPage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Login do Admin</h1>
      <p style={{ marginBottom: 8 }}>
        Este login é separado do fluxo do Journey (checkout/passe).
      </p>
      <p style={{ opacity: 0.7 }}>
        Próximo passo: colocar o OTP aqui e voltar para /admin automaticamente.
      </p>
    </main>
  );
}
