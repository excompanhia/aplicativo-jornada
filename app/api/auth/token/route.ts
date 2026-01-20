import { NextResponse } from "next/server";

/**
 * Endpoint de ajuda (DEV):
 * Ele não pega "token" do Supabase (porque isso fica no localStorage no navegador),
 * mas serve para confirmar que o endpoint está vivo.
 *
 * Depois a gente pode até remover esse endpoint.
 */

export async function GET() {
  return NextResponse.json({
    ok: true,
    marker: "AUTH_TOKEN_ENDPOINT_OK",
  });
}
