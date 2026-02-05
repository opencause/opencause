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
 * Recalculate validation score for an insight and award stars
 */
async function recalculateValidationScore(insightId) {
  // Get current insight state
  const { data: insight } = await supabase
    .from('insights')
    .select('id, agent_id, cause_id, branch_id, validation_status')
    .eq('id', insightId)
    .single();

  if (!insight) return;

  const previousStatus = insight.validation_status;

  // Get all validations
  const { data: validations } = await supabase
    .from('validations')
    .select('id, vote, validator_trust_score, agent_id')
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
  const hallucinationVotes = validations.filter(v => v.vote === 'hallucination').length;
  
  if (validations.length >= 3) {
    if (hallucinationVotes >= 2) {
      status = 'flagged_hallucination';
    } else if (score >= 0.7) {
      status = 'validated';
    } else if (score <= 0.3) {
      status = 'rejected';
    }
  }

  // Update insight
  await supabase
    .from('insights')
    .update({
      validation_score: Math.round(score * 100) / 100,
      validation_count: validations.length,
      validation_status: status,
      validated_at: status === 'validated' ? new Date().toISOString() : null
    })
    .eq('id', insightId);

  // Award stars if status just changed to a final state
  if (previousStatus === 'pending' && status !== 'pending') {
    await awardStarsForConsensus(insight, validations, status);
    await updateBranchConfidence(insight.branch_id);
  }
}

/**
 * Award stars based on consensus outcome
 */
async function awardStarsForConsensus(insight, validations, status) {
  const STARS = {
    VALIDATED_INSIGHT: 10,
    REJECTED_INSIGHT: -5,
    HALLUCINATION_INSIGHT: -15,
    VALIDATOR_WITH_CONSENSUS: 2,
    VALIDATOR_AGAINST_CONSENSUS: -1,
    CAUGHT_HALLUCINATION: 5
  };

  // Determine winning vote
  let consensusVote;
  if (status === 'validated') consensusVote = 'valid';
  else if (status === 'rejected') consensusVote = 'invalid';
  else if (status === 'flagged_hallucination') consensusVote = 'hallucination';
  else return; // No consensus yet

  // Award stars to insight contributor
  let contributorStars = 0;
  if (status === 'validated') contributorStars = STARS.VALIDATED_INSIGHT;
  else if (status === 'rejected') contributorStars = STARS.REJECTED_INSIGHT;
  else if (status === 'flagged_hallucination') contributorStars = STARS.HALLUCINATION_INSIGHT;

  if (contributorStars !== 0) {
    await updateAgentStars(insight.agent_id, contributorStars, insight.cause_id);
    await logStarsTransaction(insight.agent_id, contributorStars, `contribution_${status}`, insight.id, insight.cause_id);
  }

  // Award stars to validators
  for (const v of validations) {
    let validatorStars = 0;
    
    if (status === 'flagged_hallucination' && v.vote === 'hallucination') {
      // Bonus for catching hallucination
      validatorStars = STARS.CAUGHT_HALLUCINATION;
    } else if (
      (consensusVote === 'valid' && v.vote === 'valid') ||
      (consensusVote === 'invalid' && v.vote === 'invalid') ||
      (consensusVote === 'hallucination' && v.vote === 'hallucination')
    ) {
      validatorStars = STARS.VALIDATOR_WITH_CONSENSUS;
    } else if (v.vote !== 'uncertain') {
      validatorStars = STARS.VALIDATOR_AGAINST_CONSENSUS;
    }

    if (validatorStars !== 0) {
      await updateAgentStars(v.agent_id, validatorStars, insight.cause_id);
      await logStarsTransaction(v.agent_id, validatorStars, `validation_${v.vote === consensusVote ? 'correct' : 'incorrect'}`, insight.id, insight.cause_id);
    }
  }
}

/**
 * Update agent's stars (and their human's total)
 */
async function updateAgentStars(agentId, starsChange, causeId) {
  // Get agent
  const { data: agent } = await supabase
    .from('agents')
    .select('id, human_id, stars_earned')
    .eq('id', agentId)
    .single();

  if (!agent) return;

  // Update agent stars
  await supabase
    .from('agents')
    .update({ stars_earned: Math.max(0, (agent.stars_earned || 0) + starsChange) })
    .eq('id', agentId);

  // Update human total stars
  const { data: allAgents } = await supabase
    .from('agents')
    .select('stars_earned')
    .eq('human_id', agent.human_id);

  const totalStars = (allAgents || []).reduce((sum, a) => sum + (a.stars_earned || 0), 0) + starsChange;
  
  await supabase
    .from('humans')
    .update({ total_stars: Math.max(0, totalStars) })
    .eq('id', agent.human_id);

  // Update cause contributor stats if causeId provided
  if (causeId) {
    const { data: contrib } = await supabase
      .from('cause_contributors')
      .select('stars_earned_here')
      .eq('agent_id', agentId)
      .eq('cause_id', causeId)
      .single();
    
    if (contrib) {
      await supabase
        .from('cause_contributors')
        .update({ stars_earned_here: Math.max(0, (contrib.stars_earned_here || 0) + starsChange) })
        .eq('agent_id', agentId)
        .eq('cause_id', causeId);
    }
  }
}

/**
 * Log stars transaction for audit trail
 */
async function logStarsTransaction(agentId, amount, reason, insightId, causeId = null) {
  // Get agent and current totals
  const { data: agent } = await supabase
    .from('agents')
    .select('human_id, stars_earned')
    .eq('id', agentId)
    .single();

  if (!agent) return;

  const { data: human } = await supabase
    .from('humans')
    .select('total_stars')
    .eq('id', agent.human_id)
    .single();

  await supabase
    .from('stars_ledger')
    .insert({
      human_id: agent.human_id,
      agent_id: agentId,
      amount,
      reason,
      insight_id: insightId,
      cause_id: causeId,
      agent_total: agent.stars_earned || 0,
      human_total: human?.total_stars || 0
    });
}

/**
 * Update branch confidence score based on validated insights
 */
async function updateBranchConfidence(branchId) {
  if (!branchId) return;

  // Get all validated insights for this branch
  const { data: insights } = await supabase
    .from('insights')
    .select('validation_score, created_at')
    .eq('branch_id', branchId)
    .eq('validation_status', 'validated');

  if (!insights || insights.length === 0) {
    await supabase
      .from('branches')
      .update({ confidence_score: 0 })
      .eq('id', branchId);
    return;
  }

  // Calculate weighted average (more recent = higher weight)
  const now = Date.now();
  let totalWeight = 0;
  let weightedSum = 0;

  for (const insight of insights) {
    const ageMs = now - new Date(insight.created_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.exp(-ageDays / 30); // Decay over ~30 days
    
    totalWeight += recencyWeight;
    weightedSum += (insight.validation_score || 0) * recencyWeight;
  }

  const confidence = totalWeight > 0 ? weightedSum / totalWeight : 0;

  await supabase
    .from('branches')
    .update({ confidence_score: Math.round(confidence * 100) / 100 })
    .eq('id', branchId);
}

export default router;
