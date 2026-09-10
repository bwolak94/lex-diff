"use client";

// Admin: Local acts management + synchronization

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  fetchLocalActs,
  importAct,
  syncLocalAct,
  deleteLocalAct,
} from "@/lib/api";
import type { LocalActSummary } from "@/lib/api";
import { AppLayout } from "@/components/app-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  Trash2,
  Download,
  GitCompare,
  Clock,
  Plus,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

// ── Import form ────────────────────────────────────────────────────────────────

function ImportForm({ onSuccess }: { onSuccess: () => void }) {
  const [eli, setEli] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const mutation = useMutation({
    mutationFn: () => importAct(eli.trim()),
    onSuccess: (data) => {
      setResult({ ok: true, message: `Imported ${data.eli} — ${data.newEvents} new events` });
      setEli("");
      onSuccess();
    },
    onError: (err: Error) => {
      setResult({ ok: false, message: err.message });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Import Act from Sejm</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-500">
          Enter the act ELI identifier (e.g.{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">DU/2024/1</code> or{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">DU:2024:1</code>).
          The act metadata and structural units will be fetched from the Sejm API
          and stored locally for diff and timeline analysis.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. DU/2024/1234"
            value={eli}
            onChange={(e) => {
              setEli(e.target.value);
              setResult(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && eli.trim()) mutation.mutate();
            }}
          />
          <Button
            onClick={() => mutation.mutate()}
            disabled={!eli.trim() || mutation.isPending}
          >
            {mutation.isPending ? (
              <RefreshCw size={16} className="mr-2 animate-spin" />
            ) : (
              <Plus size={16} className="mr-2" />
            )}
            Import
          </Button>
        </div>
        {result && (
          <div
            className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
              result.ok
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {result.ok ? (
              <CheckCircle size={16} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
            )}
            {result.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Act row ────────────────────────────────────────────────────────────────────

function ActRow({ act }: { act: LocalActSummary }) {
  const queryClient = useQueryClient();
  const routeEli = act.eli.replace(/\//g, ":");
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const syncMutation = useMutation({
    mutationFn: () => syncLocalAct(act.eli),
    onSuccess: (data) => {
      setSyncResult(`+${data.newEvents} events`);
      void queryClient.invalidateQueries({ queryKey: ["admin-acts"] });
    },
    onError: (err: Error) => setSyncResult(`Error: ${err.message.slice(0, 60)}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteLocalAct(act.eli),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-acts"] });
    },
  });

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
      <td className="py-3 pr-4">
        <Link
          href={`/acts/${routeEli}`}
          className="font-medium text-slate-800 hover:text-blue-600 line-clamp-1"
        >
          {act.title}
        </Link>
        <p className="font-mono text-xs text-slate-400 mt-0.5">{act.eli}</p>
      </td>
      <td className="py-3 pr-4">
        <Badge variant="outline" className="text-xs">
          {act.type}
        </Badge>
      </td>
      <td className="py-3 pr-4">
        <Badge
          variant={act.inForce ? "success" : "secondary"}
          className="text-xs"
        >
          {act.inForce ? "In force" : "Repealed"}
        </Badge>
      </td>
      <td className="py-3 pr-4 text-sm text-slate-600">
        {act.versionCount > 0 ? (
          <Link
            href={`/acts/${routeEli}/diff`}
            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
          >
            <GitCompare size={13} />
            {act.versionCount}
          </Link>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="py-3 pr-4 text-sm text-slate-600">
        {act.eventCount > 0 ? (
          <Link
            href={`/acts/${routeEli}/timeline`}
            className="inline-flex items-center gap-1 text-emerald-600 hover:underline"
          >
            <Clock size={13} />
            {act.eventCount}
          </Link>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="py-3 pr-4 text-xs text-slate-400">
        {act.changeDate ?? "—"}
      </td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSyncResult(null);
              syncMutation.mutate();
            }}
            disabled={syncMutation.isPending}
            title="Re-sync from Sejm API"
            className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"
          >
            <RefreshCw
              size={15}
              className={syncMutation.isPending ? "animate-spin" : ""}
            />
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete "${act.title}" from local database?`))
                deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
            title="Remove from local database"
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
          >
            <Trash2 size={15} />
          </button>
          {syncResult && (
            <span
              className={`text-xs ${syncResult.startsWith("Error") ? "text-red-500" : "text-emerald-600"}`}
            >
              {syncResult}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Acts table skeleton ────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminSyncPage() {
  const queryClient = useQueryClient();

  const {
    data: acts,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-acts"],
    queryFn: fetchLocalActs,
    staleTime: 30_000,
  });

  const totalVersions = acts?.reduce((s, a) => s + a.versionCount, 0) ?? 0;
  const totalEvents = acts?.reduce((s, a) => s + a.eventCount, 0) ?? 0;

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Local Acts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage acts stored locally for diff and timeline analysis.
          </p>
        </div>

        {/* Summary stats */}
        {acts && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Acts", value: acts.length },
              { label: "Versions", value: totalVersions },
              { label: "Change events", value: totalEvents },
            ].map(({ label, value }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="mt-0.5 text-2xl font-bold text-slate-900">
                    {value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <ErrorBoundary>
          {/* Import form */}
          <ImportForm
            onSuccess={() =>
              void queryClient.invalidateQueries({ queryKey: ["admin-acts"] })
            }
          />

          {/* Acts table */}
          <Card>
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Imported Acts</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void queryClient.invalidateQueries({
                      queryKey: ["admin-acts"],
                    })
                  }
                >
                  <RefreshCw size={14} className="mr-1" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {isLoading && <TableSkeleton />}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {(error as Error).message}
                </div>
              )}
              {acts && acts.length === 0 && (
                <div className="py-8 text-center">
                  <Download
                    size={32}
                    className="mx-auto mb-3 text-slate-300"
                  />
                  <p className="text-sm text-slate-500">
                    No acts imported yet. Use the form above to import an act
                    from the Sejm API.
                  </p>
                </div>
              )}
              {acts && acts.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wider text-slate-400">
                        <th className="pb-2 pr-4 text-left">Act</th>
                        <th className="pb-2 pr-4 text-left">Type</th>
                        <th className="pb-2 pr-4 text-left">Status</th>
                        <th className="pb-2 pr-4 text-left">Versions</th>
                        <th className="pb-2 pr-4 text-left">Events</th>
                        <th className="pb-2 pr-4 text-left">Changed</th>
                        <th className="pb-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acts.map((act) => (
                        <ActRow key={act.eli} act={act} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </ErrorBoundary>
      </div>
    </AppLayout>
  );
}
