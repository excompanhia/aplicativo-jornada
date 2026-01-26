import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

type EventType = "qr_open" | "otp_login" | "purchase";

function isValidEventType(v: any): v is EventType {
  return v === "qr_open" || v === "otp_login" || v === "purchase";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const experience_id = body?.experience_id;
    const event_type = body?.event_type;
    const user_id = body?.user_id ?? null;
    const anon_id = body?.anon_id ?? null;
    const occurred_at = body?.occurred_at ?? null; // opcional
    const qr_point_id = body?.qr_point_id ?? null; // NOVO (opcional)

    if (typeof experience_id !== "string" || experience_id.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "missing_experience_id" },
        { status: 400 }
      );
    }

    if (!isValidEventType(event_type)) {
      return NextResponse.json(
        { ok: false, error: "invalid_event_type" },
        { status: 400 }
      );
    }

    // valida qr_point_id (se vier)
    if (qr_point_id !== null && typeof qr_point_id !== "string") {
      return NextResponse.json(
        { ok: false, error: "invalid_qr_point_id" },
        { status: 400 }
      );
    }

    // regras mínimas por tipo (pra evitar lixo)
    if (event_type === "qr_open") {
      // para qr_open, user_id é normalmente null (a pessoa ainda não logou)
      if (anon_id !== null && typeof anon_id !== "string") {
        return NextResponse.json(
          { ok: false, error: "invalid_anon_id" },
          { status: 400 }
        );
      }
    }

    if (event_type === "otp_login" || event_type === "purchase") {
      // nesses casos, user_id deve existir
      if (typeof user_id !== "string" || user_id.trim().length === 0) {
        return NextResponse.json(
          { ok: false, error: "missing_user_id" },
          { status: 400 }
        );
      }
    }

    // se occurred_at vier, precisa ser data válida
    let occurredAtToInsert: string | null = null;
    if (occurred_at != null) {
      const d = new Date(occurred_at);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { ok: false, error: "invalid_occurred_at" },
          { status: 400 }
        );
      }
      occurredAtToInsert = d.toISOString();
    }

    const supabase = getSupabaseAdmin();

    const insertPayload: any = {
      experience_id: experience_id.trim(),
      event_type,
      user_id: user_id ? user_id : null,
      anon_id: anon_id ? anon_id : null,
      qr_point_id: qr_point_id ? String(qr_point_id).trim() : null,
    };

    if (occurredAtToInsert) insertPayload.occurred_at = occurredAtToInsert;

    const { error } = await supabase.from("analytics_events").insert(insertPayload);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "unexpected_error" },
      { status: 500 }
    );
  }
}
