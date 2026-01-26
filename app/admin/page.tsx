"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "contato@excompanhia.com";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminPage() {
  const router = useRouter();
  const [status, setStatus] = useState<
    "checking" | "not_logged" | "not_admin" | "ok"
  >("checking");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data, error } = await supabase.auth.getUser();

      if (cancelled) return;

      if (error || !data?.user) {
        setStatus("not_logged");
        router.replace("/admin/login");
        return;
      }

      const e = (data.user.email || "").toLowerCase();
      setEmail(e);

      if (e !== ADMIN_EMAIL) {
        setStatus("not_admin");
        return;
      }

      setStatus("ok");
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === "checking") {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Admin</h1>
        <p style={{ opacity: 0.7 }}>Verificando login…</p>
      </main>
    );
  }

  if (status === "not_admin") {
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

  // status === "ok"
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Admin (read-only)</h1>
      <p style={{ marginBottom: 8 }}>
        Bem-vindo, {email}. Este painel é leitura apenas.
      </p>
      <p style={{ opacity: 0.7 }}>VERSÃO ADMIN: 2026-01-26_CLIENT_OK</p>
    </main>
  );
}
