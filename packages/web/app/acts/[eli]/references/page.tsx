// B-2: References page — graph + list of outgoing and incoming act references.

import { fetchReferences } from "@/lib/api";
import type { ActReference } from "@/lib/api";
import { ReferencesGraph } from "@/components/references-graph";
import { AppLayout } from "@/components/app-layout";

interface Props {
  params: Promise<{ eli: string }>;
}

const LABEL: Record<string, string> = {
  amends: "Amends",
  repeals: "Repeals",
  implements: "Implements",
  extends: "Extends",
};

const TYPE_DOT: Record<string, string> = {
  amends: "bg-blue-500",
  repeals: "bg-red-500",
  implements: "bg-violet-500",
  extends: "bg-amber-500",
};

function ReferenceRow({ ref: r }: { ref: ActReference }) {
  const label = LABEL[r.referenceType] ?? r.referenceType;
  const dot = TYPE_DOT[r.referenceType] ?? "bg-slate-400";
  return (
    <li className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0 text-sm">
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="text-slate-500 text-xs w-20 shrink-0">{label}</span>
      <a
        href={`/acts/${encodeURIComponent(r.targetEli.replace(/\//g, ":"))}`}
        className="text-blue-600 hover:underline font-mono text-xs"
      >
        {r.targetEli}
      </a>
    </li>
  );
}

function IncomingRow({ ref: r }: { ref: ActReference }) {
  const label = LABEL[r.referenceType] ?? r.referenceType;
  const dot = TYPE_DOT[r.referenceType] ?? "bg-slate-400";
  return (
    <li className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0 text-sm">
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <a
        href={`/acts/${encodeURIComponent(r.sourceEli.replace(/\//g, ":"))}`}
        className="text-blue-600 hover:underline font-mono text-xs"
      >
        {r.sourceEli}
      </a>
      <span className="text-slate-400 text-xs ml-auto shrink-0">{label} this act</span>
    </li>
  );
}

export default async function ReferencesPage({ params }: Props) {
  const { eli } = await params;
  const internalEli = eli.replace(/:/g, "/");
  const { outgoing, incoming } = await fetchReferences(eli);
  const hasAny = outgoing.length > 0 || incoming.length > 0;

  return (
    <AppLayout eli={eli}>
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">References</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">{internalEli}</p>
        </div>

        {/* Graph visualization */}
        {hasAny ? (
          <ReferencesGraph
            currentEli={internalEli}
            outgoing={outgoing}
            incoming={incoming}
          />
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
            No references recorded for this act.
          </p>
        )}

        {/* Detailed lists */}
        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Outgoing ({outgoing.length})
            </h2>
            {outgoing.length === 0 ? (
              <p className="text-xs text-slate-400">No outgoing references.</p>
            ) : (
              <ul className="rounded-lg border border-slate-200 divide-y divide-slate-100 px-3">
                {outgoing.map((r) => (
                  <ReferenceRow key={r.id} ref={r} />
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Incoming ({incoming.length})
            </h2>
            {incoming.length === 0 ? (
              <p className="text-xs text-slate-400">No incoming references.</p>
            ) : (
              <ul className="rounded-lg border border-slate-200 divide-y divide-slate-100 px-3">
                {incoming.map((r) => (
                  <IncomingRow key={r.id} ref={r} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
