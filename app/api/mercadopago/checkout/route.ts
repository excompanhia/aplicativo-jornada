import { NextResponse } from "next/server";

/**
 * Endpoint do servidor para criar o checkout do Mercado Pago
 * Recebe:
 *  - plan: "1h" | "2h" | "day"
 *  - Authorization: Bearer <access_token do Supabase>
 */

type Plan = "1h" | "2h" | "day";

function planToItem(plan: Plan) {
  if (plan === "1h") {
    return { title: "Jornada — Passe 1 hora (teste)", price: 0.01, seconds: 60 * 60 };
  }
  if (plan === "2h") {
    return { title: "Jornada — Passe 2 horas (teste)", price: 0.01, seconds: 2 * 60 * 60 };
  }
  return { title: "Jornada — Passe 24 horas (teste)", price: 0.01, seconds: 24 * 60 * 60 };
}

export async function POST(req: Request) {
  try {
    // 1) Lê o plano enviado pelo frontend
    const body = await req.json().catch(() => ({}));
    const plan = body?.plan as Plan | undefined;

    if (!plan || !["1h", "2h", "day"].includes(plan)) {
      return NextResponse.json(
        { error: "Plano inválido. Use: 1h, 2h ou day." },
        { status: 400 }
      );
    }

    // 2) Lê o token do usuário (Supabase) do header Authorization
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : "";

    if (!token) {
      return NextResponse.json(
        { error: "Usuário não autenticado. Faça login novamente." },
        { status: 401 }
      );
    }

    // 3) Variáveis do Supabase (também precisam existir no servidor)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase não configurado no servidor." },
        { status: 500 }
      );
    }

    // 4) Confirma o usuário chamando o Supabase diretamente
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
    });

    const user = await userRes.json().catch(() => null);

    if (!userRes.ok || !user?.id) {
      return NextResponse.json(
        {
          error: "Não consegui confirmar seu login. Faça login novamente.",
          supabase_status: userRes.status,
          supabase_response: user,
        },
        { status: 401 }
      );
    }

    // 5) Variáveis do Mercado Pago
    const mpAccessToken = process.env.MP_ACCESS_TOKEN;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!mpAccessToken) {
      return NextResponse.json(
        { error: "MP_ACCESS_TOKEN não configurado." },
        { status: 500 }
      );
    }

    if (!siteUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SITE_URL não configurado." },
        { status: 500 }
      );
    }

    // 6) Monta o item
    const item = planToItem(plan);

    // 7) Cria a preferência no Mercado Pago
    const preferencePayload = {
  items: [
    {
      title: item.title,
      quantity: 1,
      unit_price: item.price,
      currency_id: "BRL",
    },
  ],

  // 1) Webhook (server-to-server)
  notification_url: `${siteUrl}/api/webhook/mercadopago`,

  // 2) Para onde o Mercado Pago manda o usuário voltar
  back_urls: {
    success: `${siteUrl}/payment/success`,
    pending: `${siteUrl}/payment/pending`,
    failure: `${siteUrl}/payment/failure`,
  },

  // 3) Tenta redirecionar automaticamente quando for aprovado (cartão costuma voltar)
  auto_return: "approved",

  // 4) Dados que a gente usa no webhook para criar o passe
  metadata: {
    user_id: user.id,
    user_email: user.email,
    plan,
    seconds: item.seconds,
  },

  external_reference: `jornada:${user.id}:${plan}:${Date.now()}`,
};

    const mpRes = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferencePayload),
      }
    );

    const mpJson = await mpRes.json().catch(() => null);

    if (!mpRes.ok) {
      return NextResponse.json(
        { error: "Mercado Pago recusou o checkout.", details: mpJson },
        { status: 400 }
      );
    }

    const checkoutUrl = mpJson?.sandbox_init_point ?? mpJson?.init_point;

return NextResponse.json({
  ok: true,
  checkoutUrl,
  preferenceId: mpJson?.id,
  hasSandboxUrl: Boolean(mpJson?.sandbox_init_point),
});

  } catch (err: any) {
    return NextResponse.json(
      { error: "Erro inesperado.", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
