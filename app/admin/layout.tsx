"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function TabLink({
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
      className={[
        "rounded-md px-3 py-2 text-sm transition",
        active
          ? "bg-neutral-900 text-white"
          : "text-neutral-700 hover:bg-neutral-100",
      ].join(" ")}
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

  const [hasSession, setHasSession] = useState<boolean>(false);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);

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
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm font-semibold">
              ADMIN
            </div>

            <nav className="flex items-center gap-2">
              <TabLink
                href="/admin/metrics"
                label="Métricas"
                active={!!isMetrics}
              />
              <TabLink href="/admin/pwa" label="Layout PWA" active={!!isPwa} />
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/login"
              className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
            >
              Login
            </Link>

            {hasSession && (
              <button
                onClick={logout}
                disabled={loggingOut}
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {loggingOut ? "Saindo…" : "Sair"}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content: FULL WIDTH, sem "card" embrulhando */}
      <main className="w-full px-4 py-6">{children}</main>

      <footer className="w-full px-4 pb-10 text-xs text-neutral-500">
        Admin do Aplicativo Jornada • Em produção só após deploy Vercel
      </footer>
    </div>
  );
}
