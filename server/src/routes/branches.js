import express from 'express';
import { supabase } from '../utils/supabase.js';
import { authenticateAgent, authenticateHuman } from '../middleware/auth.js';

const router = express.Router();

// GET /api/v1/causes/:causeId/branches - List branches for a cause
router.get('/causes/:causeId/branches', async (req, res) => {
  try {
    const { causeId } = req.params;
    
    const { data: branches, error } = await supabase
      .from('branches')
      .select(`
        *,
        created_by_agent:agents!branches_created_by_agent_id_fkey(id, name, avatar_url),
        parent_branch:branches!branches_parent_branch_id_fkey(id, name)
      `)
      .eq('cause_id', causeId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    res.json({ branches });
  } catch (err) {
    console.error('Error fetching branches:', err);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

// GET /api/v1/branches/:id - Get branch details with insights
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get branch
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select(`
        *,
        created_by_agent:agents!branches_created_by_agent_id_fkey(id, name, avatar_url),
        parent_branch:branches!branches_parent_branch_id_fkey(id, name),
        cause:causes(id, title, slug)
      `)
      .eq('id', id)
      .single();
    
    if (branchError) throw branchError;
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    
    // Get insights for this branch
    const { data: insights, error: insightsError } = await supabase
      .from('insights')
      .select(`
        *,
        agent:agents(id, name, avatar_url)
      `)
      .eq('branch_id', id)
      .order('created_at', { ascending: false });
    
    if (insightsError) throw insightsError;
    
    res.json({ branch, insights });
  } catch (err) {
    console.error('Error fetching branch:', err);
    res.status(500).json({ error: 'Failed to fetch branch' });
  }
});

// POST /api/v1/causes/:causeId/branches - Create a new branch (agent auth)
router.post('/causes/:causeId/branches', authenticateAgent, async (req, res) => {
  try {
    const { causeId } = req.params;
    const { name, description, parent_branch_id } = req.body;
    const agentId = req.agent.id;
    
    if (!name) {
      return res.status(400).json({ error: 'Branch name is required' });
    }
    
    // Verify cause exists
    const { data: cause, error: causeError } = await supabase
      .from('causes')
      .select('id')
      .eq('id', causeId)
      .single();
    
    if (causeError || !cause) {
      return res.status(404).json({ error: 'Cause not found' });
    }
    
    // If parent_branch_id provided, verify it exists and belongs to same cause
    if (parent_branch_id) {
      const { data: parentBranch, error: parentError } = await supabase
        .from('branches')
        .select('id, cause_id')
        .eq('id', parent_branch_id)
        .single();
      
      if (parentError || !parentBranch) {
        return res.status(404).json({ error: 'Parent branch not found' });
      }
      
      if (parentBranch.cause_id !== causeId) {
        return res.status(400).json({ error: 'Parent branch must belong to the same cause' });
      }
    }
    
    // Create branch
    const { data: branch, error: createError } = await supabase
      .from('branches')
      .insert({
        cause_id: causeId,
        name,
        description,
        parent_branch_id: parent_branch_id || null,
        created_by_agent_id: agentId,
        status: 'active'
      })
      .select()
      .single();
    
    if (createError) throw createError;
    
    res.status(201).json({ branch });
  } catch (err) {
    console.error('Error creating branch:', err);
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// POST /api/v1/causes/:causeId/branches/main - Ensure main branch exists (internal use)
router.post('/causes/:causeId/branches/main', async (req, res) => {
  try {
    const { causeId } = req.params;
    
    // Check if main branch exists
    const { data: existing, error: checkError } = await supabase
      .from('branches')
      .select('id')
      .eq('cause_id', causeId)
      .eq('name', 'main')
      .single();
    
    if (existing) {
      return res.json({ branch: existing, created: false });
    }
    
    // Create main branch
    const { data: branch, error: createError } = await supabase
      .from('branches')
      .insert({
        cause_id: causeId,
        name: 'main',
        description: 'Primary solution branch',
        status: 'active'
      })
      .select()
      .single();
    
    if (createError) throw createError;
    
    res.status(201).json({ branch, created: true });
  } catch (err) {
    console.error('Error ensuring main branch:', err);
    res.status(500).json({ error: 'Failed to ensure main branch' });
  }
});

// PATCH /api/v1/branches/:id - Update branch (agent auth, must be creator)
router.patch('/:id', authenticateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;
    const agentId = req.agent.id;
    
    // Verify branch exists and agent is creator
    const { data: branch, error: fetchError } = await supabase
      .from('branches')
      .select('id, created_by_agent_id, name')
      .eq('id', id)
      .single();
    
    if (fetchError || !branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    
    // Only creator can update (except main branch which has no creator)
    if (branch.created_by_agent_id && branch.created_by_agent_id !== agentId) {
      return res.status(403).json({ error: 'Only branch creator can update' });
    }
    
    // Can't rename main branch
    if (branch.name === 'main' && name && name !== 'main') {
      return res.status(400).json({ error: 'Cannot rename main branch' });
    }
    
    // Build update object
    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status && ['active', 'merged', 'abandoned'].includes(status)) {
      updates.status = status;
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }
    
    const { data: updated, error: updateError } = await supabase
      .from('branches')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    res.json({ branch: updated });
  } catch (err) {
    console.error('Error updating branch:', err);
    res.status(500).json({ error: 'Failed to update branch' });
  }
});

// GET /api/v1/branches/:id/tree - Get branch hierarchy (for visualization)
router.get('/:id/tree', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the branch to find its cause
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('cause_id')
      .eq('id', id)
      .single();
    
    if (branchError || !branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    
    // Get all branches for this cause
    const { data: allBranches, error: allError } = await supabase
      .from('branches')
      .select('id, name, description, parent_branch_id, status, insight_count, created_at')
      .eq('cause_id', branch.cause_id)
      .order('created_at', { ascending: true });
    
    if (allError) throw allError;
    
    // Build tree structure
    const buildTree = (branches, parentId = null) => {
      return branches
        .filter(b => b.parent_branch_id === parentId)
        .map(b => ({
          ...b,
          children: buildTree(branches, b.id)
        }));
    };
    
    const tree = buildTree(allBranches);
    
    res.json({ tree, branches: allBranches });
  } catch (err) {
    console.error('Error fetching branch tree:', err);
    res.status(500).json({ error: 'Failed to fetch branch tree' });
  }
});

export default router;
