import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

const ADMIN_EMAIL = "contato@excompanhia.com";

function getSupabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    // 1) Validar admin via token do usuário (Authorization: Bearer <access_token>)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "missing bearer token" },
        { status: 401 }
      );
    }

    const supabaseAnon = getSupabaseAnon();
    const { data: userData, error: userErr } = await supabaseAnon.auth.getUser(token);

    if (userErr || !userData?.user) {
      return NextResponse.json(
        { ok: false, error: "invalid session" },
        { status: 401 }
      );
    }

    const email = (userData.user.email || "").toLowerCase();
    if (email !== ADMIN_EMAIL) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    // 2) Buscar passes com service role (read-only + pequenas normalizações)
    const supabaseAdmin = getSupabaseAdmin();

    // ✅ (opcional, mas útil no Admin): auto-expirar purchased_not_started que passaram do start_deadline
    // Isso evita que o Admin mostre "comprado aguardando iniciar" quando já venceu.
    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from("passes")
      .update({ status: "expired_without_start" })
      .eq("status", "purchased_not_started")
      .not("start_deadline", "is", null)
      .lt("start_deadline", nowIso);

    // ✅ Novo select: inclui campos do lifecycle + experience_id para auditoria/métricas
    const { data: passes, error: passesErr } = await supabaseAdmin
      .from("passes")
      .select(
        "id,user_id,status,duration_minutes,purchased_at,start_deadline,started_at,expires_at,payment_provider,payment_id,experience_id"
      )
      .order("purchased_at", { ascending: false })
      .limit(200);

    if (passesErr) {
      return NextResponse.json({ ok: false, error: passesErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, passes });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "unknown error" },
      { status: 500 }
    );
  }
}
