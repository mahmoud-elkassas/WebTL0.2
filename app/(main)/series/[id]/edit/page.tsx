"use client";

import { EditSeriesPage } from "@/components/series/edit-series-page";

export default function Page({ params }: { params: { id: string } }) {
  return <EditSeriesPage seriesId={params.id} />;
}
