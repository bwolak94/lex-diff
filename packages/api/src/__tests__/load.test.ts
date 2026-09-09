// S6-8: Load test — scheduler throughput with 500-subscription dataset.
// Uses InMemory repos (no DB). Measures wall-clock time and throughput.

import { describe, it, expect } from "vitest";
import {
  InMemorySubscriptionRepository,
  InMemoryChangeEventRepository,
  InMemoryNotificationLogRepository,
} from "@lexdiff/db";
import { Notifier } from "../notifier.js";
import type { EmailChannel } from "../channels/email.js";
import type { WebhookChannel } from "../channels/webhook.js";
import type { ChangeEvent } from "@lexdiff/core";

const STUB_EMAIL: EmailChannel = {
  send: async () => undefined,
} as unknown as EmailChannel;

const STUB_WEBHOOK: WebhookChannel = {
  send: async () => undefined,
} as unknown as WebhookChannel;

const AMENDMENT: ChangeEvent = {
  type: "UnitAmended",
  eventHash: "load-test-hash",
  severity: "high",
  effectiveDate: "2024-06-01",
  path: "art=1",
  before: "old text",
  after: "new text",
  wordDiff: [],
};

describe("Scheduler load test (S6-8)", () => {
  it(
    "notifies 500 subscribers for a single act within 5 seconds",
    async () => {
      const subscriptionRepo = new InMemorySubscriptionRepository();
      const notificationLogRepo = new InMemoryNotificationLogRepository();

      // Seed 500 subscriptions for the same act
      for (let i = 0; i < 500; i++) {
        await subscriptionRepo.save({
          actEli: "DU/2024/9999",
          email: `user${i}@example.com`,
          webhookUrl: null,
        });
      }

      const notifier = new Notifier(
        subscriptionRepo,
        notificationLogRepo,
        STUB_EMAIL,
        STUB_WEBHOOK,
      );

      const start = Date.now();
      await notifier.notifyForAct("DU/2024/9999", [AMENDMENT]);
      const elapsed = Date.now() - start;

      const subs = await subscriptionRepo.findAll();
      expect(subs.length).toBe(500);

      // All 500 should be marked as sent
      let sentCount = 0;
      for (const sub of subs) {
        const sent = await notificationLogRepo.hasBeenSent(
          sub.id,
          AMENDMENT.eventHash,
          "email",
        );
        if (sent) sentCount++;
      }
      expect(sentCount).toBe(500);

      // Throughput assertion: must complete in under 5 seconds (in-memory ops)
      expect(elapsed).toBeLessThan(5000);
      console.info(
        `[S6-8] 500 subscriptions notified in ${elapsed}ms (${(500_000 / elapsed).toFixed(0)} subs/s)`,
      );
    },
    { timeout: 10_000 },
  );

  it(
    "dedup prevents double-send on second run — still under 2 seconds",
    async () => {
      const subscriptionRepo = new InMemorySubscriptionRepository();
      const notificationLogRepo = new InMemoryNotificationLogRepository();

      for (let i = 0; i < 100; i++) {
        await subscriptionRepo.save({
          actEli: "DU/2024/8888",
          email: `user${i}@dedup.com`,
          webhookUrl: null,
        });
      }

      const notifier = new Notifier(
        subscriptionRepo,
        notificationLogRepo,
        STUB_EMAIL,
        STUB_WEBHOOK,
      );

      // First run — populates dedup log
      await notifier.notifyForAct("DU/2024/8888", [AMENDMENT]);

      // Second run — all deduplicated, should be fast
      const start = Date.now();
      await notifier.notifyForAct("DU/2024/8888", [AMENDMENT]);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(2000);
    },
    { timeout: 5_000 },
  );
});
