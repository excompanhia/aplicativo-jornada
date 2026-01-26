import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/app/lib/supabaseServer";

const ADMIN_EMAIL = "contato@excompanhia.com";

export default async function AdminPage() {
  const supabase = await getSupabaseServer();

  const { data, error } = await supabase.auth.getUser();

  // Se não estiver logado (ou deu erro de sessão), manda para login
  if (error || !data?.user) {
    redirect("/login");
  }

  const email = (data.user.email || "").toLowerCase();

  // Se estiver logado mas não for o admin, bloqueia
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

  // Se for admin, mostra o painel
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Admin (read-only)</h1>
      <p style={{ marginBottom: 8 }}>
        Bem-vindo, {email}. Este painel é leitura apenas.
      </p>
      <p style={{ opacity: 0.7 }}>
        Próximo passo: listar passes com Supabase admin (service role).
      </p>
    </main>
  );
}
