/**
 * Email Monitoring API Routes
 * 
 * Provides endpoints for:
 * - Connecting/disconnecting email monitoring
 * - SSE stream of analyzed emails
 * - Email analysis history
 */

import { Router } from 'express';
import emailMonitor from '../helpers/emailMonitor.js';
import { extractAllIOCs } from '../helpers/iocExtractor.js';
import { enrichIndicators } from '../helpers/threatIntelEnricher.js';

const router = Router();

const ML_SERVER_URL = process.env.ML_SERVER_URL || 'http://localhost:8000';

// SSE clients
let sseClients = [];

/**
 * Analyze an email through the full pipeline
 */
async function analyzeEmail(emailData) {
  try {
    // 1. Combine subject + body for analysis
    const fullContent = [
      emailData.subject ? `Subject: ${emailData.subject}` : '',
      emailData.from ? `From: ${emailData.from}` : '',
      emailData.body || '',
    ].filter(Boolean).join('\n');

    // 2. Call ML server for classification
    let mlResult = null;
    try {
      const mlResponse = await fetch(`${ML_SERVER_URL}/threat/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: fullContent,
          input_type: 'email_text',
        }),
      });
      if (mlResponse.ok) {
        mlResult = await mlResponse.json();
      }
    } catch (err) {
      console.error('[EmailRoutes] ML server error:', err.message);
    }

    // 3. Extract IOCs
    const indicators = extractAllIOCs(fullContent);

    // 4. Enrich IOCs
    const enrichment = await enrichIndicators(indicators);

    // 5. Build analyzed result
    const analyzedEmail = {
      id: emailData.id,
      timestamp: emailData.timestamp,
      email: {
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        bodyPreview: (emailData.body || '').substring(0, 300),
        attachments: emailData.attachments,
        headers: emailData.headers,
      },
      ml_classification: mlResult || {
        predicted_class: 'unknown',
        confidence: 0,
        risk_score: 0,
        severity: 'unknown',
      },
      indicators: enrichment.enriched,
      indicator_summary: enrichment.summary,
      analyzed_at: new Date().toISOString(),
    };

    // Add to history
    emailMonitor.addToHistory(analyzedEmail);

    // Push to SSE clients
    broadcastSSE(analyzedEmail);

    return analyzedEmail;

  } catch (error) {
    console.error('[EmailRoutes] Analysis error:', error.message);
    return null;
  }
}

/**
 * Broadcast analyzed email to all SSE clients
 */
function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter(client => {
    try {
      client.write(payload);
      return true;
    } catch (e) {
      return false;
    }
  });
}

// Wire up email monitor events
emailMonitor.on('new_email', async (emailData) => {
  console.log('[EmailRoutes] Processing new email:', emailData.subject);
  await analyzeEmail(emailData);
});

emailMonitor.on('status', (status) => {
  const payload = `event: status\ndata: ${JSON.stringify(status)}\n\n`;
  sseClients = sseClients.filter(client => {
    try {
      client.write(payload);
      return true;
    } catch (e) {
      return false;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/email/connect
 * Start monitoring an email inbox
 */
router.post('/connect', async (req, res) => {
  const { host, port, email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password (app password) are required',
    });
  }

  try {
    await emailMonitor.connect({
      host: host || 'imap.gmail.com',
      port: port || 993,
      email,
      password,
    });

    res.json({
      success: true,
      message: 'Connected and monitoring inbox',
      status: emailMonitor.getStatus(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/email/disconnect
 * Stop monitoring
 */
router.post('/disconnect', async (req, res) => {
  try {
    await emailMonitor.disconnect();
    res.json({ success: true, message: 'Disconnected' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/email/status
 * Get monitoring status
 */
router.get('/status', (req, res) => {
  res.json(emailMonitor.getStatus());
});

/**
 * GET /api/email/feed
 * SSE stream of analyzed emails
 */
router.get('/feed', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial status
  res.write(`event: status\ndata: ${JSON.stringify(emailMonitor.getStatus())}\n\n`);

  // Send history
  const history = emailMonitor.getHistory();
  if (history.length > 0) {
    res.write(`event: history\ndata: ${JSON.stringify(history)}\n\n`);
  }

  sseClients.push(res);

  // Heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter(c => c !== res);
  });
});

/**
 * GET /api/email/history
 * Get recent analyzed emails
 */
router.get('/history', (req, res) => {
  res.json({
    emails: emailMonitor.getHistory(),
    count: emailMonitor.getHistory().length,
  });
});

export default router;
