/**
 * alertRoutes.js
 *
 * Routes:
 *   GET  /api/alerts              – list alerts (filter: severity, status, threat_family)
 *   POST /api/alerts              – manually create an alert
 *   PATCH /api/alerts/:id/status  – update alert status
 *   GET  /api/alerts/stats        – alert statistics
 *   GET  /api/alerts/stream       – SSE real-time stream
 *
 *   GET  /api/alerts/watchlist              – list watchlist entries
 *   POST /api/alerts/watchlist              – add watchlist entry
 *   DELETE /api/alerts/watchlist/:id        – remove watchlist entry
 *
 *   GET  /api/alerts/groups       – list alert groups
 *
 *   POST /api/alerts/ingest       – generate alerts from a ThreatAnalysisResult
 */

import express from 'express';
import {
  addAlert,
  getAlerts,
  updateAlertStatus,
  getAlertStats,
  addWatchlistEntry,
  getWatchlist,
  deleteWatchlistEntry,
  getGroups,
  alertEvents,
} from '../helpers/alertStore.js';
import { generateAlertsFromAnalysis } from '../helpers/alertEngine.js';

const router = express.Router();

// ─── SSE stream ───────────────────────────────────────────────────────────────
/**
 * GET /api/alerts/stream
 * Opens an SSE connection; receives 'alert' and 'alertUpdated' events in real-time.
 */
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders?.();

  // Send current stats immediately on connect
  const stats = getAlertStats();
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ message: 'Alert stream connected', stats })}\n\n`);

  // Send a heartbeat every 25 s to keep connection alive
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
    }
  }, 25000);

  const onAlert = (alert) => {
    if (!res.writableEnded) {
      res.write(`event: alert\n`);
      res.write(`data: ${JSON.stringify(alert)}\n\n`);
    }
  };

  const onAlertUpdated = (alert) => {
    if (!res.writableEnded) {
      res.write(`event: alertUpdated\n`);
      res.write(`data: ${JSON.stringify(alert)}\n\n`);
    }
  };

  const onWatchlistUpdated = (payload) => {
    if (!res.writableEnded) {
      res.write(`event: watchlistUpdated\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  alertEvents.on('alert',            onAlert);
  alertEvents.on('alertUpdated',     onAlertUpdated);
  alertEvents.on('watchlistUpdated', onWatchlistUpdated);

  req.on('close', () => {
    clearInterval(heartbeat);
    alertEvents.off('alert',            onAlert);
    alertEvents.off('alertUpdated',     onAlertUpdated);
    alertEvents.off('watchlistUpdated', onWatchlistUpdated);
  });
});

// ─── Alert list ───────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { severity, status, threat_family, limit } = req.query;
  const alerts = getAlerts({
    severity,
    status,
    threat_family,
    limit: limit ? parseInt(limit, 10) : 100,
  });
  res.json({ success: true, alerts, total: alerts.length });
});

// ─── Alert stats ──────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  res.json({ success: true, stats: getAlertStats() });
});

// ─── Alert groups ─────────────────────────────────────────────────────────────
router.get('/groups', (req, res) => {
  res.json({ success: true, groups: getGroups() });
});

// ─── Ingest analysis → generate alerts ───────────────────────────────────────
/**
 * POST /api/alerts/ingest
 * Body: { analysis: ThreatAnalysisResult, correlation?: CorrelationResult }
 * Runs alert generation heuristics and returns created alerts.
 */
router.post('/ingest', (req, res) => {
  const { analysis, correlation } = req.body;

  if (!analysis) {
    return res.status(400).json({ error: 'Missing analysis in request body' });
  }

  // Attach correlation result to analysis for the engine to use
  const enrichedAnalysis = correlation
    ? { ...analysis, correlation }
    : analysis;

  const created = generateAlertsFromAnalysis(enrichedAnalysis);

  res.json({
    success: true,
    alerts_created: created.length,
    alerts: created,
  });
});

// ─── Manual alert creation ────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const alertData = req.body;
  if (!alertData?.title) {
    return res.status(400).json({ error: 'Alert title is required' });
  }
  const alert = addAlert(alertData);
  res.status(201).json({ success: true, alert });
});

// ─── Update alert status ──────────────────────────────────────────────────────
router.patch('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const VALID_STATUSES = ['open', 'investigating', 'resolved', 'dismissed'];
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  const updated = updateAlertStatus(id, status);
  if (!updated) return res.status(404).json({ error: 'Alert not found' });
  res.json({ success: true, alert: updated });
});

// ─── Watchlist ────────────────────────────────────────────────────────────────
router.get('/watchlist', (req, res) => {
  const { type } = req.query;
  const entries = getWatchlist({ type });
  res.json({ success: true, entries, total: entries.length });
});

router.post('/watchlist', (req, res) => {
  const { type, value, label, notes, severity } = req.body;
  const VALID_TYPES = ['brand', 'domain', 'email', 'phone', 'wallet', 'username', 'keyword', 'narrative'];
  if (!type || !value) {
    return res.status(400).json({ error: 'type and value are required' });
  }
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });
  }
  const entry = addWatchlistEntry({ type, value, label, notes, severity, created_by: 'analyst' });
  res.status(201).json({ success: true, entry });
});

router.delete('/watchlist/:id', (req, res) => {
  const removed = deleteWatchlistEntry(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Watchlist entry not found' });
  res.json({ success: true, removed: true });
});

export default router;
