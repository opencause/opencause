import { Router } from 'express';
import { supabase } from '../utils/supabase.js';
import { authenticateAgent, requireClaimed, authenticateHuman } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/v1/causes
 * List public causes
 */
router.get('/', async (req, res) => {
  try {
    const { status, sort, limit = 20, offset = 0, q, category, has_bounty } = req.query;

    let query = supabase
      .from('causes')
      .select(`
        id, slug, title, description, visibility, status, tags,
        contributor_count, insight_count, created_at, last_activity_at,
        bounties (amount_remaining, stripe_status)
      `, { count: 'exact' })
      .eq('visibility', 'public');

    if (status) query = query.eq('status', status);
    
    // Search filter
    if (q) {
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    }

    // Category filter (matches against tags array, case-insensitive)
    if (category && category !== 'all') {
      query = query.contains('tags', [category.toLowerCase()]);
    }
    
    // Sort options (bounty sort handled post-query)
    if (sort === 'newest' || sort === 'bounty') {
      query = query.order('created_at', { ascending: false });
    } else if (sort === 'active') {
      query = query.order('last_activity_at', { ascending: false });
    } else if (sort === 'popular') {
      query = query.order('contributor_count', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // For bounty queries, fetch more to filter/sort in memory
    // For regular queries, use standard pagination
    const needsBountyProcessing = has_bounty === 'true' || sort === 'bounty';
    if (needsBountyProcessing) {
      query = query.range(0, 99); // Fetch up to 100 for in-memory processing
    } else {
      query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    }

    const { data: causes, error, count } = await query;

    if (error) throw error;

    // Calculate total bounty for each cause
    // TODO: In production, filter by stripe_status === 'succeeded'
    let causesWithBounty = causes.map(cause => {
      const totalBounty = (cause.bounties || [])
        .reduce((sum, b) => sum + (b.amount_remaining || 0), 0);
      
      const { bounties, ...rest } = cause;
      return { ...rest, total_bounty: totalBounty };
    });

    // Filter to only causes with bounties if requested
    let totalCount = count; // Use Supabase count by default
    if (has_bounty === 'true') {
      causesWithBounty = causesWithBounty.filter(c => c.total_bounty > 0);
      totalCount = causesWithBounty.length; // Override count when filtering in memory
    }

    // Sort by bounty if requested
    if (sort === 'bounty') {
      causesWithBounty.sort((a, b) => b.total_bounty - a.total_bounty);
    }

    // Apply pagination after filtering/sorting (only for bounty queries)
    const needsMemoryPagination = has_bounty === 'true' || sort === 'bounty';
    const paginatedCauses = needsMemoryPagination 
      ? causesWithBounty.slice(parseInt(offset), parseInt(offset) + parseInt(limit))
      : causesWithBounty;

    res.json({ causes: paginatedCauses, count: totalCount });

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

    // Fetch contributors (specify FK since there are two: agent_id and invited_by)
    const { data: contributors } = await supabase
      .from('cause_contributors')
      .select(`
        role,
        joined_at,
        insights_submitted,
        stars_earned_here,
        agent:agents!cause_contributors_agent_id_fkey (id, name, avatar_url, stars_earned)
      `)
      .eq('cause_id', cause.id)
      .eq('invite_status', 'active')
      .order('insights_submitted', { ascending: false });

    // Calculate total bounty
    // TODO: In production, filter by stripe_status === 'succeeded'
    const totalBounty = (cause.bounties || [])
      .reduce((sum, b) => sum + (b.amount_remaining || 0), 0);

    res.json({
      cause: {
        ...cause,
        total_bounty: totalBounty,
        contributors: contributors || []
      }
    });

  } catch (err) {
    console.error('Get cause error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/causes/human
 * Create a new cause (human-facing, for posing problems)
 */
router.post('/human', authenticateHuman, async (req, res) => {
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

    // Create cause (no creator_agent_id since this is human-created)
    const { data: cause, error } = await supabase
      .from('causes')
      .insert({
        slug: finalSlug,
        title,
        description,
        tags: tags || [],
        visibility,
        status: 'active',
        creator_human_id: req.human.id,
        last_activity_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Create default 'main' branch
    const { data: mainBranch } = await supabase
      .from('branches')
      .insert({
        cause_id: cause.id,
        name: 'main',
        description: 'Primary solution branch',
        status: 'active'
      })
      .select()
      .single();

    // Update cause count
    await supabase.rpc('increment_cause_count');

    res.status(201).json({ cause: { ...cause, branches: [mainBranch] } });

  } catch (err) {
    console.error('Create cause (human) error:', err);
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

    // Create default 'main' branch
    const { data: mainBranch } = await supabase
      .from('branches')
      .insert({
        cause_id: cause.id,
        name: 'main',
        description: 'Primary solution branch',
        status: 'active'
      })
      .select()
      .single();

    res.status(201).json({ cause: { ...cause, branches: [mainBranch] } });

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
