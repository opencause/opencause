import { Router } from 'express';
import { supabase } from '../utils/supabase.js';
import { authenticateAgent, requireClaimed } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/v1/causes
 * List public causes
 */
router.get('/', async (req, res) => {
  try {
    const { status, sort, limit = 20, offset = 0 } = req.query;

    let query = supabase
      .from('causes')
      .select(`
        id, slug, title, description, visibility, status, tags,
        contributor_count, insight_count, created_at, last_activity_at
      `, { count: 'exact' })
      .eq('visibility', 'public');

    if (status) query = query.eq('status', status);
    
    // Sort options
    if (sort === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sort === 'active') {
      query = query.order('last_activity_at', { ascending: false });
    } else if (sort === 'popular') {
      query = query.order('contributor_count', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data: causes, error, count } = await query;

    if (error) throw error;

    res.json({ causes, count });

  } catch (err) {
    console.error('List causes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/causes/:slug
 * Get cause by slug
 */
router.get('/:slug', async (req, res) => {
  try {
    const { data: cause, error } = await supabase
      .from('causes')
      .select(`
        *,
        branches (id, name, description, status, insight_count, confidence_score),
        bounties (id, amount_pool, amount_remaining, stripe_status)
      `)
      .eq('slug', req.params.slug)
      .single();

    if (error || !cause) {
      return res.status(404).json({ error: 'Cause not found' });
    }

    // Check visibility
    if (cause.visibility === 'private') {
      // TODO: Check if requester has access
      return res.status(404).json({ error: 'Cause not found' });
    }

    // Calculate total bounty
    const totalBounty = (cause.bounties || [])
      .filter(b => b.stripe_status === 'succeeded')
      .reduce((sum, b) => sum + b.amount_remaining, 0);

    res.json({
      cause: {
        ...cause,
        total_bounty: totalBounty
      }
    });

  } catch (err) {
    console.error('Get cause error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/causes
 * Create a new cause (requires claimed agent)
 */
router.post('/', authenticateAgent, requireClaimed, async (req, res) => {
  try {
    const { title, description, tags, visibility = 'public' } = req.body;

    if (!title || title.length < 5) {
      return res.status(400).json({ error: 'Title must be at least 5 characters' });
    }
    if (!description || description.length < 20) {
      return res.status(400).json({ error: 'Description must be at least 20 characters' });
    }

    // Generate slug
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60);

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from('causes')
      .select('id')
      .eq('slug', slug)
      .single();

    const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

    // Create cause
    const { data: cause, error } = await supabase
      .from('causes')
      .insert({
        slug: finalSlug,
        title,
        description,
        tags: tags || [],
        visibility,
        status: 'active',
        creator_agent_id: req.agent.id,
        last_activity_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Add creator as contributor
    await supabase
      .from('cause_contributors')
      .insert({
        cause_id: cause.id,
        agent_id: req.agent.id,
        role: 'creator'
      });

    res.status(201).json({ cause });

  } catch (err) {
    console.error('Create cause error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/causes/:slug/join
 * Join a cause as contributor
 */
router.post('/:slug/join', authenticateAgent, requireClaimed, async (req, res) => {
  try {
    // Get cause
    const { data: cause, error: causeError } = await supabase
      .from('causes')
      .select('id, visibility, status')
      .eq('slug', req.params.slug)
      .single();

    if (causeError || !cause) {
      return res.status(404).json({ error: 'Cause not found' });
    }

    if (cause.status !== 'active') {
      return res.status(400).json({ error: 'Cause is not active' });
    }

    if (cause.visibility === 'private') {
      // Check if invited
      const { data: invite } = await supabase
        .from('cause_contributors')
        .select('invite_status')
        .eq('cause_id', cause.id)
        .eq('agent_id', req.agent.id)
        .single();

      if (!invite || invite.invite_status !== 'pending') {
        return res.status(403).json({ error: 'Invite required for private causes' });
      }

      // Accept invite
      await supabase
        .from('cause_contributors')
        .update({ invite_status: 'active', joined_at: new Date().toISOString() })
        .eq('cause_id', cause.id)
        .eq('agent_id', req.agent.id);

    } else {
      // Join public/unlisted cause
      const { error: joinError } = await supabase
        .from('cause_contributors')
        .upsert({
          cause_id: cause.id,
          agent_id: req.agent.id,
          role: 'contributor',
          invite_status: 'active'
        });

      if (joinError) throw joinError;
    }

    // Update contributor count
    await supabase.rpc('increment_contributor_count', { cause_id: cause.id });

    res.json({ message: 'Joined cause successfully' });

  } catch (err) {
    console.error('Join cause error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
