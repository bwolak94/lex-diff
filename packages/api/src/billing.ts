// B-6: Stripe billing integration.
// Free tier: up to FREE_PLAN_SUBSCRIPTION_LIMIT act subscriptions.
// Pro tier: unlimited subscriptions, unlocked via Stripe Checkout.

import Stripe from "stripe";
import { FREE_PLAN_SUBSCRIPTION_LIMIT } from "./auth.js";

export { FREE_PLAN_SUBSCRIPTION_LIMIT };

export interface BillingDbClient {
  findUserById(id: string): Promise<{ id: string; email: string; plan: string } | null>;
  updateUserPlan(id: string, plan: "free" | "pro"): Promise<void>;
}

export class BillingService {
  private readonly stripe: Stripe;

  constructor(
    stripeSecretKey: string,
    private readonly db: BillingDbClient,
    private readonly appBaseUrl: string,
    private readonly proPriceId: string,
    private readonly webhookSecret: string,
  ) {
    this.stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-01-27.acacia" });
  }

  /** Create a Stripe Checkout session to upgrade to Pro. */
  async createCheckoutSession(
    userId: string,
    userEmail: string,
  ): Promise<{ url: string }> {
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: userEmail,
      line_items: [{ price: this.proPriceId, quantity: 1 }],
      metadata: { userId },
      success_url: `${this.appBaseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.appBaseUrl}/billing/cancel`,
    });
    return { url: session.url! };
  }

  /** Create a Stripe Customer Portal session to manage subscription. */
  async createPortalSession(
    customerId: string,
  ): Promise<{ url: string }> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.appBaseUrl}/subscriptions`,
    });
    return { url: session.url };
  }

  /**
   * Handle incoming Stripe webhook events.
   * Verifies signature and upgrades/downgrades user plan accordingly.
   */
  async handleWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<void> {
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.["userId"];
        if (userId) await this.db.updateUserPlan(userId, "pro");
        break;
      }

      case "customer.subscription.deleted": {
        // Downgrade to free when subscription is cancelled
        const subscription = event.data.object as Stripe.Subscription;
        const userId = (subscription.metadata as Record<string, string>)?.["userId"];
        if (userId) await this.db.updateUserPlan(userId, "free");
        break;
      }
    }
  }

  /** Check whether a user is allowed to add more subscriptions. */
  async canAddSubscription(
    userId: string,
    currentCount: number,
  ): Promise<boolean> {
    const user = await this.db.findUserById(userId);
    if (!user) return false;
    if (user.plan === "pro") return true;
    return currentCount < FREE_PLAN_SUBSCRIPTION_LIMIT;
  }
}
