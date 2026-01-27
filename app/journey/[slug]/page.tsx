"use client";

import { useParams } from "next/navigation";

export default function JourneyBySlugPage() {
  const params = useParams();
  const slug = params?.slug as string;

  return (
    <main style={{ padding: 24 }}>
      <h1>Journey por Experiência</h1>
      <p>
        <strong>Slug recebido:</strong> {slug}
      </p>
    </main>
  );
}
