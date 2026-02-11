import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;

    if (!token) {
      return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });
    }

    // ✅ NOVO: a experiência atual (slug) vem por query ?exp=
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
