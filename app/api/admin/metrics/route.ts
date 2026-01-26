import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

const ADMIN_EMAIL = "contato@excompanhia.com";

/**
 * GET /api/admin/metrics
 *
 * Query params:
 * - exp (optional): filtra por experience_id
 * - qr (optional): filtra por qr_point_id
 * - from (optional): ISO date (ex: 2026-01-01)
 * - to (optional): ISO date (ex: 2026-01-31)
 *
 * Retorna:
 * - totals: totais no período
 * - byDay: lista agrupada por dia (UTC) com qr_open e otp_login
 */
export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ")
      ? auth.slice("Bearer ".length)
      : null;

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

    // 3) ler filtros da URL
    const url = new URL(req.url);

    const exp = (url.searchParams.get("exp") || "").trim();
    const qr = (url.searchParams.get("qr") || "").trim();
    const from = (url.searchParams.get("from") || "").trim();
    const to = (url.searchParams.get("to") || "").trim();

    // 4) buscar eventos (apenas os tipos que importam aqui)
    // OBS: Vamos agrupar no Node (simples e robusto).
    let q = supabase
      .from("analytics_events")
      .select("event_type,experience_id,qr_point_id,occurred_at,user_id,anon_id")
      .in("event_type", ["qr_open", "otp_login"])
      .order("occurred_at", { ascending: false });

    if (exp) q = q.eq("experience_id", exp);
    if (qr) q = q.eq("qr_point_id", qr);

    // filtro de período (opcional)
    // usamos occurred_at (timestamp com timezone)
    if (from) q = q.gte("occurred_at", `${from}T00:00:00Z`);
    if (to) q = q.lte("occurred_at", `${to}T23:59:59Z`);

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = Array.isArray(data) ? data : [];

    // 5) agrupar por dia (UTC)
    // chave: YYYY-MM-DD
    const byDayMap: Record<
      string,
      { day: string; qr_open: number; otp_login: number }
    > = {};

    let totalQrOpen = 0;
    let totalOtpLogin = 0;

    for (const r of rows as any[]) {
      const ts = r.occurred_at ? new Date(r.occurred_at) : null;
      const day = ts ? ts.toISOString().slice(0, 10) : "unknown";

      if (!byDayMap[day]) byDayMap[day] = { day, qr_open: 0, otp_login: 0 };

      if (r.event_type === "qr_open") {
        byDayMap[day].qr_open += 1;
        totalQrOpen += 1;
      } else if (r.event_type === "otp_login") {
        byDayMap[day].otp_login += 1;
        totalOtpLogin += 1;
      }
    }

    const byDay = Object.values(byDayMap).sort((a, b) => (a.day < b.day ? 1 : -1));

    return NextResponse.json({
      ok: true,
      filters: { exp: exp || null, qr: qr || null, from: from || null, to: to || null },
      totals: {
        qr_open: totalQrOpen,
        otp_login: totalOtpLogin,
      },
      byDay,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "unexpected_error" },
      { status: 500 }
    );
  }
}
