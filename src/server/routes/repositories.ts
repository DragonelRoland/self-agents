import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest, requireSubscription, checkUsageLimit } from '../middleware/auth';
import { prisma } from '../utils/database';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { GitHubService } from '../services/GitHubService';
import { AnalysisService } from '../services/AnalysisService';

const router = Router();

// Get all repositories for authenticated user
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const repositories = await prisma.repository.findMany({
      where: {
        OR: [
          { userId: req.user!.id },
          {
            organization: {
              members: {
                some: { userId: req.user!.id }
              }
            }
          }
        ]
      },
      include: {
        analysisResults: {
          orderBy: { analyzedAt: 'desc' },
          take: 1,
          select: {
            overallScore: true,
            analyzedAt: true,
            criticalIssues: true,
            majorIssues: true,
            minorIssues: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({
      repositories: repositories.map(repo => ({
        ...repo,
        latestAnalysis: repo.analysisResults[0] || null,
        analysisResults: undefined
      }))
    });
  } catch (error) {
    logger.error('Failed to fetch repositories:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// Get GitHub repositories for import
router.get('/github', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { githubToken: true }
    });

    if (!user?.githubToken) {
      throw createError('GitHub token not found. Please reconnect your GitHub account.', 401);
    }

    const githubService = new GitHubService(user.githubToken);
    const repos = await githubService.getUserRepositories();

    // Get already imported repositories
    const existingRepos = await prisma.repository.findMany({
      where: {
        userId: req.user!.id,
        provider: 'GITHUB'
      },
      select: { providerId: true }
    });

    const existingIds = new Set(existingRepos.map(r => r.providerId));

    res.json({
      repositories: repos.map(repo => ({
        ...repo,
        imported: existingIds.has(repo.id.toString())
      }))
    });
  } catch (error) {
    logger.error('Failed to fetch GitHub repositories:', error);
    res.status(500).json({ error: 'Failed to fetch GitHub repositories' });
  }
});

// Import repository from GitHub
router.post('/import', 
  authenticateToken, 
  requireSubscription, 
  checkUsageLimit('repositories'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { repositoryId, provider = 'GITHUB' } = req.body;

      if (!repositoryId) {
        throw createError('Repository ID is required', 400);
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { githubToken: true }
      });

      if (!user?.githubToken) {
        throw createError('GitHub token not found', 401);
      }

      // Check if repository already exists
      const existing = await prisma.repository.findUnique({
        where: {
          provider_providerId: {
            provider: 'GITHUB',
            providerId: repositoryId.toString()
          }
        }
      });

      if (existing) {
        throw createError('Repository already imported', 409);
      }

      const githubService = new GitHubService(user.githubToken);
      const repoData = await githubService.getRepository(repositoryId);

      // Create repository record
      const repository = await prisma.repository.create({
        data: {
          name: repoData.name,
          fullName: repoData.full_name,
          description: repoData.description,
          isPrivate: repoData.private,
          language: repoData.language,
          url: repoData.html_url,
          cloneUrl: repoData.clone_url,
          provider: 'GITHUB',
          providerId: repoData.id.toString(),
          defaultBranch: repoData.default_branch,
          userId: req.user!.id
        }
      });

      // Update subscription usage
      await prisma.subscription.updateMany({
        where: { userId: req.user!.id },
        data: {
          repositoriesUsed: {
            increment: 1
          }
        }
      });

      logger.info('Repository imported successfully', {
        userId: req.user!.id,
        repositoryId: repository.id,
        fullName: repository.fullName
      });

      res.status(201).json({ repository });
    } catch (error) {
      logger.error('Failed to import repository:', error);
      
      if (error instanceof Error && error.message.includes('already imported')) {
        return res.status(409).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Failed to import repository' });
    }
  }
);

// Get repository details
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const repository = await prisma.repository.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { userId: req.user!.id },
          {
            organization: {
              members: {
                some: { userId: req.user!.id }
              }
            }
          }
        ]
      },
      include: {
        analysisResults: {
          orderBy: { analyzedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            overallScore: true,
            qualityScore: true,
            securityScore: true,
            performanceScore: true,
            maintainabilityScore: true,
            criticalIssues: true,
            majorIssues: true,
            minorIssues: true,
            suggestions: true,
            analyzedAt: true,
            commitSha: true,
            branch: true,
            aiSummary: true
          }
        }
      }
    });

    if (!repository) {
      throw createError('Repository not found', 404);
    }

    res.json({ repository });
  } catch (error) {
    logger.error('Failed to fetch repository:', error);
    res.status(500).json({ error: 'Failed to fetch repository' });
  }
});

