import jwt from 'jsonwebtoken';
import { logger } from './logger';

interface TokenPayload {
  userId: string;
  email: string;
}

export const generateToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  try {
    return jwt.sign(payload, secret, { expiresIn });
  } catch (error) {
    logger.error('Failed to generate JWT token:', error);
    throw new Error('Failed to generate authentication token');
  }
};

export const verifyToken = (token: string): TokenPayload => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  try {
    const decoded = jwt.verify(token, secret) as TokenPayload & { iat: number; exp: number };
    return {
      userId: decoded.userId,
      email: decoded.email
    };
  } catch (error) {
    logger.warn('Failed to verify JWT token:', error);
    
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    
    throw new Error('Token verification failed');
  }
};

export const generateRefreshToken = (): string => {
  // Generate a secure random token for refresh
  const crypto = require('crypto');
  return crypto.randomBytes(64).toString('hex');
};