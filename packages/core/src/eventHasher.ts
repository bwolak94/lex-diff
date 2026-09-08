import { createHash } from "node:crypto";

/**
 * S2-6 — EventHasher
 * Produces a canonical, deterministic SHA-256 hash for a change event.
 * Used as the `eventHash` field for idempotent deduplication:
 * the same logical event always produces the same hash, so inserting
 * it twice (e.g. after a scheduler re-run) is a no-op.
 */
export class EventHasher {
  /**
   * Returns a 64-char hex SHA-256 of a stable JSON representation of
   * { actEli, type, ...payload }.  Keys are sorted to guarantee stability.
   */
  hash(
    actEli: string,
    type: string,
    payload: Record<string, string>,
  ): string {
    const obj: Record<string, string> = { actEli, type, ...payload };
    const canonical = stableStringify(obj);
    return createHash("sha256").update(canonical).digest("hex");
  }
}

/** JSON.stringify with sorted keys — ensures stable output regardless of insertion order */
function stableStringify(
  value: string | number | boolean | null | Record<string, string>,
): string {
  if (typeof value !== "object" || value === null) return JSON.stringify(value);
  const keys = Object.keys(value).sort();
  const pairs = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify(value[k] as string)}`,
  );
  return `{${pairs.join(",")}}`;
}
