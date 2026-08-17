import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Response } from 'express';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';
import {
  INVALID_CREDENTIALS_MESSAGE,
  type SafeUserProfile,
  type UserPreferencesResponse,
} from './auth.constants';
import { isValidEmailFormat, normalizeEmail } from './email-normalization';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { ReportImagesService } from '../ocr/report-images.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    @Inject(forwardRef(() => ReportImagesService))
    private readonly reportImagesService: ReportImagesService,
  ) {}

  async register(
    email: string,
    password: string,
    displayName: string | undefined,
    response: Response,
    userAgent?: string,
  ) {
    if (!isValidEmailFormat(email)) {
      throw new ConflictException('Invalid email address');
    }

    const trimmedEmail = email.trim();
    const emailNormalized = normalizeEmail(email);
    const passwordHash = await this.passwordService.hashPassword(password);

    const user = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.emailNormalized, emailNormalized))
        .limit(1);

      if (existing) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }

      const [created] = await tx
        .insert(schema.users)
        .values({
          email: trimmedEmail,
          emailNormalized,
          passwordHash,
          displayName: displayName?.trim() || null,
          preferredLocale: 'en',
        })
        .returning({
          id: schema.users.id,
          email: schema.users.email,
          displayName: schema.users.displayName,
          preferredLocale: schema.users.preferredLocale,
        });

      await tx.insert(schema.userPreferences).values({
        userId: created.id,
        locale: 'en',
      });

      await tx.insert(schema.userReputation).values({
        userId: created.id,
        score: 50,
      });

      return created;
    });

    const { token } = await this.sessionService.createSession(
      user.id,
      userAgent,
    );
    this.sessionService.setSessionCookie(response, token);

    return {
      user: this.toSafeUser(user),
      preferences: await this.getPreferencesForUser(user.id),
    };
  }

  async login(
    email: string,
    password: string,
    response: Response,
    userAgent?: string,
  ) {
    const emailNormalized = normalizeEmail(email);

    const [user] = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        displayName: schema.users.displayName,
        preferredLocale: schema.users.preferredLocale,
        passwordHash: schema.users.passwordHash,
        isActive: schema.users.isActive,
      })
      .from(schema.users)
      .where(eq(schema.users.emailNormalized, emailNormalized))
      .limit(1);

    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const valid = await this.passwordService.verifyPassword(
      password,
      user.passwordHash,
    );
    if (!valid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    await this.db
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, user.id));

    const { token } = await this.sessionService.createSession(
      user.id,
      userAgent,
    );
    this.sessionService.setSessionCookie(response, token);

    return {
      user: this.toSafeUser(user),
      preferences: await this.getPreferencesForUser(user.id),
    };
  }

  async logout(token: string | undefined, response: Response): Promise<void> {
    if (token) {
      await this.sessionService.revokeSession(token);
    }
    this.sessionService.clearSessionCookie(response);
  }

  async getMe(userId: string) {
    const [user] = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        displayName: schema.users.displayName,
        preferredLocale: schema.users.preferredLocale,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      user: this.toSafeUser(user),
      preferences: await this.getPreferencesForUser(user.id),
    };
  }

  async deleteAccount(
    userId: string,
    password: string | undefined,
  ): Promise<void> {
    const [user] = await this.db
      .select({
        id: schema.users.id,
        passwordHash: schema.users.passwordHash,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.passwordHash) {
      if (!password) {
        throw new UnauthorizedException('Password confirmation required');
      }
      const valid = await this.passwordService.verifyPassword(
        password,
        user.passwordHash,
      );
      if (!valid) {
        throw new UnauthorizedException('Password confirmation required');
      }
    }

    await this.sessionService.revokeAllUserSessions(userId);
    await this.reportImagesService.deleteUserImages(userId);

    await this.db.transaction(async (tx) => {
      await tx
        .delete(schema.userPriceReportVotes)
        .where(eq(schema.userPriceReportVotes.userId, userId));

      await tx
        .delete(schema.userReputationEvents)
        .where(eq(schema.userReputationEvents.userId, userId));

      await tx
        .delete(schema.userReputation)
        .where(eq(schema.userReputation.userId, userId));

      await tx.delete(schema.users).where(eq(schema.users.id, userId));
    });
  }

  toSafeUser(user: {
    id: string;
    email: string;
    displayName: string | null;
    preferredLocale: string;
  }): SafeUserProfile {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      locale: user.preferredLocale,
    };
  }

  async getPreferencesForUser(
    userId: string,
  ): Promise<UserPreferencesResponse> {
    const [prefs] = await this.db
      .select({
        preferredFuelTypeId: schema.userPreferences.preferredFuelTypeId,
        preferredCurrencyCode: schema.currencies.code,
        defaultRefuelLiters: schema.userPreferences.defaultRefuelLiters,
        vehicleConsumptionLPer100Km:
          schema.userPreferences.vehicleConsumptionLPer100Km,
        locale: schema.userPreferences.locale,
      })
      .from(schema.userPreferences)
      .leftJoin(
        schema.currencies,
        eq(schema.userPreferences.preferredCurrencyId, schema.currencies.id),
      )
      .where(eq(schema.userPreferences.userId, userId))
      .limit(1);

    return {
      preferredFuelTypeId: prefs?.preferredFuelTypeId ?? null,
      preferredCurrency: prefs?.preferredCurrencyCode ?? null,
      defaultRefuelLiters: prefs?.defaultRefuelLiters ?? null,
      vehicleConsumptionLPer100Km: prefs?.vehicleConsumptionLPer100Km ?? null,
      locale: prefs?.locale ?? 'en',
    };
  }
}
