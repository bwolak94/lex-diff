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

// ── B-1: Keyword + publisher subscriber fan-out ───────────────────────────────

describe("Notifier B-1 — keyword + publisher fan-out", () => {
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

  it("notifies keyword subscriber when act has matching keyword", async () => {
    await subscriptionRepo.save({
      subscriptionType: "keyword",
      keyword: "prawo cywilne",
      email: "kw@example.com",
      webhookUrl: null,
    });

    await notifier.notifyForAct(
      "DU/2024/1",
      [SAMPLE_EVENT],
      { publisher: "DU", keywords: ["prawo cywilne", "umowy"] },
    );

    expect(emailChannel.send).toHaveBeenCalledOnce();
    expect(emailChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "kw@example.com" }),
    );
  });

  it("notifies publisher subscriber when act publisher matches", async () => {
    await subscriptionRepo.save({
      subscriptionType: "publisher",
      publisherFilter: "DU",
      email: "pub@example.com",
      webhookUrl: null,
    });

    await notifier.notifyForAct(
      "DU/2024/1",
      [SAMPLE_EVENT],
      { publisher: "DU", keywords: [] },
    );

    expect(emailChannel.send).toHaveBeenCalledOnce();
    expect(emailChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "pub@example.com" }),
    );
  });

  it("does NOT notify publisher subscriber when publisher does not match", async () => {
    await subscriptionRepo.save({
      subscriptionType: "publisher",
      publisherFilter: "MP",
      email: "pub@example.com",
      webhookUrl: null,
    });

    await notifier.notifyForAct(
      "DU/2024/1",
      [SAMPLE_EVENT],
      { publisher: "DU", keywords: [] },
    );

    expect(emailChannel.send).not.toHaveBeenCalled();
  });

  it("deduplicates subscriber who matches both act and keyword", async () => {
    // Same email subscribed via both act ELI and keyword
    await subscriptionRepo.save({
      actEli: "DU/2024/1",
      email: "overlap@example.com",
      webhookUrl: null,
    });
    await subscriptionRepo.save({
      subscriptionType: "keyword",
      keyword: "prawo cywilne",
      email: "overlap2@example.com",
      webhookUrl: null,
    });

    // notifyForAct matches act subscription + keyword subscription; two distinct subs → 2 emails
    await notifier.notifyForAct(
      "DU/2024/1",
      [SAMPLE_EVENT],
      { publisher: "DU", keywords: ["prawo cywilne"] },
    );

    expect(emailChannel.send).toHaveBeenCalledTimes(2);
  });

  it("sends nothing when actMeta is absent and no act-type subs match", async () => {
    await subscriptionRepo.save({
      subscriptionType: "keyword",
      keyword: "prawo cywilne",
      email: "kw@example.com",
      webhookUrl: null,
    });

    // No actMeta passed → keyword subs not consulted
    await notifier.notifyForAct("DU/2024/1", [SAMPLE_EVENT]);

    expect(emailChannel.send).not.toHaveBeenCalled();
  });
});
