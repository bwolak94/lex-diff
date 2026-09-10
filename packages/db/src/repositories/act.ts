import { eq, ilike, and, sql, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { ActMetadata } from "@lexdiff/core";
import type { ActRepository } from "@lexdiff/core";
import { acts, actVersions, units, changeEvents } from "../schema/index.js";
import type * as schema from "../schema/index.js";

type DB = NodePgDatabase<typeof schema>;

type ActRow = typeof acts.$inferSelect;

function rowToMeta(row: ActRow): ActMetadata {
  return {
    eli: row.eli,
    publisher: row.publisher,
    year: row.year,
    position: row.position,
    title: row.title,
    type: row.type,
    status: row.status,
    inForce: row.inForce,
    announcementDate: row.announcementDate ?? null,
    entryIntoForce: row.entryIntoForce ?? null,
    repealDate: row.repealDate ?? null,
    changeDate: row.changeDate ?? null,
    textHTML: row.textHtml,
    keywords: row.keywords,
  };
}

export class DrizzleActRepository implements ActRepository {
  constructor(private readonly db: DB) {}

  async findByEli(eli: string): Promise<ActMetadata | null> {
    const [row] = await this.db
      .select()
      .from(acts)
      .where(eq(acts.eli, eli))
      .limit(1);
    return row ? rowToMeta(row) : null;
  }

  async listVersionElis(eli: string): Promise<string[]> {
    const rows = await this.db
      .select({ eli: actVersions.eli })
      .from(actVersions)
      .where(eq(actVersions.actEli, eli));
    return rows.map((r) => r.eli);
  }

  async save(meta: ActMetadata): Promise<void> {
    await this.db
      .insert(acts)
      .values({
        eli: meta.eli,
        publisher: meta.publisher,
        year: meta.year,
        position: meta.position,
        title: meta.title,
        type: meta.type,
        status: meta.status,
        inForce: meta.inForce,
        announcementDate: meta.announcementDate,
        entryIntoForce: meta.entryIntoForce,
        repealDate: meta.repealDate,
        changeDate: meta.changeDate,
        textHtml: meta.textHTML,
        keywords: meta.keywords,
      })
      .onConflictDoUpdate({
        target: acts.eli,
        set: {
          title: meta.title,
          status: meta.status,
          inForce: meta.inForce,
          changeDate: meta.changeDate,
          textHtml: meta.textHTML,
          keywords: meta.keywords,
        },
      });
  }

  async deleteByEli(eli: string): Promise<void> {
    const versions = await this.db
      .select({ eli: actVersions.eli })
      .from(actVersions)
      .where(eq(actVersions.actEli, eli));
    const versionElis = versions.map((v) => v.eli);
    if (versionElis.length > 0) {
      await this.db.delete(units).where(inArray(units.actVersionEli, versionElis));
    }
    await this.db.delete(changeEvents).where(eq(changeEvents.actEli, eli));
    await this.db.delete(actVersions).where(eq(actVersions.actEli, eli));
    await this.db.delete(acts).where(eq(acts.eli, eli));
  }

  async search(q: {
    q?: string;
    keyword?: string;
    type?: string;
  }): Promise<ActMetadata[]> {
    const conditions = [];

    if (q.q) {
      conditions.push(ilike(acts.title, `%${q.q}%`));
    }
    if (q.keyword) {
      conditions.push(
        sql`${q.keyword} = ANY(${acts.keywords})`,
      );
    }
    if (q.type) {
      conditions.push(eq(acts.type, q.type));
    }

    const rows =
      conditions.length > 0
        ? await this.db
            .select()
            .from(acts)
            .where(and(...conditions))
        : await this.db.select().from(acts);

    return rows.map(rowToMeta);
  }
}
