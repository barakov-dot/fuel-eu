import { Injectable } from '@nestjs/common';
import { SessionService } from './session.service';

@Injectable()
export class SessionCleanupService {
  constructor(private readonly sessionService: SessionService) {}

  async cleanupExpiredSessions(): Promise<number> {
    return this.sessionService.cleanupExpiredSessions();
  }
}
