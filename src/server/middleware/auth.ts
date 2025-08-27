import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/database';
import { createError } from './errorHandler';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
    avatar?: string;
  };
}

interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      throw createError('Access token required', 401);
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw createError('JWT secret not configured', 500);
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    
    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
      }
    });

    if (!user) {
      throw createError('User not found', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token:', { error: error.message, ip: req.ip });
      return next(createError('Invalid token', 401));
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Expired JWT token:', { ip: req.ip });
      return next(createError('Token expired', 401));
    }

    next(error);
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return next();
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return next();
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
      }
    });

    if (user) {
      req.user = user;
    }
  } catch (error) {
    // Silently fail for optional auth
    logger.debug('Optional auth failed:', { error: (error as Error).message });
  }
  
  next();
};

export const requireSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw createError('Authentication required', 401);
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        OR: [
          { userId: req.user.id },
          { 
            organization: {
              members: {
                some: { userId: req.user.id }
              }
            }
          }
        ],
        status: 'ACTIVE'
      },
      select: {
        plan: true,
        maxRepositories: true,
        maxAnalysesPerMonth: true,
        analysesThisMonth: true,
        repositoriesUsed: true
      }
    });

    if (!subscription || subscription.plan === 'FREE') {
      throw createError('Active subscription required', 403);
    }

    // Add subscription info to request
    (req as any).subscription = subscription;
    next();
  } catch (error) {
    next(error);
  }
};

export const checkUsageLimit = (limitType: 'repositories' | 'analyses') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const subscription = (req as any).subscription;
      
      if (!subscription) {
        throw createError('Subscription information not found', 400);
      }

      if (limitType === 'repositories' && subscription.repositoriesUsed >= subscription.maxRepositories) {
        throw createError('Repository limit exceeded', 403);
      }

      if (limitType === 'analyses' && subscription.analysesThisMonth >= subscription.maxAnalysesPerMonth) {
        throw createError('Monthly analysis limit exceeded', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};