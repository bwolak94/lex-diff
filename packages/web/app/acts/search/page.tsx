"use client";

// S4-5: Search page — local DB search + live ELI API passthrough search

import { useState } from "react";
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
import { Search, GitCompare, Clock, Globe, Database } from "lucide-react";

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

// ── Local search results (our DB) ─────────────────────────────────────────────

function LocalResults({ q, keyword, type }: { q: string; keyword: string; type: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["search", q, keyword, type],
    queryFn: () => searchActs({ ...(q ? { q } : {}), ...(keyword ? { keyword } : {}), ...(type ? { type } : {}) }),
  });

  const { data: statsArr } = useQuery({
    queryKey: ["acts-stats"],
    queryFn: fetchActStats,
    staleTime: 60_000,
  });
  const statsMap = Object.fromEntries((statsArr ?? []).map((s) => [s.eli, s]));

  if (isLoading) return <ResultsSkeleton />;
  if (error) return <ErrorBox message={(error as Error).message} />;

  const acts = data ?? [];
  if (acts.length === 0) return <EmptyState title="No local acts found" description="Try the Sejm search tab to search the full corpus." />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">{acts.length} result{acts.length === 1 ? "" : "s"} from local database</p>
      {acts.map((act) => (
        <ActCard key={act.eli} act={act} stats={statsMap[act.eli]} isLocal />
      ))}
    </div>
  );
}

// ── Live ELI search results (full 164k corpus) ────────────────────────────────

function EliResults({
  q,
  type,
  publisher,
  page,
}: {
  q: string;
  type: string;
  publisher: string;
  page: number;
}) {
  const limit = 20;
  const offset = page * limit;

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["eli-search", q, type, publisher, page],
    queryFn: () => searchEliActs({ ...(q ? { q } : {}), ...(type ? { type } : {}), ...(publisher ? { publisher } : {}), limit, offset }),
    staleTime: 60_000,
  });

  if (isLoading) return <ResultsSkeleton />;
  if (error) return <ErrorBox message={(error as Error).message} />;

  const { items = [], totalCount = 0 } = data ?? {};
  if (items.length === 0) return <EmptyState title="No acts found in Sejm database" description="Try different search terms." />;

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {totalCount.toLocaleString()} results in Sejm database
          {isFetching && <span className="ml-2 text-slate-400">(updating…)</span>}
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
        <p className="text-center text-xs text-slate-400">
          Showing {offset + 1}–{Math.min(offset + limit, totalCount)} of {totalCount.toLocaleString()}
        </p>
      )}
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

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

  const [submitted, setSubmitted] = useState<{
    q: string; keyword: string; type: string; publisher: string;
  }>({ q: "", keyword: "", type: "", publisher: "" });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted({ q, keyword, type, publisher });
    setPage(0);
  }

  const hasQuery = submitted.q || submitted.keyword || submitted.type || submitted.publisher;

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Search Acts</h1>

        <ErrorBoundary>
          {/* Search form */}
          <form onSubmit={handleSearch} className="mb-6 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search by title…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">
                <Search size={16} className="mr-1" />
                Search
              </Button>
            </div>
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
                onClick={() => { setTab("sejm"); setPage(0); }}
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
              q={submitted.q}
              keyword={submitted.keyword}
              type={submitted.type}
            />
          )}

          {hasQuery && tab === "sejm" && (
            <>
              <EliResults
                q={submitted.q}
                type={submitted.type}
                publisher={submitted.publisher}
                page={page}
              />
              {/* Pagination */}
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}

          {!hasQuery && (
            <EmptyState
              title="Search for acts"
              description="Enter a title, keyword, or type above and press Search."
            />
          )}
        </ErrorBoundary>
      </div>
    </AppLayout>
  );
}
