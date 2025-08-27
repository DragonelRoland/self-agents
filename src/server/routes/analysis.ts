import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../utils/database';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// Get analysis details by ID
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const analysis = await prisma.analysisResult.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      },
      include: {
        repository: {
          select: {
            name: true,
            fullName: true,
            language: true,
            url: true
          }
        }
      }
    });

    if (!analysis) {
      throw createError('Analysis not found', 404);
    }

    res.json({ analysis });
  } catch (error) {
    logger.error('Failed to fetch analysis:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});

// Get analysis summary statistics
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { 
      repositoryId, 
      timeframe = '30d',
      page = 1, 
      limit = 20 
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    
    // Calculate date range based on timeframe
    const now = new Date();
    let startDate: Date;
    
    switch (timeframe) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const where = {
      userId: req.user!.id,
      analyzedAt: {
        gte: startDate
      },
      ...(repositoryId && { repositoryId: repositoryId as string })
    };

    const [analyses, totalCount, stats] = await Promise.all([
      prisma.analysisResult.findMany({
        where,
        orderBy: { analyzedAt: 'desc' },
        skip: offset,
        take: Number(limit),
        select: {
          id: true,
          analyzedAt: true,
          overallScore: true,
          qualityScore: true,
          securityScore: true,
          performanceScore: true,
          maintainabilityScore: true,
          criticalIssues: true,
          majorIssues: true,
          minorIssues: true,
          suggestions: true,
          commitSha: true,
          branch: true,
          analysisType: true,
          aiSummary: true,
          repository: {
            select: {
              name: true,
              fullName: true,
              language: true
            }
          }
        }
      }),
      prisma.analysisResult.count({ where }),
      prisma.analysisResult.aggregate({
        where,
        _avg: {
          overallScore: true,
          qualityScore: true,
          securityScore: true,
          performanceScore: true,
          maintainabilityScore: true
        },
        _sum: {
          criticalIssues: true,
          majorIssues: true,
          minorIssues: true,
          suggestions: true
        }
      })
    ]);

    // Calculate trends (compare with previous period)
    const prevStartDate = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
    const prevStats = await prisma.analysisResult.aggregate({
      where: {
        userId: req.user!.id,
        analyzedAt: {
          gte: prevStartDate,
          lt: startDate
        },
        ...(repositoryId && { repositoryId: repositoryId as string })
      },
      _avg: {
        overallScore: true
      },
      _sum: {
        criticalIssues: true,
        majorIssues: true
      }
    });

    // Calculate score trend
    const currentAvgScore = stats._avg.overallScore || 0;
    const prevAvgScore = prevStats._avg.overallScore || currentAvgScore;
    const scoreTrend = currentAvgScore - prevAvgScore;

    // Calculate issue trend
    const currentIssues = (stats._sum.criticalIssues || 0) + (stats._sum.majorIssues || 0);
    const prevIssues = (prevStats._sum.criticalIssues || 0) + (prevStats._sum.majorIssues || 0);
    const issuesTrend = currentIssues - prevIssues;

    res.json({
      analyses,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / Number(limit))
      },
      summary: {
        totalAnalyses: totalCount,
        averageScores: {
          overall: Math.round((stats._avg.overallScore || 0) * 10) / 10,
          quality: Math.round((stats._avg.qualityScore || 0) * 10) / 10,
          security: Math.round((stats._avg.securityScore || 0) * 10) / 10,
          performance: Math.round((stats._avg.performanceScore || 0) * 10) / 10,
          maintainability: Math.round((stats._avg.maintainabilityScore || 0) * 10) / 10
        },
        totalIssues: {
          critical: stats._sum.criticalIssues || 0,
          major: stats._sum.majorIssues || 0,
          minor: stats._sum.minorIssues || 0,
          suggestions: stats._sum.suggestions || 0
        },
        trends: {
          scoreChange: Math.round(scoreTrend * 100) / 100,
          issueChange: issuesTrend,
          improving: scoreTrend > 0 && issuesTrend <= 0
        }
      },
      timeframe
    });
  } catch (error) {
    logger.error('Failed to fetch analysis summary:', error);
    res.status(500).json({ error: 'Failed to fetch analysis summary' });
  }
});

