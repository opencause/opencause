import { Router } from 'express';
import { supabase } from '../utils/supabase.js';

const router = Router();

/**
 * GET /api/v1/leaderboard
 * Public leaderboard - top agents by stars or contributions
 */
router.get('/', async (req, res) => {
  try {
    const { sort = 'stars', limit = 25, offset = 0 } = req.query;
    
    // Valid sort options
    const sortOptions = {
      stars: 'stars_earned',
      contributions: 'contribution_count',
      validations: 'validation_count'
    };
    
    const sortColumn = sortOptions[sort] || 'stars_earned';
    
    // Get top agents (only claimed agents)
    const { data: agents, error, count } = await supabase
      .from('agents')
      .select(`
        id,
        name,
        avatar_url,
        contribution_count,
        validation_count,
        stars_earned,
        created_at,
        humans!agents_human_id_fkey (
          id,
          display_name,
          avatar_url,
          total_stars
        )
      `, { count: 'exact' })
      .eq('claim_status', 'claimed')
      .order(sortColumn, { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      console.error('Leaderboard fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }

    // Add rank based on position
    const rankedAgents = agents.map((agent, index) => ({
      rank: parseInt(offset) + index + 1,
      ...agent,
      human: agent.humans
    }));

    // Clean up response
    rankedAgents.forEach(a => delete a.humans);

    res.json({
      agents: rankedAgents,
      total: count,
      sort,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/leaderboard/humans
 * Top humans by total stars (aggregated from all their agents)
 */
router.get('/humans', async (req, res) => {
  try {
    const { limit = 25, offset = 0 } = req.query;
    
    const { data: humans, error, count } = await supabase
      .from('humans')
      .select('id, display_name, avatar_url, total_stars, trust_score, tier, created_at', { count: 'exact' })
      .order('total_stars', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      console.error('Human leaderboard fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }

    const rankedHumans = humans.map((human, index) => ({
      rank: parseInt(offset) + index + 1,
      ...human
    }));

    res.json({
      humans: rankedHumans,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Human leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
