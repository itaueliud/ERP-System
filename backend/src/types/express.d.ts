import { Role } from '../auth/authorizationService';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: Role;
      permissions: string[];
      sessionId: string;
    }
  }
}

export {};
