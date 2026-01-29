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

    // 1) valida experiência publicada/ativa (como já era)
    const { data: exp, error: expErr } = await supabase
      .from("experiences")
      .select("id, slug, title, is_active")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (expErr || !exp) {
      return NextResponse.json(
        { ok: false, error: "not_found_or_not_published" },
        { status: 404 }
      );
    }

    // 2) tenta buscar landing (se não existir ainda, tudo bem)
    const { data: landing, error: landErr } = await supabase
      .from("experience_landings")
      .select(
        "logo_url, headline, description, free_preview_audio_url, free_preview_duration_seconds, blocks_order"
      )
      .eq("experience_id", exp.id)
      .maybeSingle();

    // se der erro na landing, não derruba a experiência (fallback conservador)
    const safeLanding = landErr ? null : landing;

    return NextResponse.json({
      ok: true,
      experience: exp,
      landing: safeLanding,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "unknown error" },
      { status: 500 }
    );
  }
}