// Get analysis trends over time
router.get('/trends/chart', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { repositoryId, days = '30' } = req.query;
    const daysNum = parseInt(days as string);
    
    if (daysNum > 365) {
      throw createError('Maximum 365 days allowed', 400);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const analyses = await prisma.analysisResult.findMany({
      where: {
        userId: req.user!.id,
        analyzedAt: {
          gte: startDate
        },
        ...(repositoryId && { repositoryId: repositoryId as string })
      },
      orderBy: { analyzedAt: 'asc' },
      select: {
        analyzedAt: true,
        overallScore: true,
        qualityScore: true,
        securityScore: true,
        performanceScore: true,
        maintainabilityScore: true,
        criticalIssues: true,
        majorIssues: true,
        minorIssues: true
      }
    });

    // Group by day and calculate averages
    const trendData = new Map();
    
    analyses.forEach(analysis => {
      const day = analysis.analyzedAt.toISOString().split('T')[0];
      
      if (!trendData.has(day)) {
        trendData.set(day, {
          date: day,
          scores: [],
          issues: []
        });
      }
      
      const dayData = trendData.get(day);
      dayData.scores.push({
        overall: analysis.overallScore,
        quality: analysis.qualityScore,
        security: analysis.securityScore,
        performance: analysis.performanceScore,
        maintainability: analysis.maintainabilityScore
      });
      
      dayData.issues.push({
        critical: analysis.criticalIssues,
        major: analysis.majorIssues,
        minor: analysis.minorIssues
      });
    });

    // Calculate daily averages
    const chartData = Array.from(trendData.values()).map(day => {
      const avgScores = day.scores.reduce((acc: any, score: any) => {
        Object.keys(score).forEach(key => {
          acc[key] = (acc[key] || 0) + score[key];
        });
        return acc;
      }, {});

      const avgIssues = day.issues.reduce((acc: any, issue: any) => {
        Object.keys(issue).forEach(key => {
          acc[key] = (acc[key] || 0) + issue[key];
        });
        return acc;
      }, {});

      const count = day.scores.length;

      return {
        date: day.date,
        scores: {
          overall: Math.round((avgScores.overall / count) * 10) / 10,
          quality: Math.round((avgScores.quality / count) * 10) / 10,
          security: Math.round((avgScores.security / count) * 10) / 10,
          performance: Math.round((avgScores.performance / count) * 10) / 10,
          maintainability: Math.round((avgScores.maintainability / count) * 10) / 10
        },
        issues: {
          critical: Math.round(avgIssues.critical / count),
          major: Math.round(avgIssues.major / count),
          minor: Math.round(avgIssues.minor / count)
        },
        analysisCount: count
      };
    });

    res.json({
      chartData,
      totalDataPoints: chartData.length,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      }
    });
  } catch (error) {
    logger.error('Failed to fetch analysis trends:', error);
    res.status(500).json({ error: 'Failed to fetch analysis trends' });
  }
});

// Compare analyses between commits
router.get('/compare/:analysisId1/:analysisId2', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { analysisId1, analysisId2 } = req.params;

    const [analysis1, analysis2] = await Promise.all([
      prisma.analysisResult.findFirst({
        where: {
          id: analysisId1,
          userId: req.user!.id
        },
        include: {
          repository: {
            select: { name: true, fullName: true }
          }
        }
      }),
      prisma.analysisResult.findFirst({
        where: {
          id: analysisId2,
          userId: req.user!.id
        },
        include: {
          repository: {
            select: { name: true, fullName: true }
          }
        }
      })
    ]);

    if (!analysis1 || !analysis2) {
      throw createError('One or both analyses not found', 404);
    }

    // Calculate differences
    const comparison = {
      analysis1: {
        id: analysis1.id,
        analyzedAt: analysis1.analyzedAt,
        commitSha: analysis1.commitSha,
        branch: analysis1.branch,
        repository: analysis1.repository,
        scores: {
          overall: analysis1.overallScore,
          quality: analysis1.qualityScore,
          security: analysis1.securityScore,
          performance: analysis1.performanceScore,
          maintainability: analysis1.maintainabilityScore
        },
        issues: {
          critical: analysis1.criticalIssues,
          major: analysis1.majorIssues,
          minor: analysis1.minorIssues,
          suggestions: analysis1.suggestions
        }
      },
      analysis2: {
        id: analysis2.id,
        analyzedAt: analysis2.analyzedAt,
        commitSha: analysis2.commitSha,
        branch: analysis2.branch,
        repository: analysis2.repository,
        scores: {
          overall: analysis2.overallScore,
          quality: analysis2.qualityScore,
          security: analysis2.securityScore,
          performance: analysis2.performanceScore,
          maintainability: analysis2.maintainabilityScore
        },
        issues: {
          critical: analysis2.criticalIssues,
          major: analysis2.majorIssues,
          minor: analysis2.minorIssues,
          suggestions: analysis2.suggestions
        }
      },
      differences: {
        scores: {
          overall: Math.round((analysis2.overallScore - analysis1.overallScore) * 10) / 10,
          quality: Math.round((analysis2.qualityScore - analysis1.qualityScore) * 10) / 10,
          security: Math.round((analysis2.securityScore - analysis1.securityScore) * 10) / 10,
          performance: Math.round((analysis2.performanceScore - analysis1.performanceScore) * 10) / 10,
          maintainability: Math.round((analysis2.maintainabilityScore - analysis1.maintainabilityScore) * 10) / 10
        },
        issues: {
          critical: analysis2.criticalIssues - analysis1.criticalIssues,
          major: analysis2.majorIssues - analysis1.majorIssues,
          minor: analysis2.minorIssues - analysis1.minorIssues,
          suggestions: analysis2.suggestions - analysis1.suggestions
        }
      }
    };

    // Determine if this is an improvement
    const scoreImprovement = comparison.differences.scores.overall > 0;
    const issueReduction = (comparison.differences.issues.critical + comparison.differences.issues.major) < 0;
    
    comparison.differences.isImprovement = scoreImprovement || issueReduction;

    res.json({ comparison });
  } catch (error) {
    logger.error('Failed to compare analyses:', error);
    res.status(500).json({ error: 'Failed to compare analyses' });
  }
});

export default router;