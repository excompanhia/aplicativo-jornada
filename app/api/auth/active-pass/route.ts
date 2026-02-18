import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;

    if (!token) {
      return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });
    }

    // ✅ experiência atual por query ?exp=
    const url = new URL(req.url);
    const exp = (url.searchParams.get("exp") || "").trim();

    if (!exp) {
      return NextResponse.json({ ok: false, error: "missing_exp" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1) valida token e pega usuário
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401 });
    }

    const uid = userData.user.id;

    // ✅ D2.3: auto-expirar purchased_not_started se passou do start_deadline
    const { data: pendingCheck, error: pendingCheckErr } = await supabase
      .from("passes")
      .select("id,start_deadline,status")
      .eq("user_id", uid)
      .eq("experience_id", exp)
      .eq("status", "purchased_not_started")
      .order("purchased_at", { ascending: false })
      .limit(1);

    if (!pendingCheckErr) {
      const pending =
        Array.isArray(pendingCheck) && pendingCheck.length > 0 ? pendingCheck[0] : null;

      if (pending?.id && pending?.start_deadline) {
        const deadlineMs = new Date(pending.start_deadline).getTime();
        const nowMs = Date.now();
        if (Number.isFinite(deadlineMs) && nowMs > deadlineMs) {
          await supabase
            .from("passes")
            .update({ status: "expired_without_start" })
            .eq("id", pending.id);
        }
      }
    }

    // ✅ 2) pega passe "ativo" para esta experiência (compatível: active OU journey_active)
    const { data: activeData, error: activeErr } = await supabase
      .from("passes")
      .select(
        "id,user_id,status,duration_minutes,purchased_at,start_deadline,started_at,expires_at,payment_provider,payment_id,experience_id"
      )
      .eq("user_id", uid)
      .eq("experience_id", exp)
      .in("status", ["active", "journey_active"])
      .order("expires_at", { ascending: false })
      .limit(1);

    if (activeErr) {
      return NextResponse.json({ ok: false, error: activeErr.message }, { status: 500 });
    }

    const activePass =
      Array.isArray(activeData) && activeData.length > 0 ? activeData[0] : null;

    if (activePass) {
      return NextResponse.json({ ok: true, pass: activePass });
    }

    // 3) se não tem ativo, devolve PURCHASED_NOT_STARTED (tela pré-Audiowalk)
    const { data: pendingData, error: pendingErr } = await supabase
      .from("passes")
      .select(
        "id,user_id,status,duration_minutes,purchased_at,start_deadline,started_at,expires_at,payment_provider,payment_id,experience_id"
      )
      .eq("user_id", uid)
      .eq("experience_id", exp)
      .eq("status", "purchased_not_started")
      .order("purchased_at", { ascending: false })
      .limit(1);

    if (pendingErr) {
      return NextResponse.json({ ok: false, error: pendingErr.message }, { status: 500 });
    }

    const pendingPass =
      Array.isArray(pendingData) && pendingData.length > 0 ? pendingData[0] : null;

    return NextResponse.json({ ok: true, pass: pendingPass || null });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}
