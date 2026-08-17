import { Module, forwardRef } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { OcrModule } from '../ocr/ocr.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AUTH_THROTTLE, REGISTER_THROTTLE } from './auth.constants';
import { PasswordService } from './password.service';
import { SessionAuthGuard } from './session-auth.guard';
import { SessionCleanupService } from './session-cleanup.service';
import { SessionService } from './session.service';

@Module({
  imports: [
    forwardRef(() => OcrModule),
    ThrottlerModule.forRoot([
      {
        name: AUTH_THROTTLE.name,
        ttl: AUTH_THROTTLE.ttl,
        limit: AUTH_THROTTLE.limit,
      },
      {
        name: REGISTER_THROTTLE.name,
        ttl: REGISTER_THROTTLE.ttl,
        limit: REGISTER_THROTTLE.limit,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionService,
    SessionCleanupService,
    SessionAuthGuard,
  ],
  exports: [
    AuthService,
    SessionService,
    PasswordService,
    SessionAuthGuard,
    SessionCleanupService,
  ],
})
export class AuthModule {}
