import Link from "next/link";

export default function StationPage() {
  return (
    <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <h1 style={{ margin: 0 }}>Station</h1>

      <div style={{ opacity: 0.75, lineHeight: 1.4 }}>
        Esta rota é um rascunho.
        <br />
        A Jornada real está em <b>/journey</b>.
      </div>

      <Link
        href="/journey"
        style={{
          height: 52,
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.15)",
          fontSize: 16,
          background: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
          color: "black",
        }}
      >
        Ir para a Jornada
      </Link>
    </main>
  );
}