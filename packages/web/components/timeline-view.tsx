"use client";

// S4-7: Timeline view — chronological event list with severity badges
// S4-12: Vacatio legis indicator
// S4-13: Responsive layout
// S4-14: Loading skeleton

import { useQuery } from "@tanstack/react-query";
import { fetchTimeline } from "@/lib/api";
import type { ChangeEvent } from "@/lib/api";
import { EventTypeBadge, SeverityBadge } from "@/components/severity-badge";
import { VacatioLegis } from "@/components/vacatio-legis";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Clock } from "lucide-react";

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="ml-auto h-4 w-28" />
          </div>
          <Skeleton className="mt-3 h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

function EventCard({ ev }: { ev: ChangeEvent }) {
  const label = getEventLabel(ev);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <EventTypeBadge type={ev.type} />
        <SeverityBadge severity={ev.severity} />
        {ev.effectiveDate && (
          <VacatioLegis entryIntoForce={ev.effectiveDate} />
        )}
        <time className="ml-auto text-xs text-slate-400">
          {ev.effectiveDate ?? "Date unknown"}
        </time>
      </div>
      {label && (
        <p className="mt-2 text-sm text-slate-600 font-mono break-all">
          {label}
        </p>
      )}
    </article>
  );
}

function getEventLabel(ev: ChangeEvent): string | null {
  switch (ev.type) {
    case "UnitAdded":
    case "UnitRepealed":
    case "UnitAmended":
      return ev.path ?? null;
    case "UnitRenumbered":
      return ev.fromPath && ev.toPath ? `${ev.fromPath} → ${ev.toPath}` : null;
    case "ActConsolidated":
      return ev.tjEli ?? null;
    case "ActRepealed":
      return ev.by ? `by ${ev.by}` : null;
    case "EntryIntoForceSet":
      return ev.unitPath ?? null;
    default:
      return null;
  }
}

export function TimelineView({ eli }: { eli: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["timeline", eli],
    queryFn: () => fetchTimeline(eli),
  });

  if (isLoading) return <TimelineSkeleton />;

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
        Failed to load timeline: {(error as Error).message}
      </div>
    );
  }

  const events = data?.events ?? [];

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<Clock size={48} />}
        title="No events recorded"
        description="This act has no tracked changes yet."
      />
    );
  }

  return (
    <div className="space-y-3">
      {events.map((ev) => (
        <EventCard key={ev.eventHash} ev={ev} />
      ))}
    </div>
  );
}
