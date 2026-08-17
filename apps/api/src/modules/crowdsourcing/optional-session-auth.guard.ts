import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { SessionService } from '../auth/session.service';

/** Sets request.user when a valid session exists; never rejects anonymous requests. */
@Injectable()
export class OptionalSessionAuthGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieName = this.sessionService.getCookieName();
    const token = request.cookies?.[cookieName] as string | undefined;

    if (token) {
      const user = await this.sessionService.validateSession(token);
      if (user) {
        request.user = user;
      }
    }

    return true;
  }
}
