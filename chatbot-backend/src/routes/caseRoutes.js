/**
 * caseRoutes.js
 *
 * Case management API routes.
 * Supports CRUD, evidence, notes, timeline, and action integration.
 */

import express from 'express';
import {
  createCase,
  getCases,
  getCaseById,
  updateCase,
  deleteCase,
  addCaseNote,
  addEvidence,
  getCaseEvidence,
  getCaseTimeline,
  getCaseStats,
  linkAlertToCase,
  linkArtifactToCase,
  caseEvents,
} from '../helpers/caseStore.js';
import {
  createAction,
  getActions,
  updateActionStatus,
  ACTION_STATUS,
} from '../helpers/actionStore.js';
import { recommendActionsForCase } from '../helpers/actionRecommender.js';

const router = express.Router();

// ─── Case CRUD ────────────────────────────────────────────────────────────────
/**
 * POST /api/cases
 * Create a new case. Supports creation from alerts, artifacts, or manual entry.
 */
router.post('/', (req, res) => {
  try {
    const caseData = req.body;
    
    if (!caseData.title) {
      return res.status(400).json({ error: 'Case title is required' });
    }

    const caseRecord = createCase(caseData);

    // Auto-generate recommended actions if requested
    if (req.body.auto_recommend_actions) {
      const evidence = req.body.initial_evidence || [];
      const recommendations = recommendActionsForCase(caseRecord, evidence);
      
      // Create suggested actions
      const actions = recommendations.map(rec =>
        createAction({
          case_id: caseRecord.case_id,
          action_type: rec.action_type,
          title: rec.title,
          description: rec.description,
          status: rec.auto_approve ? ACTION_STATUS.APPROVED : ACTION_STATUS.SUGGESTED,
          performed_by: 'system',
          metadata: rec.metadata,
        })
      );

      // Update case with recommended actions
      caseRecord.recommended_actions = recommendations.map(r => r.action_type);
      updateCase(caseRecord.case_id, { recommended_actions: caseRecord.recommended_actions });

      return res.status(201).json({
        success: true,
        case: caseRecord,
        actions_created: actions.length,
        actions,
      });
    }

    res.status(201).json({ success: true, case: caseRecord });
  } catch (error) {
    console.error('Create case error:', error);
    res.status(500).json({ error: 'Failed to create case', message: error.message });
  }
});

/**
 * GET /api/cases
 * List cases with optional filters.
 */
router.get('/', (req, res) => {
  try {
    const { status, priority, severity, threat_family, assignee, limit } = req.query;
    const cases = getCases({
      status,
      priority,
      severity,
      threat_family,
      assignee,
      limit: limit ? parseInt(limit, 10) : 100,
    });
    res.json({ success: true, cases, total: cases.length });
  } catch (error) {
    console.error('List cases error:', error);
    res.status(500).json({ error: 'Failed to list cases', message: error.message });
  }
});

/**
 * GET /api/cases/stats
 * Get case statistics.
 */
router.get('/stats', (req, res) => {
  try {
    const stats = getCaseStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Case stats error:', error);
    res.status(500).json({ error: 'Failed to get stats', message: error.message });
  }
});

/**
 * GET /api/cases/:id
 * Get a single case by ID with full details.
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const caseRecord = getCaseById(id);
    
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Fetch related data
    const evidence = getCaseEvidence(id);
    const timeline = getCaseTimeline(id);
    const actions = getActions({ case_id: id });

    res.json({
      success: true,
      case: caseRecord,
      evidence,
      timeline,
      actions,
    });
  } catch (error) {
    console.error('Get case error:', error);
    res.status(500).json({ error: 'Failed to get case', message: error.message });
  }
});

/**
 * PATCH /api/cases/:id
 * Update a case (status, priority, assignee, etc).
 */
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updated = updateCase(id, updates);
    
    if (!updated) {
      return res.status(404).json({ error: 'Case not found' });
    }

    res.json({ success: true, case: updated });
  } catch (error) {
    console.error('Update case error:', error);
    res.status(500).json({ error: 'Failed to update case', message: error.message });
  }
});

/**
 * DELETE /api/cases/:id
 * Delete a case.
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const removed = deleteCase(id);
    
    if (!removed) {
      return res.status(404).json({ error: 'Case not found' });
    }

    res.json({ success: true, removed: true });
  } catch (error) {
    console.error('Delete case error:', error);
    res.status(500).json({ error: 'Failed to delete case', message: error.message });
  }
});

// ─── Notes ────────────────────────────────────────────────────────────────────
/**
 * POST /api/cases/:id/notes
 * Add an analyst note to a case.
 */
