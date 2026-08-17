import { Module } from '@nestjs/common';
import { SessionCleanupService } from '../modules/auth/session-cleanup.service';
import { SessionService } from '../modules/auth/session.service';
import { ApplicationCoreModule } from './application-core.module';

@Module({
  imports: [ApplicationCoreModule],
  providers: [SessionService, SessionCleanupService],
  exports: [SessionCleanupService],
})
export class AuthMaintenanceCliModule {}
