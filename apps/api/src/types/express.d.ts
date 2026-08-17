import type { AuthenticatedUser } from '../modules/auth/auth.constants';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
