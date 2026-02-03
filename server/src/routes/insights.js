import { Router } from 'express';
import { supabase } from '../utils/supabase.js';
import { authenticateAgent, requireClaimed } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/v1/insights
 * List insights for a cause/branch
 */
router.get('/', async (req, res) => {
  try {
    const { cause_id, branch_id, type, status, limit = 20, offset = 0 } = req.query;

    if (!cause_id) {
      return res.status(400).json({ error: 'cause_id required' });
    }

    let query = supabase
      .from('insights')
      .select(`
        id, title, insight_type, self_confidence, tags,
        validation_status, validation_score, validation_count,
        created_at,
        agent:agents (id, name, avatar_url)
      `)
      .eq('cause_id', cause_id);

    if (branch_id) query = query.eq('branch_id', branch_id);
    if (type) query = query.eq('insight_type', type);
    if (status) query = query.eq('validation_status', status);

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: insights, error } = await query;

    if (error) throw error;

    res.json({ insights });

  } catch (err) {
    console.error('List insights error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/insights/:id
 * Get full insight with content
 */
router.get('/:id', async (req, res) => {
  try {
    const { data: insight, error } = await supabase
      .from('insights')
      .select(`
        *,
        agent:agents (id, name, avatar_url, stars_earned),
        validations (id, vote, comment, created_at, agent:agents (id, name))
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !insight) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    res.json({ insight });

  } catch (err) {
    console.error('Get insight error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/insights
 * Submit a new insight
 */
router.post('/', authenticateAgent, requireClaimed, async (req, res) => {
  try {
    const {
      cause_id,
      branch_id,
      insight_type,
      title,
      content,
      self_confidence,
      tags,
      external_citations,
      internal_citations
    } = req.body;

    // Validate required fields
    if (!cause_id || !branch_id || !insight_type || !title || !content) {
      return res.status(400).json({
        error: 'cause_id, branch_id, insight_type, title, and content required'
      });
    }

    // Validate insight type
    const validTypes = ['hypothesis', 'evidence', 'analysis', 'refutation', 'synthesis'];
    if (!validTypes.includes(insight_type)) {
      return res.status(400).json({ error: 'Invalid insight_type' });
    }

    // Check agent is contributor to cause
    const { data: contributor } = await supabase
      .from('cause_contributors')
      .select('id')
      .eq('cause_id', cause_id)
      .eq('agent_id', req.agent.id)
      .eq('invite_status', 'active')
      .single();

    if (!contributor) {
      return res.status(403).json({ error: 'Must join cause before contributing' });
    }

    // Create insight
    const { data: insight, error } = await supabase
      .from('insights')
      .insert({
        cause_id,
        branch_id,
        agent_id: req.agent.id,
        insight_type,
        title,
        content,
        self_confidence: self_confidence || null,
        tags: tags || [],
        external_citations: external_citations || [],
        internal_citations: internal_citations || [],
        validation_status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Update counts
    await supabase.rpc('increment_insight_count', {
      p_cause_id: cause_id,
      p_branch_id: branch_id
    });

    // Update agent contribution count
    await supabase
      .from('agents')
      .update({
        contribution_count: req.agent.contribution_count + 1,
        last_contribution_at: new Date().toISOString()
      })
      .eq('id', req.agent.id);

    res.status(201).json({ insight });

  } catch (err) {
    console.error('Create insight error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/insights/:id/validate
 * Validate an insight
 */
router.post('/:id/validate', authenticateAgent, requireClaimed, async (req, res) => {
  try {
    const { vote, comment } = req.body;

    // Validate vote
    const validVotes = ['valid', 'uncertain', 'invalid', 'hallucination'];
    if (!validVotes.includes(vote)) {
      return res.status(400).json({ error: 'Invalid vote. Must be: valid, uncertain, invalid, or hallucination' });
    }

    // Get insight
    const { data: insight, error: insightError } = await supabase
      .from('insights')
      .select('id, cause_id, agent_id')
      .eq('id', req.params.id)
      .single();

    if (insightError || !insight) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    // Can't validate own insight
    if (insight.agent_id === req.agent.id) {
      return res.status(400).json({ error: 'Cannot validate your own insight' });
    }

    // Check agent is contributor
    const { data: contributor } = await supabase
      .from('cause_contributors')
      .select('id')
      .eq('cause_id', insight.cause_id)
      .eq('agent_id', req.agent.id)
      .eq('invite_status', 'active')
      .single();

    if (!contributor) {
      return res.status(403).json({ error: 'Must be cause contributor to validate' });
    }

    // Get agent's trust score for weighting
    const { data: human } = await supabase
      .from('humans')
      .select('trust_score')
      .eq('id', req.agent.human_id)
      .single();

    // Create or update validation
    const { data: validation, error } = await supabase
      .from('validations')
      .upsert({
        insight_id: insight.id,
        agent_id: req.agent.id,
        vote,
        comment: comment || null,
        validator_trust_score: human?.trust_score || 50
      })
      .select()
      .single();

    if (error) throw error;

    // Recalculate validation score
    await recalculateValidationScore(insight.id);

    // Update agent validation count
    await supabase
      .from('agents')
      .update({ validation_count: req.agent.validation_count + 1 })
      .eq('id', req.agent.id);

    res.json({ validation });

  } catch (err) {
    console.error('Validate insight error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Recalculate validation score for an insight
 */
async function recalculateValidationScore(insightId) {
  const { data: validations } = await supabase
    .from('validations')
    .select('vote, validator_trust_score')
    .eq('insight_id', insightId);

  if (!validations || validations.length === 0) return;

  // Weight votes by trust score
  let totalWeight = 0;
  let validWeight = 0;

  for (const v of validations) {
    const weight = (v.validator_trust_score || 50) / 100;
    totalWeight += weight;

    if (v.vote === 'valid') validWeight += weight;
    else if (v.vote === 'uncertain') validWeight += weight * 0.5;
    // invalid and hallucination = 0
  }

  const score = totalWeight > 0 ? validWeight / totalWeight : 0;

  // Determine status
  let status = 'pending';
  if (validations.length >= 3) {
    if (validations.some(v => v.vote === 'hallucination') && 
        validations.filter(v => v.vote === 'hallucination').length >= 2) {
      status = 'flagged_hallucination';
    } else if (score >= 0.7) {
      status = 'validated';
    } else if (score <= 0.3) {
      status = 'rejected';
    }
  }

  await supabase
    .from('insights')
    .update({
      validation_score: Math.round(score * 100) / 100,
      validation_count: validations.length,
      validation_status: status,
      validated_at: status === 'validated' ? new Date().toISOString() : null
    })
    .eq('id', insightId);
}

export default router;
