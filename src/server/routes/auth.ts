import { Router } from 'express';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { prisma } from '../utils/database';
import { generateToken } from '../utils/jwt';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';

const router = Router();

// Configure GitHub OAuth Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "/api/auth/github/callback"
  },
  async (accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      logger.info('GitHub OAuth callback received', { 
        profileId: profile.id,
        username: profile.username 
      });

      // Check if user already exists
      let user = await prisma.user.findUnique({
        where: { githubId: profile.id }
      });

      if (user) {
        // Update GitHub token
        user = await prisma.user.update({
          where: { id: user.id },
          data: { githubToken: accessToken }
        });
        
        logger.info('Existing user updated', { userId: user.id });
      } else {
        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: profile.emails?.[0]?.value }
        });

        if (existingUser) {
          // Link GitHub to existing account
          user = await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              githubId: profile.id,
              githubToken: accessToken,
              avatar: profile.photos?.[0]?.value || existingUser.avatar
            }
          });
          
          logger.info('GitHub linked to existing user', { userId: user.id });
        } else {
          // Create new user
          user = await prisma.user.create({
            data: {
              email: profile.emails?.[0]?.value || `${profile.username}@github.local`,
              name: profile.displayName || profile.username,
              avatar: profile.photos?.[0]?.value,
              githubId: profile.id,
              githubToken: accessToken
            }
          });

          // Create free subscription
          await prisma.subscription.create({
            data: {
              userId: user.id,
              status: 'ACTIVE',
              plan: 'FREE',
              billingInterval: 'MONTH',
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
              maxRepositories: 3,
              maxAnalysesPerMonth: 10
            }
          });
          
          logger.info('New user created', { userId: user.id });
        }
      }

      return done(null, user);
    } catch (error) {
      logger.error('GitHub OAuth error:', error);
      return done(error, null);
    }
  }));
}

// Configure JWT Strategy
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'fallback-secret'
}, async (payload, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });
    
    if (user) {
      return done(null, user);
    } else {
      return done(null, false);
    }
  } catch (error) {
    return done(error, false);
  }
}));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id }
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Initialize passport
router.use(passport.initialize());

// GitHub OAuth routes
router.get('/github', 
  passport.authenticate('github', { scope: ['user:email', 'repo'] })
);

router.get('/github/callback',
  passport.authenticate('github', { session: false }),
  async (req, res) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        throw createError('Authentication failed', 401);
      }

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email
      });

      logger.info('User authenticated successfully', { userId: user.id });

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } catch (error) {
      logger.error('GitHub callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/error`);
    }
  }
);

// Get current user
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
        subscription: {
          select: {
            plan: true,
            status: true,
            maxRepositories: true,
            maxAnalysesPerMonth: true,
            repositoriesUsed: true,
            analysesThisMonth: true,
            currentPeriodEnd: true
          }
        },
        repositories: {
          select: {
            id: true,
            name: true,
            fullName: true,
            language: true,
            lastAnalyzedAt: true
          },
          take: 5,
          orderBy: { updatedAt: 'desc' }
        }
      }
    });

    if (!user) {
      throw createError('User not found', 404);
    }

    res.json({
      user,
      authenticated: true
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Logout endpoint
router.post('/logout', authenticateToken, (req, res) => {
  // Since we're using stateless JWT, just acknowledge the logout
  // In a production app, you might want to blacklist the token
  logger.info('User logged out', { userId: req.user?.id });
  
  res.json({
    message: 'Logged out successfully',
    timestamp: new Date().toISOString()
  });
});

// Token verification endpoint
router.post('/verify', authenticateToken, (req: AuthenticatedRequest, res) => {
  res.json({
    valid: true,
    user: req.user
  });
});

export default router;