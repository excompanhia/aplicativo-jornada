import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSupabaseServer } from "@/app/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ADMIN_EMAIL = "contato@excompanhia.com";

export default async function AdminPage() {
  headers();

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.getUser();

  // Se não estiver logado, manda para login do ADMIN (separado do Journey)
  if (error || !data?.user) {
    redirect("/admin/login");
  }

  const email = (data.user.email || "").toLowerCase();

  // Se estiver logado mas não for o admin
  if (email !== ADMIN_EMAIL) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Sem acesso</h1>
        <p style={{ marginBottom: 8 }}>
          Esta área é restrita ao administrador.
        </p>
        <p style={{ opacity: 0.7 }}>Usuário logado: {email || "(sem e-mail)"}</p>
      </main>
    );
  }

  // Admin OK
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Admin (read-only)</h1>
      <p style={{ marginBottom: 8 }}>
        Bem-vindo, {email}. Este painel é leitura apenas.
      </p>
      <p style={{ opacity: 0.7 }}>VERSÃO ADMIN: 2026-01-26_FINAL</p>
    </main>
  );
}
