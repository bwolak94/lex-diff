// S5-16: Integration test — subscribe → notify → dedup verification.
// Uses InMemory repos + spy channels; no DATABASE_URL required.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  InMemorySubscriptionRepository,
  InMemoryNotificationLogRepository,
  InMemoryChangeEventRepository,
} from "@lexdiff/db";
import { Notifier } from "../notifier.js";
import type { EmailChannel } from "../channels/email.js";
import type { WebhookChannel } from "../channels/webhook.js";
import type { ChangeEvent } from "@lexdiff/core";

function makeStubEmailChannel(): EmailChannel {
  return { send: vi.fn().mockResolvedValue(undefined) } as unknown as EmailChannel;
}

function makeStubWebhookChannel(): WebhookChannel {
  return { send: vi.fn().mockResolvedValue(undefined) } as unknown as WebhookChannel;
}

const SAMPLE_EVENT: ChangeEvent = {
  type: "UnitAmended",
  eventHash: "hash-abc-123",
  severity: "high",
  effectiveDate: "2024-01-01",
  path: "art=1",
  before: "old text",
  after: "new text",
  wordDiff: [{ type: "equal", text: "text" }],
};

describe("Notifier (S5-16)", () => {
  let subscriptionRepo: InMemorySubscriptionRepository;
  let notificationLogRepo: InMemoryNotificationLogRepository;
  let emailChannel: EmailChannel;
  let webhookChannel: WebhookChannel;
  let notifier: Notifier;

  beforeEach(() => {
    subscriptionRepo = new InMemorySubscriptionRepository();
    notificationLogRepo = new InMemoryNotificationLogRepository();
    emailChannel = makeStubEmailChannel();
    webhookChannel = makeStubWebhookChannel();
    notifier = new Notifier(
      subscriptionRepo,
      notificationLogRepo,
      emailChannel,
      webhookChannel,
    );
  });

  it("sends email when subscriber exists for act", async () => {
    await subscriptionRepo.save({
      actEli: "DU/2024/1",
      email: "user@example.com",
      webhookUrl: null,
    });

    await notifier.notifyForAct("DU/2024/1", [SAMPLE_EVENT]);

    expect(emailChannel.send).toHaveBeenCalledOnce();
    expect(emailChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" }),
    );
  });

  it("does NOT send again on second call (dedup)", async () => {
    await subscriptionRepo.save({
      actEli: "DU/2024/1",
      email: "user@example.com",
      webhookUrl: null,
    });

    await notifier.notifyForAct("DU/2024/1", [SAMPLE_EVENT]);
    await notifier.notifyForAct("DU/2024/1", [SAMPLE_EVENT]);

    expect(emailChannel.send).toHaveBeenCalledOnce();
  });

  it("also sends webhook when webhookUrl is set", async () => {
    await subscriptionRepo.save({
      actEli: "DU/2024/2",
      email: "user@example.com",
      webhookUrl: "https://hooks.example.com/lexdiff",
    });

    await notifier.notifyForAct("DU/2024/2", [SAMPLE_EVENT]);

    expect(emailChannel.send).toHaveBeenCalledOnce();
    expect(webhookChannel.send).toHaveBeenCalledOnce();
    expect(webhookChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({ webhookUrl: "https://hooks.example.com/lexdiff" }),
    );
  });

  it("sends nothing when no subscribers for act", async () => {
    await notifier.notifyForAct("DU/2024/99", [SAMPLE_EVENT]);

    expect(emailChannel.send).not.toHaveBeenCalled();
    expect(webhookChannel.send).not.toHaveBeenCalled();
  });

  it("sends nothing when event list is empty", async () => {
    await subscriptionRepo.save({
      actEli: "DU/2024/1",
      email: "user@example.com",
      webhookUrl: null,
    });

    await notifier.notifyForAct("DU/2024/1", []);

    expect(emailChannel.send).not.toHaveBeenCalled();
  });

  it("dedup is per channel — email dedup does not block webhook", async () => {
    const sub = await subscriptionRepo.save({
      actEli: "DU/2024/3",
      email: "user@example.com",
      webhookUrl: "https://hooks.example.com/lexdiff",
    });

    // Manually mark email as already sent
    await notificationLogRepo.markSent(sub.id, SAMPLE_EVENT.eventHash, "email");

    await notifier.notifyForAct("DU/2024/3", [SAMPLE_EVENT]);

    expect(emailChannel.send).not.toHaveBeenCalled();
    expect(webhookChannel.send).toHaveBeenCalledOnce();
  });
});
