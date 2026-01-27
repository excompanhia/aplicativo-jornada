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

    // 3) filtros (por enquanto: from/to aplicados sobre created_at)
    // OBS: a tabela mailing_contacts não tem experience_id hoje (pelo seu resumo),
    // então o filtro "exp" ainda não faz sentido aqui. (Podemos evoluir depois.)
    const url = new URL(req.url);
    const from = (url.searchParams.get("from") || "").trim(); // YYYY-MM-DD
    const to = (url.searchParams.get("to") || "").trim(); // YYYY-MM-DD

    let q = supabase
      .from("mailing_contacts")
      .select(
        "user_id,email,first_login_at,first_purchase_at,last_purchase_at,purchases_count,source,created_at"
      )
      .order("created_at", { ascending: false });

    if (from) q = q.gte("created_at", `${from}T00:00:00Z`);
    if (to) q = q.lte("created_at", `${to}T23:59:59Z`);

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = Array.isArray(data) ? data : [];

    // 4) CSV
    const header = [
      "email",
      "purchases_count",
      "first_login_at",
      "first_purchase_at",
      "last_purchase_at",
      "source",
      "created_at",
    ];

    const lines: string[] = [];
    lines.push(header.join(","));

    for (const r of rows as any[]) {
      lines.push(
        [
          csvEscape(r.email),
          csvEscape(r.purchases_count ?? 0),
          csvEscape(r.first_login_at ?? ""),
          csvEscape(r.first_purchase_at ?? ""),
          csvEscape(r.last_purchase_at ?? ""),
          csvEscape(r.source ?? ""),
          csvEscape(r.created_at ?? ""),
        ].join(",")
      );
    }

    const csv = lines.join("\n");

    const filenameParts = ["mailing", from ? `from-${from}` : null, to ? `to-${to}` : null].filter(
      Boolean
    );
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
