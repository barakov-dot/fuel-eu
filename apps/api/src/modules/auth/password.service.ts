import { BadRequestException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './auth.constants';

@Injectable()
export class PasswordService {
  /**
   * Argon2id with library defaults tuned for web auth:
   * - type: argon2id
   * - timeCost: 3
   * - memoryCost: 65536 (64 MiB)
   * - parallelism: 4
   * - hashLength: 32
   */
  async hashPassword(password: string): Promise<string> {
    this.assertPasswordPolicy(password);
    return argon2.hash(password, {
      type: argon2.argon2id,
      timeCost: 3,
      memoryCost: 65536,
      parallelism: 4,
      hashLength: 32,
    });
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  assertPasswordPolicy(password: string): void {
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      );
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
      throw new BadRequestException(
        `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
      );
    }
  }
}
