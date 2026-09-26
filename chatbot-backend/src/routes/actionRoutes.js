/**
 * actionRoutes.js
 *
 * Mitigation action API routes.
 * Trust operations dashboard and action tracking.
 */

import express from 'express';
import {
  createAction,
  getActions,
  getActionById,
  updateActionStatus,
  deleteAction,
  getActionStats,
  ACTION_TYPES,
  ACTION_STATUS,
} from '../helpers/actionStore.js';

const router = express.Router();

/**
 * GET /api/actions
 * List actions with optional filters.
 */
router.get('/', (req, res) => {
  try {
    const { case_id, status, action_type, limit } = req.query;
    const actions = getActions({
      case_id,
      status,
      action_type,
      limit: limit ? parseInt(limit, 10) : 100,
    });
    res.json({ success: true, actions, total: actions.length });
  } catch (error) {
    console.error('List actions error:', error);
    res.status(500).json({ error: 'Failed to list actions', message: error.message });
  }
});

/**
 * GET /api/actions/stats
 * Get action statistics for trust ops dashboard.
 */
router.get('/stats', (req, res) => {
  try {
    const stats = getActionStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Action stats error:', error);
    res.status(500).json({ error: 'Failed to get stats', message: error.message });
  }
});

/**
 * GET /api/actions/types
 * List available action types.
 */
router.get('/types', (req, res) => {
  res.json({
    success: true,
    action_types: Object.values(ACTION_TYPES),
    action_statuses: Object.values(ACTION_STATUS),
  });
});

/**
 * GET /api/actions/:id
 * Get a single action by ID.
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const action = getActionById(id);
    
    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }

    res.json({ success: true, action });
  } catch (error) {
    console.error('Get action error:', error);
    res.status(500).json({ error: 'Failed to get action', message: error.message });
  }
});

/**
 * POST /api/actions
 * Create a new action (can be standalone or case-linked).
 */
router.post('/', (req, res) => {
  try {
    const actionData = req.body;
    
    if (!actionData.action_type || !actionData.title) {
      return res.status(400).json({ error: 'Action type and title are required' });
    }

    const action = createAction(actionData);
    res.status(201).json({ success: true, action });
  } catch (error) {
    console.error('Create action error:', error);
    res.status(500).json({ error: 'Failed to create action', message: error.message });
  }
});

/**
 * PATCH /api/actions/:id/status
 * Update action status (approve, complete, dismiss, etc).
 */
router.patch('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status, outcome, notes } = req.body;
    
    const validStatuses = Object.values(ACTION_STATUS);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updated = updateActionStatus(id, status, outcome, notes);
    
    if (!updated) {
      return res.status(404).json({ error: 'Action not found' });
    }

    res.json({ success: true, action: updated });
  } catch (error) {
    console.error('Update action status error:', error);
    res.status(500).json({ error: 'Failed to update action status', message: error.message });
  }
});

/**
 * DELETE /api/actions/:id
 * Delete an action.
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const removed = deleteAction(id);
    
    if (!removed) {
      return res.status(404).json({ error: 'Action not found' });
    }

    res.json({ success: true, removed: true });
  } catch (error) {
    console.error('Delete action error:', error);
    res.status(500).json({ error: 'Failed to delete action', message: error.message });
  }
});

export default router;
