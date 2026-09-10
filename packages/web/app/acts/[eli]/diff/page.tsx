"use client";

// S4-9, S4-10: Diff view — side-by-side panels with word-level highlights

import { use, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { DiffView } from "@/components/diff-view";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchActVersions } from "@/lib/api";
import { GitCompare } from "lucide-react";

// ── Version picker ─────────────────────────────────────────────────────────────

function VersionPicker({
  eli,
  internalEli,
  currentFrom,
  currentTo,
}: {
  eli: string;
  internalEli: string;
  currentFrom: string;
  currentTo: string;
}) {
  const router = useRouter();
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["versions", internalEli],
    queryFn: () => fetchActVersions(eli),
  });

  const [from, setFrom] = useState(currentFrom || "");
  const [to, setTo] = useState(currentTo || "");

  // Auto-navigate when versions load and no URL params set
  useEffect(() => {
    if (versions.length >= 2 && !currentFrom && !currentTo) {
      const params = new URLSearchParams({
        from: versions[0]!,
        to: versions[versions.length - 1]!,
      });
      router.replace(`?${params.toString()}`);
    }
    // Only run when versions first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions.length]);

  const effectiveFrom = from || (versions.length >= 1 ? versions[0]! : "");
  const effectiveTo = to || (versions.length >= 2 ? versions[versions.length - 1]! : "");

  if (isLoading) {
    return (
      <div className="mb-6 flex gap-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-8" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-24" />
      </div>
    );
  }

  if (versions.length < 2) {
    return (
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Only one version available for this act. Diffs appear automatically when
        a new consolidated text is published and synced.
      </div>
    );
  }

  const handleCompare = () => {
    if (!effectiveFrom || !effectiveTo || effectiveFrom === effectiveTo) return;
    const params = new URLSearchParams({ from: effectiveFrom, to: effectiveTo });
    router.push(`?${params.toString()}`);
  };

  const select =
    "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-mono focus:border-blue-500 focus:outline-none";

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <select
        value={effectiveFrom}
        onChange={(e) => setFrom(e.target.value)}
        className={select}
      >
        {versions.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <span className="text-slate-400">→</span>
      <select
        value={effectiveTo}
        onChange={(e) => setTo(e.target.value)}
        className={select}
      >
        {versions.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <button
        onClick={handleCompare}
        disabled={!effectiveFrom || !effectiveTo || effectiveFrom === effectiveTo}
        className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
      >
        <GitCompare size={14} />
        Compare
      </button>
    </div>
  );
}

// ── Page content ───────────────────────────────────────────────────────────────

function DiffPageContent({ eli }: { eli: string }) {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const internalEli = eli.replace(/:/g, "/");

  return (
    <AppLayout eli={eli}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900">Diff</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">{internalEli}</p>
        </div>

        <VersionPicker
          eli={eli}
          internalEli={internalEli}
          currentFrom={from}
          currentTo={to}
        />

        <ErrorBoundary>
          <DiffView eli={internalEli} from={from} to={to} />
        </ErrorBoundary>
      </div>
    </AppLayout>
  );
}

function DiffFallback() {
  return (
    <AppLayout>
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3">
              {[...Array(3)].map((_, j) => (
                <Skeleton key={j} className="h-24" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

export default function DiffPage({
  params,
}: {
  params: Promise<{ eli: string }>;
}) {
  const { eli: rawEli } = use(params);
  const eli = decodeURIComponent(rawEli);

  return (
    <Suspense fallback={<DiffFallback />}>
      <DiffPageContent eli={eli} />
    </Suspense>
  );
}
