"use client";

// B-8: Global changelog — paginated feed of recent change events across all tracked acts

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Activity } from "lucide-react";
import { fetchChangelog } from "@/lib/api";
import type { ChangelogItem, EventType } from "@/lib/api";
import { AppLayout } from "@/components/app-layout";
import { EventTypeBadge, SeverityBadge } from "@/components/severity-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";

const PAGE_SIZE = 20;

const EVENT_TYPES: { value: EventType | ""; label: string }[] = [
  { value: "", label: "All types" },
  { value: "UnitAmended", label: "Amended" },
  { value: "UnitAdded", label: "Added" },
  { value: "UnitRepealed", label: "Repealed" },
  { value: "UnitRenumbered", label: "Renumbered" },
  { value: "ActRepealed", label: "Act repealed" },
  { value: "ActConsolidated", label: "Consolidated" },
  { value: "EntryIntoForceSet", label: "Entry into force" },
];

function ChangelogSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="ml-auto h-4 w-32" />
          </div>
          <Skeleton className="mt-2 h-4 w-2/3" />
          <Skeleton className="mt-1 h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

function eliToUrl(actEli: string): string {
  return actEli.replace(/\//g, ":");
}

function getEventDetail(ev: ChangelogItem): string | null {
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
      return ev.by ? `repealed by ${ev.by}` : null;
    case "EntryIntoForceSet":
      return ev.unitPath ? `unit ${ev.unitPath}` : null;
    default:
      return null;
  }
}

function ChangelogCard({ item }: { item: ChangelogItem }) {
  const detail = getEventDetail(item);
  const actUrl = `/acts/${eliToUrl(item.actEli)}/timeline`;
  const createdAt = new Date(item.createdAt).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <EventTypeBadge type={item.type} />
        <SeverityBadge severity={item.severity} />
        {item.effectiveDate && (
          <span className="text-xs text-slate-500">
            effective {item.effectiveDate}
          </span>
        )}
        <time className="ml-auto text-xs text-slate-400">{createdAt}</time>
      </div>
      <Link
        href={actUrl}
        className="mt-2 block text-sm font-medium text-blue-700 hover:underline line-clamp-2"
      >
        {item.actTitle}
      </Link>
      {detail && (
        <p className="mt-1 font-mono text-xs text-slate-500 break-all">
          {detail}
        </p>
      )}
      <p className="mt-1 font-mono text-xs text-slate-400">{item.actEli}</p>
    </article>
  );
}

export default function ChangelogPage() {
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<EventType | "">("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["changelog", page, typeFilter],
    queryFn: () =>
      fetchChangelog({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        ...(typeFilter ? { type: typeFilter } : {}),
      }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Changelog</h1>
            <p className="mt-1 text-sm text-slate-500">
              Recent legislative changes across all tracked acts
              {total > 0 && ` · ${total} events total`}
            </p>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as EventType | "");
              setPage(0);
            }}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {EVENT_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {isLoading && <ChangelogSkeleton />}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load changelog: {(error as Error).message}
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <EmptyState
            icon={<Activity size={48} />}
            title="No events yet"
            description="Import and sync acts to start tracking legislative changes."
          />
        )}

        {items.length > 0 && (
          <>
            <div className="space-y-3">
              {items.map((item) => (
                <ChangelogCard key={item.eventHash} item={item} />
              ))}
            </div>

            {pageCount > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-500">
                  Page {page + 1} of {pageCount}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={page >= pageCount - 1}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
