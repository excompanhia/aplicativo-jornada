import { NextResponse } from "next/server";

/**
 * Endpoint do servidor para criar o checkout do Mercado Pago
 * Recebe:
 *  - plan: "1h" | "2h" | "day"
 *  - renewal?: boolean  (true = renovação com desconto, só permitido faltando <= 5 min)
 *  - Authorization: Bearer <access_token do Supabase>
 */

type Plan = "1h" | "2h" | "day";

// Detecta ambiente na Vercel de forma confiável
function getVercelEnv(): "production" | "preview" | "development" | "unknown" {
  const v = (process.env.VERCEL_ENV || "").toLowerCase();
  if (v === "production" || v === "preview" || v === "development") return v;
  return "unknown";
}

function isProductionEnv() {
  // Em localhost, VERCEL_ENV normalmente não existe → cai em "unknown"
  // Então "production" é só quando VERCEL_ENV === "production"
  return getVercelEnv() === "production";
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function planToItem(plan: Plan) {
  const prod = isProductionEnv();

  // ⚠️ Hoje está tudo por R$ 1 para testes (inclusive em produção).
  // Quando você quiser voltar aos preços reais, basta trocar os valores de price aqui:
  // 1h 14.90 | 2h 19.90 | day 29.90
  if (plan === "1h") {
    return {
      title: prod ? "Jornada — Passe 1 hora" : "Jornada — Passe 1 hora (teste)",
      price: 1.0,
      seconds: 60 * 60,
    };
  }
  if (plan === "2h") {
    return {
      title: prod ? "Jornada — Passe 2 horas" : "Jornada — Passe 2 horas (teste)",
      price: 1.0,
      seconds: 2 * 60 * 60,
    };
  }
  return {
    title: prod ? "Jornada — Passe 24 horas" : "Jornada — Passe 24 horas (teste)",
    price: 1.0,
    seconds: 24 * 60 * 60,
  };
}

async function fetchUser(supabaseUrl: string, supabaseAnonKey: string, token: string) {
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
  });

  const user = await userRes.json().catch(() => null);
  return { userRes, user };
}

async function fetchLatestActivePass(
  supabaseUrl: string,
  supabaseAnonKey: string,
  token: string,
  userId: string
) {
  // Usa o REST do Supabase (PostgREST), com o token do usuário.
  // Isso respeita RLS. Como sua página /payment/pending consegue ler passes,
  // isso deve funcionar.
  const nowIso = new Date().toISOString();
  const url =
    `${supabaseUrl}/rest/v1/passes` +
    `?select=id,status,expires_at` +
    `&user_id=eq.${encodeURIComponent(userId)}` +
    `&status=eq.active` +
    `&expires_at=gt.${encodeURIComponent(nowIso)}` +
    `&order=expires_at.desc` +
    `&limit=1`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
      Accept: "application/json",
    },
  });

  const data = await res.json().catch(() => null);
  const pass = Array.isArray(data) && data.length > 0 ? data[0] : null;
  return { res, pass };
}

export async function POST(req: Request) {
  try {
    // 1) Lê o plano enviado pelo frontend
    const body = await req.json().catch(() => ({}));
    const plan = body?.plan as Plan | undefined;
    const renewal = Boolean(body?.renewal);

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
    const { userRes, user } = await fetchUser(supabaseUrl, supabaseAnonKey, token);

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

    // 4.1) Se for renovação, valida no SERVIDOR que faltam <= 5 minutos
    if (renewal) {
      const { res: passRes, pass } = await fetchLatestActivePass(
        supabaseUrl,
        supabaseAnonKey,
        token,
        user.id
      );

      if (!passRes.ok) {
        return NextResponse.json(
          {
            error: "Não consegui verificar seu passe para renovação.",
            supabase_status: passRes.status,
          },
          { status: 400 }
        );
      }

      if (!pass?.expires_at) {
        return NextResponse.json(
          {
            error:
              "Renovação indisponível: não encontrei passe ativo válido agora.",
          },
          { status: 400 }
        );
      }

      const expiresAtMs = new Date(pass.expires_at).getTime();
      const nowMs = Date.now();
      const remainingMs = expiresAtMs - nowMs;

      // Deve estar ativo e dentro da janela de 5 minutos (0 < restante <= 5min)
      const fiveMinMs = 5 * 60 * 1000;
      if (!(remainingMs > 0 && remainingMs <= fiveMinMs)) {
        return NextResponse.json(
          {
            error:
              "Renovação indisponível: só é permitida quando faltam 5 minutos ou menos.",
            remaining_seconds: Math.floor(remainingMs / 1000),
          },
          { status: 400 }
        );
      }
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

    // 6.1) Aplica desconto na renovação (50%)
    // Obs: hoje o preço está 1.0 em todos os ambientes.
    // Quando você voltar preços reais, a renovação vai automaticamente para metade.
    const discountFactor = 0.5;
    const unitPrice = renewal ? round2(item.price * discountFactor) : item.price;

    const title = renewal
      ? `${item.title} — Renovação (-50%)`
      : item.title;

    // 7) Cria a preferência no Mercado Pago
    const preferencePayload = {
      items: [
        {
          title,
          quantity: 1,
          unit_price: unitPrice,
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
        vercel_env: getVercelEnv(),

        // ✅ NOVO
        is_renewal: renewal,
        discount_factor: renewal ? discountFactor : 0,
      },

      external_reference: `jornada:${user.id}:${renewal ? "renewal" : "buy"}:${plan}:${Date.now()}`,
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferencePayload),
    });

    const mpJson = await mpRes.json().catch(() => null);

    if (!mpRes.ok) {
      return NextResponse.json(
        { error: "Mercado Pago recusou o checkout.", details: mpJson },
        { status: 400 }
      );
    }

    // ✅ REGRA CORRETA:
    // - Production -> init_point (real)
    // - Preview/Development -> sandbox_init_point (se existir), senão init_point
    const prod = isProductionEnv();
    const checkoutUrl = prod
      ? (mpJson?.init_point as string | undefined)
      : (mpJson?.sandbox_init_point as string | undefined) ??
        (mpJson?.init_point as string | undefined);

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: "Mercado Pago não retornou uma URL de checkout.", details: mpJson },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      checkoutUrl,
      preferenceId: mpJson?.id,
      vercelEnv: getVercelEnv(),
      chosen: prod ? "init_point" : "sandbox_init_point_or_init_point",
      hasSandboxUrl: Boolean(mpJson?.sandbox_init_point),

      // ✅ NOVO (debug amigável)
      renewal,
      unitPrice,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Erro inesperado.", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
