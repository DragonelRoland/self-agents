import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { AnalysisService } from '../services/AnalysisService';

const router = Router();

// GitHub webhook endpoint
router.post('/github', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const payload = JSON.stringify(req.body);
    const event = req.headers['x-github-event'] as string;

    // Verify webhook signature
    if (!verifyGitHubSignature(payload, signature)) {
      logger.warn('Invalid GitHub webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Store webhook event for processing
    await prisma.webhookEvent.create({
      data: {
        provider: 'GITHUB',
        repository: req.body.repository?.full_name || 'unknown',
        event,
        payload: req.body,
        processed: false
      }
    });

    logger.info('GitHub webhook received', {
      event,
      repository: req.body.repository?.full_name,
      sender: req.body.sender?.login
    });

    // Process webhook asynchronously
    processGitHubWebhook(req.body, event).catch(error => {
      logger.error('Webhook processing failed:', error);
    });

    res.status(200).json({ message: 'Webhook received' });
  } catch (error) {
    logger.error('GitHub webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Stripe webhook endpoint
router.post('/stripe', async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.error('Stripe webhook secret not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    // Verify Stripe webhook signature
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (err) {
      logger.warn('Invalid Stripe webhook signature:', err);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    logger.info('Stripe webhook received', {
      type: event.type,
      id: event.id
    });

    // Process Stripe webhook
    await processStripeWebhook(event);

    res.status(200).json({ message: 'Webhook received' });
  } catch (error) {
    logger.error('Stripe webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Verify GitHub webhook signature
function verifyGitHubSignature(payload: string, signature: string): boolean {
  try {
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.warn('GitHub webhook secret not configured');
      return false;
    }

    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('Signature verification failed:', error);
    return false;
  }
}

// Process GitHub webhook events
async function processGitHubWebhook(payload: any, event: string) {
  try {
    switch (event) {
      case 'push':
        await handlePushEvent(payload);
        break;
      case 'pull_request':
        await handlePullRequestEvent(payload);
        break;
      case 'installation':
      case 'installation_repositories':
        await handleInstallationEvent(payload);
        break;
      default:
        logger.debug('Unhandled GitHub webhook event:', event);
    }
  } catch (error) {
    logger.error('Failed to process GitHub webhook:', error);
    throw error;
  }
}

// Handle GitHub push events
async function handlePushEvent(payload: any) {
  try {
    const { repository, pusher, ref, head_commit } = payload;
    
    if (!repository || !head_commit) {
      return;
    }

    // Find repository in our database
    const repo = await prisma.repository.findUnique({
      where: {
        provider_providerId: {
          provider: 'GITHUB',
          providerId: repository.id.toString()
        }
      },
      include: {
        user: {
          select: {
            id: true,
            githubToken: true
          }
        }
      }
    });

    if (!repo || !repo.analysisEnabled || !repo.user?.githubToken) {
      return;
    }

    // Extract branch name from ref
    const branch = ref.replace('refs/heads/', '');
    
    // Only analyze default branch pushes
    if (branch !== repo.defaultBranch) {
      return;
    }

    logger.info('Triggering analysis for push event', {
      repository: repository.full_name,
      branch,
      commit: head_commit.id
    });

    // Trigger analysis
    const analysisService = new AnalysisService();
    await analysisService.analyzeRepository(
      repo,
      repo.user.githubToken,
      {
        branch,
        analysisType: 'incremental',
        triggeredBy: 'webhook',
        userId: repo.userId!
      }
    );

    logger.info('Push event analysis completed', {
      repository: repository.full_name,
      repositoryId: repo.id
    });

  } catch (error) {
    logger.error('Push event handling failed:', error);
    throw error;
  }
}

// Handle GitHub pull request events
async function handlePullRequestEvent(payload: any) {
  try {
    const { action, pull_request, repository } = payload;
    
    // Only handle opened and synchronized (updated) PRs
    if (!['opened', 'synchronize'].includes(action)) {
      return;
    }

    // Find repository in our database
    const repo = await prisma.repository.findUnique({
      where: {
        provider_providerId: {
          provider: 'GITHUB',
          providerId: repository.id.toString()
        }
      },
      include: {
        user: {
          select: {
            id: true,
            githubToken: true
          }
        }
      }
    });

    if (!repo || !repo.analysisEnabled || !repo.user?.githubToken) {
      return;
    }

    logger.info('Triggering analysis for PR event', {
      repository: repository.full_name,
      prNumber: pull_request.number,
      action
    });

    // Trigger analysis on PR branch
    const analysisService = new AnalysisService();
    await analysisService.analyzeRepository(
      repo,
      repo.user.githubToken,
      {
        branch: pull_request.head.ref,
        analysisType: 'pr',
        triggeredBy: 'webhook',
        userId: repo.userId!
      }
    );

    logger.info('PR event analysis completed', {
      repository: repository.full_name,
      repositoryId: repo.id,
      prNumber: pull_request.number
    });

  } catch (error) {
    logger.error('Pull request event handling failed:', error);
    throw error;
  }
}

// Handle GitHub installation events
async function handleInstallationEvent(payload: any) {
  try {
    const { action, installation, sender } = payload;
    
    logger.info('GitHub app installation event', {
      action,
      installationId: installation.id,
      account: installation.account.login
    });

    // Here you could auto-import repositories when the app is installed
    // For now, just log the event

  } catch (error) {
    logger.error('Installation event handling failed:', error);
    throw error;
  }
}

// Process Stripe webhook events
async function processStripeWebhook(event: any) {
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      default:
        logger.debug('Unhandled Stripe webhook event:', event.type);
    }
  } catch (error) {
    logger.error('Failed to process Stripe webhook:', error);
    throw error;
  }
}

// Handle successful checkout
async function handleCheckoutCompleted(session: any) {
  try {
    const { customer, subscription, metadata } = session;
    const { userId, plan, billingInterval } = metadata;

    if (!userId || !plan) {
      logger.error('Missing metadata in checkout session');
      return;
    }

    const planConfig = {
      STARTER: { maxRepositories: 10, maxAnalysesPerMonth: 50 },
      PROFESSIONAL: { maxRepositories: -1, maxAnalysesPerMonth: 500 },
      ENTERPRISE: { maxRepositories: -1, maxAnalysesPerMonth: -1 }
    }[plan];

    if (!planConfig) {
      logger.error('Invalid plan in checkout session:', plan);
      return;
    }

    // Update or create subscription
    await prisma.subscription.upsert({
      where: { userId },
      update: {
        status: 'ACTIVE',
        plan,
        billingInterval,
        stripeSubscriptionId: subscription,
        stripeCustomerId: customer,
        maxRepositories: planConfig.maxRepositories,
        maxAnalysesPerMonth: planConfig.maxAnalysesPerMonth,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + (billingInterval === 'YEAR' ? 365 : 30) * 24 * 60 * 60 * 1000)
      },
      create: {
        userId,
        status: 'ACTIVE',
        plan,
        billingInterval,
        stripeSubscriptionId: subscription,
        stripeCustomerId: customer,
        maxRepositories: planConfig.maxRepositories,
        maxAnalysesPerMonth: planConfig.maxAnalysesPerMonth,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + (billingInterval === 'YEAR' ? 365 : 30) * 24 * 60 * 60 * 1000)
      }
    });

    logger.info('Checkout completed successfully', {
      userId,
      plan,
      subscriptionId: subscription
    });

  } catch (error) {
    logger.error('Checkout completion handling failed:', error);
    throw error;
  }
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription: any) {
  try {
    const { id, customer, status, current_period_start, current_period_end, metadata } = subscription;
    
    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: id }
    });

    if (!dbSubscription) {
      logger.warn('Subscription not found in database:', id);
      return;
    }

    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: status.toUpperCase(),
        currentPeriodStart: new Date(current_period_start * 1000),
        currentPeriodEnd: new Date(current_period_end * 1000)
      }
    });

    logger.info('Subscription updated', {
      subscriptionId: id,
      status
    });

  } catch (error) {
    logger.error('Subscription update handling failed:', error);
    throw error;
  }
}

