/**
 * caseStore.js
 *
 * Case management data store with evidence tracking and timeline events.
 * Supports linking alerts, artifacts, patterns, graphs, and actions.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { recordCaseCreated } from './metricsStore.js';

export const caseEvents = new EventEmitter();
caseEvents.setMaxListeners(50);

const _cases = new Map();
const _evidence = new Map();
const _timeline = new Map(); // caseId -> timeline events array

// ─── Case CRUD ────────────────────────────────────────────────────────────────
export function createCase({
  title,
  summary = '',
  case_type = 'threat_investigation',
  threat_family = 'unknown',
  severity = 'medium',
  confidence = 0.5,
  status = 'new',
  priority = 'medium',
  assignee = null,
  created_by = 'system',
  linked_alert_ids = [],
  linked_artifact_ids = [],
  linked_pattern_ids = [],
  linked_graph_ids = [],
  tags = [],
  notes = '',
  recommended_actions = [],
  resolution_summary = '',
} = {}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const caseRecord = {
    case_id: id,
    title: title || 'Untitled Case',
    summary,
    case_type,
    threat_family,
    severity,
    confidence,
    status,
    priority,
    assignee,
    created_by,
    created_at: now,
    updated_at: now,
    linked_alert_ids: [...linked_alert_ids],
    linked_artifact_ids: [...linked_artifact_ids],
    linked_pattern_ids: [...linked_pattern_ids],
    linked_graph_ids: [...linked_graph_ids],
    tags: [...tags],
    notes,
    recommended_actions: [...recommended_actions],
    resolution_summary,
  };
  _cases.set(id, caseRecord);
  _timeline.set(id, []);

  // Add initial timeline event
  addTimelineEvent(id, 'case_created', `Case created by ${created_by}`, { created_by, severity, threat_family });

  // Record metrics
  try { recordCaseCreated(); } catch(e) { console.error('Metrics error:', e); }

  caseEvents.emit('caseCreated', caseRecord);
  return caseRecord;
}

export function getCases({ status, priority, severity, threat_family, assignee, limit = 100 } = {}) {
  let results = [..._cases.values()].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  if (status) results = results.filter(c => c.status === status);
  if (priority) results = results.filter(c => c.priority === priority);
  if (severity) results = results.filter(c => c.severity === severity);
  if (threat_family) results = results.filter(c => c.threat_family === threat_family);
  if (assignee) results = results.filter(c => c.assignee === assignee);
  return results.slice(0, limit);
}

export function getCaseById(caseId) {
  return _cases.get(caseId);
}

export function updateCase(caseId, updates) {
  const caseRecord = _cases.get(caseId);
  if (!caseRecord) return null;

  const oldStatus = caseRecord.status;
  const oldPriority = caseRecord.priority;
  const oldAssignee = caseRecord.assignee;

  Object.assign(caseRecord, updates);
  caseRecord.updated_at = new Date().toISOString();

  // Track status changes in timeline
  if (updates.status && updates.status !== oldStatus) {
    addTimelineEvent(caseId, 'status_changed', `Status changed: ${oldStatus} → ${updates.status}`, { old_status: oldStatus, new_status: updates.status });
  }
  if (updates.priority && updates.priority !== oldPriority) {
    addTimelineEvent(caseId, 'priority_changed', `Priority changed: ${oldPriority} → ${updates.priority}`, { old_priority: oldPriority, new_priority: updates.priority });
  }
  if (updates.assignee && updates.assignee !== oldAssignee) {
    addTimelineEvent(caseId, 'assignee_changed', `Assigned to ${updates.assignee}`, { old_assignee: oldAssignee, new_assignee: updates.assignee });
  }

  caseEvents.emit('caseUpdated', caseRecord);
  return caseRecord;
}

export function deleteCase(caseId) {
  const removed = _cases.get(caseId);
  if (!removed) return false;
  _cases.delete(caseId);
  _timeline.delete(caseId);
  // Clean up related evidence
  for (const [evId, ev] of _evidence.entries()) {
    if (ev.case_id === caseId) _evidence.delete(evId);
  }
  caseEvents.emit('caseDeleted', { case_id: caseId });
  return true;
}

// ─── Notes ────────────────────────────────────────────────────────────────────
export function addCaseNote(caseId, noteText, author = 'analyst') {
  const caseRecord = _cases.get(caseId);
  if (!caseRecord) return null;

  const timestamp = new Date().toISOString();
  const noteEntry = { text: noteText, author, timestamp };
  
  // Append to notes field (string with timestamps)
  caseRecord.notes += `\n[${timestamp}] ${author}: ${noteText}`;
  caseRecord.updated_at = timestamp;

  addTimelineEvent(caseId, 'note_added', `Note added by ${author}`, { author, excerpt: noteText.slice(0, 60) });
  caseEvents.emit('caseUpdated', caseRecord);
  return noteEntry;
}

// ─── Evidence ─────────────────────────────────────────────────────────────────
export function addEvidence({
  case_id,
  type,
  title,
  source = 'analyst',
  source_ref = null,
  short_summary = '',
  raw_excerpt = '',
  linked_entities = [],
  linked_indicators = [],
  linked_urls = [],
  timestamp = null,
  confidence = 0.5,
  attachment_ref = null,
} = {}) {
  if (!case_id) throw new Error('case_id is required');
  const id = randomUUID();
  const now = new Date().toISOString();
  const evidence = {
    evidence_id: id,
    case_id,
    type,
    title: title || 'Untitled Evidence',
    source,
    source_ref,
    short_summary,
    raw_excerpt,
    linked_entities: [...linked_entities],
    linked_indicators: [...linked_indicators],
    linked_urls: [...linked_urls],
    timestamp: timestamp || now,
    confidence,
    attachment_ref,
    created_at: now,
  };
  _evidence.set(id, evidence);

  addTimelineEvent(case_id, 'evidence_added', `Evidence added: ${title}`, { evidence_id: id, type, source });
  caseEvents.emit('evidenceAdded', evidence);
  return evidence;
}

export function getCaseEvidence(caseId) {
  return [..._evidence.values()]
    .filter(e => e.case_id === caseId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export function getAllEvidence() {
  return [..._evidence.values()];
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
export function addTimelineEvent(caseId, event_type, description, metadata = {}) {
  const events = _timeline.get(caseId) || [];
  const event = {
    event_id: randomUUID(),
    event_type,
    description,
    metadata,
    timestamp: new Date().toISOString(),
  };
  events.push(event);
  _timeline.set(caseId, events);
  return event;
}

export function getCaseTimeline(caseId) {
  return (_timeline.get(caseId) || []).sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────
export function getCaseStats() {
  const all = [..._cases.values()];
  return {
    total: all.length,
    new: all.filter(c => c.status === 'new').length,
    triaging: all.filter(c => c.status === 'triaging').length,
    investigating: all.filter(c => c.status === 'investigating').length,
    escalated: all.filter(c => c.status === 'escalated').length,
    monitoring: all.filter(c => c.status === 'monitoring').length,
    mitigated: all.filter(c => c.status === 'mitigated').length,
    closed: all.filter(c => c.status === 'closed').length,
    critical_priority: all.filter(c => c.priority === 'critical').length,
    high_priority: all.filter(c => c.priority === 'high').length,
    total_evidence: _evidence.size,
  };
}

// ─── Linking helpers ──────────────────────────────────────────────────────────
export function linkAlertToCase(caseId, alertId) {
  const caseRecord = _cases.get(caseId);
  if (!caseRecord) return null;
  if (!caseRecord.linked_alert_ids.includes(alertId)) {
    caseRecord.linked_alert_ids.push(alertId);
    caseRecord.updated_at = new Date().toISOString();
    addTimelineEvent(caseId, 'alert_linked', `Alert linked: ${alertId}`, { alert_id: alertId });
  }
  return caseRecord;
}

export function linkArtifactToCase(caseId, artifactId) {
  const caseRecord = _cases.get(caseId);
  if (!caseRecord) return null;
  if (!caseRecord.linked_artifact_ids.includes(artifactId)) {
    caseRecord.linked_artifact_ids.push(artifactId);
    caseRecord.updated_at = new Date().toISOString();
    addTimelineEvent(caseId, 'artifact_linked', `Artifact linked: ${artifactId}`, { artifact_id: artifactId });
  }
  return caseRecord;
}
