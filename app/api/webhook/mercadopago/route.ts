import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

function addSeconds(baseIso: string, seconds: number) {
  const base = new Date(baseIso).getTime();
  return new Date(base + seconds * 1000).toISOString();
}

export async function POST(req: Request) {
  try {
    const mpAccessToken = process.env.MP_ACCESS_TOKEN;
    if (!mpAccessToken) {
      return NextResponse.json(
        { ok: false, error: "MP_ACCESS_TOKEN missing" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const paymentId = body?.data?.id;
    if (!paymentId) {
      return NextResponse.json(
        { ok: false, error: "payment id missing" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: "failed to fetch payment" },
        { status: 500 }
      );
    }

    const payment = await res.json();

    if (payment.status !== "approved") {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const metadata = payment.metadata || {};
    const userId = metadata.user_id;
    const durationMinutes = Number(metadata.duration_minutes);
    const isRenewal: boolean = Boolean(metadata.is_renewal);

    if (!userId || !durationMinutes) {
      return NextResponse.json(
        { ok: false, error: "metadata incomplete" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    // ✅ NOVO: atualizar mailing_contacts quando uma compra é aprovada
    // (vale para compra normal e renovação)
    try {
      // 1) Buscar email do usuário no Auth (admin)
      const { data: userData, error: userErr } =
        await supabase.auth.admin.getUserById(String(userId));

      const email = userData?.user?.email ?? null;

      // 2) Ler estado atual no mailing (se existir)
      const { data: existing, error: existingErr } = await supabase
        .from("mailing_contacts")
        .select(
          "user_id, email, first_login_at, first_purchase_at, last_purchase_at, purchases_count"
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (existingErr) {
        console.error("mailing_contacts read failed:", existingErr.message);
      } else {
        if (!existing) {
          // ✅ CORREÇÃO AQUI: parênteses para não misturar ?? com || sem agrupar
          const emailToSave =
            (email ?? String(metadata.email ?? "").trim()) || "unknown";

          // Se nunca registrou login, criamos mesmo assim (não perdemos histórico)
          await supabase.from("mailing_contacts").insert({
            user_id: userId,
            email: emailToSave,
            first_login_at: nowIso, // fallback se não houver login registrado
            first_purchase_at: nowIso,
            last_purchase_at: nowIso,
            purchases_count: 1,
            source: "mercadopago_webhook",
            created_at: nowIso,
          });
        } else {
          const nextCount = (existing.purchases_count ?? 0) + 1;

          await supabase
            .from("mailing_contacts")
            .update({
              email: email ?? existing.email,
              purchases_count: nextCount,
              first_purchase_at: existing.first_purchase_at ?? nowIso,
              last_purchase_at: nowIso,
              source: "mercadopago_webhook",
            })
            .eq("user_id", userId);
        }
      }

      if (userErr) {
        console.error("auth admin getUserById failed:", userErr.message);
      }
    } catch (e: any) {
      console.error("mailing_contacts update unexpected error:", e?.message ?? e);
    }

    // --- lógica atual de passes (mantida) ---
    if (isRenewal) {
      const { data: activePass } = await supabase
        .from("passes")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activePass) {
        return NextResponse.json(
          { ok: false, error: "no active pass to renew" },
          { status: 400 }
        );
      }

      const baseIso =
        new Date(activePass.expires_at).getTime() > Date.now()
          ? activePass.expires_at
          : new Date().toISOString();

      const newExpiresAt = addSeconds(baseIso, durationMinutes * 60);

      await supabase
        .from("passes")
        .update({ expires_at: newExpiresAt })
        .eq("id", activePass.id);

      return NextResponse.json({ ok: true, renewed: true });
    }

    await supabase
      .from("passes")
      .update({ status: "expired" })
      .eq("user_id", userId)
      .eq("status", "active");

    const purchasedAt = new Date().toISOString();
    const expiresAt = addSeconds(purchasedAt, durationMinutes * 60);

    await supabase.from("passes").insert({
      user_id: userId,
      status: "active",
      duration_minutes: durationMinutes,
      purchased_at: purchasedAt,
      expires_at: expiresAt,
      payment_provider: "mercadopago",
      payment_id: String(paymentId),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
