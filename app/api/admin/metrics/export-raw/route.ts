import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

const ADMIN_EMAIL = "contato@excompanhia.com";

function csvEscape(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  const needsQuotes = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;

    if (!token) {
      return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // 1) validar sessão
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401 });
    }

    // 2) validar admin por e-mail
    if (userData.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ ok: false, error: "not_admin" }, { status: 403 });
    }

    // 3) filtros
    const url = new URL(req.url);
    const exp = (url.searchParams.get("exp") || "").trim();
    const from = (url.searchParams.get("from") || "").trim();
    const to = (url.searchParams.get("to") || "").trim();

    let q = supabase
      .from("analytics_events")
      .select(
        "occurred_at,event_type,experience_id,qr_point_id,user_id,anon_id"
      )
      .order("occurred_at", { ascending: false });

    if (exp) q = q.eq("experience_id", exp);
    if (from) q = q.gte("occurred_at", `${from}T00:00:00Z`);
    if (to) q = q.lte("occurred_at", `${to}T23:59:59Z`);

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = Array.isArray(data) ? data : [];

    // 4) CSV linha a linha
    const header = [
      "occurred_at",
      "event_type",
      "experience_id",
      "qr_point_id",
      "user_id",
      "anon_id",
    ];

    const lines: string[] = [];
    lines.push(header.join(","));

    for (const r of rows as any[]) {
      lines.push(
        [
          csvEscape(r.occurred_at),
          csvEscape(r.event_type),
          csvEscape(r.experience_id ?? ""),
          csvEscape(r.qr_point_id ?? ""),
          csvEscape(r.user_id ?? ""),
          csvEscape(r.anon_id ?? ""),
        ].join(",")
      );
    }

    const csv = lines.join("\n");

    const filenameParts = [
      "events_raw",
      exp ? `exp-${exp}` : null,
      from ? `from-${from}` : null,
      to ? `to-${to}` : null,
    ].filter(Boolean);

    const filename = `${filenameParts.join("_")}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "unexpected_error" },
      { status: 500 }
    );
  }
}
