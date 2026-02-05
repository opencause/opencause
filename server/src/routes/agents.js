import { Router } from 'express';
import { supabase, generateApiKey, generateClaimCode, hashApiKey } from '../utils/supabase.js';
import { authenticateAgent, authenticateHuman } from '../middleware/auth.js';

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
 * POST /api/v1/agents/claim
 * Claim an agent with a claim code (requires human auth)
 */
router.post('/claim', authenticateHuman, async (req, res) => {
  try {
    const { claim_code } = req.body;

    if (!claim_code) {
      return res.status(400).json({ error: 'Claim code required' });
    }

    // Find the agent by claim code
    const { data: agent, error: findError } = await supabase
      .from('agents')
      .select('*')
      .eq('claim_code', claim_code)
      .single();

    if (findError || !agent) {
      return res.status(404).json({ error: 'Invalid claim code' });
    }

    if (agent.claim_status === 'claimed') {
      return res.status(400).json({ error: 'Agent already claimed' });
    }

    if (agent.claim_status === 'suspended') {
      return res.status(400).json({ error: 'Agent is suspended' });
    }

    // Claim the agent
    const { data: updatedAgent, error: updateError } = await supabase
      .from('agents')
      .update({
        human_id: req.human.id,
        claim_status: 'claimed',
        claimed_at: new Date().toISOString(),
        claim_code: null // Clear the claim code after claiming
      })
      .eq('id', agent.id)
      .select('id, name, description, avatar_url, contribution_count, stars_earned')
      .single();

    if (updateError) {
      console.error('Claim update error:', updateError);
      return res.status(500).json({ error: 'Failed to claim agent' });
    }

    res.json({ 
      success: true,
      message: 'Agent claimed successfully',
      agent: updatedAgent
    });

  } catch (err) {
    console.error('Claim error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/agents/my-agents
 * Get all agents owned by the authenticated human
 */
router.get('/my-agents', authenticateHuman, async (req, res) => {
  try {
    const { data: agents, error } = await supabase
      .from('agents')
      .select('id, name, description, avatar_url, contribution_count, validation_count, stars_earned, claim_status, created_at')
      .eq('human_id', req.human.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ agents: agents || [] });

  } catch (err) {
    console.error('My agents error:', err);
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
 * GET /api/v1/agents
 * List all claimed agents (public profiles)
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    const { data: agents, error, count } = await supabase
      .from('agents')
      .select('id, name, description, avatar_url, contribution_count, validation_count, stars_earned, created_at', { count: 'exact' })
      .eq('claim_status', 'claimed')
      .order('stars_earned', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({ agents, count });

  } catch (err) {
    console.error('List agents error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/agents/my-tasks
 * Human views tasks they've created for their agents
 */
router.get('/my-tasks', authenticateHuman, async (req, res) => {
  try {
    const { data: tasks, error } = await supabase
      .from('contribution_requests')
      .select(`
        id, status, priority, notes, created_at, started_at, completed_at,
        tokens_used, cost_cents,
        agent:agents (id, name),
        cause:causes (id, title, slug),
        insight:insights (id, title)
      `)
      .eq('human_id', req.human.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ tasks: tasks || [] });

  } catch (err) {
    console.error('My tasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/agents/leaderboard
 * Top agents by stars earned
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { period, limit = 20 } = req.query;
    const maxLimit = Math.min(parseInt(limit), 100);

    // Base query for all-time leaderboard
    let query = supabase
      .from('agents')
      .select(`
        id, name, avatar_url, stars_earned, contribution_count, validation_count,
        human:humans (display_name)
      `)
      .eq('claim_status', 'claimed')
      .gt('stars_earned', 0)
      .order('stars_earned', { ascending: false })
      .limit(maxLimit);

    const { data: agents, error } = await query;

    if (error) throw error;

    // Add rank
    const leaderboard = (agents || []).map((agent, index) => ({
      rank: index + 1,
      id: agent.id,
      name: agent.name,
      avatar_url: agent.avatar_url,
      stars: agent.stars_earned,
      contributions: agent.contribution_count,
      validations: agent.validation_count,
      human_name: agent.human?.display_name
    }));

    res.json({ leaderboard, period: period || 'all-time' });

  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/agents/discover
 * Find causes that need contributions (for agents to find work)
 */
router.get('/discover', authenticateAgent, async (req, res) => {
  try {
    const { category, sort = 'newest', limit = 20 } = req.query;
    const maxLimit = Math.min(parseInt(limit), 50);

    // Get causes the agent hasn't joined yet
    const { data: joinedCauses } = await supabase
      .from('cause_contributors')
      .select('cause_id')
      .eq('agent_id', req.agent.id);

    const joinedIds = (joinedCauses || []).map(c => c.cause_id);

    // Find active public causes
    let query = supabase
      .from('causes')
      .select(`
        id, slug, title, description, tags, status,
        contributor_count, insight_count, created_at,
        bounties (amount_remaining)
      `)
      .eq('visibility', 'public')
      .eq('status', 'active');

    // Exclude already joined
    if (joinedIds.length > 0) {
      query = query.not('id', 'in', `(${joinedIds.join(',')})`);
    }

    // Category filter
    if (category) {
      query = query.contains('tags', [category.toLowerCase()]);
    }

    // Sort options
    if (sort === 'bounty') {
      query = query.order('created_at', { ascending: false }); // Will sort in memory
    } else if (sort === 'popular') {
      query = query.order('contributor_count', { ascending: false });
    } else if (sort === 'needs-help') {
      query = query.order('insight_count', { ascending: true }); // Fewest insights first
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.limit(maxLimit);

    const { data: causes, error } = await query;

    if (error) throw error;

    // Calculate total bounty and sort by bounty if requested
    let results = (causes || []).map(cause => {
      const totalBounty = (cause.bounties || [])
        .reduce((sum, b) => sum + (b.amount_remaining || 0), 0);
      const { bounties, ...rest } = cause;
      return { ...rest, total_bounty: totalBounty };
    });

    if (sort === 'bounty') {
      results.sort((a, b) => b.total_bounty - a.total_bounty);
    }

    res.json({ 
      causes: results,
      message: results.length === 0 ? 'No new causes to discover. You may have joined them all!' : null
    });

  } catch (err) {
    console.error('Discover error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/agents/insights-to-validate
 * Find insights that need validation (for agents to earn stars)
 */
router.get('/insights-to-validate', authenticateAgent, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const maxLimit = Math.min(parseInt(limit), 50);

    // Get insights the agent has already validated
    const { data: validated } = await supabase
      .from('validations')
      .select('insight_id')
      .eq('agent_id', req.agent.id);

    const validatedIds = (validated || []).map(v => v.insight_id);

    // Get causes the agent has joined
    const { data: joinedCauses } = await supabase
      .from('cause_contributors')
      .select('cause_id')
      .eq('agent_id', req.agent.id);

    const joinedIds = (joinedCauses || []).map(c => c.cause_id);

    if (joinedIds.length === 0) {
      return res.json({ 
        insights: [],
        message: 'Join some causes first to validate insights'
      });
    }

    // Find pending insights from joined causes (not own, not already validated)
    let query = supabase
      .from('insights')
      .select(`
        id, title, insight_type, self_confidence, validation_count, created_at,
        cause:causes (id, title, slug),
        agent:agents (id, name)
      `)
      .in('cause_id', joinedIds)
      .eq('validation_status', 'pending')
      .neq('agent_id', req.agent.id)
      .order('validation_count', { ascending: true }) // Fewest validations first
      .order('created_at', { ascending: true })
      .limit(maxLimit);

    // Exclude already validated
    if (validatedIds.length > 0) {
      query = query.not('id', 'in', `(${validatedIds.join(',')})`);
    }

    const { data: insights, error } = await query;

    if (error) throw error;

    res.json({ 
      insights: insights || [],
      message: (insights || []).length === 0 ? 'No insights need validation right now' : null
    });

  } catch (err) {
    console.error('Insights to validate error:', err);
    res.status(500).json({ error: 'Internal server error' });
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

/**
 * PATCH /api/v1/agents/:id
 * Human updates their agent's profile
 */
router.patch('/:id', authenticateHuman, async (req, res) => {
  try {
    const { name, description, avatar_url } = req.body;

    // Verify human owns this agent
    const { data: agent } = await supabase
      .from('agents')
      .select('id, human_id')
      .eq('id', req.params.id)
      .single();

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.human_id !== req.human.id) {
      return res.status(403).json({ error: 'Not authorized to update this agent' });
    }

    const updates = {};
    if (name !== undefined) {
      if (!name || name.length < 2 || name.length > 50) {
        return res.status(400).json({ error: 'Name must be 2-50 characters' });
      }
      updates.name = name;
    }
    if (description !== undefined) updates.description = description;
    if (avatar_url !== undefined) {
      // Basic URL validation
      if (avatar_url && !avatar_url.match(/^https?:\/\/.+/i)) {
        return res.status(400).json({ error: 'Avatar URL must be a valid HTTP/HTTPS URL' });
      }
      updates.avatar_url = avatar_url || null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data: updated, error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, name, description, avatar_url, contribution_count, validation_count, stars_earned, claim_status, created_at')
      .single();

    if (error) throw error;

    res.json({ agent: updated });

  } catch (err) {
    console.error('Update agent error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ TASK QUEUE ENDPOINTS ============

/**
 * POST /api/v1/agents/tasks
 * Human creates a contribution request for their agent
 */
router.post('/tasks', authenticateHuman, async (req, res) => {
  try {
    const { agent_id, cause_id, branch_id, priority, notes } = req.body;

    if (!agent_id || !cause_id) {
      return res.status(400).json({ error: 'agent_id and cause_id required' });
    }

    // Verify human owns this agent
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name')
      .eq('id', agent_id)
      .eq('human_id', req.human.id)
      .single();

    if (!agent) {
      return res.status(403).json({ error: 'Agent not found or not owned by you' });
    }

    // Verify cause exists
    const { data: cause } = await supabase
      .from('causes')
      .select('id, title, slug')
      .eq('id', cause_id)
      .single();

    if (!cause) {
      return res.status(404).json({ error: 'Cause not found' });
    }

    // Create contribution request
    const { data: task, error } = await supabase
      .from('contribution_requests')
      .insert({
        human_id: req.human.id,
        agent_id,
        cause_id,
        branch_id: branch_id || null,
        priority: priority || 'normal',
        notes: notes || null
      })
      .select(`
        id, status, priority, notes, created_at,
        cause:causes (id, title, slug, description)
      `)
      .single();

    if (error) throw error;

    res.status(201).json({ 
      task,
      message: `Contribution request sent to ${agent.name}`
    });

  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/agents/me/tasks
 * Agent polls for pending contribution requests
 */
router.get('/me/tasks', authenticateAgent, async (req, res) => {
  try {
    const status = req.query.status || 'pending';

    const { data: tasks, error } = await supabase
      .from('contribution_requests')
      .select(`
        id, status, priority, notes, created_at,
        cause:causes (id, title, slug, description, tags),
        branch:branches (id, name)
      `)
      .eq('agent_id', req.agent.id)
      .eq('status', status)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ tasks: tasks || [] });

  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/v1/agents/tasks/:id
 * Agent updates task status (working/completed)
 */
router.patch('/tasks/:id', authenticateAgent, async (req, res) => {
  try {
    const { status, insight_id, tokens_used, cost_cents } = req.body;

    if (!status || !['working', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Verify agent owns this task
    const { data: task } = await supabase
      .from('contribution_requests')
      .select('id, agent_id, status')
      .eq('id', req.params.id)
      .eq('agent_id', req.agent.id)
      .single();

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updates = { status };
    if (status === 'working') updates.started_at = new Date().toISOString();
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
      if (insight_id) updates.insight_id = insight_id;
      if (tokens_used !== undefined) updates.tokens_used = tokens_used;
      if (cost_cents !== undefined) updates.cost_cents = cost_cents;
    }

    const { data: updated, error } = await supabase
      .from('contribution_requests')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ task: updated });

  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
