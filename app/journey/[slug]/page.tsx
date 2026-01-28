"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import JourneyPage from "../page";

const KEY_CURRENT_EXPERIENCE = "jornada:current_experience_id";

type LoadState =
  | { status: "loading" }
  | { status: "blocked" }
  | { status: "ok" };

export default function JourneyBySlugPage() {
  const router = useRouter();
  const params = useParams();
  const search = useSearchParams();

  const slug = (params?.slug as string) || "";
  const play = search.get("play") === "1";

  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!slug) return;
    try {
      localStorage.setItem(KEY_CURRENT_EXPERIENCE, slug);
    } catch {}
  }, [slug]);

  useEffect(() => {
    if (!slug) {
      setState({ status: "blocked" });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/experiences/${encodeURIComponent(slug)}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          if (!cancelled) setState({ status: "blocked" });
          return;
        }

        const json = await res.json();
        if (!json?.ok) {
          if (!cancelled) setState({ status: "blocked" });
          return;
        }

        if (!cancelled) setState({ status: "ok" });
      } catch {
        if (!cancelled) setState({ status: "blocked" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Se estiver ok e NÃO for play=1 → manda para a landing
  useEffect(() => {
    if (state.status !== "ok") return;
    if (play) return;

    router.replace(`/journey/${encodeURIComponent(slug)}/landing`);
  }, [state.status, play, slug, router]);

  if (state.status === "loading") return null;
  if (state.status === "blocked") return null;

  if (!play) return null;

  return <JourneyPage />;
}
