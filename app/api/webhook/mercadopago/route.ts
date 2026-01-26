import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

      const newExpiresAt = addSeconds(
        baseIso,
        durationMinutes * 60
      );

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
    const expiresAt = addSeconds(
      purchasedAt,
      durationMinutes * 60
    );

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
