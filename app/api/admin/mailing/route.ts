import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

const ADMIN_EMAIL = "contato@excompanhia.com";

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ")
      ? auth.slice("Bearer ".length)
      : null;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "missing_token" },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1) validar sessão
    const { data: userData, error: userErr } =
      await supabase.auth.getUser(token);

    if (userErr || !userData?.user) {
      return NextResponse.json(
        { ok: false, error: "invalid_session" },
        { status: 401 }
      );
    }

    // 2) validar admin por e-mail
    if (userData.user.email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { ok: false, error: "not_admin" },
        { status: 403 }
      );
    }

    // 3) listar mailing (read-only)
    const { data, error } = await supabase
      .from("mailing_contacts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "unexpected_error" },
      { status: 500 }
    );
  }
}
