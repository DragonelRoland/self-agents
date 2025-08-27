import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../utils/database';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import Joi from 'joi';

const router = Router();

const createOrgSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  slug: Joi.string().min(2).max(30).regex(/^[a-z0-9-]+$/).required()
});

const inviteMemberSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid('ADMIN', 'MEMBER').required()
});

const updateMemberRoleSchema = Joi.object({
  role: Joi.string().valid('ADMIN', 'MEMBER').required()
});

// Get user's organizations
router.get('/my-organizations', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const organizations = await prisma.organization.findMany({
      where: {
        OR: [
          { ownerId: req.user!.id },
          {
            members: {
              some: { userId: req.user!.id }
            }
          }
        ]
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true
              }
            }
          }
        },
        repositories: {
          select: {
            id: true,
            name: true,
            language: true,
            lastAnalyzedAt: true
          }
        },
        subscription: {
          select: {
            plan: true,
            status: true,
            maxRepositories: true,
            maxTeamMembers: true,
            repositoriesUsed: true
          }
        },
        _count: {
          select: {
            members: true,
            repositories: true
          }
        }
      }
    });

    // Add user's role in each organization
    const orgsWithRoles = organizations.map(org => {
      const isOwner = org.ownerId === req.user!.id;
      const membership = org.members.find(m => m.userId === req.user!.id);
      
      return {
        ...org,
        userRole: isOwner ? 'OWNER' : membership?.role || 'MEMBER',
        isOwner
      };
    });

    res.json({ organizations: orgsWithRoles });
  } catch (error) {
    logger.error('Failed to fetch organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// Create organization
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { error, value } = createOrgSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details.map(d => d.message)
      });
    }
    const { name, slug } = value;

    // Check if slug is already taken
    const existingOrg = await prisma.organization.findUnique({
      where: { slug }
    });

    if (existingOrg) {
      throw createError('Organization slug already exists', 409);
    }

    // Create organization
    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        ownerId: req.user!.id
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        },
        _count: {
          select: {
            members: true,
            repositories: true
          }
        }
      }
    });

    logger.info('Organization created', { 
      orgId: organization.id, 
      ownerId: req.user!.id,
      name: organization.name
    });

    res.status(201).json({ organization });
  } catch (error) {
    logger.error('Failed to create organization:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// Get organization details
router.get('/:orgId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { orgId } = req.params;

    const organization = await prisma.organization.findFirst({
      where: {
        id: orgId,
        OR: [
          { ownerId: req.user!.id },
          {
            members: {
              some: { userId: req.user!.id }
            }
          }
        ]
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                createdAt: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        repositories: {
          select: {
            id: true,
            name: true,
            fullName: true,
            description: true,
            language: true,
            isPrivate: true,
            lastAnalyzedAt: true,
            analysisResults: {
              select: {
                overallScore: true,
                analyzedAt: true
              },
              orderBy: {
                analyzedAt: 'desc'
              },
              take: 1
            }
          },
          orderBy: {
            name: 'asc'
          }
        },
        subscription: {
          select: {
            plan: true,
            status: true,
            maxRepositories: true,
            maxAnalysesPerMonth: true,
            maxTeamMembers: true,
            repositoriesUsed: true,
            analysesThisMonth: true,
            currentPeriodEnd: true
          }
        }
      }
    });

    if (!organization) {
      throw createError('Organization not found or access denied', 404);
    }

    // Determine user's role
    const isOwner = organization.ownerId === req.user!.id;
    const membership = organization.members.find(m => m.userId === req.user!.id);
    const userRole = isOwner ? 'OWNER' : membership?.role || 'MEMBER';

    // Add analytics data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const analytics = await prisma.analysisResult.groupBy({
      by: ['analyzedAt'],
      where: {
        repository: {
          organizationId: orgId
        },
        analyzedAt: {
          gte: thirtyDaysAgo
        }
      },
      _avg: {
        overallScore: true
      },
      _count: {
        id: true
      }
    });

    res.json({ 
      organization: {
        ...organization,
        userRole,
        isOwner,
        analytics: analytics.map(a => ({
          date: a.analyzedAt,
          averageScore: a._avg.overallScore,
          analysisCount: a._count.id
        }))
      }
    });
  } catch (error) {
    logger.error('Failed to fetch organization:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// Update organization
router.put('/:orgId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { orgId } = req.params;
    const { name } = req.body;

    // Only owner can update organization
    const organization = await prisma.organization.findFirst({
      where: {
        id: orgId,
        ownerId: req.user!.id
      }
    });

    if (!organization) {
      throw createError('Organization not found or insufficient permissions', 404);
    }

    const updatedOrg = await prisma.organization.update({
      where: { id: orgId },
      data: { name },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        }
      }
    });

    logger.info('Organization updated', { orgId, userId: req.user!.id });
    res.json({ organization: updatedOrg });
  } catch (error) {
    logger.error('Failed to update organization:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Invite member to organization
router.post('/:orgId/invite', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { orgId } = req.params;
    const { error, value } = inviteMemberSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details.map(d => d.message)
      });
    }
    const { email, role } = value;

    // Check if user has admin permissions
    const organization = await prisma.organization.findFirst({
      where: {
        id: orgId,
        OR: [
          { ownerId: req.user!.id },
          {
            members: {
              some: {
                userId: req.user!.id,
                role: 'ADMIN'
              }
            }
          }
        ]
      },
      include: {
        subscription: true,
        members: true
      }
    });

    if (!organization) {
      throw createError('Organization not found or insufficient permissions', 404);
    }

    // Check team size limits
    if (organization.subscription?.maxTeamMembers && 
        organization.members.length >= organization.subscription.maxTeamMembers) {
      throw createError('Team member limit exceeded', 403);
    }

    // Find or create user
    let invitedUser = await prisma.user.findUnique({
      where: { email }
    });

    if (!invitedUser) {
      // For now, we require the user to exist. In production, you'd send an invitation email
      throw createError('User with this email does not exist', 404);
    }

    // Check if user is already a member
    const existingMembership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: invitedUser.id,
          organizationId: orgId
        }
      }
    });

    if (existingMembership) {
      throw createError('User is already a member of this organization', 409);
    }

    // Add member
    const membership = await prisma.organizationMember.create({
      data: {
        userId: invitedUser.id,
        organizationId: orgId,
        role
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        }
      }
    });

    logger.info('Member added to organization', {
      orgId,
      userId: invitedUser.id,
      role,
      invitedBy: req.user!.id
    });

    res.status(201).json({ membership });
  } catch (error) {
    logger.error('Failed to invite member:', error);
    res.status(500).json({ error: 'Failed to invite member' });
  }
});

