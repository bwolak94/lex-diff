import type { Unit, ChangeEvent } from "./types.js";

/**
 * Replays a list of ChangeEvents onto a Unit[] snapshot, producing a new
 * Unit[] that represents the resulting state.
 *
 * Used in:
 *   - Property tests: apply(old, diff(old, new)) ≈ new
 *   - API diff-view response: reconstruct new state for rendering
 *   - Email templates: show before/after for a subscriber
 *
 * Note: UnitRenumbered only updates the direct unit path; children must
 * be handled by their own events if they moved along with the parent.
 */
export function apply(units: Unit[], events: ChangeEvent[]): Unit[] {
  // Work on a shallow-cloned array of cloned unit objects
  let result: Unit[] = units.map((u) => ({ ...u }));

  for (const event of events) {
    switch (event.type) {
      case "UnitAdded": {
        // Only add if not already present (idempotent)
        if (!result.some((u) => u.path === event.path)) {
          result.push({
            path: event.path,
            kind: "art", // placeholder; kind is unknown from event alone
            number: event.path.split("=").at(-1) ?? "",
            numberSort: "",
            parentPath: event.path.includes("/")
              ? event.path.slice(0, event.path.lastIndexOf("/"))
              : null,
            text: event.text,
            textHash: null,
          });
        }
        break;
      }

      case "UnitRepealed": {
        result = result.filter((u) => u.path !== event.path);
        break;
      }

      case "UnitAmended": {
        const unit = result.find((u) => u.path === event.path);
        if (unit) {
          unit.text = event.after;
          unit.textHash = null; // hash would need re-computation
        }
        break;
      }

      case "UnitRenumbered": {
        const unit = result.find((u) => u.path === event.fromPath);
        if (unit) {
          unit.path = event.toPath;
          unit.parentPath = event.toPath.includes("/")
            ? event.toPath.slice(0, event.toPath.lastIndexOf("/"))
            : null;
        }
        break;
      }

      // These events describe act-level changes, not individual unit mutations
      case "ActRepealed":
      case "ActConsolidated":
      case "EntryIntoForceSet":
        break;
    }
  }

  return result;
}
