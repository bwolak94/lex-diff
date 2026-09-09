"use client";

// S4-9: Side-by-side diff panels
// S4-14: Loading skeletons for diff panels
// S6-13: EventPanel memoized to avoid re-renders when Zustand focus state changes

import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDiff } from "@/lib/api";
import type { ChangeEvent } from "@/lib/api";
import { EventTypeBadge, SeverityBadge } from "@/components/severity-badge";
import { WordDiff } from "@/components/word-diff";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { UnitTree } from "@/components/unit-tree";
import { GitCompare } from "lucide-react";

function DiffSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {[0, 1].map((col) => (
        <div key={col} className="space-y-3">
          <Skeleton className="h-6 w-32" />
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <Skeleton className="mb-2 h-4 w-20" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// S6-13: Memoized — only re-renders when ev or side changes
const EventPanel = memo(function EventPanel({
  ev,
  side,
}: {
  ev: ChangeEvent;
  side: "old" | "new";
}) {
  const text =
    ev.type === "UnitAmended"
      ? side === "old"
        ? ev.before
        : ev.after
      : ev.type === "UnitAdded"
        ? side === "new"
          ? ev.text
          : undefined
        : ev.type === "UnitRepealed"
          ? side === "old"
            ? "(repealed)"
            : undefined
          : undefined;

  if (text === undefined) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-medium text-slate-500">
          {ev.path}
        </span>
        <EventTypeBadge type={ev.type} />
        <SeverityBadge severity={ev.severity} />
      </div>
      <p className="text-sm leading-relaxed text-slate-700">
        {ev.type === "UnitAmended" && ev.wordDiff && side === "new" ? (
          <WordDiff ops={ev.wordDiff} />
        ) : (
          text
        )}
      </p>
    </div>
  );
});

interface DiffViewProps {
  eli: string;
  from: string;
  to: string;
}

export function DiffView({ eli, from, to }: DiffViewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["diff", eli, from, to],
    queryFn: () => fetchDiff(eli, from, to),
    enabled: Boolean(from && to),
  });

  if (!from || !to) {
    return (
      <EmptyState
        icon={<GitCompare size={48} />}
        title="Select two versions to compare"
        description="Use the ?from=ELI&to=ELI query parameters to specify versions."
      />
    );
  }

  if (isLoading) return <DiffSkeleton />;

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
        Failed to load diff: {(error as Error).message}
      </div>
    );
  }

  const events = data?.events ?? [];

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<GitCompare size={48} />}
        title="No changes detected"
        description={`The two versions "${from}" and "${to}" are identical.`}
      />
    );
  }

  return (
    <div className="flex gap-6">
      {/* Unit tree sidebar */}
      <aside className="hidden w-48 shrink-0 xl:block">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          Units
        </p>
        <UnitTree events={events} />
      </aside>

      {/* Side-by-side panels */}
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
          <span className="rounded bg-red-100 px-2 py-0.5 font-mono text-red-700">
            {from}
          </span>
          <span>→</span>
          <span className="rounded bg-green-100 px-2 py-0.5 font-mono text-green-700">
            {to}
          </span>
          <span className="ml-auto text-xs">
            {events.length} event{events.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Old column */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-500">
              Before
            </h3>
            <div className="space-y-3">
              {events.map((ev) => (
                <EventPanel key={`old-${ev.eventHash}`} ev={ev} side="old" />
              ))}
            </div>
          </div>
          {/* New column */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-500">
              After
            </h3>
            <div className="space-y-3">
              {events.map((ev) => (
                <EventPanel key={`new-${ev.eventHash}`} ev={ev} side="new" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
