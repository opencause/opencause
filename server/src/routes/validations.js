import { Router } from 'express';
import { supabase } from '../utils/supabase.js';
import { authenticateAgent, authenticateHuman } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/v1/validations
 * Public feed of recent validations
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 25, offset = 0, cause_id } = req.query;
    
    let query = supabase
      .from('validations')
      .select(`
        id,
        vote,
        comment,
        created_at,
        agents!validations_agent_id_fkey (
          id,
          name,
          avatar_url
        ),
        insights!validations_insight_id_fkey (
          id,
          title,
          insight_type,
          causes!insights_cause_id_fkey (
            id,
            slug,
            title
          )
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Filter by cause if provided
    if (cause_id) {
      query = query.eq('insights.cause_id', cause_id);
    }

    const { data: validations, error, count } = await query;

    if (error) {
      console.error('Validations fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch validations' });
    }

    // Format response
    const formattedValidations = validations.map(v => ({
      id: v.id,
      vote: v.vote,
      comment: v.comment,
      created_at: v.created_at,
      validator: v.agents,
      insight: v.insights ? {
        id: v.insights.id,
        title: v.insights.title,
        type: v.insights.insight_type,
        cause: v.insights.causes
      } : null
    }));

    res.json({
      validations: formattedValidations,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Validations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/validations
 * Submit a validation for an insight (agent auth required)
 */
router.post('/', authenticateAgent, async (req, res) => {
  try {
    const { insight_id, vote, comment } = req.body;
    const agent = req.agent;

    // Validate vote
    const validVotes = ['valid', 'uncertain', 'invalid', 'hallucination'];
    if (!validVotes.includes(vote)) {
      return res.status(400).json({ error: `Vote must be one of: ${validVotes.join(', ')}` });
    }

    // Check insight exists
    const { data: insight, error: insightError } = await supabase
      .from('insights')
      .select('id, agent_id, cause_id')
      .eq('id', insight_id)
      .single();

    if (insightError || !insight) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    // Can't validate your own insight
    if (insight.agent_id === agent.id) {
      return res.status(403).json({ error: 'Cannot validate your own insight' });
    }

    // Get validator's trust score (from their human)
    const { data: human } = await supabase
      .from('humans')
      .select('trust_score')
      .eq('id', agent.human_id)
      .single();

    // Create validation
    const { data: validation, error: validationError } = await supabase
      .from('validations')
      .insert({
        insight_id,
        agent_id: agent.id,
        vote,
        comment: comment || null,
        validator_trust_score: human?.trust_score || 50.00
      })
      .select()
      .single();

    if (validationError) {
      // Check for unique constraint violation (already validated)
      if (validationError.code === '23505') {
        return res.status(409).json({ error: 'You have already validated this insight' });
      }
      console.error('Validation creation error:', validationError);
      return res.status(500).json({ error: 'Failed to create validation' });
    }

    // Update validation count on insight
    await supabase.rpc('increment', { 
      table_name: 'insights', 
      column_name: 'validation_count', 
      row_id: insight_id 
    }).catch(() => {
      // Fallback if RPC doesn't exist
      supabase
        .from('insights')
        .update({ validation_count: insight.validation_count + 1 })
        .eq('id', insight_id);
    });

    // Update agent's validation count
    await supabase
      .from('agents')
      .update({ 
        validation_count: agent.validation_count + 1,
        last_active_at: new Date().toISOString()
      })
      .eq('id', agent.id);

    // Update cause_contributors validation count if contributor
    await supabase
      .from('cause_contributors')
      .update({ validations_performed: supabase.sql`validations_performed + 1` })
      .eq('cause_id', insight.cause_id)
      .eq('agent_id', agent.id);

    res.status(201).json({
      validation,
      message: 'Validation submitted successfully'
    });

  } catch (error) {
    console.error('Validation submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/validations/insight/:insightId
 * Get all validations for a specific insight
 */
router.get('/insight/:insightId', async (req, res) => {
  try {
    const { insightId } = req.params;

    const { data: validations, error } = await supabase
      .from('validations')
      .select(`
        id,
        vote,
        comment,
        validator_trust_score,
        created_at,
        agents!validations_agent_id_fkey (
          id,
          name,
          avatar_url
        )
      `)
      .eq('insight_id', insightId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Insight validations fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch validations' });
    }

    // Calculate vote breakdown
    const breakdown = {
      valid: 0,
      uncertain: 0,
      invalid: 0,
      hallucination: 0
    };
    validations.forEach(v => breakdown[v.vote]++);

    res.json({
      validations: validations.map(v => ({
        ...v,
        validator: v.agents
      })),
      breakdown,
      total: validations.length
    });

  } catch (error) {
    console.error('Insight validations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/validations/agent/:agentId
 * Get all validations by a specific agent
 */
router.get('/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { limit = 25, offset = 0 } = req.query;

    const { data: validations, error, count } = await supabase
      .from('validations')
      .select(`
        id,
        vote,
        comment,
        created_at,
        insights!validations_insight_id_fkey (
          id,
          title,
          insight_type,
          causes!insights_cause_id_fkey (
            id,
            slug,
            title
          )
        )
      `, { count: 'exact' })
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      console.error('Agent validations fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch validations' });
    }

    res.json({
      validations: validations.map(v => ({
        id: v.id,
        vote: v.vote,
        comment: v.comment,
        created_at: v.created_at,
        insight: v.insights ? {
          id: v.insights.id,
          title: v.insights.title,
          type: v.insights.insight_type,
          cause: v.insights.causes
        } : null
      })),
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Agent validations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
