/**
 * alertStore.js
 *
 * Lightweight in-memory alert and watchlist store.
 * Uses Maps for O(1) lookups and an EventEmitter so SSE clients
 * can subscribe to live updates without polling.
 *
 * Data shapes are designed to be drop-in replaceable with a DB layer later.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { recordAlertGenerated } from './metricsStore.js';

// ─── Event bus (used by SSE endpoint) ────────────────────────────────────────
export const alertEvents = new EventEmitter();
alertEvents.setMaxListeners(50);

// ─── Stores ───────────────────────────────────────────────────────────────────
const _alerts     = new Map(); // alertId → AlertRecord
const _watchlist  = new Map(); // watchlistId → WatchlistEntry
const _groups     = new Map(); // groupId → AlertGroup

// ─── Factory helpers ──────────────────────────────────────────────────────────
export function createAlert({
  title,
  severity       = 'medium',
  confidence     = 0.5,
  threat_family  = 'unknown',
  source         = 'analysis',
  reasons        = [],
  evidence_refs  = [],
  related_entities = [],
  top_indicator  = null,
  top_entity     = null,
  artifact_id    = null,
  pattern_id     = null,
  group_id       = null,
  watchlist_hit  = false,
  watchlist_terms = [],
} = {}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const alert = {
    alert_id:         id,
    title:            title || 'Untitled Alert',
    severity,
    confidence,
    threat_family,
    source,
    reasons,
    evidence_refs,
    related_entities,
    top_indicator,
    top_entity,
    artifact_id,
    pattern_id,
    group_id,
    watchlist_hit,
    watchlist_terms,
    status:           'open',
    created_at:       now,
    updated_at:       now,
  };
  _alerts.set(id, alert);
  return alert;
}

export function createWatchlistEntry({
  type,           // brand | domain | email | phone | wallet | username | keyword | narrative
  value,
  label        = '',
  notes        = '',
  severity     = 'medium',
  created_by   = 'system',
} = {}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const entry = {
    watchlist_id: id,
    type,
    value:        String(value || '').toLowerCase().trim(),
    label,
    notes,
    severity,
    created_by,
    hit_count:    0,
    last_hit_at:  null,
    created_at:   now,
    updated_at:   now,
  };
  _watchlist.set(id, entry);
  return entry;
}

export function createAlertGroup({
  label,
  threat_family = 'unknown',
  reason        = '',
} = {}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const group = {
    group_id:       id,
    label,
    threat_family,
    reason,
    member_count:   0,
    member_ids:     [],
    created_at:     now,
    updated_at:     now,
  };
  _groups.set(id, group);
  return group;
}

// ─── Alert CRUD ───────────────────────────────────────────────────────────────
export function addAlert(alertData) {
  const alert = createAlert(alertData);

  // Auto-group similar alerts
  autoGroup(alert);

  // Record metrics
  try { recordAlertGenerated(alert); } catch(e) { console.error('Metrics error:', e); }

  // Notify SSE subscribers
  alertEvents.emit('alert', alert);
  return alert;
}

export function getAlerts({ severity, status, threat_family, limit = 100 } = {}) {
  let results = [..._alerts.values()].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  if (severity)     results = results.filter(a => a.severity === severity);
  if (status)       results = results.filter(a => a.status === status);
  if (threat_family) results = results.filter(a => a.threat_family === threat_family);
  return results.slice(0, limit);
}

export function updateAlertStatus(alertId, status) {
  const alert = _alerts.get(alertId);
  if (!alert) return null;
  alert.status = status;
  alert.updated_at = new Date().toISOString();
  alertEvents.emit('alertUpdated', alert);
  return alert;
}

// ─── Watchlist CRUD ───────────────────────────────────────────────────────────
export function addWatchlistEntry(data) {
  const entry = createWatchlistEntry(data);
  alertEvents.emit('watchlistUpdated', { action: 'add', entry });
  return entry;
}

export function getWatchlist({ type } = {}) {
  let results = [..._watchlist.values()];
  if (type) results = results.filter(w => w.type === type);
  return results;
}

export function deleteWatchlistEntry(watchlistId) {
  const removed = _watchlist.get(watchlistId);
  if (!removed) return false;
  _watchlist.delete(watchlistId);
  alertEvents.emit('watchlistUpdated', { action: 'delete', watchlistId });
  return true;
}

/**
 * Check if any value from the given sets matches watchlist entries.
 * Returns { hit: boolean, matches: WatchlistEntry[] }
 */
