import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

function getSupabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "missing_bearer_token" },
        { status: 401 }
      );
    }

    // 1) Descobre o usuário (user_id + email) a partir do token
    const supabaseAnon = getSupabaseAnon();
    const { data, error } = await supabaseAnon.auth.getUser(token);

    if (error || !data?.user) {
      return NextResponse.json(
        { ok: false, error: "invalid_token" },
        { status: 401 }
      );
    }

    const user = data.user;
    const userId = user.id;
    const email = user.email;

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "user_missing_email" },
        { status: 400 }
      );
    }

    // 2) Upsert no mailing_contacts (server-side com service role)
    // Regra: first_login_at só é “primeira vez”, então preservamos se já existir.
    const admin = getSupabaseAdmin();

    const nowIso = new Date().toISOString();

    // Faz upsert e mantém first_login_at existente se já houver
    // Estratégia: tentamos inserir; se já existir, não queremos sobrescrever first_login_at.
    // Então fazemos:
    // - update apenas de email/source quando já existe
    // - insert completo quando não existe
    const { data: existing, error: existingErr } = await admin
      .from("mailing_contacts")
      .select("user_id, first_login_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json(
        { ok: false, error: "db_read_failed", detail: existingErr.message },
        { status: 500 }
      );
    }

    if (!existing) {
      const { error: insErr } = await admin.from("mailing_contacts").insert({
        user_id: userId,
        email,
        first_login_at: nowIso,
        first_purchase_at: null,
        last_purchase_at: null,
        purchases_count: 0,
        source: "otp_login",
        created_at: nowIso,
      });

      if (insErr) {
        return NextResponse.json(
          { ok: false, error: "db_insert_failed", detail: insErr.message },
          { status: 500 }
        );
      }
    } else {
      const { error: updErr } = await admin
        .from("mailing_contacts")
        .update({
          email,
          source: "otp_login",
        })
        .eq("user_id", userId);

      if (updErr) {
        return NextResponse.json(
          { ok: false, error: "db_update_failed", detail: updErr.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "unexpected_error", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
