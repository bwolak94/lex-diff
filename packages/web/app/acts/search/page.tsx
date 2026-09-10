"use client";

// S4-5: Search page — debounced auto-search, autocomplete dropdown,
//        local DB tab + live ELI API passthrough tab (164k acts)

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { searchActs, searchEliActs, fetchActStats } from "@/lib/api";
import type { ActMetadata, ActMetadataWithLocal, ActStats } from "@/lib/api";
import { AppLayout } from "@/components/app-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, GitCompare, Clock, Globe, Database, Loader2 } from "lucide-react";

// ── Debounce hook ──────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

// ── Act card ───────────────────────────────────────────────────────────────────

function ActCard({
  act,
  stats,
  isLocal = true,
}: {
  act: ActMetadata;
  stats?: ActStats;
  isLocal?: boolean;
}) {
  const routeEli = act.eli.replace(/\//g, ":");
  const hasDiff = isLocal && (stats?.versionCount ?? 0) >= 2;
  const hasTimeline = isLocal && (stats?.eventCount ?? 0) > 0;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <Link href={`/acts/${routeEli}`} className="min-w-0 flex-1">
            <p className="font-medium text-slate-900 line-clamp-2 hover:text-blue-600">
              {act.title}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500">{act.eli}</p>
          </Link>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="outline">{act.type}</Badge>
            <Badge variant={act.inForce ? "success" : "secondary"}>
              {act.inForce ? "In force" : "Not in force"}
            </Badge>
            {!isLocal && (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                Metadata only
              </Badge>
            )}
          </div>
        </div>

        {act.keywords.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {act.keywords.slice(0, 5).map((kw) => (
              <span
                key={kw}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
              >
                {kw}
              </span>
            ))}
            {act.keywords.length > 5 && (
              <span className="text-xs text-slate-400">
                +{act.keywords.length - 5} more
              </span>
            )}
          </div>
        )}

        {(hasDiff || hasTimeline) && (
          <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
            {hasDiff && (
              <Link
                href={`/acts/${routeEli}/diff`}
                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                <GitCompare size={12} />
                Diff ({stats!.versionCount} versions)
              </Link>
            )}
            {hasTimeline && (
              <Link
                href={`/acts/${routeEli}/timeline`}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              >
                <Clock size={12} />
                Timeline ({stats!.eventCount} events)
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Autocomplete dropdown ──────────────────────────────────────────────────────

function Autocomplete({
  inputValue,
  onSelect,
}: {
  inputValue: string;
  onSelect: (title: string) => void;
}) {
  const debouncedInput = useDebounce(inputValue, 250);
  const [open, setOpen] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ["autocomplete", debouncedInput],
    queryFn: () => searchEliActs({ q: debouncedInput, limit: 7 }),
    enabled: debouncedInput.length >= 3,
    staleTime: 30_000,
  });

  const suggestions = data?.items ?? [];

  useEffect(() => {
    setOpen(debouncedInput.length >= 3 && suggestions.length > 0);
  }, [debouncedInput, suggestions.length]);

  if (!open) return null;

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
      {isFetching && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-400">
          <Loader2 size={12} className="animate-spin" /> Searching…
        </div>
      )}
      {suggestions.map((act) => (
        <button
          key={act.eli}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault(); // keep focus on input
            onSelect(act.title);
            setOpen(false);
          }}
          className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-slate-50"
        >
          <span className="line-clamp-1 text-sm text-slate-900">{act.title}</span>
          <span className="font-mono text-xs text-slate-400">{act.eli}</span>
        </button>
      ))}
    </div>
  );
}

// ── Local results ──────────────────────────────────────────────────────────────

function LocalResults({
  q,
  keyword,
  type,
  onNoResults,
}: {
  q: string;
  keyword: string;
  type: string;
  onNoResults: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["search", q, keyword, type],
    queryFn: () =>
      searchActs({
        ...(q ? { q } : {}),
        ...(keyword ? { keyword } : {}),
        ...(type ? { type } : {}),
      }),
    enabled: Boolean(q || keyword || type),
  });

  const { data: statsArr } = useQuery({
    queryKey: ["acts-stats"],
    queryFn: fetchActStats,
    staleTime: 60_000,
  });
  const statsMap = Object.fromEntries((statsArr ?? []).map((s) => [s.eli, s]));

  const acts = data ?? [];

  // Auto-suggest Sejm tab when local has nothing
  useEffect(() => {
    if (!isLoading && acts.length === 0 && (q || keyword || type)) {
      onNoResults();
    }
  }, [isLoading, acts.length, q, keyword, type, onNoResults]);

  if (isLoading) return <ResultsSkeleton />;
  if (error) return <ErrorBox message={(error as Error).message} />;

  if (acts.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No acts found in the local database. Switching to the Sejm full corpus…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        {acts.length} result{acts.length === 1 ? "" : "s"} from local database
      </p>
      {acts.map((act) => (
        <ActCard key={act.eli} act={act} stats={statsMap[act.eli]} isLocal />
      ))}
    </div>
  );
}

