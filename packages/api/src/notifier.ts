// S5-15: Notifier — fan-out to email + webhook with dedup via NotificationLog.
// S6-5: OTel spans on notifyForAct.
// B-1: keyword + publisher subscriber fan-out.
import { trace, SpanStatusCode } from "@opentelemetry/api";
import type {
  ChangeEvent,
  Subscription,
  SubscriptionRepository,
  NotificationLogRepository,
} from "@lexdiff/core";
import type { EmailChannel } from "./channels/email.js";
import type { WebhookChannel } from "./channels/webhook.js";

const tracer = trace.getTracer("@lexdiff/api", "0.1.0");

export class Notifier {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly notificationLogRepo: NotificationLogRepository,
    private readonly emailChannel: EmailChannel,
    private readonly webhookChannel: WebhookChannel,
  ) {}

  async notifyForAct(
    actEli: string,
    events: ChangeEvent[],
    actMeta?: { publisher: string; keywords: string[] },
  ): Promise<void> {
    if (events.length === 0) return;

    const span = tracer.startSpan("Notifier.notifyForAct", {
      attributes: { actEli, "events.count": events.length },
    });

    try {
      // Collect all matching subscribers (act + keyword + publisher), dedupe by id.
      const actSubs = await this.subscriptionRepo.findByActEli(actEli);
      const subsById = new Map<string, Subscription>(
        actSubs.map((s) => [s.id, s]),
      );

      if (actMeta) {
        for (const kw of actMeta.keywords) {
          for (const s of await this.subscriptionRepo.findByKeyword(kw)) {
            subsById.set(s.id, s);
          }
        }
        for (const s of await this.subscriptionRepo.findByPublisher(actMeta.publisher)) {
          subsById.set(s.id, s);
        }
      }

      const subs = Array.from(subsById.values());
      span.setAttribute("subscribers.count", subs.length);

      for (const sub of subs) {
        for (const event of events) {
          await this._withDedup(sub.id, event.eventHash, "email", () =>
            this.emailChannel.send({
              to: sub.email,
              subject: `LexDiff: Changes detected in ${actEli}`,
              documentTitle: actEli,
              changeDescription: `${event.type} detected`,
            }),
          );

          if (sub.webhookUrl) {
            await this._withDedup(sub.id, event.eventHash, "webhook", () =>
              this.webhookChannel.send({
                webhookUrl: sub.webhookUrl as string,
                payload: { actEli, subscriptionId: sub.id, event },
              }),
            );
          }
        }
      }

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  }

  private async _withDedup(
    subscriptionId: string,
    eventHash: string,
    channel: string,
    send: () => Promise<void>,
  ): Promise<void> {
    const alreadySent = await this.notificationLogRepo.hasBeenSent(
      subscriptionId,
      eventHash,
      channel,
    );
    if (alreadySent) return;
    await send();
    await this.notificationLogRepo.markSent(subscriptionId, eventHash, channel);
  }
}
