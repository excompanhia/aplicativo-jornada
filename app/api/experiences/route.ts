import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon);
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // Público: só retorna o mínimo necessário para a Home
    // Ordem alfabética pelo slug
    const { data, error } = await supabase
      .from("experiences")
      .select("slug, title, status")
      .eq("status", "published")
      .order("slug", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "failed_to_load_experiences",
          detail: error.message,
          hint:
            "Verifique se existe a tabela 'experiences' e se há campo 'status' com valor 'published'.",
        },
        { status: 500 }
      );
    }

    const items =
      (data || [])
        .filter((x: any) => x?.slug)
        .map((x: any) => ({
          slug: String(x.slug),
          title: x?.title ? String(x.title) : null,
        })) || [];

    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "unexpected_error",
        detail: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}
