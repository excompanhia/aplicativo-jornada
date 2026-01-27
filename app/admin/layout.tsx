"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function Tab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: active ? "#111827" : "#6B7280",
        fontSize: 14,
        padding: "12px 10px",
        borderBottom: active ? "2px solid #111827" : "2px solid transparent",
        marginBottom: -1,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontWeight: active ? 600 : 500,
      }}
    >
      {label}
    </Link>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [hasSession, setHasSession] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(Boolean(data.session));
    })();
  }, []);

  async function logout() {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setHasSession(false);
      setLoggingOut(false);
      router.replace("/admin/login");
    }
  }

  const isMetrics = pathname?.startsWith("/admin/metrics");
  const isPwa = pathname?.startsWith("/admin/pwa");

  return (
    <div style={{ minHeight: "100vh", background: "#fff", color: "#111827" }}>
      {/* Top bar (estilo Vercel) */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid #E5E7EB",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 0.3,
              }}
            >
              ADMIN
            </div>

            <nav
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                borderBottom: "1px solid #E5E7EB",
              }}
            >
              <Tab href="/admin/metrics" label="Métricas" active={!!isMetrics} />
              <Tab href="/admin/pwa" label="Layout PWA" active={!!isPwa} />
            </nav>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link
              href="/admin/login"
              style={{
                textDecoration: "none",
                fontSize: 14,
                color: "#111827",
                padding: "8px 10px",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                background: "#fff",
              }}
            >
              Login
            </Link>

            {hasSession && (
              <button
                onClick={logout}
                disabled={loggingOut}
                style={{
                  fontSize: 14,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #111827",
                  background: "#111827",
                  color: "#fff",
                  cursor: loggingOut ? "default" : "pointer",
                  opacity: loggingOut ? 0.7 : 1,
                }}
              >
                {loggingOut ? "Saindo…" : "Sair"}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main style={{ padding: "24px 20px" }}>{children}</main>

      <footer style={{ padding: "0 20px 24px", fontSize: 12, color: "#6B7280" }}>
        Admin do Aplicativo Jornada • Em produção só após deploy Vercel
      </footer>
    </div>
  );
}
