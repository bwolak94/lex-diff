// S5-2: Job scheduler — enqueues and processes refresh-act and sync-act jobs
// via pg-boss. Also registers an hourly cron to poll changed acts from the ELI API.

import type PgBoss from "pg-boss";
import type {
  SubscriptionRepository,
  ChangeEventRepository,
  JobCursorRepository,
  ActRepository,
} from "@lexdiff/core";
import { EliClient } from "@lexdiff/core";
import type { Notifier } from "../notifier.js";
import type { ActSyncService } from "../syncService.js";

const QUEUE_REFRESH_ACT = "refresh-act";
const QUEUE_SYNC_ACT = "sync-act";
const QUEUE_POLL_CHANGES = "poll-changed-acts";
// Run poll every hour at minute 0
const CRON_HOURLY = "0 * * * *";

interface RefreshActPayload {
  actEli: string;
}

interface SyncActPayload {
  actEli: string;
}

export interface SchedulerRepos {
  subscriptions: SubscriptionRepository;
  changeEvents: ChangeEventRepository;
  jobCursors: JobCursorRepository;
  acts: ActRepository;
}

export class Scheduler {
  private readonly eliClient = new EliClient();

  constructor(
    private readonly boss: PgBoss,
    private readonly repos: SchedulerRepos,
    private readonly notifier: Notifier,
    private readonly syncService: ActSyncService,
  ) {}

  /** Register pg-boss workers and cron schedule. Call once at server startup. */
  async start(): Promise<void> {
    // Worker: notify subscribers about stored change events
    await this.boss.work<RefreshActPayload>(
      QUEUE_REFRESH_ACT,
      async (jobs) => {
        for (const job of jobs) {
          await this._processRefreshAct(job.data);
        }
      },
    );

    // Worker: sync a single act (fetch + parse + diff + save)
    await this.boss.work<SyncActPayload>(QUEUE_SYNC_ACT, async (jobs) => {
      for (const job of jobs) {
        try {
          await this.syncService.syncAct(job.data.actEli);
        } catch (err) {
          console.error(`[sync-act] ${job.data.actEli}: ${String(err)}`);
        }
      }
    });

    // Worker: poll ELI API for changed acts and enqueue sync jobs
    await this.boss.work(QUEUE_POLL_CHANGES, async () => {
      await this._pollChangedActs();
    });

    // Register hourly cron schedule (idempotent — pg-boss skips if exists)
    await this.boss.schedule(QUEUE_POLL_CHANGES, CRON_HOURLY);
  }

  /** Enqueue one refresh-act job per unique subscribed actEli (S5-2). */
  async enqueueRefreshChanges(): Promise<void> {
    const subs = await this.repos.subscriptions.findAll();
    const uniqueElis = [...new Set(subs.map((s) => s.actEli))];
    for (const actEli of uniqueElis) {
      await this.boss.send(
        QUEUE_REFRESH_ACT,
        { actEli },
        { singletonKey: actEli },
      );
    }
  }

  /** Immediately trigger a sync for every act currently in the DB. */
  async enqueueAllActsSync(): Promise<void> {
    const acts = await this.repos.acts.search({});
    for (const act of acts) {
      await this.boss.send(
        QUEUE_SYNC_ACT,
        { actEli: act.eli },
        { singletonKey: act.eli },
      );
    }
  }

  // ── Private workers ─────────────────────────────────────────────────────────

  private async _processRefreshAct(data: RefreshActPayload): Promise<void> {
    const events = await this.repos.changeEvents.findByActEli(data.actEli);
    if (events.length > 0) {
      await this.notifier.notifyForAct(data.actEli, events);
    }
  }

  private async _pollChangedActs(): Promise<void> {
    const cursor = await this.repos.jobCursors.getCursor("poll-changed-acts");
    // Default: look back 30 days on first run
    const since =
      cursor ??
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const { items } = await this.eliClient.getChangedActs(since);

      for (const changed of items) {
        // Only sync acts already in our DB — don't auto-import new ones
        const existing = await this.repos.acts.findByEli(changed.eli);
        if (existing) {
          await this.boss.send(
            QUEUE_SYNC_ACT,
            { actEli: changed.eli },
            { singletonKey: changed.eli },
          );
        }
      }
    } catch (err) {
      console.error(`[poll-changed-acts] ELI API error: ${String(err)}`);
    }

    await this.repos.jobCursors.setCursor(
      "poll-changed-acts",
      new Date().toISOString(),
    );
  }
}
