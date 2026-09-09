// S5-2: Job scheduler — enqueues and processes refresh-act jobs via pg-boss.
import type PgBoss from "pg-boss";
import type {
  SubscriptionRepository,
  ChangeEventRepository,
  JobCursorRepository,
} from "@lexdiff/core";
import type { Notifier } from "../notifier.js";

const QUEUE_REFRESH_ACT = "refresh-act";

interface RefreshActPayload {
  actEli: string;
}

export interface SchedulerRepos {
  subscriptions: SubscriptionRepository;
  changeEvents: ChangeEventRepository;
  jobCursors: JobCursorRepository;
}

export class Scheduler {
  constructor(
    private readonly boss: PgBoss,
    private readonly repos: SchedulerRepos,
    private readonly notifier: Notifier,
  ) {}

  /** Register pg-boss workers. Call once at server startup. */
  async start(): Promise<void> {
    await this.boss.work<RefreshActPayload>(
      QUEUE_REFRESH_ACT,
      async (jobs) => {
        for (const job of jobs) {
          await this._processRefreshAct(job.data);
        }
      },
    );
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

  /** Notify subscribers of all stored change events for an act. */
  private async _processRefreshAct(data: RefreshActPayload): Promise<void> {
    const events = await this.repos.changeEvents.findByActEli(data.actEli);
    if (events.length > 0) {
      await this.notifier.notifyForAct(data.actEli, events);
    }
  }
}
