import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;

    if (!token) {
      return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });
    }

    const url = new URL(req.url);
    const exp = (url.searchParams.get("exp") || "").trim();

    if (!exp) {
      return NextResponse.json({ ok: false, error: "missing_exp" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401 });
    }

    const uid = userData.user.id;

    const { data: activeData, error: activeErr } = await supabase
      .from("passes")
      .select("id,user_id,status,experience_id,expires_at,last_station_reached")
      .eq("user_id", uid)
      .eq("experience_id", exp)
      .eq("status", "journey_active")
      .order("expires_at", { ascending: false })
      .limit(1);

    if (activeErr) {
      return NextResponse.json({ ok: false, error: activeErr.message }, { status: 500 });
    }

    const activePass =
      Array.isArray(activeData) && activeData.length > 0 ? activeData[0] : null;

    if (!activePass?.id) {
      return NextResponse.json({ ok: false, error: "no_active_pass" }, { status: 404 });
    }

    if (activePass.last_station_reached === true) {
      return NextResponse.json({ ok: true, already_marked: true, pass: activePass });
    }

    const { data: updated, error: updErr } = await supabase
      .from("passes")
      .update({ last_station_reached: true })
      .eq("id", activePass.id)
      .select("id,user_id,status,experience_id,expires_at,last_station_reached")
      .maybeSingle();

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, pass: updated || null });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}