import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
}

function addSeconds(baseIso: string, seconds: number) {
  const base = new Date(baseIso).getTime();
  return new Date(base + seconds * 1000).toISOString();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }

    const paymentId = body?.data?.id;
    if (!paymentId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const mpAccessToken = process.env.MP_ACCESS_TOKEN;
    if (!mpAccessToken) {
      return NextResponse.json(
        { ok: false, error: "MP_ACCESS_TOKEN missing" },
        { status: 500 }
      );
    }

    // 1) Buscar detalhes do pagamento no Mercado Pago
    const paymentRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
        },
      }
    );

    const payment = await paymentRes.json().catch(() => null);
    if (!paymentRes.ok || !payment) {
      return NextResponse.json({ ok: false, error: "Payment not found" }, { status: 400 });
    }

    // Só processa pagamentos aprovados
    if (payment.status !== "approved") {
      return NextResponse.json({ ok: true, status: payment.status });
    }

    const metadata = payment.metadata || {};

    const userId = metadata.user_id;

    // metadata.seconds vem como "segundos"
    const durationMinutes = Number(metadata.seconds) / 60;

    // ✅ este é o vínculo do passe com a experiência (hoje: slug = experiência publicada)
    const experienceId = String(metadata.experience_id || "").trim();

    if (!userId || !durationMinutes || !experienceId) {
      return NextResponse.json(
        { ok: false, error: "metadata incomplete" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const nowIso = new Date().toISOString();
    const expiresAt = addSeconds(nowIso, durationMinutes * 60);

    // 2) Expira passes ativos anteriores SOMENTE desta experiência (1 passe ativo por experiência)
    await supabase
      .from("passes")
      .update({ status: "expired" })
      .eq("user_id", userId)
      .eq("experience_id", experienceId)
      .eq("status", "active");

    // 3) Cria novo passe
    await supabase.from("passes").insert({
      user_id: userId,
      status: "active",
      duration_minutes: durationMinutes,
      purchased_at: nowIso,
      expires_at: expiresAt,
      payment_provider: "mercadopago",
      payment_id: String(paymentId),

      // ✅ grava a experiência do passe
      experience_id: experienceId,
    });

    // 4) 🔥 REGISTRA EVENTO DE COMPRA (ANALYTICS)
    await supabase.from("analytics_events").insert({
      event_type: "purchase",
      experience_id: experienceId,
      user_id: userId,
      payment_id: String(paymentId),
      source: "mercadopago_webhook",
      created_at: nowIso,
    });

    // 5) Atualiza mailing (se existir)
    const email =
      payment.payer?.email ||
      String(metadata.user_email || "").trim() ||
      "unknown";

    const { data: existing } = await supabase
      .from("mailing_contacts")
      .select("id,purchases_count")
      .eq("email", email)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("mailing_contacts")
        .update({
          purchases_count: (existing.purchases_count || 0) + 1,
          last_purchase_at: nowIso,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("mailing_contacts").insert({
        email,
        user_id: userId,
        first_purchase_at: nowIso,
        last_purchase_at: nowIso,
        purchases_count: 1,
        source: "mercadopago_webhook",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