// Handle subscription deletion
async function handleSubscriptionDeleted(subscription: any) {
  try {
    const { id } = subscription;
    
    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: id }
    });

    if (!dbSubscription) {
      logger.warn('Subscription not found in database:', id);
      return;
    }

    // Downgrade to free plan
    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: 'CANCELED',
        plan: 'FREE',
        maxRepositories: 3,
        maxAnalysesPerMonth: 10,
        stripeSubscriptionId: null,
        stripePriceId: null
      }
    });

    logger.info('Subscription cancelled and downgraded to free', {
      subscriptionId: id,
      userId: dbSubscription.userId
    });

  } catch (error) {
    logger.error('Subscription deletion handling failed:', error);
    throw error;
  }
}

// Handle successful payment
async function handlePaymentSucceeded(invoice: any) {
  try {
    const { subscription, customer } = invoice;
    
    logger.info('Payment succeeded', {
      subscriptionId: subscription,
      customerId: customer,
      amount: invoice.amount_paid
    });

    // Reset usage counters at the start of new billing period
    if (invoice.billing_reason === 'subscription_cycle') {
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription },
        data: {
          analysesThisMonth: 0,
          lastUsageReset: new Date()
        }
      });
    }

  } catch (error) {
    logger.error('Payment success handling failed:', error);
    throw error;
  }
}

// Handle failed payment
async function handlePaymentFailed(invoice: any) {
  try {
    const { subscription, customer, attempt_count } = invoice;
    
    logger.warn('Payment failed', {
      subscriptionId: subscription,
      customerId: customer,
      attemptCount: attempt_count
    });

    // Update subscription status after multiple failures
    if (attempt_count >= 3) {
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription },
        data: {
          status: 'PAST_DUE'
        }
      });
    }

  } catch (error) {
    logger.error('Payment failure handling failed:', error);
    throw error;
  }
}

export default router;