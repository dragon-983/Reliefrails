import { Request, Response, NextFunction } from 'express';

export interface AuthUser {
  wallet: string;
  role: 'donor' | 'organisation' | 'beneficiary' | 'merchant' | 'auditor' | 'user';
  name?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const DEMO_PROFILES: Record<string, AuthUser> = {
  donor: {
    wallet: 'GADONOR1111111111111111111111111111111111111111111111111111',
    role: 'donor',
    name: 'Disaster Philanthropy Fund',
  },
  organisation: {
    wallet: 'GAORGANIZATION11111111111111111111111111111111111111111111111',
    role: 'organisation',
    name: 'Global Emergency Relief Network (Admin)',
  },
  beneficiary: {
    wallet: 'GABENEFICIARY11111111111111111111111111111111111111111111111',
    role: 'beneficiary',
    name: 'Household AF-409 (Beneficiary)',
  },
  merchant: {
    wallet: 'GAMERCHANT11111111111111111111111111111111111111111111111',
    role: 'merchant',
    name: 'City Central Food Hub & Market',
  },
  auditor: {
    wallet: 'GAAUDITOR1111111111111111111111111111111111111111111111111111',
    role: 'auditor',
    name: 'Independent Humanitarian Watchdog',
  },
};

/**
 * Authentication extraction middleware
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const headerWallet = req.headers['x-wallet-address'] as string | undefined;
  const headerRole = req.headers['x-user-role'] as AuthUser['role'] | undefined;
  const demoRole = req.headers['x-demo-role'] as string | undefined;

  if (demoRole && DEMO_PROFILES[demoRole]) {
    req.user = DEMO_PROFILES[demoRole];
    return next();
  }

  if (headerWallet) {
    req.user = {
      wallet: headerWallet,
      role: headerRole || 'user',
    };
    return next();
  }

  next();
}

/**
 * Require valid authenticated user
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.wallet) {
    return res.status(401).json({
      error: 'Authentication required. Please connect your Stellar wallet or select a sandbox role.',
    });
  }
  next();
}

/**
 * Require specific role
 */
export function requireRole(...allowedRoles: AuthUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
      });
    }

    next();
  };
}
