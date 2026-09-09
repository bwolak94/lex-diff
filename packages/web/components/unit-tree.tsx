"use client";

// S4-8: Unit navigation tree — extracted from timeline events

import type { ChangeEvent } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDiffStore } from "@/lib/store";

interface TreeNode {
  path: string;
  kind: string;
  children: TreeNode[];
  hasEvent: boolean;
}

function buildTree(paths: string[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();

  for (const path of paths) {
    const segments = path.split("/");
    let current = "";
    for (const seg of segments) {
      const parent = current;
      current = current ? `${current}/${seg}` : seg;
      if (!nodeMap.has(current)) {
        const kind = seg.split("=")[0] ?? seg;
        nodeMap.set(current, {
          path: current,
          kind,
          children: [],
          hasEvent: paths.includes(current),
        });
        if (parent) {
          nodeMap.get(parent)?.children.push(nodeMap.get(current)!);
        }
      }
    }
  }

  // Top-level nodes are those without a parent
  return Array.from(nodeMap.values()).filter((n) => !n.path.includes("/"));
}

function TreeNodeItem({
  node,
  depth = 0,
}: {
  node: TreeNode;
  depth?: number;
}) {
  const { focusedUnitPath, setFocusedUnitPath } = useDiffStore();
  const isFocused = focusedUnitPath === node.path;

  return (
    <div>
      <button
        onClick={() => setFocusedUnitPath(isFocused ? null : node.path)}
        className={cn(
          "w-full rounded px-2 py-1 text-left text-xs transition-colors",
          "hover:bg-slate-100",
          isFocused && "bg-blue-100 text-blue-800 font-medium",
          !isFocused && node.hasEvent && "text-amber-700",
          !isFocused && !node.hasEvent && "text-slate-600",
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <span className="font-mono">{node.path.split("/").at(-1)}</span>
      </button>
      {node.children.map((child) => (
        <TreeNodeItem key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

interface UnitTreeProps {
  events: ChangeEvent[];
}

export function UnitTree({ events }: UnitTreeProps) {
  const paths = Array.from(
    new Set(
      events.flatMap((ev) => {
        const p: string[] = [];
        if (ev.path) p.push(ev.path);
        if (ev.fromPath) p.push(ev.fromPath);
        if (ev.toPath) p.push(ev.toPath);
        if (ev.unitPath) p.push(ev.unitPath);
        return p;
      }),
    ),
  ).sort();

  const tree = buildTree(paths);

  if (tree.length === 0) {
    return (
      <p className="px-2 text-xs text-slate-400">No unit paths in events.</p>
    );
  }

  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <TreeNodeItem key={node.path} node={node} />
      ))}
    </div>
  );
}
