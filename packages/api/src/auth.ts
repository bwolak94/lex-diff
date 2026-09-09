// B-5: Magic-link authentication service.
// Flow: POST /auth/magic-link → email with token →
//       GET /auth/verify?token= → creates session → returns session token.
import { randomBytes } from "crypto";
import type { Resend } from "resend";

export const FREE_PLAN_SUBSCRIPTION_LIMIT = 5;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface AuthDbClient {
  upsertUser(email: string): Promise<{ id: string; email: string; plan: string }>;
  createMagicToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  findMagicToken(
    token: string,
  ): Promise<{ userId: string; expiresAt: Date; usedAt: Date | null } | null>;
  markMagicTokenUsed(token: string): Promise<void>;
  createSession(userId: string, token: string, expiresAt: Date): Promise<void>;
  findSession(token: string): Promise<{ userId: string; expiresAt: Date } | null>;
  deleteSession(token: string): Promise<void>;
}

export class AuthService {
  constructor(
    private readonly db: AuthDbClient,
    private readonly resend: Resend,
    private readonly fromEmail: string,
    private readonly appBaseUrl: string,
  ) {}

  async sendMagicLink(email: string): Promise<void> {
    const user = await this.db.upsertUser(email);
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);
    await this.db.createMagicToken(user.id, token, expiresAt);

    const link = `${this.appBaseUrl}/auth/verify?token=${token}`;
    await this.resend.emails.send({
      from: this.fromEmail,
      to: email,
      subject: "LexDiff — sign in link",
      html: `<p>Click to sign in (valid 15 minutes):</p><p><a href="${link}">${link}</a></p>`,
    });
  }

  async verifyMagicLink(
    token: string,
  ): Promise<{ sessionToken: string; userId: string } | null> {
    const record = await this.db.findMagicToken(token);
    if (!record) return null;
    if (record.usedAt) return null; // already used
    if (record.expiresAt < new Date()) return null; // expired

    await this.db.markMagicTokenUsed(token);

    const sessionToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.db.createSession(record.userId, sessionToken, expiresAt);

    return { sessionToken, userId: record.userId };
  }

  async getSession(
    token: string,
  ): Promise<{ userId: string } | null> {
    const session = await this.db.findSession(token);
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await this.db.deleteSession(token);
      return null;
    }
    return { userId: session.userId };
  }

  async logout(token: string): Promise<void> {
    await this.db.deleteSession(token);
  }
}
