import { Router } from 'express';
import { supabase } from '../utils/supabase.js';
import { authenticateHuman } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/v1/auth/signup
 * Create human account (via Supabase Auth)
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, display_name } = req.body;

    if (!email || !password || !display_name) {
      return res.status(400).json({ error: 'Email, password, and display_name required' });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name }
      }
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Create human record
    const { data: human, error: humanError } = await supabase
      .from('humans')
      .insert({
        id: authData.user.id,
        email,
        display_name,
        email_verified: false,
        tier: 'new'
      })
      .select()
      .single();

    if (humanError) {
      console.error('Human creation error:', humanError);
      return res.status(500).json({ error: 'Failed to create account' });
    }

    res.status(201).json({
      message: 'Account created. Check email for verification.',
      human: {
        id: human.id,
        email: human.email,
        display_name: human.display_name
      }
    });

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/auth/login
 * Login human
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get human record
    const { data: human } = await supabase
      .from('humans')
      .select('*')
      .eq('id', data.user.id)
      .single();

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      human
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/auth/claim/:code
 * Claim an agent
 */
router.post('/claim/:code', authenticateHuman, async (req, res) => {
  try {
    const { code } = req.params;

    // Find unclaimed agent
    const { data: agent, error: findError } = await supabase
      .from('agents')
      .select('*')
      .eq('claim_code', code)
      .eq('claim_status', 'pending')
      .single();

    if (findError || !agent) {
      return res.status(404).json({ error: 'Invalid or already claimed code' });
    }

    // Claim agent
    const { data: claimed, error: claimError } = await supabase
      .from('agents')
      .update({
        human_id: req.human.id,
        claim_status: 'claimed',
        claimed_at: new Date().toISOString(),
        claim_code: null // Clear claim code
      })
      .eq('id', agent.id)
      .select()
      .single();

    if (claimError) {
      return res.status(500).json({ error: 'Failed to claim agent' });
    }

    res.json({
      message: 'Agent claimed successfully!',
      agent: {
        id: claimed.id,
        name: claimed.name,
        claim_status: claimed.claim_status
      }
    });

  } catch (err) {
    console.error('Claim error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current human profile
 */
router.get('/me', authenticateHuman, async (req, res) => {
  // Get agents owned by this human
  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, claim_status, stars_earned, contribution_count')
    .eq('human_id', req.human.id);

  res.json({
    human: req.human,
    agents: agents || []
  });
});

/**
 * PATCH /api/v1/auth/me
 * Update human profile
 */
router.patch('/me', authenticateHuman, async (req, res) => {
  try {
    const { display_name } = req.body;
    const updates = {};

    if (display_name !== undefined) {
      if (!display_name || display_name.length < 2 || display_name.length > 50) {
        return res.status(400).json({ error: 'Display name must be 2-50 characters' });
      }
      updates.display_name = display_name;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data: human, error } = await supabase
      .from('humans')
      .update(updates)
      .eq('id', req.human.id)
      .select()
      .single();

    if (error) {
      console.error('Update human error:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    res.json({ human });

  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
