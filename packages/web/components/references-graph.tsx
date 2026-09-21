"use client";

/**
 * B-2: References graph — SVG visualization of act cross-references.
 *
 * Layout:
 *   Left column  — acts that reference this act (incoming)
 *   Center node  — current act
 *   Right column — acts this act references (outgoing)
 *
 * Arrows point in the direction of the reference:
 *   incoming source → center (arrow points right toward center)
 *   center → outgoing target (arrow points right toward target)
 */

import type { ActReference } from "@/lib/api";

const TYPE_COLOR: Record<string, string> = {
  amends: "#3b82f6",
  repeals: "#ef4444",
  implements: "#8b5cf6",
  extends: "#f59e0b",
};

const TYPE_LABEL: Record<string, string> = {
  amends: "amends",
  repeals: "repeals",
  implements: "implements",
  extends: "extends",
};

const NODE_W = 160;
const NODE_H = 36;
const NODE_RX = 6;
const COL_GAP = 200;
const ROW_GAP = 56;
const PADDING = 24;

interface NodeData {
  id: string;
  label: string;
  x: number;
  y: number;
}

interface EdgeData {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  label: string;
  refType: string;
}

function shortEli(eli: string): string {
  // "DU/2017/2196" → "DU/2017/2196" (keep as-is, truncate only if very long)
  return eli.length > 20 ? `…${eli.slice(-17)}` : eli;
}

interface Props {
  currentEli: string;
  outgoing: ActReference[];
  incoming: ActReference[];
}

export function ReferencesGraph({ currentEli, outgoing, incoming }: Props) {
  const maxSide = Math.max(outgoing.length, incoming.length, 1);
  const height = Math.max(maxSide * ROW_GAP + PADDING * 2, NODE_H + PADDING * 2);
  const centerY = height / 2;

  // Column X positions
  const incomingX = PADDING;
  const centerX = PADDING + NODE_W + COL_GAP;
  const outgoingX = centerX + NODE_W + COL_GAP;
  const totalWidth = outgoingX + NODE_W + PADDING;

  // Build node positions
  function columnNodes(elis: string[], x: number): NodeData[] {
    return elis.map((eli, i) => {
      const total = elis.length;
      const startY = centerY - ((total - 1) * ROW_GAP) / 2;
      return { id: eli, label: shortEli(eli), x, y: startY + i * ROW_GAP };
    });
  }

  const incomingNodes = columnNodes(incoming.map((r) => r.sourceEli), incomingX);
  const outgoingNodes = columnNodes(outgoing.map((r) => r.targetEli), outgoingX);

  const centerNode: NodeData = {
    id: currentEli,
    label: shortEli(currentEli),
    x: centerX,
    y: centerY - NODE_H / 2,
  };

  // Build edges
  const edges: EdgeData[] = [];

  incomingNodes.forEach((node, i) => {
    const ref = incoming[i]!;
    const color = TYPE_COLOR[ref.referenceType] ?? "#64748b";
    edges.push({
      x1: node.x + NODE_W,
      y1: node.y + NODE_H / 2,
      x2: centerX,
      y2: centerY,
      color,
      label: TYPE_LABEL[ref.referenceType] ?? ref.referenceType,
      refType: ref.referenceType,
    });
  });

  outgoingNodes.forEach((node, i) => {
    const ref = outgoing[i]!;
    const color = TYPE_COLOR[ref.referenceType] ?? "#64748b";
    edges.push({
      x1: centerX + NODE_W,
      y1: centerY,
      x2: node.x,
      y2: node.y + NODE_H / 2,
      color,
      label: TYPE_LABEL[ref.referenceType] ?? ref.referenceType,
      refType: ref.referenceType,
    });
  });

  function NodeRect({ node, isCurrent }: { node: NodeData; isCurrent?: boolean }) {
    const href = isCurrent
      ? undefined
      : `/acts/${encodeURIComponent(node.id.replace(/\//g, ":"))}`;

    const rect = (
      <rect
        x={node.x}
        y={node.y}
        width={NODE_W}
        height={NODE_H}
        rx={NODE_RX}
        fill={isCurrent ? "#1e40af" : "#f8fafc"}
        stroke={isCurrent ? "#1e40af" : "#cbd5e1"}
        strokeWidth={isCurrent ? 0 : 1}
      />
    );

    const text = (
      <text
        x={node.x + NODE_W / 2}
        y={node.y + NODE_H / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontFamily="monospace"
        fill={isCurrent ? "#ffffff" : "#334155"}
      >
        {node.label}
      </text>
    );

    if (href) {
      return (
        <a href={href}>
          {rect}
          {text}
        </a>
      );
    }
    return (
      <>
        {rect}
        {text}
      </>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-2">
      <svg
        width={totalWidth}
        height={height}
        viewBox={`0 0 ${totalWidth} ${height}`}
        role="img"
        aria-label="References graph"
      >
        <defs>
          {Object.entries(TYPE_COLOR).map(([type, color]) => (
            <marker
              key={type}
              id={`arrow-${type}`}
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" fill={color} />
            </marker>
          ))}
          <marker
            id="arrow-default"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill="#64748b" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const mx = (edge.x1 + edge.x2) / 2;
          const my = (edge.y1 + edge.y2) / 2;
          const markerId = TYPE_COLOR[edge.refType] ? `arrow-${edge.refType}` : "arrow-default";
          return (
            <g key={i}>
              <line
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke={edge.color}
                strokeWidth={1.5}
                strokeOpacity={0.7}
                markerEnd={`url(#${markerId})`}
              />
              <text
                x={mx}
                y={my - 6}
                textAnchor="middle"
                fontSize={9}
                fill={edge.color}
                fontFamily="sans-serif"
              >
                {edge.label}
              </text>
            </g>
          );
        })}

        {/* Incoming nodes */}
        {incomingNodes.map((node) => (
          <NodeRect key={node.id} node={node} />
        ))}

        {/* Center node */}
        <NodeRect node={{ ...centerNode, y: centerY - NODE_H / 2 }} isCurrent />

        {/* Outgoing nodes */}
        {outgoingNodes.map((node) => (
          <NodeRect key={node.id} node={node} />
        ))}

        {/* Column labels */}
        {incoming.length > 0 && (
          <text
            x={incomingX + NODE_W / 2}
            y={PADDING / 2}
            textAnchor="middle"
            fontSize={9}
            fill="#94a3b8"
            fontFamily="sans-serif"
          >
            referenced by
          </text>
        )}
        {outgoing.length > 0 && (
          <text
            x={outgoingX + NODE_W / 2}
            y={PADDING / 2}
            textAnchor="middle"
            fontSize={9}
            fill="#94a3b8"
            fontFamily="sans-serif"
          >
            references
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-2 pb-1">
        {Object.entries(TYPE_COLOR).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1 text-xs text-slate-500">
            <span
              className="inline-block h-2 w-4 rounded-sm"
              style={{ backgroundColor: color }}
            />
            {TYPE_LABEL[type]}
          </span>
        ))}
      </div>
    </div>
  );
}
