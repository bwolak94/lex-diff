// S5-15: Notifier — fan-out to email + webhook with dedup via NotificationLog.
import type {
  ChangeEvent,
  Subscription,
  SubscriptionRepository,
  NotificationLogRepository,
} from "@lexdiff/core";
import type { EmailChannel } from "./channels/email.js";
import type { WebhookChannel } from "./channels/webhook.js";

export class Notifier {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly notificationLogRepo: NotificationLogRepository,
    private readonly emailChannel: EmailChannel,
    private readonly webhookChannel: WebhookChannel,
  ) {}

  async notifyForAct(actEli: string, events: ChangeEvent[]): Promise<void> {
    if (events.length === 0) return;
    const subs = await this.subscriptionRepo.findByActEli(actEli);

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
