import { Router } from 'express';
import Stripe from 'stripe';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../utils/database';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20'
});

// Pricing configuration
const PLANS = {
  STARTER: {
    name: 'Starter',
    price: 2900, // $29.00
    maxRepositories: 10,
    maxAnalysesPerMonth: 50,
    features: ['GitHub Integration', 'Basic Analysis', 'Email Support']
  },
  PROFESSIONAL: {
    name: 'Professional',
    price: 9900, // $99.00
    maxRepositories: -1, // unlimited
    maxAnalysesPerMonth: 500,
    features: ['Everything in Starter', 'Advanced AI Analysis', 'Team Collaboration', 'Priority Support', 'Custom Rules']
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 49900, // $499.00
    maxRepositories: -1, // unlimited
    maxAnalysesPerMonth: -1, // unlimited
    features: ['Everything in Professional', 'SSO/SAML', 'On-premise Options', 'SLA', 'Dedicated Support']
  }
};

// Get current subscription
router.get('/current', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user!.id },
      select: {
        id: true,
        status: true,
        plan: true,
        billingInterval: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        maxRepositories: true,
        maxAnalysesPerMonth: true,
        maxTeamMembers: true,
        repositoriesUsed: true,
        analysesThisMonth: true,
        stripeSubscriptionId: true,
        stripePriceId: true
      }
    });

    if (!subscription) {
      throw createError('No subscription found', 404);
    }

    // Get plan features
    const planConfig = PLANS[subscription.plan as keyof typeof PLANS];

    res.json({
      subscription: {
        ...subscription,
        planName: planConfig?.name || subscription.plan,
        features: planConfig?.features || [],
        usage: {
          repositories: {
            used: subscription.repositoriesUsed,
            limit: subscription.maxRepositories === -1 ? 'unlimited' : subscription.maxRepositories,
            percentage: subscription.maxRepositories === -1 ? 0 : 
              Math.round((subscription.repositoriesUsed / subscription.maxRepositories) * 100)
          },
          analyses: {
            used: subscription.analysesThisMonth,
            limit: subscription.maxAnalysesPerMonth === -1 ? 'unlimited' : subscription.maxAnalysesPerMonth,
            percentage: subscription.maxAnalysesPerMonth === -1 ? 0 :
              Math.round((subscription.analysesThisMonth / subscription.maxAnalysesPerMonth) * 100)
          }
        }
      }
    });
  } catch (error) {
    logger.error('Failed to fetch subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Get available plans
router.get('/plans', async (req, res) => {
  try {
    const plans = Object.entries(PLANS).map(([key, plan]) => ({
      id: key,
      name: plan.name,
      price: plan.price,
      maxRepositories: plan.maxRepositories === -1 ? 'unlimited' : plan.maxRepositories,
      maxAnalysesPerMonth: plan.maxAnalysesPerMonth === -1 ? 'unlimited' : plan.maxAnalysesPerMonth,
      features: plan.features,
      popular: key === 'PROFESSIONAL' // Mark popular plan
    }));

    res.json({ plans });
  } catch (error) {
    logger.error('Failed to fetch plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Create checkout session
router.post('/checkout', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { plan, billingInterval = 'MONTH' } = req.body;

    if (!PLANS[plan as keyof typeof PLANS]) {
      throw createError('Invalid plan selected', 400);
    }

    // Check if user already has an active subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: { 
        userId: req.user!.id,
        status: 'ACTIVE'
      }
    });

    if (existingSubscription && existingSubscription.plan !== 'FREE') {
      throw createError('User already has an active subscription', 409);
    }

    // Create or get Stripe customer
    let stripeCustomerId;
    
    const existingCustomer = await prisma.subscription.findFirst({
      where: { userId: req.user!.id },
      select: { stripeCustomerId: true }
    });

    if (existingCustomer?.stripeCustomerId) {
      stripeCustomerId = existingCustomer.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email: req.user!.email,
        name: req.user!.name || undefined,
        metadata: {
          userId: req.user!.id
        }
      });
      stripeCustomerId = customer.id;
    }

    // Create price if doesn't exist
    const planConfig = PLANS[plan as keyof typeof PLANS];
    const priceInterval = billingInterval === 'YEAR' ? 'year' : 'month';
    const unitAmount = billingInterval === 'YEAR' ? 
      Math.round(planConfig.price * 10) : // 10 months price for annual
      planConfig.price;

    const price = await stripe.prices.create({
      unit_amount: unitAmount,
      currency: 'usd',
      recurring: {
        interval: priceInterval
      },
      product_data: {
        name: `Vibecode ${planConfig.name}`,
        description: `AI-powered code analysis platform - ${planConfig.name} plan`
      }
    });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: price.id,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?checkout=cancelled`,
      metadata: {
        userId: req.user!.id,
        plan,
        billingInterval
      },
      subscription_data: {
        metadata: {
          userId: req.user!.id,
          plan,
          billingInterval
        }
      }
    });

    logger.info('Checkout session created', {
      userId: req.user!.id,
      sessionId: session.id,
      plan,
      billingInterval
    });

    res.json({
      checkoutUrl: session.url,
      sessionId: session.id
    });
  } catch (error) {
    logger.error('Failed to create checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create customer portal session
router.post('/portal', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user!.id },
      select: { stripeCustomerId: true }
    });

    if (!subscription?.stripeCustomerId) {
      throw createError('No billing account found', 404);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/dashboard/settings/billing`
    });

    logger.info('Customer portal session created', {
      userId: req.user!.id,
      customerId: subscription.stripeCustomerId
    });

    res.json({
      portalUrl: session.url
    });
  } catch (error) {
    logger.error('Failed to create portal session:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Get billing history
router.get('/billing-history', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user!.id },
      select: { stripeCustomerId: true }
    });

    if (!subscription?.stripeCustomerId) {
      throw createError('No billing account found', 404);
    }

    const invoices = await stripe.invoices.list({
      customer: subscription.stripeCustomerId,
      limit: 20
    });

    const billingHistory = invoices.data.map(invoice => ({
      id: invoice.id,
      date: new Date(invoice.created * 1000),
      amount: invoice.amount_paid,
      status: invoice.status,
      description: invoice.description || 'Subscription payment',
      downloadUrl: invoice.hosted_invoice_url,
      pdfUrl: invoice.invoice_pdf
    }));

    res.json({ billingHistory });
  } catch (error) {
    logger.error('Failed to fetch billing history:', error);
    res.status(500).json({ error: 'Failed to fetch billing history' });
  }
});

