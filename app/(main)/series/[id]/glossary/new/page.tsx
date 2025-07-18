"use client";

import { NewGlossaryTermPage } from "@/components/series/new-glossary-term-page";

export default function Page({ params }: { params: { id: string } }) {
  return <NewGlossaryTermPage seriesId={params.id} />;
}
