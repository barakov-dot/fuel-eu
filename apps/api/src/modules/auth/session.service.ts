import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNull, lt } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Response } from 'express';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';
import {
  AUTH_COOKIE_NAME,
  AUTH_SESSION_TOKEN_BYTES,
  AUTH_SESSION_TTL_SECONDS,
  type AuthenticatedUser,
} from './auth.constants';

@Injectable()
export class SessionService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly configService: ConfigService,
  ) {}

  getCookieName(): string {
    return this.configService.get<string>('AUTH_COOKIE_NAME', AUTH_COOKIE_NAME);
  }

  getSessionTtlSeconds(): number {
    return this.configService.get<number>(
      'AUTH_SESSION_TTL_SECONDS',
      AUTH_SESSION_TTL_SECONDS,
    );
  }

  generateToken(): string {
    return randomBytes(AUTH_SESSION_TOKEN_BYTES).toString('base64url');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  hashUserAgent(userAgent: string | undefined): string | null {
    if (!userAgent) {
      return null;
    }
    return createHash('sha256').update(userAgent).digest('hex').slice(0, 64);
  }

  setSessionCookie(response: Response, token: string): void {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    response.cookie(this.getCookieName(), token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: this.getSessionTtlSeconds() * 1000,
    });
  }

  clearSessionCookie(response: Response): void {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    response.clearCookie(this.getCookieName(), {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
  }

  async createSession(
    userId: string,
    userAgent?: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + this.getSessionTtlSeconds() * 1000);

    await this.db.insert(schema.authSessions).values({
      userId,
      tokenHash,
      expiresAt,
      userAgentHash: this.hashUserAgent(userAgent),
    });

    return { token, expiresAt };
  }

  async revokeSession(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await this.db
      .update(schema.authSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.authSessions.tokenHash, tokenHash),
          isNull(schema.authSessions.revokedAt),
        ),
      );
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.db
      .update(schema.authSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.authSessions.userId, userId),
          isNull(schema.authSessions.revokedAt),
        ),
      );
  }

  async validateSession(token: string): Promise<AuthenticatedUser | null> {
    const tokenHash = this.hashToken(token);
    const now = new Date();

    const [row] = await this.db
      .select({
        sessionId: schema.authSessions.id,
        expiresAt: schema.authSessions.expiresAt,
        revokedAt: schema.authSessions.revokedAt,
        userId: schema.users.id,
        email: schema.users.email,
        emailNormalized: schema.users.emailNormalized,
        displayName: schema.users.displayName,
        preferredLocale: schema.users.preferredLocale,
        isActive: schema.users.isActive,
      })
      .from(schema.authSessions)
      .innerJoin(schema.users, eq(schema.authSessions.userId, schema.users.id))
      .where(eq(schema.authSessions.tokenHash, tokenHash))
      .limit(1);

    if (!row || row.revokedAt || row.expiresAt <= now || !row.isActive) {
      return null;
    }

    await this.db
      .update(schema.authSessions)
      .set({ lastSeenAt: now })
      .where(eq(schema.authSessions.id, row.sessionId));

    return {
      id: row.userId,
      email: row.email,
      emailNormalized: row.emailNormalized,
      displayName: row.displayName,
      preferredLocale: row.preferredLocale,
      isActive: row.isActive,
    };
  }

  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    const deleted = await this.db
      .delete(schema.authSessions)
      .where(lt(schema.authSessions.expiresAt, now))
      .returning({ id: schema.authSessions.id });

    return deleted.length;
  }
}
