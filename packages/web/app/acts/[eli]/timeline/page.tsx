"use client";

// S4-7: Timeline page

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTimeline } from "@/lib/api";
import { AppLayout } from "@/components/app-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { TimelineView } from "@/components/timeline-view";
import { UnitTree } from "@/components/unit-tree";

export default function TimelinePage({
  params,
}: {
  params: Promise<{ eli: string }>;
}) {
  const { eli: rawEli } = use(params);
  const eli = decodeURIComponent(rawEli);

  const { data } = useQuery({
    queryKey: ["timeline", eli.replace(/:/g, "/")],
    queryFn: () => fetchTimeline(eli.replace(/:/g, "/")),
  });

  const events = data?.events ?? [];

  return (
    <AppLayout eli={eli}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Timeline</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">
            {eli.replace(/:/g, "/")}
          </p>
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
