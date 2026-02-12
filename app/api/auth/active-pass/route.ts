import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;

    if (!token) {
      return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });
    }

    // ✅ a experiência atual (slug) vem por query ?exp=
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

    // ✅ D2.3: validação automática da janela para iniciar
    // Se existir purchased_not_started e now > start_deadline => virar expired_without_start
    const { data: pendingData, error: pendingErr } = await supabase
      .from("passes")
      .select("id,start_deadline,status")
      .eq("user_id", uid)
      .eq("experience_id", exp)
      .eq("status", "purchased_not_started")
      .order("purchased_at", { ascending: false })
      .limit(1);

    if (!pendingErr) {
      const pending = Array.isArray(pendingData) && pendingData.length > 0 ? pendingData[0] : null;

      if (pending?.id && pending?.start_deadline) {
        const deadlineMs = new Date(pending.start_deadline).getTime();
        const nowMs = Date.now();

        if (Number.isFinite(deadlineMs) && nowMs > deadlineMs) {
          await supabase
            .from("passes")
            .update({
              status: "expired_without_start",
            })
            .eq("id", pending.id);
        }
      }
    }

    // 2) pega passe ativo mais recente PARA ESTA EXPERIÊNCIA (exp = slug)
    const { data, error } = await supabase
      .from("passes")
      .select(
        "id,user_id,status,duration_minutes,purchased_at,expires_at,payment_provider,payment_id,experience_id"
      )
      .eq("user_id", uid)
      .eq("experience_id", exp)
      .eq("status", "active")
      .order("expires_at", { ascending: false })
      .limit(1);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const pass = Array.isArray(data) && data.length > 0 ? data[0] : null;

    return NextResponse.json({ ok: true, pass });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}
