"use client";

// S4-5: Search page — keyword/type filters, results list

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { searchActs } from "@/lib/api";
import type { ActMetadata } from "@/lib/api";
import { AppLayout } from "@/components/app-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

function ActCard({ act }: { act: ActMetadata }) {
  // Convert internal ELI (DU/2017/2196) → route ELI (DU:2017:2196)
  const routeEli = act.eli.replace(/\//g, ":");

  return (
    <Link href={`/acts/${routeEli}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium text-slate-900 line-clamp-2">
                {act.title}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500">{act.eli}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge variant="outline">{act.type}</Badge>
              <Badge variant={act.inForce ? "success" : "secondary"}>
                {act.inForce ? "In force" : "Not in force"}
              </Badge>
            </div>
          </div>
          {act.keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
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
        </CardContent>
      </Card>
    </Link>
  );
}

function SearchResults({
  q,
  keyword,
  type,
}: {
  q: string;
  keyword: string;
  type: string;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["search", q, keyword, type],
    queryFn: () =>
      searchActs({
        ...(q ? { q } : {}),
        ...(keyword ? { keyword } : {}),
        ...(type ? { type } : {}),
      }),
  });

  if (isLoading) {
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

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Error loading results: {(error as Error).message}
      </div>
    );
  }

  const acts = data ?? [];

  if (acts.length === 0) {
    return (
      <EmptyState
        title="No acts found"
        description="Try different search terms or clear the filters."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        {acts.length} result{acts.length === 1 ? "" : "s"}
      </p>
      {acts.map((act) => (
        <ActCard key={act.eli} act={act} />
      ))}
    </div>
  );
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState("");
  const [submitted, setSubmitted] = useState<{
    q: string;
    keyword: string;
    type: string;
  }>({ q: "", keyword: "", type: "" });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted({ q, keyword, type });
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Search Acts</h1>

        <ErrorBoundary>
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
            </div>
          </form>

          <SearchResults
            q={submitted.q}
            keyword={submitted.keyword}
            type={submitted.type}
          />
        </ErrorBoundary>
      </div>
    </AppLayout>
  );
}
