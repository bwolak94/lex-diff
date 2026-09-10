"use client";

// S4-9, S4-10: Diff view — side-by-side panels with word-level highlights
// Exit criterion: /acts/DU:2017:2196/diff?from=v1&to=v2 renders correctly

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AppLayout } from "@/components/app-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { DiffView } from "@/components/diff-view";
import { Skeleton } from "@/components/ui/skeleton";

function DiffPageContent({ eli }: { eli: string }) {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  return (
    <AppLayout eli={eli}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Diff</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">
            {eli.replace(/:/g, "/")}
          </p>
        </div>

        <ErrorBoundary>
          <DiffView eli={eli.replace(/:/g, "/")} from={from} to={to} />
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