// Cancel subscription
router.post('/cancel', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { reason } = req.body;

    const subscription = await prisma.subscription.findFirst({
      where: { 
        userId: req.user!.id,
        status: 'ACTIVE'
      }
    });

    if (!subscription?.stripeSubscriptionId) {
      throw createError('No active subscription found', 404);
    }

    // Cancel at period end in Stripe
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
      metadata: {
        cancellationReason: reason || 'User requested'
      }
    });

    // Update status in database
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELED' }
    });

    logger.info('Subscription cancelled', {
      userId: req.user!.id,
      subscriptionId: subscription.id,
      reason
    });

    res.json({
      message: 'Subscription will be cancelled at the end of your current billing period',
      cancellationDate: subscription.currentPeriodEnd
    });
  } catch (error) {
    logger.error('Failed to cancel subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Reactivate subscription
router.post('/reactivate', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { 
        userId: req.user!.id,
        status: 'CANCELED'
      }
    });

    if (!subscription?.stripeSubscriptionId) {
      throw createError('No cancelled subscription found', 404);
    }

    // Reactivate in Stripe
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    // Update status in database
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'ACTIVE' }
    });

    logger.info('Subscription reactivated', {
      userId: req.user!.id,
      subscriptionId: subscription.id
    });

    res.json({
      message: 'Subscription has been reactivated'
    });
  } catch (error) {
    logger.error('Failed to reactivate subscription:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

// Usage statistics
router.get('/usage', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
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

    const [analysisUsage, subscription] = await Promise.all([
      prisma.analysisResult.groupBy({
        by: ['analyzedAt'],
        where: {
          userId: req.user!.id,
          analyzedAt: {
            gte: startDate
          }
        },
        _count: {
          id: true
        },
        orderBy: {
          analyzedAt: 'asc'
        }
      }),
      prisma.subscription.findFirst({
        where: { userId: req.user!.id },
        select: {
          maxAnalysesPerMonth: true,
          analysesThisMonth: true,
          maxRepositories: true,
          repositoriesUsed: true
        }
      })
    ]);

    // Group usage by day
    const dailyUsage = new Map();
    
    analysisUsage.forEach(usage => {
      const day = usage.analyzedAt.toISOString().split('T')[0];
      dailyUsage.set(day, (dailyUsage.get(day) || 0) + usage._count.id);
    });

    const usageChart = Array.from(dailyUsage.entries()).map(([date, count]) => ({
      date,
      analyses: count
    }));

    res.json({
      usage: {
        analyses: {
          thisMonth: subscription?.analysesThisMonth || 0,
          limit: subscription?.maxAnalysesPerMonth === -1 ? 'unlimited' : subscription?.maxAnalysesPerMonth || 0,
          chart: usageChart
        },
        repositories: {
          used: subscription?.repositoriesUsed || 0,
          limit: subscription?.maxRepositories === -1 ? 'unlimited' : subscription?.maxRepositories || 0
        }
      },
      timeframe
    });
  } catch (error) {
    logger.error('Failed to fetch usage statistics:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

export default router;