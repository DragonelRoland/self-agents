import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../utils/database';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// Get user profile
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
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
        }
      }
    });

    if (!user) {
      throw createError('User not found', 404);
    }

    res.json({ user });
  } catch (error) {
    logger.error('Failed to fetch user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, email } = req.body;

    // Validate input
    if (!name || name.length < 2) {
      throw createError('Name must be at least 2 characters', 400);
    }

    if (!email || !email.includes('@')) {
      throw createError('Valid email is required', 400);
    }

    // Check if email is already taken by another user
    if (email !== req.user!.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        throw createError('Email is already taken', 409);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name, email },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        updatedAt: true
      }
    });

    logger.info('User profile updated', { userId: req.user!.id });

    res.json({ user: updatedUser });
  } catch (error) {
    logger.error('Failed to update user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Get user statistics
router.get('/stats', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const [
      repositoryCount,
      analysisCount,
      recentAnalyses,
      subscription
    ] = await Promise.all([
      prisma.repository.count({
        where: { userId: req.user!.id }
      }),
      prisma.analysisResult.count({
        where: { userId: req.user!.id }
      }),
      prisma.analysisResult.findMany({
        where: { userId: req.user!.id },
        orderBy: { analyzedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          analyzedAt: true,
          overallScore: true,
          criticalIssues: true,
          majorIssues: true,
          repository: {
            select: {
              name: true,
              language: true
            }
          }
        }
      }),
      prisma.subscription.findFirst({
        where: { userId: req.user!.id },
        select: {
          plan: true,
          maxRepositories: true,
          maxAnalysesPerMonth: true,
          repositoriesUsed: true,
          analysesThisMonth: true
        }
      })
    ]);

    // Calculate average score from recent analyses
    const avgScore = recentAnalyses.length > 0 
      ? recentAnalyses.reduce((sum, analysis) => sum + analysis.overallScore, 0) / recentAnalyses.length
      : 0;

    // Count total issues
    const totalIssues = recentAnalyses.reduce((sum, analysis) => 
      sum + analysis.criticalIssues + analysis.majorIssues, 0
    );

    res.json({
      stats: {
        repositories: {
          total: repositoryCount,
          limit: subscription?.maxRepositories || 0,
          remaining: Math.max(0, (subscription?.maxRepositories || 0) - repositoryCount)
        },
        analyses: {
          total: analysisCount,
          thisMonth: subscription?.analysesThisMonth || 0,
          limit: subscription?.maxAnalysesPerMonth || 0,
          remaining: Math.max(0, (subscription?.maxAnalysesPerMonth || 0) - (subscription?.analysesThisMonth || 0))
        },
        quality: {
          averageScore: Math.round(avgScore * 10) / 10,
          totalIssues,
          recentAnalyses: recentAnalyses.length
        }
      },
      recentAnalyses
    });
  } catch (error) {
    logger.error('Failed to fetch user statistics:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

// Get user activity feed
router.get('/activity', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const activities = await prisma.analysisResult.findMany({
      where: { userId: req.user!.id },
      orderBy: { analyzedAt: 'desc' },
      skip: offset,
      take: Number(limit),
      select: {
        id: true,
        analyzedAt: true,
        analysisType: true,
        overallScore: true,
        criticalIssues: true,
        majorIssues: true,
        minorIssues: true,
        commitSha: true,
        branch: true,
        repository: {
          select: {
            name: true,
            fullName: true,
            language: true
          }
        }
      }
    });

    const totalActivities = await prisma.analysisResult.count({
      where: { userId: req.user!.id }
    });

    res.json({
      activities,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalActivities,
        pages: Math.ceil(totalActivities / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Failed to fetch user activity:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

// Delete user account
router.delete('/account', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { confirmEmail } = req.body;

    // Confirm email for security
    if (confirmEmail !== req.user!.email) {
      throw createError('Email confirmation does not match', 400);
    }

    // Delete in transaction to maintain data integrity
    await prisma.$transaction(async (tx) => {
      // Delete analysis results
      await tx.analysisResult.deleteMany({
        where: { userId: req.user!.id }
      });

      // Delete repositories
      await tx.repository.deleteMany({
        where: { userId: req.user!.id }
      });

      // Delete subscription
      await tx.subscription.deleteMany({
        where: { userId: req.user!.id }
      });

      // Delete user
      await tx.user.delete({
        where: { id: req.user!.id }
      });
    });

    logger.info('User account deleted', { userId: req.user!.id });

    res.json({
      message: 'Account deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to delete user account:', error);
    res.status(500).json({ error: 'Failed to delete user account' });
  }
});

// Export user data (GDPR compliance)
router.get('/export', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        repositories: {
          include: {
            analysisResults: {
              orderBy: { analyzedAt: 'desc' }
            }
          }
        },
        subscription: true
      }
    });

    if (!user) {
      throw createError('User not found', 404);
    }

    // Remove sensitive data
    const exportData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      subscription: user.subscription ? {
        plan: user.subscription.plan,
        status: user.subscription.status,
        createdAt: user.subscription.createdAt
      } : null,
      repositories: user.repositories.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.fullName,
        description: repo.description,
        language: repo.language,
        createdAt: repo.createdAt,
        analysisCount: repo.analysisResults.length,
        lastAnalyzed: repo.lastAnalyzedAt
      })),
      totalAnalyses: user.repositories.reduce((sum, repo) => sum + repo.analysisResults.length, 0),
      exportDate: new Date().toISOString()
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=vibecode-data-${user.id}.json`);
    res.json(exportData);

    logger.info('User data exported', { userId: req.user!.id });
  } catch (error) {
    logger.error('Failed to export user data:', error);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

export default router;