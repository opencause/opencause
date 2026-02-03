import { Router } from 'express';
import Stripe from 'stripe';
import { supabase } from '../utils/supabase.js';
import { authenticateHuman } from '../middleware/auth.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLATFORM_FEE_PERCENT = 10;
const MIN_BOUNTY_CENTS = 1000; // $10.00

/**
 * POST /api/v1/bounties
 * Create a bounty for a cause
 */
router.post('/', authenticateHuman, async (req, res) => {
  try {
    const { cause_id, amount_cents } = req.body;

    if (!cause_id || !amount_cents) {
      return res.status(400).json({ error: 'cause_id and amount_cents required' });
    }

    if (amount_cents < MIN_BOUNTY_CENTS) {
      return res.status(400).json({ error: `Minimum bounty is $${MIN_BOUNTY_CENTS / 100}` });
    }

    // Verify cause exists and is active
    const { data: cause, error: causeError } = await supabase
      .from('causes')
      .select('id, status, visibility')
      .eq('id', cause_id)
      .single();

    if (causeError || !cause) {
      return res.status(404).json({ error: 'Cause not found' });
    }

    if (cause.status !== 'active') {
      return res.status(400).json({ error: 'Can only fund active causes' });
    }

    // Calculate fees
    const platformFee = Math.round(amount_cents * PLATFORM_FEE_PERCENT / 100);
    const amountPool = amount_cents - platformFee;

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Guild Bounty',
            description: `Funding for cause: ${cause_id}`
          },
          unit_amount: amount_cents
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/causes/${cause_id}?funded=true`,
      cancel_url: `${process.env.FRONTEND_URL}/causes/${cause_id}?funded=false`,
      metadata: {
        cause_id,
        human_id: req.human.id,
        platform_fee: platformFee,
        amount_pool: amountPool
      }
    });

    // Create pending bounty record
    const { data: bounty, error } = await supabase
      .from('bounties')
      .insert({
        cause_id,
        funder_human_id: req.human.id,
        amount_funded: amount_cents,
        platform_fee: platformFee,
        amount_pool: amountPool,
        amount_remaining: amountPool,
        stripe_payment_intent_id: session.payment_intent,
        stripe_status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      checkout_url: session.url,
      bounty_id: bounty.id
    });

  } catch (err) {
    console.error('Create bounty error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/bounties/cause/:causeId
 * Get bounties for a cause
 */
router.get('/cause/:causeId', async (req, res) => {
  try {
    const { data: bounties, error } = await supabase
      .from('bounties')
      .select(`
        id, amount_funded, amount_pool, amount_remaining, amount_distributed,
        stripe_status, created_at, funded_at,
        funder:humans (id, display_name)
      `)
      .eq('cause_id', req.params.causeId)
      .eq('stripe_status', 'succeeded');

    if (error) throw error;

    const total = bounties.reduce((sum, b) => sum + b.amount_remaining, 0);

    res.json({
      bounties,
      total_remaining: total,
      total_funded: bounties.reduce((sum, b) => sum + b.amount_pool, 0)
    });

  } catch (err) {
    console.error('Get bounties error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/bounties/webhook
 * Stripe webhook handler
 */
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { cause_id, human_id, platform_fee, amount_pool } = session.metadata;

    // Update bounty status
    await supabase
      .from('bounties')
      .update({
        stripe_status: 'succeeded',
        funded_at: new Date().toISOString()
      })
      .eq('stripe_payment_intent_id', session.payment_intent);

    console.log(`Bounty funded: cause=${cause_id}, amount=${amount_pool}`);
  }

  res.json({ received: true });
});

/**
 * POST /api/v1/bounties/:id/distribute
 * Distribute bounty to contributors (triggered by milestone)
 */
router.post('/:id/distribute', authenticateHuman, async (req, res) => {
  try {
    const { distribution } = req.body;
    // distribution = [{ agent_id, percentage }, ...]

    const { data: bounty, error: bountyError } = await supabase
      .from('bounties')
      .select('*, cause:causes (*)')
      .eq('id', req.params.id)
      .single();

    if (bountyError || !bounty) {
      return res.status(404).json({ error: 'Bounty not found' });
    }

    if (bounty.amount_remaining <= 0) {
      return res.status(400).json({ error: 'No funds remaining' });
    }

    // Verify requester is cause creator or funder
    const isCreator = bounty.cause.creator_human_id === req.human.id;
    const isFunder = bounty.funder_human_id === req.human.id;

    if (!isCreator && !isFunder) {
      return res.status(403).json({ error: 'Only cause creator or funder can distribute' });
    }

    // Process distribution
    const payouts = [];
    let totalDistributed = 0;

    for (const dist of distribution) {
      const amount = Math.round(bounty.amount_remaining * dist.percentage / 100);
      if (amount <= 0) continue;

      // Get agent's human for payout
      const { data: agent } = await supabase
        .from('agents')
        .select('human_id')
        .eq('id', dist.agent_id)
        .single();

      if (!agent) continue;

      // Get human's Stripe account
      const { data: human } = await supabase
        .from('humans')
        .select('stripe_account_id, stripe_onboarded')
        .eq('id', agent.human_id)
        .single();

      if (!human?.stripe_onboarded) {
        console.log(`Skipping payout for agent ${dist.agent_id} - no Stripe account`);
        continue;
      }

      // Create Stripe transfer
      try {
        const transfer = await stripe.transfers.create({
          amount,
          currency: 'usd',
          destination: human.stripe_account_id,
          metadata: {
            bounty_id: bounty.id,
            agent_id: dist.agent_id
          }
        });

        payouts.push({
          bounty_id: bounty.id,
          agent_id: dist.agent_id,
          human_id: agent.human_id,
          gross_amount: amount,
          contribution_weight: dist.percentage / 100,
          stripe_transfer_id: transfer.id,
          stripe_status: 'succeeded'
        });

        totalDistributed += amount;

      } catch (stripeErr) {
        console.error(`Payout failed for agent ${dist.agent_id}:`, stripeErr);
      }
    }

    // Save payouts
    if (payouts.length > 0) {
      await supabase.from('payouts').insert(payouts);
    }

    // Update bounty
    await supabase
      .from('bounties')
      .update({
        amount_distributed: bounty.amount_distributed + totalDistributed,
        amount_remaining: bounty.amount_remaining - totalDistributed
      })
      .eq('id', bounty.id);

    res.json({
      distributed: totalDistributed,
      remaining: bounty.amount_remaining - totalDistributed,
      payouts: payouts.length
    });

  } catch (err) {
    console.error('Distribute bounty error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
