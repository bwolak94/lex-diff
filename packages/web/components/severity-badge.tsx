// S4-11: Severity badge + event-type badge

import { Badge } from "@/components/ui/badge";
import type { Severity, EventType } from "@/lib/api";

// ── Severity badge ────────────────────────────────────────────────────────────

const severityConfig: Record<
  Severity,
  { label: string; variant: "destructive" | "warning" | "info" | "secondary" }
> = {
  critical: { label: "Critical", variant: "destructive" },
  high: { label: "High", variant: "warning" },
  medium: { label: "Medium", variant: "info" },
  low: { label: "Low", variant: "secondary" },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { label, variant } = severityConfig[severity];
  return <Badge variant={variant}>{label}</Badge>;
}

// ── Event-type badge ──────────────────────────────────────────────────────────

const eventConfig: Record<
  EventType,
  { label: string; variant: "success" | "destructive" | "warning" | "info" | "outline" | "secondary" }
> = {
  UnitAdded: { label: "Added", variant: "success" },
  UnitRepealed: { label: "Repealed", variant: "destructive" },
  UnitAmended: { label: "Amended", variant: "warning" },
  UnitRenumbered: { label: "Renumbered", variant: "info" },
  ActConsolidated: { label: "Consolidated", variant: "outline" },
  ActRepealed: { label: "Act Repealed", variant: "destructive" },
  EntryIntoForceSet: { label: "Entry into Force", variant: "secondary" },
};

export function EventTypeBadge({ type }: { type: EventType }) {
  const { label, variant } = eventConfig[type] ?? {
    label: type,
    variant: "outline" as const,
  };
  return <Badge variant={variant}>{label}</Badge>;
}
