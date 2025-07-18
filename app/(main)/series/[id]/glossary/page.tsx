"use client";

import { GlossaryPage } from "@/components/series/glossary-page";

export default function Page({ params }: { params: { id: string } }) {
  return <GlossaryPage seriesId={params.id} />;
}
