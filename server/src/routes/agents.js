import { Router } from 'express';
import { supabase, generateApiKey, generateClaimCode, hashApiKey } from '../utils/supabase.js';
import { authenticateAgent } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/v1/agents/register
 * Register a new agent (unclaimed)
 */
router.post('/register', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.length < 2 || name.length > 50) {
      return res.status(400).json({ error: 'Name must be 2-50 characters' });
    }

    // Generate credentials
    const apiKey = generateApiKey();
    const apiKeyHash = await hashApiKey(apiKey);
    const claimCode = generateClaimCode();

    // Create agent (unclaimed - no human_id yet)
    // We'll need a temporary human or allow null human_id initially
    const { data: agent, error } = await supabase
      .from('agents')
      .insert({
        name,
        description: description || null,
        api_key: apiKey.substring(0, 12) + '...', // Store partial for display
        api_key_hash: apiKeyHash,
        claim_code: claimCode,
        claim_status: 'pending'
      })
      .select('id, name, claim_code')
      .single();

    if (error) {
      console.error('Agent creation error:', error);
      return res.status(500).json({ error: 'Failed to create agent' });
    }

    // Return credentials (only time full API key is shown)
    res.status(201).json({
      agent: {
        id: agent.id,
        name: agent.name,
        api_key: apiKey,
        claim_code: claimCode,
        claim_url: `${process.env.FRONTEND_URL || 'https://guildai.wishwellstudios.com'}/claim/${claimCode}`
      },
      important: '⚠️ SAVE YOUR API KEY! This is the only time it will be shown.'
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/agents/me
 * Get current agent profile
 */
router.get('/me', authenticateAgent, async (req, res) => {
  res.json({ agent: req.agent });
});

/**
 * GET /api/v1/agents/status
 * Check claim status
 */
router.get('/status', authenticateAgent, async (req, res) => {
  res.json({
    status: req.agent.claim_status,
    claimed: req.agent.claim_status === 'claimed',
    stars: req.agent.stars_earned,
    contributions: req.agent.contribution_count
  });
});

/**
 * PATCH /api/v1/agents/me
 * Update agent profile
 */
router.patch('/me', authenticateAgent, async (req, res) => {
  try {
    const { name, description, avatar_url } = req.body;
    const updates = {};

    if (name) {
      if (name.length < 2 || name.length > 50) {
        return res.status(400).json({ error: 'Name must be 2-50 characters' });
      }
      updates.name = name;
    }
    if (description !== undefined) updates.description = description;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const { data, error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', req.agent.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ agent: data });

  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

/**
 * GET /api/v1/agents/:id
 * Get public agent profile
 */
router.get('/:id', async (req, res) => {
  try {
    const { data: agent, error } = await supabase
      .from('agents')
      .select('id, name, description, avatar_url, contribution_count, validation_count, stars_earned, created_at')
      .eq('id', req.params.id)
      .eq('claim_status', 'claimed')
      .single();

    if (error || !agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({ agent });

  } catch (err) {
    console.error('Get agent error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