router.post('/:id/notes', (req, res) => {
  try {
    const { id } = req.params;
    const { text, author } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Note text is required' });
    }

    const note = addCaseNote(id, text, author || 'analyst');
    
    if (!note) {
      return res.status(404).json({ error: 'Case not found' });
    }

    res.status(201).json({ success: true, note });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ error: 'Failed to add note', message: error.message });
  }
});

// ─── Evidence ─────────────────────────────────────────────────────────────────
/**
 * POST /api/cases/:id/evidence
 * Add evidence to a case.
 */
router.post('/:id/evidence', (req, res) => {
  try {
    const { id } = req.params;
    const evidenceData = { ...req.body, case_id: id };
    
    if (!evidenceData.type || !evidenceData.title) {
      return res.status(400).json({ error: 'Evidence type and title are required' });
    }

    const evidence = addEvidence(evidenceData);
    res.status(201).json({ success: true, evidence });
  } catch (error) {
    console.error('Add evidence error:', error);
    res.status(500).json({ error: 'Failed to add evidence', message: error.message });
  }
});

/**
 * GET /api/cases/:id/evidence
 * Get all evidence for a case.
 */
router.get('/:id/evidence', (req, res) => {
  try {
    const { id } = req.params;
    const evidence = getCaseEvidence(id);
    res.json({ success: true, evidence, total: evidence.length });
  } catch (error) {
    console.error('Get evidence error:', error);
    res.status(500).json({ error: 'Failed to get evidence', message: error.message });
  }
});

// ─── Timeline ─────────────────────────────────────────────────────────────────
/**
 * GET /api/cases/:id/timeline
 * Get case investigation timeline.
 */
router.get('/:id/timeline', (req, res) => {
  try {
    const { id } = req.params;
    const timeline = getCaseTimeline(id);
    res.json({ success: true, timeline, total: timeline.length });
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({ error: 'Failed to get timeline', message: error.message });
  }
});

// ─── Actions ──────────────────────────────────────────────────────────────────
/**
 * POST /api/cases/:id/actions
 * Create a mitigation action for a case.
 */
router.post('/:id/actions', (req, res) => {
  try {
    const { id } = req.params;
    const actionData = { ...req.body, case_id: id };
    
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
 * GET /api/cases/:id/actions
 * Get all actions for a case.
 */
router.get('/:id/actions', (req, res) => {
  try {
    const { id } = req.params;
    const actions = getActions({ case_id: id });
    res.json({ success: true, actions, total: actions.length });
  } catch (error) {
    console.error('Get actions error:', error);
    res.status(500).json({ error: 'Failed to get actions', message: error.message });
  }
});

/**
 * POST /api/cases/:id/recommend-actions
 * Generate recommended actions for a case.
 */
router.post('/:id/recommend-actions', (req, res) => {
  try {
    const { id } = req.params;
    const caseRecord = getCaseById(id);
    
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const evidence = getCaseEvidence(id);
    const recommendations = recommendActionsForCase(caseRecord, evidence);
    
    res.json({ success: true, recommendations, total: recommendations.length });
  } catch (error) {
    console.error('Recommend actions error:', error);
    res.status(500).json({ error: 'Failed to recommend actions', message: error.message });
  }
});

// ─── Linking helpers ──────────────────────────────────────────────────────────
/**
 * POST /api/cases/:id/link-alert
 * Link an alert to a case.
 */
router.post('/:id/link-alert', (req, res) => {
  try {
    const { id } = req.params;
    const { alert_id } = req.body;
    
    if (!alert_id) {
      return res.status(400).json({ error: 'alert_id is required' });
    }

    const updated = linkAlertToCase(id, alert_id);
    
    if (!updated) {
      return res.status(404).json({ error: 'Case not found' });
    }

    res.json({ success: true, case: updated });
  } catch (error) {
    console.error('Link alert error:', error);
    res.status(500).json({ error: 'Failed to link alert', message: error.message });
  }
});

/**
 * POST /api/cases/:id/link-artifact
 * Link an artifact to a case.
 */
router.post('/:id/link-artifact', (req, res) => {
  try {
    const { id } = req.params;
    const { artifact_id } = req.body;
    
    if (!artifact_id) {
      return res.status(400).json({ error: 'artifact_id is required' });
    }

    const updated = linkArtifactToCase(id, artifact_id);
    
    if (!updated) {
      return res.status(404).json({ error: 'Case not found' });
    }

    res.json({ success: true, case: updated });
  } catch (error) {
    console.error('Link artifact error:', error);
    res.status(500).json({ error: 'Failed to link artifact', message: error.message });
  }
});

export default router;
