// B-2: References page — shows outgoing and incoming act references.

import { fetchReferences } from "../../../../lib/api.js";
import type { ActReference } from "../../../../lib/api.js";

interface Props {
  params: Promise<{ eli: string }>;
}

const LABEL: Record<string, string> = {
  amends: "Amends",
  repeals: "Repeals",
  implements: "Implements",
  extends: "Extends",
};

function ReferenceRow({ ref: r }: { ref: ActReference }) {
  const label = LABEL[r.referenceType] ?? r.referenceType;
  return (
    <li className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0 text-sm">
      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-xs">
        {label}
      </span>
      <a
        href={`/acts/${encodeURIComponent(r.targetEli.replace(/\//g, ":"))}`}
        className="text-blue-600 hover:underline font-mono"
      >
        {r.targetEli}
      </a>
    </li>
  );
}

function IncomingRow({ ref: r }: { ref: ActReference }) {
  const label = LABEL[r.referenceType] ?? r.referenceType;
  return (
    <li className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0 text-sm">
      <a
        href={`/acts/${encodeURIComponent(r.sourceEli.replace(/\//g, ":"))}`}
        className="text-blue-600 hover:underline font-mono"
      >
        {r.sourceEli}
      </a>
      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-xs">
        {label}
      </span>
      <span className="text-slate-400">this act</span>
    </li>
  );
}

export default async function ReferencesPage({ params }: Props) {
  const { eli } = await params;
  const { outgoing, incoming } = await fetchReferences(eli);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">References</h1>
        <p className="text-slate-500 text-sm mt-1 font-mono">{eli.replace(/:/g, "/")}</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Outgoing ({outgoing.length})</h2>
        {outgoing.length === 0 ? (
          <p className="text-slate-400 text-sm">No outgoing references.</p>
        ) : (
          <ul className="border border-slate-200 rounded divide-y divide-slate-100">
            {outgoing.map((r) => (
              <ReferenceRow key={r.id} ref={r} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Incoming ({incoming.length})</h2>
        {incoming.length === 0 ? (
          <p className="text-slate-400 text-sm">No incoming references.</p>
        ) : (
          <ul className="border border-slate-200 rounded divide-y divide-slate-100">
            {incoming.map((r) => (
              <IncomingRow key={r.id} ref={r} />
            ))}
          </ul>
        )}
      </section>

      <a
        href={`/acts/${eli}`}
        className="inline-block text-sm text-blue-600 hover:underline"
      >
        ← Back to act
      </a>
    </main>
  );
}
