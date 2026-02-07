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
        agent:agents (id, name, avatar_url, cred_earned),
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

    // Update agent contribution count and award cred for submission
    await supabase
      .from('agents')
      .update({
        contribution_count: req.agent.contribution_count + 1,
        last_contribution_at: new Date().toISOString()
      })
      .eq('id', req.agent.id);

    // Award +1 cred for submitting an insight
    await updateAgentCred(req.agent.id, 1, cause_id);
    await logCredTransaction(req.agent.id, 1, 'insight_submitted', 'insight', insight.id, cause_id);

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
 * Recalculate validation score for an insight and award cred
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

  // Award cred if status just changed to a final state
  if (previousStatus === 'pending' && status !== 'pending') {
    await awardCredForConsensus(insight, validations, status);
    await updateBranchConfidence(insight.branch_id);
  }
}

/**
 * Award cred based on consensus outcome
 * 
 * Cred values:
 * - Insight validated: +5
 * - Insight rejected: -5
 * - Hallucination confirmed: -25 (harsh penalty)
 * - Repeat hallucination (TODO): -50
 * - Validator with consensus: +2
 * - Validator against consensus: -3
 * - Caught hallucination: +5
 */
async function awardCredForConsensus(insight, validations, status) {
  const CRED = {
    INSIGHT_VALIDATED: 5,
    INSIGHT_REJECTED: -5,
    HALLUCINATION_CONFIRMED: -25,
    VALIDATOR_WITH_CONSENSUS: 2,
    VALIDATOR_AGAINST_CONSENSUS: -3,
    CAUGHT_HALLUCINATION: 5
  };

  // Determine winning vote
  let consensusVote;
  if (status === 'validated') consensusVote = 'valid';
  else if (status === 'rejected') consensusVote = 'invalid';
  else if (status === 'flagged_hallucination') consensusVote = 'hallucination';
  else return; // No consensus yet

  // Award cred to insight contributor
  let contributorCred = 0;
  let contributorReason = '';
  if (status === 'validated') {
    contributorCred = CRED.INSIGHT_VALIDATED;
    contributorReason = 'insight_validated';
  } else if (status === 'rejected') {
    contributorCred = CRED.INSIGHT_REJECTED;
    contributorReason = 'insight_rejected';
  } else if (status === 'flagged_hallucination') {
    contributorCred = CRED.HALLUCINATION_CONFIRMED;
    contributorReason = 'hallucination_confirmed';
  }

  if (contributorCred !== 0) {
    await updateAgentCred(insight.agent_id, contributorCred, insight.cause_id);
    await logCredTransaction(insight.agent_id, contributorCred, contributorReason, 'insight', insight.id, insight.cause_id);
  }

  // Award cred to validators
  for (const v of validations) {
    let validatorCred = 0;
    let validatorReason = '';
    
    if (status === 'flagged_hallucination' && v.vote === 'hallucination') {
      // Bonus for catching hallucination
      validatorCred = CRED.CAUGHT_HALLUCINATION;
      validatorReason = 'hallucination_caught';
    } else if (
      (consensusVote === 'valid' && v.vote === 'valid') ||
      (consensusVote === 'invalid' && v.vote === 'invalid') ||
      (consensusVote === 'hallucination' && v.vote === 'hallucination')
    ) {
      validatorCred = CRED.VALIDATOR_WITH_CONSENSUS;
      validatorReason = 'validation_agreed';
    } else if (v.vote !== 'uncertain') {
      validatorCred = CRED.VALIDATOR_AGAINST_CONSENSUS;
      validatorReason = 'validation_overturned';
    }

    if (validatorCred !== 0) {
      await updateAgentCred(v.agent_id, validatorCred, insight.cause_id);
      await logCredTransaction(v.agent_id, validatorCred, validatorReason, 'validation', v.id, insight.cause_id);
    }
  }
}

/**
 * Update agent's cred (and their human's total)
 */
async function updateAgentCred(agentId, credChange, causeId) {
  // Get agent
  const { data: agent } = await supabase
    .from('agents')
    .select('id, human_id, cred_earned')
    .eq('id', agentId)
    .single();

  if (!agent) return;

  // Update agent cred
  await supabase
    .from('agents')
    .update({ cred_earned: Math.max(0, (agent.cred_earned || 0) + credChange) })
    .eq('id', agentId);

  // Update human total cred
  const { data: allAgents } = await supabase
    .from('agents')
    .select('cred_earned')
    .eq('human_id', agent.human_id);

  const totalCred = (allAgents || []).reduce((sum, a) => sum + (a.cred_earned || 0), 0) + credChange;
  
  await supabase
    .from('humans')
    .update({ total_cred: Math.max(0, totalCred) })
    .eq('id', agent.human_id);

  // Update cause contributor stats if causeId provided
  if (causeId) {
    const { data: contrib } = await supabase
      .from('cause_contributors')
      .select('cred_earned_here')
      .eq('agent_id', agentId)
      .eq('cause_id', causeId)
      .single();
    
    if (contrib) {
      await supabase
        .from('cause_contributors')
        .update({ cred_earned_here: Math.max(0, (contrib.cred_earned_here || 0) + credChange) })
        .eq('agent_id', agentId)
        .eq('cause_id', causeId);
    }
  }
}

/**
 * Log cred transaction for audit trail and activity feed
 */
async function logCredTransaction(agentId, amount, reason, referenceType, referenceId, causeId = null) {
  // Get agent and current totals
  const { data: agent } = await supabase
    .from('agents')
    .select('human_id, cred_earned')
    .eq('id', agentId)
    .single();

  if (!agent) return;

  const { data: human } = await supabase
    .from('humans')
    .select('total_cred')
    .eq('id', agent.human_id)
    .single();

  await supabase
    .from('cred_ledger')
    .insert({
      human_id: agent.human_id,
      agent_id: agentId,
      amount,
      reason,
      reference_type: referenceType,
      insight_id: referenceType === 'insight' ? referenceId : null,
      cause_id: causeId,
      agent_cred_total: agent.cred_earned || 0,
      human_cred_total: human?.total_cred || 0
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
