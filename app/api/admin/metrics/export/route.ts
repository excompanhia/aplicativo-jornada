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

    // 3) ler filtros da URL (mesmos do /api/admin/metrics)
    const url = new URL(req.url);

    const exp = (url.searchParams.get("exp") || "").trim();
    const qr = (url.searchParams.get("qr") || "").trim();
    const from = (url.searchParams.get("from") || "").trim(); // YYYY-MM-DD
    const to = (url.searchParams.get("to") || "").trim(); // YYYY-MM-DD

    // 4) buscar eventos (iguais ao metrics)
    let q = supabase
      .from("analytics_events")
      .select("event_type,experience_id,qr_point_id,occurred_at,user_id,anon_id")
      .in("event_type", ["qr_open", "purchase", "otp_login"])
      .order("occurred_at", { ascending: false });

    if (exp) q = q.eq("experience_id", exp);
    if (qr) q = q.eq("qr_point_id", qr);

    if (from) q = q.gte("occurred_at", `${from}T00:00:00Z`);
    if (to) q = q.lte("occurred_at", `${to}T23:59:59Z`);

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = Array.isArray(data) ? data : [];

    // 5) agrupar por dia (UTC) -> chave YYYY-MM-DD (igual ao metrics)
    const byDayMap: Record<
      string,
      { day: string; qr_open: number; purchase: number; otp_login: number }
    > = {};

    let totalQrOpen = 0;
    let totalPurchase = 0;
    let totalOtpLogin = 0;

    for (const r of rows as any[]) {
      const ts = r.occurred_at ? new Date(r.occurred_at) : null;
      const day = ts ? ts.toISOString().slice(0, 10) : "unknown";

      if (!byDayMap[day]) byDayMap[day] = { day, qr_open: 0, purchase: 0, otp_login: 0 };

      if (r.event_type === "qr_open") {
        byDayMap[day].qr_open += 1;
        totalQrOpen += 1;
      } else if (r.event_type === "purchase") {
        byDayMap[day].purchase += 1;
        totalPurchase += 1;
      } else if (r.event_type === "otp_login") {
        byDayMap[day].otp_login += 1;
        totalOtpLogin += 1;
      }
    }

    // mesma ordenação do endpoint (desc)
    const byDay = Object.values(byDayMap).sort((a, b) => (a.day < b.day ? 1 : -1));

    const conversion =
      totalQrOpen > 0 ? Math.round((totalPurchase / totalQrOpen) * 1000) / 10 : 0;

    // 6) montar CSV
    const header = [
      "day",
      "qr_open",
      "purchase",
      "otp_login",
      "conversion_percent",
      "filter_exp",
      "filter_qr",
      "filter_from",
      "filter_to",
    ];

    const lines: string[] = [];
    lines.push(header.join(","));

    for (const d of byDay) {
      lines.push(
        [
          csvEscape(d.day),
          csvEscape(d.qr_open),
          csvEscape(d.purchase),
          csvEscape(d.otp_login),
          csvEscape(conversion),
          csvEscape(exp || ""),
          csvEscape(qr || ""),
          csvEscape(from || ""),
          csvEscape(to || ""),
        ].join(",")
      );
    }

    // se não tiver linhas (nenhum evento), ainda devolve cabeçalho
    const csv = lines.join("\n");

    const filenameParts = [
      "metrics",
      exp ? `exp-${exp}` : null,
      qr ? `qr-${qr}` : null,
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
