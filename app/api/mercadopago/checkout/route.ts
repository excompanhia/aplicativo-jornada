import { NextResponse } from "next/server";

/**
 * Endpoint do servidor para criar o checkout do Mercado Pago
 * Recebe:
 *  - plan: "1h" | "2h" | "day"
 *  - experience_id: string
 *  - renewal?: boolean
 *  - lifecycle_mode?: "legacy" | "new"   ✅ NOVO (controle do novo lifecycle)
 *  - Authorization: Bearer <access_token do Supabase>
 */

type Plan = "1h" | "2h" | "day";
type LifecycleMode = "legacy" | "new";

// Detecta ambiente na Vercel de forma confiável
function getVercelEnv(): "production" | "preview" | "development" | "unknown" {
  const v = (process.env.VERCEL_ENV || "").toLowerCase();
  if (v === "production" || v === "preview" || v === "development") return v;
  return "unknown";
}

function isProductionEnv() {
  return getVercelEnv() === "production";
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function planToItem(plan: Plan) {
  const prod = isProductionEnv();

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

async function fetchUser(
  supabaseUrl: string,
  supabaseAnonKey: string,
  token: string
) {
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
    const body = await req.json().catch(() => ({}));

    const plan = body?.plan as Plan | undefined;
    const renewal = Boolean(body?.renewal);
    const experienceId = String(body?.experience_id || "").trim();

    // ✅ NOVO: modo de lifecycle controlado explicitamente (padrão: legacy)
    const lifecycleModeRaw = String(body?.lifecycle_mode || "legacy").trim();
    const lifecycleMode: LifecycleMode =
      lifecycleModeRaw === "new" ? "new" : "legacy";

    if (!plan || !["1h", "2h", "day"].includes(plan)) {
      return NextResponse.json(
        { error: "Plano inválido. Use: 1h, 2h ou day." },
        { status: 400 }
      );
    }

    if (!experienceId) {
      return NextResponse.json(
        { error: "experience_id ausente no checkout." },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : "";

    if (!token) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase não configurado." },
        { status: 500 }
      );
    }

    const { userRes, user } = await fetchUser(
      supabaseUrl,
      supabaseAnonKey,
      token
    );

    if (!userRes.ok || !user?.id) {
      return NextResponse.json(
        { error: "Login inválido." },
        { status: 401 }
      );
    }

    if (renewal) {
      const { res: passRes, pass } = await fetchLatestActivePass(
        supabaseUrl,
        supabaseAnonKey,
        token,
        user.id
      );

      if (!passRes.ok || !pass?.expires_at) {
        return NextResponse.json(
          { error: "Renovação indisponível." },
          { status: 400 }
        );
      }

      const remainingMs =
        new Date(pass.expires_at).getTime() - Date.now();

      if (!(remainingMs > 0 && remainingMs <= 5 * 60 * 1000)) {
        return NextResponse.json(
          { error: "Renovação fora da janela permitida." },
          { status: 400 }
        );
      }
    }

    const mpAccessToken = process.env.MP_ACCESS_TOKEN;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!mpAccessToken || !siteUrl) {
      return NextResponse.json(
        { error: "Configuração Mercado Pago incompleta." },
        { status: 500 }
      );
    }

    const item = planToItem(plan);

    const discountFactor = 0.5;
    const unitPrice = renewal
      ? round2(item.price * discountFactor)
      : item.price;

    const title = renewal
      ? `${item.title} — Renovação (-50%)`
      : item.title;

    const preferencePayload = {
      items: [
        {
          title,
          quantity: 1,
          unit_price: unitPrice,
          currency_id: "BRL",
        },
      ],

      notification_url: `${siteUrl}/api/webhook/mercadopago`,

      back_urls: {
        success: `${siteUrl}/payment/success`,
        pending: `${siteUrl}/payment/pending`,
        failure: `${siteUrl}/payment/failure`,
      },

      auto_return: "approved",

      metadata: {
        user_id: user.id,
        user_email: user.email,
        plan,
        seconds: item.seconds,
        experience_id: experienceId, // ✅ CRÍTICO
        lifecycle_mode: lifecycleMode, // ✅ NOVO (legacy por padrão)
        vercel_env: getVercelEnv(),
        is_renewal: renewal,
        discount_factor: renewal ? discountFactor : 0,
      },

      external_reference: `jornada:${experienceId}:${user.id}:${renewal ? "renewal" : "buy"}:${plan}:${Date.now()}`,
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

    const prod = isProductionEnv();
    const checkoutUrl = prod
      ? mpJson?.init_point
      : mpJson?.sandbox_init_point ?? mpJson?.init_point;

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: "URL de checkout ausente." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      checkoutUrl,
      preferenceId: mpJson?.id,
      lifecycle_mode: lifecycleMode,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Erro inesperado.", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
