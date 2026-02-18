import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;

    if (!token) {
      return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });
    }

    // exp pode vir por query (?exp=) — padrão do projeto
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

    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    // 2) Regra: um Audiowalk ativo por vez (qualquer experiência)
    const { data: anyActive, error: anyActiveErr } = await supabase
      .from("passes")
      .select("id,experience_id,expires_at,status")
      .eq("user_id", uid)
      .eq("status", "journey_active")
      .order("expires_at", { ascending: false })
      .limit(1);

    if (anyActiveErr) {
      return NextResponse.json({ ok: false, error: anyActiveErr.message }, { status: 500 });
    }

    const activeRow =
      Array.isArray(anyActive) && anyActive.length > 0 ? anyActive[0] : null;

    if (activeRow?.expires_at) {
      const activeExpMs = new Date(activeRow.expires_at).getTime();
      if (Number.isFinite(activeExpMs) && activeExpMs > nowMs) {
        return NextResponse.json(
          {
            ok: false,
            error: "already_active",
            active: activeRow,
          },
          { status: 409 }
        );
      }
    }

    // 3) pegar compra mais recente "purchased_not_started" PARA ESTA EXPERIÊNCIA
    const { data: pending, error: pendingErr } = await supabase
      .from("passes")
      .select(
        "id,user_id,status,duration_minutes,purchased_at,start_deadline,started_at,expires_at,experience_id"
      )
      .eq("user_id", uid)
      .eq("experience_id", exp)
      .eq("status", "purchased_not_started")
      .order("purchased_at", { ascending: false })
      .limit(1);

    if (pendingErr) {
      return NextResponse.json({ ok: false, error: pendingErr.message }, { status: 500 });
    }

    const row = Array.isArray(pending) && pending.length > 0 ? pending[0] : null;

    if (!row) {
      return NextResponse.json({ ok: false, error: "no_purchase_to_start" }, { status: 404 });
    }

    // 4) validar janela para iniciar
    if (!row.start_deadline) {
      // Falta start_deadline em compra new = dado inconsistente
      return NextResponse.json({ ok: false, error: "missing_start_deadline" }, { status: 500 });
    }

    const deadlineMs = new Date(row.start_deadline).getTime();
    if (!Number.isFinite(deadlineMs)) {
      return NextResponse.json({ ok: false, error: "invalid_start_deadline" }, { status: 500 });
    }

    if (nowMs > deadlineMs) {
      // passou do prazo => expira sem iniciar
      await supabase
        .from("passes")
        .update({ status: "expired_without_start" })
        .eq("id", row.id);

      return NextResponse.json({ ok: false, error: "start_window_expired" }, { status: 410 });
    }

    // 5) iniciar de fato: status journey_active + started_at + expires_at (agora + duration)
    const durationMinutes = Number(row.duration_minutes);
    if (!durationMinutes || durationMinutes <= 0) {
      return NextResponse.json({ ok: false, error: "invalid_duration_minutes" }, { status: 500 });
    }

    const expiresAtIso = new Date(nowMs + durationMinutes * 60 * 1000).toISOString();

    const { data: updated, error: updErr } = await supabase
      .from("passes")
      .update({
        status: "journey_active",
        started_at: nowIso,
        expires_at: expiresAtIso,
      })
      .eq("id", row.id)
      .select(
        "id,user_id,status,duration_minutes,purchased_at,start_deadline,started_at,expires_at,payment_provider,payment_id,experience_id"
      )
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
