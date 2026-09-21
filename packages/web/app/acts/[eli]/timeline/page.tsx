"use client";

// S4-7: Timeline page, B-3: PDF download

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { fetchTimeline } from "@/lib/api";
import { AppLayout } from "@/components/app-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { TimelineView } from "@/components/timeline-view";
import { UnitTree } from "@/components/unit-tree";

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

export default function TimelinePage({
  params,
}: {
  params: Promise<{ eli: string }>;
}) {
  const { eli: rawEli } = use(params);
  const eli = decodeURIComponent(rawEli);
  const internalEli = eli.replace(/:/g, "/");
  const pdfUrl = `${API_BASE}/acts/${encodeURIComponent(internalEli)}/timeline.pdf`;

  const { data } = useQuery({
    queryKey: ["timeline", internalEli],
    queryFn: () => fetchTimeline(internalEli),
  });

  const events = data?.events ?? [];

  return (
    <AppLayout eli={eli}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Timeline</h1>
            <p className="mt-1 font-mono text-sm text-slate-500">{internalEli}</p>
          </div>
          {events.length > 0 && (
            <a
              href={pdfUrl}
              download
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Download size={14} />
              Download PDF
            </a>
          )}
        </div>

        <ErrorBoundary>
          <div className="flex gap-6">
            {/* Unit navigation tree */}
            {events.length > 0 && (
              <aside className="hidden w-44 shrink-0 xl:block">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
                  Units
                </p>
                <UnitTree events={events} />
              </aside>
            )}

            {/* Timeline events — responsive (S4-13) */}
            <div className="min-w-0 flex-1">
              <TimelineView eli={eli.replace(/:/g, "/")} />
            </div>
          </div>
        </ErrorBoundary>
      </div>
    </AppLayout>
  );
}
