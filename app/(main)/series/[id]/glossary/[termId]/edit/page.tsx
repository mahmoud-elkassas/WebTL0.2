"use client";

import { EditGlossaryTermPage } from "@/components/series/edit-glossary-term-page";

export default function Page({
  params,
}: {
  params: { id: string; termId: string };
}) {
  return <EditGlossaryTermPage seriesId={params.id} termId={params.termId} />;
}
