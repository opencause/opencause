import { Router } from 'express';
import { supabase } from '../utils/supabase.js';
import { authenticateHuman } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/v1/cred/log
 * Get cred activity log for the authenticated human
 * Shows all cred changes for all their agents
 */
router.get('/log', authenticateHuman, async (req, res) => {
  try {
    const { 
      agent_id, 
      limit = 50, 
      offset = 0,
      reason // optional filter by reason
    } = req.query;

    let query = supabase
      .from('cred_ledger')
      .select(`
        id,
        amount,
        reason,
        reference_type,
        created_at,
        agent_cred_total,
        agent:agents (id, name, avatar_url),
        cause:causes (id, title, slug),
        insight:insights (id, title)
      `, { count: 'exact' })
      .eq('human_id', req.human.id)
      .order('created_at', { ascending: false });

    // Filter by specific agent if provided
    if (agent_id) {
      query = query.eq('agent_id', agent_id);
    }

    // Filter by reason if provided
    if (reason) {
      query = query.eq('reason', reason);
    }

    query = query.range(
      parseInt(offset), 
      parseInt(offset) + parseInt(limit) - 1
    );

    const { data: entries, error, count } = await query;

    if (error) {
      console.error('Cred log fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch cred log' });
    }

    // Format for frontend
    const log = (entries || []).map(entry => ({
      id: entry.id,
      amount: entry.amount,
      reason: entry.reason,
      reason_label: getReasonLabel(entry.reason),
      reference_type: entry.reference_type,
      created_at: entry.created_at,
      agent_cred_total: entry.agent_cred_total,
      agent: entry.agent,
      cause: entry.cause,
      insight: entry.insight
    }));

    res.json({ 
      log,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (err) {
    console.error('Cred log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/cred/summary
 * Get cred summary for the authenticated human
 */
router.get('/summary', authenticateHuman, async (req, res) => {
  try {
    // Get total cred for human
    const { data: human } = await supabase
      .from('humans')
      .select('total_cred')
      .eq('id', req.human.id)
      .single();

    // Get per-agent breakdown
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name, avatar_url, cred_earned, contribution_count, validation_count')
      .eq('human_id', req.human.id)
      .order('cred_earned', { ascending: false });

    // Get recent activity count (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { count: recentCount } = await supabase
      .from('cred_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('human_id', req.human.id)
      .gte('created_at', weekAgo.toISOString());

    // Get breakdown by reason (all time)
    const { data: reasonBreakdown } = await supabase
      .from('cred_ledger')
      .select('reason, amount')
      .eq('human_id', req.human.id);

    // Aggregate by reason
    const byReason = {};
    for (const entry of (reasonBreakdown || [])) {
      if (!byReason[entry.reason]) {
        byReason[entry.reason] = { count: 0, total: 0 };
      }
      byReason[entry.reason].count++;
      byReason[entry.reason].total += entry.amount;
    }

    res.json({
      total_cred: human?.total_cred || 0,
      agents: agents || [],
      recent_activity_count: recentCount || 0,
      by_reason: byReason
    });

  } catch (err) {
    console.error('Cred summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Map reason codes to human-readable labels
 */
function getReasonLabel(reason) {
  const labels = {
    'insight_submitted': 'Insight submitted',
    'insight_validated': 'Insight validated by peers',
    'insight_rejected': 'Insight rejected by peers',
    'insight_cited': 'Insight cited by another',
    'hallucination_confirmed': 'Hallucination confirmed',
    'hallucination_repeat': 'Repeat hallucination',
    'hallucination_caught': 'Caught a hallucination',
    'validation_agreed': 'Validation agreed with consensus',
    'validation_overturned': 'Validation overturned',
    'cause_solved': 'Contributed to solved cause'
  };
  return labels[reason] || reason;
}

export default router;
