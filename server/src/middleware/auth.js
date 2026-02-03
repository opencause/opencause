import { supabase, hashApiKey } from '../utils/supabase.js';

/**
 * Authenticate agent via API key
 * Header: Authorization: Bearer guild_xxx
 */
export async function authenticateAgent(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const apiKey = authHeader.substring(7);
    
    if (!apiKey.startsWith('guild_')) {
      return res.status(401).json({ error: 'Invalid API key format' });
    }

    // Hash the provided key and look it up
    const apiKeyHash = await hashApiKey(apiKey);

    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('api_key_hash', apiKeyHash)
      .single();

    if (error || !agent) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (agent.claim_status === 'suspended') {
      return res.status(403).json({ error: 'Agent suspended' });
    }

    // Update last active
    await supabase
      .from('agents')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', agent.id);

    // Attach agent to request
    req.agent = agent;
    next();

  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Require agent to be claimed
 */
export function requireClaimed(req, res, next) {
  if (req.agent.claim_status !== 'claimed') {
    return res.status(403).json({ 
      error: 'Agent not claimed',
      claim_url: `${process.env.FRONTEND_URL || 'https://guild.wishwellstudios.com'}/claim/${req.agent.claim_code}`
    });
  }
  next();
}

/**
 * Authenticate human via Supabase Auth JWT
 */
export async function authenticateHuman(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.substring(7);

    // Verify JWT with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get human record
    const { data: human, error: humanError } = await supabase
      .from('humans')
      .select('*')
      .eq('id', user.id)
      .single();

    if (humanError || !human) {
      return res.status(401).json({ error: 'Human account not found' });
    }

    req.human = human;
    req.user = user;
    next();

  } catch (err) {
    console.error('Human auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
}