// Trigger repository analysis
router.post('/:id/analyze', 
  authenticateToken, 
  requireSubscription, 
  checkUsageLimit('analyses'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { branch = 'main', analysisType = 'full' } = req.body;

      const repository = await prisma.repository.findFirst({
        where: {
          id: req.params.id,
          OR: [
            { userId: req.user!.id },
            {
              organization: {
                members: {
                  some: { userId: req.user!.id }
                }
              }
            }
          ]
        }
      });

      if (!repository) {
        throw createError('Repository not found', 404);
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { githubToken: true }
      });

      if (!user?.githubToken) {
        throw createError('GitHub token not found', 401);
      }

      // Start analysis (async)
      const analysisService = new AnalysisService();
      const analysisPromise = analysisService.analyzeRepository(
        repository,
        user.githubToken,
        {
          branch,
          analysisType,
          triggeredBy: 'manual',
          userId: req.user!.id
        }
      );

      // Update subscription usage
      await prisma.subscription.updateMany({
        where: { userId: req.user!.id },
        data: {
          analysesThisMonth: {
            increment: 1
          }
        }
      });

      logger.info('Repository analysis started', {
        userId: req.user!.id,
        repositoryId: repository.id,
        branch,
        analysisType
      });

      // Return immediately with status
      res.json({
        message: 'Analysis started successfully',
        repositoryId: repository.id,
        status: 'processing',
        estimatedTime: '2-5 minutes'
      });

      // Handle analysis result in background
      analysisPromise.catch(error => {
        logger.error('Analysis failed:', error);
      });

    } catch (error) {
      logger.error('Failed to start analysis:', error);
      res.status(500).json({ error: 'Failed to start analysis' });
    }
  }
);

// Delete repository
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const repository = await prisma.repository.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id // Only owner can delete
      }
    });

    if (!repository) {
      throw createError('Repository not found or access denied', 404);
    }

    // Delete all related analysis results
    await prisma.analysisResult.deleteMany({
      where: { repositoryId: repository.id }
    });

    // Delete repository
    await prisma.repository.delete({
      where: { id: repository.id }
    });

    // Update subscription usage
    await prisma.subscription.updateMany({
      where: { userId: req.user!.id },
      data: {
        repositoriesUsed: {
          decrement: 1
        }
      }
    });

    logger.info('Repository deleted', {
      userId: req.user!.id,
      repositoryId: repository.id
    });

    res.json({ message: 'Repository deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete repository:', error);
    res.status(500).json({ error: 'Failed to delete repository' });
  }
});

// Get analysis history for repository
router.get('/:id/analyses', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const repository = await prisma.repository.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { userId: req.user!.id },
          {
            organization: {
              members: {
                some: { userId: req.user!.id }
              }
            }
          }
        ]
      }
    });

    if (!repository) {
      throw createError('Repository not found', 404);
    }

    const [analyses, total] = await Promise.all([
      prisma.analysisResult.findMany({
        where: { repositoryId: repository.id },
        orderBy: { analyzedAt: 'desc' },
        skip: offset,
        take: Number(limit),
        select: {
          id: true,
          commitSha: true,
          branch: true,
          analyzedAt: true,
          analysisType: true,
          overallScore: true,
          qualityScore: true,
          securityScore: true,
          performanceScore: true,
          maintainabilityScore: true,
          criticalIssues: true,
          majorIssues: true,
          minorIssues: true,
          suggestions: true,
          aiSummary: true
        }
      }),
      prisma.analysisResult.count({
        where: { repositoryId: repository.id }
      })
    ]);

    res.json({
      analyses,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Failed to fetch analysis history:', error);
    res.status(500).json({ error: 'Failed to fetch analysis history' });
  }
});

export default router;