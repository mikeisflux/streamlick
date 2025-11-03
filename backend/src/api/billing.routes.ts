import { Router } from 'express';
import Stripe from 'stripe';
import prisma from '../database/prisma';
import { authenticate, AuthRequest } from '../auth/middleware';
import logger from '../utils/logger';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
});

// Get current subscription
router.get('/subscription', authenticate, async (req: AuthRequest, res) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    res.json(subscription);
  } catch (error) {
    logger.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// Create Stripe Checkout Session
router.post('/create-checkout-session', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Streamlick Pro',
              description: 'All features included - Unlimited streaming',
            },
            unit_amount: 2000, // $20.00
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/settings?tab=billing`,
      metadata: {
        userId: user.id,
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    logger.error('Create checkout session error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create Stripe Customer Portal Session
router.post('/create-portal-session', authenticate, async (req: AuthRequest, res) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user!.userId, status: 'active' },
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeSubscription.customer as string,
      return_url: `${process.env.FRONTEND_URL}/settings?tab=billing`,
    });

    res.json({ url: session.url });
  } catch (error) {
    logger.error('Create portal session error:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Cancel subscription
router.post('/cancel-subscription', authenticate, async (req: AuthRequest, res) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user!.userId, status: 'active' },
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'cancelled' },
    });

    res.json(updated);
  } catch (error) {
    logger.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Stripe Webhook Handler
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).send('No signature');
  }

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;

        if (userId && session.subscription) {
          const stripeSubscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          await prisma.subscription.create({
            data: {
              userId,
              planType: 'pro',
              status: 'active',
              stripeSubscriptionId: stripeSubscription.id,
              currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
              currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
            },
          });

          await prisma.user.update({
            where: { id: userId },
            data: { planType: 'pro' },
          });

          logger.info(`Subscription created for user ${userId}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: subscription.status === 'active' ? 'active' : 'cancelled',
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        const dbSub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (dbSub) {
          await prisma.subscription.update({
            where: { id: dbSub.id },
            data: { status: 'expired' },
          });

          await prisma.user.update({
            where: { id: dbSub.userId },
            data: { planType: 'free' },
          });

          logger.info(`Subscription expired for user ${dbSub.userId}`);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error}`);
  }
});

export default router;
