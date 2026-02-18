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

// ✅ Deadline fixado para 23:59:59 Brasil
function calculateStartDeadlineBrasil(baseIso: string, windowDays: number) {
  const base = new Date(baseIso);

  // Converte para timezone Brasil (America/Sao_Paulo)
  const brasil = new Date(
    base.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );

  // Soma windowDays
  brasil.setDate(brasil.getDate() + windowDays);

  // Define para 23:59:59 do dia final
  brasil.setHours(23, 59, 59, 0);

  return new Date(
    brasil.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  ).toISOString();
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

    if (payment.status !== "approved") {
      return NextResponse.json({ ok: true, status: payment.status });
    }

    const metadata = payment.metadata || {};
    const userId = metadata.user_id;

    // metadata.seconds (segundos) -> duration_minutes
    const durationMinutes = Number(metadata.seconds) / 60;

    const experienceId = String(metadata.experience_id || "").trim();

    // ✅ CORREÇÃO CRÍTICA: padrão agora é "new" (Compra ≠ Início)
    const lifecycleMode = String(metadata.lifecycle_mode || "new").trim();

    if (!userId || !durationMinutes || !Number.isFinite(durationMinutes) || !experienceId) {
      return NextResponse.json(
        { ok: false, error: "metadata incomplete" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    // legacy = compra já inicia (mantido só por compatibilidade)
    const expiresAt =
      lifecycleMode === "legacy"
        ? addSeconds(nowIso, durationMinutes * 60)
        : null;

    // new = compra não inicia, tem janela de 30 dias para iniciar
    const startDeadline =
      lifecycleMode === "new"
        ? calculateStartDeadlineBrasil(nowIso, 30)
        : null;

    // ✅ Se for legacy (início imediato), encerra qualquer journey_active anterior dessa experiência.
    // (Não usamos mais "expired": agora só status válidos da constraint.)
    if (lifecycleMode === "legacy") {
      const { error: endErr } = await supabase
        .from("passes")
        .update({
          status: "ended_by_time",
          expires_at: nowIso,
        })
        .eq("user_id", userId)
        .eq("experience_id", experienceId)
        .eq("status", "journey_active");

      if (endErr) {
        return NextResponse.json({ ok: false, error: endErr.message }, { status: 500 });
      }
    }

    // ✅ Insere o passe no lifecycle correto
    const insertPayload: any = {
      user_id: userId,
      status: lifecycleMode === "legacy" ? "journey_active" : "purchased_not_started",
      duration_minutes: durationMinutes,
      purchased_at: nowIso,
      expires_at: expiresAt,
      start_deadline: startDeadline,
      payment_provider: "mercadopago",
      payment_id: String(paymentId),
      experience_id: experienceId,
    };

    // legacy: início imediato (mantém coerência com status)
    if (lifecycleMode === "legacy") {
      insertPayload.started_at = nowIso;
    }

    const { error: insErr } = await supabase.from("passes").insert(insertPayload);
    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }

    const { error: evErr } = await supabase.from("analytics_events").insert({
      event_type: "purchase",
      experience_id: experienceId,
      user_id: userId,
      payment_id: String(paymentId),
      source: "mercadopago_webhook",
      created_at: nowIso,
    });

    if (evErr) {
      return NextResponse.json({ ok: false, error: evErr.message }, { status: 500 });
    }

    const email =
      payment.payer?.email ||
      String(metadata.user_email || "").trim() ||
      "unknown";

    const { data: existing, error: exErr } = await supabase
      .from("mailing_contacts")
      .select("id,purchases_count")
      .eq("email", email)
      .maybeSingle();

    if (exErr) {
      return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });
    }

    if (existing?.id) {
      const { error: upMailErr } = await supabase
        .from("mailing_contacts")
        .update({
          purchases_count: (existing.purchases_count || 0) + 1,
          last_purchase_at: nowIso,
        })
        .eq("id", existing.id);

      if (upMailErr) {
        return NextResponse.json({ ok: false, error: upMailErr.message }, { status: 500 });
      }
    } else {
      const { error: insMailErr } = await supabase.from("mailing_contacts").insert({
        email,
        user_id: userId,
        first_purchase_at: nowIso,
        last_purchase_at: nowIso,
        purchases_count: 1,
        source: "mercadopago_webhook",
      });

      if (insMailErr) {
        return NextResponse.json({ ok: false, error: insMailErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, lifecycle_mode: lifecycleMode });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