// ── Sejm (ELI) results ────────────────────────────────────────────────────────

function EliResults({
  q,
  type,
  publisher,
  page,
  onPageChange,
}: {
  q: string;
  type: string;
  publisher: string;
  page: number;
  onPageChange: (p: number) => void;
}) {
  const limit = 20;
  const offset = page * limit;

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["eli-search", q, type, publisher, page],
    queryFn: () =>
      searchEliActs({
        ...(q ? { q } : {}),
        ...(type ? { type } : {}),
        ...(publisher ? { publisher } : {}),
        limit,
        offset,
      }),
    enabled: Boolean(q || type || publisher),
    staleTime: 60_000,
  });

  if (isLoading) return <ResultsSkeleton />;
  if (error) return <ErrorBox message={(error as Error).message} />;

  const { items = [], totalCount = 0 } = data ?? {};
  if (items.length === 0)
    return (
      <EmptyState
        title="No acts found in Sejm database"
        description="Try different search terms."
      />
    );

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {totalCount.toLocaleString()} results in Sejm database
          {isFetching && (
            <span className="ml-2 inline-flex items-center gap-1 text-slate-400">
              <Loader2 size={11} className="animate-spin" /> updating…
            </span>
          )}
        </p>
        {totalPages > 1 && (
          <p className="text-xs text-slate-400">
            Page {page + 1} of {totalPages}
          </p>
        )}
      </div>

      {items.map((act: ActMetadataWithLocal) => (
        <ActCard key={act.eli} act={act} isLocal={act.isLocal} />
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-slate-400">
            {offset + 1}–{Math.min(offset + limit, totalCount)} of{" "}
            {totalCount.toLocaleString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function ResultsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="mb-2 h-5 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      Error: {message}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

type Tab = "local" | "sejm";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState("");
  const [publisher, setPublisher] = useState("");
  const [tab, setTab] = useState<Tab>("local");
  const [page, setPage] = useState(0);
  const inputWrapRef = useRef<HTMLDivElement>(null);

  // Debounce all filter fields — results update automatically 400ms after typing stops
  const debouncedQ = useDebounce(q, 400);
  const debouncedKeyword = useDebounce(keyword, 400);
  const debouncedType = useDebounce(type, 400);
  const debouncedPublisher = useDebounce(publisher, 400);

  // Reset page when query changes
  useEffect(() => {
    setPage(0);
  }, [debouncedQ, debouncedType, debouncedPublisher]);

  const hasQuery =
    debouncedQ || debouncedKeyword || debouncedType || debouncedPublisher;

  function handleSelectSuggestion(title: string) {
    setQ(title);
    inputWrapRef.current?.querySelector("input")?.blur();
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Search Acts</h1>

        <ErrorBoundary>
          {/* Search form — submitting is optional, results update on debounce */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              inputWrapRef.current?.querySelector("input")?.blur();
            }}
            className="mb-6 space-y-3"
          >
            {/* Main title search with autocomplete */}
            <div className="relative flex gap-2">
              <div className="relative flex-1" ref={inputWrapRef}>
                <Input
                  placeholder="Search by title…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  autoComplete="off"
                />
                <Autocomplete
                  inputValue={q}
                  onSelect={handleSelectSuggestion}
                />
              </div>
              <Button type="submit">
                <Search size={16} className="mr-1" />
                Search
              </Button>
            </div>

            {/* Secondary filters */}
            <div className="flex gap-2">
              <Input
                placeholder="Keyword…"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <Input
                placeholder="Type (e.g. Ustawa)…"
                value={type}
                onChange={(e) => setType(e.target.value)}
              />
              <Input
                placeholder="Publisher (e.g. DU)…"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                className="w-36 shrink-0"
              />
            </div>
          </form>

          {/* Source tabs */}
          {hasQuery && (
            <div className="mb-4 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                onClick={() => setTab("local")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  tab === "local"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Database size={14} />
                Local database
              </button>
              <button
                onClick={() => {
                  setTab("sejm");
                  setPage(0);
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  tab === "sejm"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Globe size={14} />
                All Sejm acts (164 k+)
              </button>
            </div>
          )}

          {/* Results */}
          {hasQuery && tab === "local" && (
            <LocalResults
              q={debouncedQ}
              keyword={debouncedKeyword}
              type={debouncedType}
              onNoResults={() => setTab("sejm")}
            />
          )}

          {hasQuery && tab === "sejm" && (
            <EliResults
              q={debouncedQ}
              type={debouncedType}
              publisher={debouncedPublisher}
              page={page}
              onPageChange={setPage}
            />
          )}

          {!hasQuery && (
            <EmptyState
              title="Search for acts"
              description="Start typing to search — results appear automatically."
            />
          )}
        </ErrorBoundary>
      </div>
    </AppLayout>
  );
}
