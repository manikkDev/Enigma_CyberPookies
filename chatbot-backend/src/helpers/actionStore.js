/**
 * actionStore.js
 *
 * Mitigation and trust-ops action tracking.
 * Supports block/flag/monitor/quarantine/escalate actions with outcomes.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { addTimelineEvent } from './caseStore.js';
import { recordActionSuggested, recordActionCompleted } from './metricsStore.js';

export const actionEvents = new EventEmitter();
actionEvents.setMaxListeners(50);

const _actions = new Map();

// ─── Action types ─────────────────────────────────────────────────────────────
export const ACTION_TYPES = {
  BLOCK_DOMAIN: 'block_domain',
  FLAG_SENDER: 'flag_sender',
  QUARANTINE_ATTACHMENT: 'quarantine_attachment',
  WATCH_BRAND: 'watch_brand',
  MONITOR_WALLET: 'monitor_wallet',
  MONITOR_NARRATIVE: 'monitor_narrative',
  ESCALATE_REVIEW: 'escalate_review',
  NOTIFY_ANALYST: 'notify_analyst',
  MARK_FALSE_POSITIVE: 'mark_false_positive',
  KEEP_MONITORING: 'keep_monitoring',
  BLOCK_IP: 'block_ip',
  SUSPEND_ACCOUNT: 'suspend_account',
  ADD_TO_WATCHLIST: 'add_to_watchlist',
  REQUEST_TAKEDOWN: 'request_takedown',
  WARN_BRAND: 'warn_brand',
};

export const ACTION_STATUS = {
  SUGGESTED: 'suggested',
  APPROVED: 'approved',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DISMISSED: 'dismissed',
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────
export function createAction({
  case_id,
  action_type,
  title,
  description = '',
  status = ACTION_STATUS.SUGGESTED,
  performed_by = 'system',
  linked_evidence_refs = [],
  outcome = null,
  notes = '',
  metadata = {},
} = {}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const action = {
    action_id: id,
    case_id,
    action_type,
    title: title || `Action: ${action_type}`,
    description,
    status,
    created_at: now,
    updated_at: now,
    performed_by,
    linked_evidence_refs: [...linked_evidence_refs],
    outcome,
    notes,
    metadata,
  };
  _actions.set(id, action);

  // Add to case timeline if case_id exists
  if (case_id) {
    addTimelineEvent(case_id, 'action_created', `Action suggested: ${title}`, { action_id: id, action_type, status });
  }

  // Record metrics
  try { recordActionSuggested(); } catch(e) { console.error('Metrics error:', e); }

  actionEvents.emit('actionCreated', action);
  return action;
}

export function getActions({ case_id, status, action_type, limit = 100 } = {}) {
  let results = [..._actions.values()].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  if (case_id) results = results.filter(a => a.case_id === case_id);
  if (status) results = results.filter(a => a.status === status);
  if (action_type) results = results.filter(a => a.action_type === action_type);
  return results.slice(0, limit);
}

export function getActionById(actionId) {
  return _actions.get(actionId);
}

export function updateActionStatus(actionId, status, outcome = null, notes = '') {
  const action = _actions.get(actionId);
  if (!action) return null;

  const oldStatus = action.status;
  action.status = status;
  if (outcome) action.outcome = outcome;
  if (notes) action.notes = (action.notes ? action.notes + '\n' : '') + notes;
  action.updated_at = new Date().toISOString();

  // Timeline event
  if (action.case_id) {
    addTimelineEvent(action.case_id, 'action_updated', `Action ${status}: ${action.title}`, { action_id: actionId, old_status: oldStatus, new_status: status, outcome });
  }

  // Record metrics for completed actions
  if (status === ACTION_STATUS.COMPLETED) {
    try { recordActionCompleted(); } catch(e) { console.error('Metrics error:', e); }
  }

  actionEvents.emit('actionUpdated', action);
  return action;
}

export function deleteAction(actionId) {
  const removed = _actions.get(actionId);
  if (!removed) return false;
  _actions.delete(actionId);
  actionEvents.emit('actionDeleted', { action_id: actionId });
  return true;
}

// ─── Stats ────────────────────────────────────────────────────────────────────
export function getActionStats() {
  const all = [..._actions.values()];
  return {
    total: all.length,
    suggested: all.filter(a => a.status === ACTION_STATUS.SUGGESTED).length,
    approved: all.filter(a => a.status === ACTION_STATUS.APPROVED).length,
    in_progress: all.filter(a => a.status === ACTION_STATUS.IN_PROGRESS).length,
    completed: all.filter(a => a.status === ACTION_STATUS.COMPLETED).length,
    failed: all.filter(a => a.status === ACTION_STATUS.FAILED).length,
    dismissed: all.filter(a => a.status === ACTION_STATUS.DISMISSED).length,
  };
}