export function checkWatchlist(valueSets = {}) {
  // valueSets: { domains: [], emails: [], phones: [], wallets: [], keywords: [], brands: [], usernames: [] }
  const matches = [];
  for (const entry of _watchlist.values()) {
    const candidates = valueSets[entry.type + 's'] || valueSets[entry.type] || [];
    const hit = candidates.some(v =>
      String(v || '').toLowerCase().includes(entry.value) ||
      entry.value.includes(String(v || '').toLowerCase())
    );
    if (hit) {
      entry.hit_count = (entry.hit_count || 0) + 1;
      entry.last_hit_at = new Date().toISOString();
      matches.push(entry);
    }
  }
  return { hit: matches.length > 0, matches };
}

// ─── Alert groups ─────────────────────────────────────────────────────────────
export function getGroups() {
  return [..._groups.values()].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

function autoGroup(alert) {
  // Find an existing open group for the same threat_family
  const existing = [..._groups.values()].find(
    g => g.threat_family === alert.threat_family && g.member_count < 20
  );
  if (existing) {
    existing.member_ids.push(alert.alert_id);
    existing.member_count += 1;
    existing.updated_at = new Date().toISOString();
    alert.group_id = existing.group_id;
    _alerts.set(alert.alert_id, alert);
  } else if (alert.severity === 'high' || alert.severity === 'critical') {
    // Create a new group for serious alerts
    const group = createAlertGroup({
      label: `${alert.threat_family.replace(/_/g,' ')} cluster`,
      threat_family: alert.threat_family,
      reason: `Auto-grouped ${alert.threat_family} alerts`,
    });
    group.member_ids.push(alert.alert_id);
    group.member_count = 1;
    alert.group_id = group.group_id;
    _alerts.set(alert.alert_id, alert);
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────
export function getAlertStats() {
  const all = [..._alerts.values()];
  return {
    total:    all.length,
    open:     all.filter(a => a.status === 'open').length,
    critical: all.filter(a => a.severity === 'critical').length,
    high:     all.filter(a => a.severity === 'high').length,
    medium:   all.filter(a => a.severity === 'medium').length,
    low:      all.filter(a => a.severity === 'low').length,
    watchlist_hits: all.filter(a => a.watchlist_hit).length,
    groups:   _groups.size,
    watchlist_entries: _watchlist.size,
  };
}

// ─── Seed demo watchlist entries ─────────────────────────────────────────────
function seedDemoWatchlist() {
  const seeds = [
    { type: 'brand',   value: 'paypal',        label: 'PayPal brand protection', severity: 'high' },
    { type: 'brand',   value: 'amazon',        label: 'Amazon brand protection', severity: 'high' },
    { type: 'brand',   value: 'microsoft',     label: 'Microsoft brand protection', severity: 'high' },
    { type: 'domain',  value: 'paypa1.com',    label: 'PayPal typosquat',        severity: 'critical' },
    { type: 'domain',  value: 'amaz0n.com',    label: 'Amazon typosquat',        severity: 'critical' },
    { type: 'keyword', value: 'verify your account', label: 'Phishing CTA',     severity: 'medium' },
    { type: 'keyword', value: 'urgent action required', label: 'Urgency CTA',   severity: 'medium' },
    { type: 'narrative', value: 'vaccine microchip', label: 'Health misinfo',    severity: 'high' },
  ];
  seeds.forEach(s => createWatchlistEntry({ ...s, created_by: 'seed' }));
}
seedDemoWatchlist();
