// S4-10: Word-level diff highlighting
// S6-12: Color-blind safe — underline + strikethrough in addition to color
// S6-13: Memoized to avoid re-rendering on parent state changes

import { memo } from "react";
import type { WordDiffOp } from "@/lib/api";

interface WordDiffProps {
  ops: WordDiffOp[];
}

function WordDiffInner({ ops }: WordDiffProps) {
  return (
    <span>
      {ops.map((op, i) => {
        if (op.type === "equal") {
          return <span key={i}>{op.text}</span>;
        }
        if (op.type === "insert") {
          return (
            <ins
              key={i}
              aria-label={`inserted: ${op.text}`}
              className="rounded bg-green-200 px-0.5 text-green-900 underline decoration-green-700 decoration-2 not-italic"
            >
              {op.text}
            </ins>
          );
        }
        // delete — strikethrough + background (color-blind safe: not color alone)
        return (
          <del
            key={i}
            aria-label={`deleted: ${op.text}`}
            className="rounded bg-red-200 px-0.5 text-red-900 line-through decoration-red-700 decoration-2"
          >
            {op.text}
          </del>
        );
      })}
    </span>
  );
}

// S6-13: Memoize — ops array identity triggers re-render only when content changes
export const WordDiff = memo(WordDiffInner);
