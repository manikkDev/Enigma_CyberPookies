/**
 * metricsRoutes.js
 *
 * Platform metrics and analytics endpoints for evaluation dashboard.
 */

import express from 'express';
import { getMetrics, getDashboardStats } from '../helpers/metricsStore.js';

const router = express.Router();

/**
 * GET /api/metrics
 * Get all raw metrics
 */
router.get('/', (req, res) => {
  try {
    const metrics = getMetrics();
    res.json({ success: true, metrics });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * GET /api/metrics/dashboard
 * Get aggregated stats for dashboard display
 */
router.get('/dashboard', (req, res) => {
  try {
    const stats = getDashboardStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

export default router;
