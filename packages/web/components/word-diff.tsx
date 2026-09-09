// S4-10: Word-level diff highlighting

import type { WordDiffOp } from "@/lib/api";

export function WordDiff({ ops }: { ops: WordDiffOp[] }) {
  return (
    <span>
      {ops.map((op, i) => {
        if (op.type === "equal") {
          return <span key={i}>{op.text}</span>;
        }
        if (op.type === "insert") {
          return (
            <mark
              key={i}
              className="rounded bg-green-200 px-0.5 text-green-900 not-italic"
            >
              {op.text}
            </mark>
          );
        }
        // delete
        return (
          <del
            key={i}
            className="rounded bg-red-200 px-0.5 text-red-900 line-through"
          >
            {op.text}
          </del>
        );
      })}
    </span>
  );
}
