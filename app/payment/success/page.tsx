"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaymentSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // A ideia é: mesmo que o Mercado Pago volte aqui,
    // a gente manda o usuário para a tela que realmente importa:
    // /payment/pending (que faz polling até liberar o Journey)
    const t = setTimeout(() => {
      router.replace("/payment/pending");
    }, 600);

    return () => clearTimeout(t);
  }, [router]);

  return (
    <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
      <h1 style={{ margin: 0 }}>Pagamento recebido ✅</h1>
      <p style={{ margin: 0, opacity: 0.85 }}>
        Estamos confirmando seu acesso agora. Você será redirecionado automaticamente…
      </p>
      <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>
        Se não redirecionar, volte para a aba do app e aguarde na tela “Aguardando confirmação…”.
      </p>
    </main>
  );
}
