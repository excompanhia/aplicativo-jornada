import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 1) Apresentação curta */}
      <div
        style={{
          borderRadius: 16,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.15)",
        }}
      >
        <h1 style={{ fontSize: 22, margin: 0, lineHeight: 1.2 }}>
          Jornada
        </h1>
        <p style={{ margin: "10px 0 0 0", lineHeight: 1.4 }}>
          Uma experiência por estações: imagens em movimento, texto e áudio.
          Você pode experimentar grátis e, se quiser, comprar um passe de acesso temporário.
        </p>
      </div>

      {/* 2) Experiência grátis (por enquanto, um player “exemplo”) */}
      <div
        style={{
          borderRadius: 16,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.15)",
        }}
      >
        <h2 style={{ fontSize: 16, margin: 0 }}>Experimente (grátis)</h2>
        <p style={{ margin: "8px 0 12px 0", lineHeight: 1.4 }}>
          Um trecho curto para você sentir o ritmo da experiência.
        </p>

        {/* Player temporário (depois a gente liga no seu áudio real) */}
        <audio controls style={{ width: "100%" }}>
          <source src="/sample.mp3" type="audio/mpeg" />
          Seu navegador não conseguiu tocar o áudio.
        </audio>

        <p style={{ margin: "10px 0 0 0", fontSize: 12, opacity: 0.75, lineHeight: 1.3 }}>
          (Por enquanto este áudio é um “arquivo exemplo”. Depois vamos trocar pelo seu.)
        </p>
      </div>

      {/* 3) Planos pagos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Escolha seu passe</h2>

        <PlanButton href="/login?plano=1h" title="1 hora" subtitle="Acesso por 60 minutos" />
        <PlanButton href="/login?plano=2h" title="2 horas" subtitle="Acesso por 120 minutos" />
        <PlanButton href="/login?plano=day" title="Dia todo" subtitle="Acesso por 24 horas" />
      </div>

      {/* Login opcional (pequeno) */}
      <div style={{ marginTop: 4, textAlign: "center" }}>
        <Link href="/login" style={{ fontSize: 13, textDecoration: "none" }}>
          Já tenho conta / entrar
        </Link>
      </div>
    </main>
  );
}

function PlanButton({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      style={{
        height: 64,
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,0.15)",
        background: "white",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 16px",
        textDecoration: "none",
        color: "black",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 13, opacity: 0.75 }}>{subtitle}</div>
    </Link>
  );
}