// Update member role
router.put('/:orgId/members/:memberId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { orgId, memberId } = req.params;
    const { error, value } = updateMemberRoleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details.map(d => d.message)
      });
    }
    const { role } = value;

    // Check if user has admin permissions
    const organization = await prisma.organization.findFirst({
      where: {
        id: orgId,
        OR: [
          { ownerId: req.user!.id },
          {
            members: {
              some: {
                userId: req.user!.id,
                role: 'ADMIN'
              }
            }
          }
        ]
      }
    });

    if (!organization) {
      throw createError('Organization not found or insufficient permissions', 404);
    }

    // Update member role
    const updatedMembership = await prisma.organizationMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        }
      }
    });

    logger.info('Member role updated', {
      orgId,
      memberId,
      newRole: role,
      updatedBy: req.user!.id
    });

    res.json({ membership: updatedMembership });
  } catch (error) {
    logger.error('Failed to update member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// Remove member from organization
router.delete('/:orgId/members/:memberId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { orgId, memberId } = req.params;

    // Check if user has admin permissions
    const organization = await prisma.organization.findFirst({
      where: {
        id: orgId,
        OR: [
          { ownerId: req.user!.id },
          {
            members: {
              some: {
                userId: req.user!.id,
                role: 'ADMIN'
              }
            }
          }
        ]
      }
    });

    if (!organization) {
      throw createError('Organization not found or insufficient permissions', 404);
    }

    // Remove member
    await prisma.organizationMember.delete({
      where: { id: memberId }
    });

    logger.info('Member removed from organization', {
      orgId,
      memberId,
      removedBy: req.user!.id
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    logger.error('Failed to remove member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Leave organization
router.post('/:orgId/leave', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { orgId } = req.params;

    // Find membership
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: req.user!.id,
        organizationId: orgId
      }
    });

    if (!membership) {
      throw createError('You are not a member of this organization', 404);
    }

    // Remove membership
    await prisma.organizationMember.delete({
      where: { id: membership.id }
    });

    logger.info('User left organization', {
      orgId,
      userId: req.user!.id
    });

    res.json({ message: 'Left organization successfully' });
  } catch (error) {
    logger.error('Failed to leave organization:', error);
    res.status(500).json({ error: 'Failed to leave organization' });
  }
});

// Delete organization (owner only)
router.delete('/:orgId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { orgId } = req.params;

    // Only owner can delete organization
    const organization = await prisma.organization.findFirst({
      where: {
        id: orgId,
        ownerId: req.user!.id
      }
    });

    if (!organization) {
      throw createError('Organization not found or insufficient permissions', 404);
    }

    // Delete in transaction
    await prisma.$transaction(async (tx) => {
      // Delete organization members
      await tx.organizationMember.deleteMany({
        where: { organizationId: orgId }
      });

      // Delete organization repositories (or transfer to personal)
      await tx.repository.deleteMany({
        where: { organizationId: orgId }
      });

      // Delete organization subscription
      await tx.subscription.deleteMany({
        where: { organizationId: orgId }
      });

      // Delete organization
      await tx.organization.delete({
        where: { id: orgId }
      });
    });

    logger.info('Organization deleted', {
      orgId,
      deletedBy: req.user!.id
    });

    res.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete organization:', error);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

export default router;