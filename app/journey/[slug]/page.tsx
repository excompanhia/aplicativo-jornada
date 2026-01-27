"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

// Reaproveita o Journey real existente (app/journey/page.tsx)
import JourneyPage from "../page";

const KEY_CURRENT_EXPERIENCE = "jornada:current_experience_id";

export default function JourneyBySlugPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "";

  useEffect(() => {
    if (!slug) return;

    // Guarda a experiência atual (para métricas e lógica futura)
    try {
      localStorage.setItem(KEY_CURRENT_EXPERIENCE, slug);
    } catch {
      // sem crash se storage estiver bloqueado
    }
  }, [slug]);

  // Renderiza o Journey real
  return <JourneyPage />;
}
