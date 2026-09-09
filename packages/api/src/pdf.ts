// B-3: PDF export — renders an act's change timeline as a downloadable PDF.
// Uses pdfkit (no headless browser needed).

import PDFDocument from "pdfkit";
import type { ChangeEvent } from "@lexdiff/core";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#ca8a04",
  low: "#16a34a",
};

const EVENT_LABELS: Partial<Record<string, string>> = {
  UnitAdded: "Added",
  UnitRepealed: "Repealed",
  UnitAmended: "Amended",
  UnitRenumbered: "Renumbered",
  ActRepealed: "Act Repealed",
  ActConsolidated: "Consolidated",
  EntryIntoForceSet: "Entry into Force",
};

/**
 * Generate a PDF buffer for the given act's change timeline.
 */
export function generateTimelinePdf(
  actEli: string,
  events: ChangeEvent[],
): Buffer {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // ── Header ────────────────────────────────────────────────────────────────
  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .text("LexDiff — Change Timeline", { align: "center" });

  doc
    .fontSize(11)
    .font("Helvetica")
    .fillColor("#64748b")
    .text(`Act: ${actEli}`, { align: "center" })
    .text(`Generated: ${new Date().toISOString().slice(0, 10)}`, {
      align: "center",
    });

  doc.moveDown(1.5);

  // ── Event list ────────────────────────────────────────────────────────────
  if (events.length === 0) {
    doc.fontSize(11).fillColor("#94a3b8").text("No changes recorded.", {
      align: "center",
    });
  }

  for (const ev of events) {
    const color = SEVERITY_COLORS[ev.severity] ?? "#334155";
    const label = EVENT_LABELS[ev.type] ?? ev.type;

    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor(color)
      .text(`${label}`, { continued: true })
      .font("Helvetica")
      .fillColor("#334155")
      .text(`  ${ev.effectiveDate ?? "date unknown"}`);

    // Per-type detail line
    if (ev.type === "UnitAmended" || ev.type === "UnitAdded" || ev.type === "UnitRepealed") {
      doc.fontSize(9).fillColor("#64748b").text(`  Path: ${ev.path}`);
    } else if (ev.type === "UnitRenumbered") {
      doc
        .fontSize(9)
        .fillColor("#64748b")
        .text(`  ${ev.fromPath} → ${ev.toPath}`);
    } else if (ev.type === "ActConsolidated") {
      doc.fontSize(9).fillColor("#64748b").text(`  Consolidated: ${ev.tjEli}`);
    }

    doc
      .fontSize(8)
      .fillColor("#94a3b8")
      .text(`  Hash: ${ev.eventHash.slice(0, 16)}…`)
      .moveDown(0.6);

    // Page break guard
    if (doc.y > 750) doc.addPage();
  }

  doc.end();
  return Buffer.concat(chunks);
}
