import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const { slug } = await context.params;

    const { data, error } = await supabase
      .from("experiences")
      .select("id, slug, title, is_active")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: "not_found_or_not_published" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, experience: data });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "unknown error" },
      { status: 500 }
    );
  }
}
