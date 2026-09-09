"use client";

// S4-6: Act detail page — metadata header

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { fetchAct } from "@/lib/api";
import { AppLayout } from "@/components/app-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { VacatioLegis } from "@/components/vacatio-legis";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, GitCompare, ExternalLink } from "lucide-react";

function ActDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-5 w-1/3" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}

export default function ActDetailPage({
  params,
}: {
  params: Promise<{ eli: string }>;
}) {
  const { eli } = use(params);
  const internalEli = eli.replace(/:/g, "/");

  const { data: act, isLoading, error } = useQuery({
    queryKey: ["act", internalEli],
    queryFn: () => fetchAct(eli),
  });

  return (
    <AppLayout eli={eli}>
      <div className="mx-auto max-w-4xl">
        <ErrorBoundary>
          {isLoading && <ActDetailSkeleton />}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Could not load act: {(error as Error).message}
            </div>
          )}

          {act && (
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {act.title}
                </h1>
                <p className="mt-1 font-mono text-sm text-slate-500">
                  {act.eli}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{act.type}</Badge>
                  <Badge variant={act.inForce ? "success" : "secondary"}>
                    {act.inForce ? "In force" : "Not in force"}
                  </Badge>
                  <VacatioLegis entryIntoForce={act.entryIntoForce} />
                </div>
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: "Publisher", value: act.publisher },
                  { label: "Year", value: String(act.year) },
                  { label: "Position", value: String(act.position) },
                  { label: "Status", value: act.status },
                  {
                    label: "Announced",
                    value: act.announcementDate ?? "—",
                  },
                  {
                    label: "Entry into Force",
                    value: act.entryIntoForce ?? "—",
                  },
                  { label: "Repealed", value: act.repealDate ?? "—" },
                  { label: "Changed", value: act.changeDate ?? "—" },
                ].map(({ label, value }) => (
                  <Card key={label}>
                    <CardContent className="p-3">
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className="mt-0.5 text-sm font-medium text-slate-800">
                        {value}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Keywords */}
              {act.keywords.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Keywords</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2 pt-0">
                    {act.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                      >
                        {kw}
                      </span>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/acts/${eli}/timeline`}
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Clock size={16} className="mr-2" />
                  View Timeline
                </Link>
                <Link
                  href={`/acts/${eli}/diff`}
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <GitCompare size={16} className="mr-2" />
                  Diff Versions
                </Link>
                {act.textHTML && (
                  <a
                    href={`https://api.sejm.gov.pl/eli/acts/${internalEli}/text.html`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                  >
                    <ExternalLink size={16} className="mr-2" />
                    Source Text
                  </a>
                )}
              </div>
            </div>
          )}
        </ErrorBoundary>
      </div>
    </AppLayout>
  );
}
