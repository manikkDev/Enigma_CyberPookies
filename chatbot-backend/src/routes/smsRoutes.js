/**
 * SMS Monitoring API Routes
 * 
 * Provides endpoints for:
 * - Receiving SMS webhooks from the Android SMS Gateway app
 * - Connecting/disconnecting SMS monitoring
 * - SSE stream of analyzed SMS messages
 * - SMS analysis history
 * 
 * Compatible with:
 *  - android_income_sms_gateway_webhook (by bogkonstantin)
 *  - SMS Forwarder / SMS to URL Forwarder
 *  - Any app that sends HTTP POST with {from, text, sentStamp}
 */

import { Router } from 'express';
import smsMonitor from '../helpers/smsMonitor.js';
import { extractAllIOCs } from '../helpers/iocExtractor.js';
import { enrichIndicators } from '../helpers/threatIntelEnricher.js';

const router = Router();

const ML_SERVER_URL = process.env.ML_SERVER_URL || 'http://localhost:8000';

// SSE clients for SMS feed
let sseClients = [];

/**
 * SMS-specific threat feature explanations (human-readable)
 */
const SMISHING_EXPLANATIONS = {
  url_count: 'Contains web links — smishing often injects malicious URLs',
  urgency_score: 'Uses pressure language ("act now", "expires", "limited time")',
  suspicious_domain_patterns: 'URL domains contain lookalike or deceptive characters',
  financial_language_score: 'References money, payment, banking, or financial accounts',
  shortened_url_count: 'Uses shortened URLs to hide true destination (bit.ly, t.co, etc.)',
  phone_number_count: 'Contains phone numbers — may direct to premium-rate or scam lines',
  impersonation_signals: 'Impersonates a known brand (FedEx, PayPal, Amazon, bank, etc.)',
  credential_request: 'Asks for passwords, PINs, or personal information',
  uppercase_ratio: 'Excessive capitalization — common in scam/spam messages',
  exclamation_count: 'Excessive exclamation marks — pressure tactic',
  special_char_ratio: 'Unusual character patterns — may indicate obfuscation',
  text_length: 'Message length — very short messages with links are suspicious',
};

/**
 * Generate human-readable conviction reasons for an SMS
 */
function generateConvictionReasons(mlResult, smsText) {
  const reasons = [];
  const text = (smsText || '').toLowerCase();
  
  // URL-based reasons
  const urlMatch = smsText.match(/https?:\/\/[^\s]+/gi);
  if (urlMatch && urlMatch.length > 0) {
    reasons.push({
      category: 'Malicious Link Injection',
      severity: 'high',
      detail: `Contains ${urlMatch.length} URL(s) embedded in the message. SMS-based phishing (smishing) typically injects shortened or lookalike URLs to harvest credentials.`,
      urls: urlMatch,
    });
    
    // Check for shortened URLs
    const shorteners = ['bit.ly', 'tinyurl', 't.co', 'goo.gl', 'ow.ly', 'rebrand.ly', 'is.gd', 'cutt.ly'];
    const shortened = urlMatch.filter(u => shorteners.some(s => u.includes(s)));
    if (shortened.length > 0) {
      reasons.push({
        category: 'URL Obfuscation',
        severity: 'high',
        detail: `Uses shortened URL(s) (${shortened.join(', ')}) to obscure the actual destination domain. This is a common evasion technique to bypass spam filters.`,
      });
    }
  }

  // Urgency language
  const urgencyWords = ['urgent', 'immediately', 'act now', 'expire', 'suspend', 'limited time', 'within 24', 'last chance', 'final warning', 'now or never'];
  const foundUrgency = urgencyWords.filter(w => text.includes(w));
  if (foundUrgency.length > 0) {
    reasons.push({
      category: 'Urgency Pressure Tactics',
      severity: 'medium',
      detail: `Uses pressure language: "${foundUrgency.join('", "')}". Creating a false sense of urgency is a core social engineering technique to bypass rational judgment.`,
    });
  }

  // Brand impersonation
  const brands = ['paypal', 'fedex', 'amazon', 'bank of', 'wells fargo', 'chase', 'apple', 'google', 'microsoft', 'netflix', 'usps', 'ups', 'dhl', 'irs', 'sbi', 'hdfc', 'icici', 'axis bank', 'kotak'];
  const foundBrands = brands.filter(b => text.includes(b));
  if (foundBrands.length > 0) {
    reasons.push({
      category: 'Brand Impersonation',
      severity: 'critical',
      detail: `Appears to impersonate: ${foundBrands.map(b => b.toUpperCase()).join(', ')}. Legitimate organizations rarely send unsolicited SMS with embedded links requesting personal information.`,
    });
  }

  // Financial/credential harvesting
  const finWords = ['account', 'password', 'pin', 'otp', 'verify', 'confirm', 'credit card', 'debit', 'ssn', 'aadhaar', 'pan card', 'bank account', 'payment', 'refund', 'prize', 'lottery', 'winner', 'congratulations'];
  const foundFin = finWords.filter(w => text.includes(w));
  if (foundFin.length > 0) {
    reasons.push({
      category: 'Credential/Financial Harvesting',
      severity: 'high',
      detail: `References sensitive terms: "${foundFin.join('", "')}". This SMS may attempt to harvest financial credentials or personal information.`,
    });
  }

  // If ML gave high confidence, note that
  if (mlResult && mlResult.confidence > 0.7 && mlResult.predicted_class !== 'benign') {
    reasons.push({
      category: 'ML Model High Confidence Detection',
      severity: mlResult.confidence > 0.9 ? 'critical' : 'high',
      detail: `The Gradient Boosting classifier identified this as "${mlResult.predicted_class.replace(/_/g, ' ')}" with ${(mlResult.confidence * 100).toFixed(1)}% confidence based on 25 structural text features including TF-IDF keyword analysis, character entropy, and language pattern matching.`,
    });
  }

  // If benign, add reassurance
  if (reasons.length === 0 || (mlResult && mlResult.predicted_class === 'benign' && mlResult.confidence > 0.8)) {
    reasons.push({
      category: 'Benign Assessment',
      severity: 'info',
      detail: 'No significant threat indicators were detected. The message appears to be legitimate based on structural analysis, language patterns, and IOC extraction.',
    });
  }

  return reasons;
}

/**
 * Analyze an SMS through the full pipeline
 */
async function analyzeSms(smsData) {
  try {
    const fullContent = smsData.text || '';

    // 1. Call ML server for classification
    let mlResult = null;
    try {
      const mlResponse = await fetch(`${ML_SERVER_URL}/threat/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: fullContent,
          input_type: 'sms_text',
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (mlResponse.ok) {
        mlResult = await mlResponse.json();
      }
    } catch (err) {
      console.error('[SmsRoutes] ML server error:', err.message);
    }

    // 2. Extract IOCs
    const indicators = extractAllIOCs(fullContent);

    // 3. Enrich IOCs
    let enrichment = { enriched: [], summary: { total: 0, malicious: 0, suspicious: 0, clean: 0, unknown: 0 } };
    try {
      enrichment = await enrichIndicators(indicators);
    } catch (err) {
      console.error('[SmsRoutes] Enrichment error:', err.message);
    }

    // 4. Generate conviction reasons
    const convictionReasons = generateConvictionReasons(mlResult, fullContent);

    // 5. Calculate risk score using same fusion formula
    const mlScore = mlResult?.risk_score || 0;
    const heuristicScore = indicators.length * 10 + convictionReasons.filter(r => r.severity === 'critical').length * 30 + convictionReasons.filter(r => r.severity === 'high').length * 20;
    const intelScore = enrichment.summary.malicious > 0 ? 90 : enrichment.summary.suspicious > 0 ? 50 : 10;
    const fusedScore = Math.min(100, Math.round(
      (Math.min(heuristicScore, 100) * 0.3) + (mlScore * 0.5) + (intelScore * 0.2)
    ));

    // 6. Build the analyzed SMS result
    const analyzedSms = {
      id: smsData.id,
      timestamp: smsData.timestamp,
      type: 'sms',
      sms: {
        from: smsData.from,
        text: smsData.text,
        sim: smsData.sim,
        sentStamp: smsData.sentStamp,
      },
      ml_classification: mlResult || {
        predicted_class: 'unknown',
        confidence: 0,
        risk_score: 0,
        severity: 'unknown',
        top_features: [],
      },
      risk_score: fusedScore,
      scoring_breakdown: {
        heuristic_score: Math.min(heuristicScore, 100),
        heuristic_weight: 0.3,
        ml_score: mlScore,
        ml_weight: 0.5,
        intel_score: intelScore,
        intel_weight: 0.2,
        fused_score: fusedScore,
      },
      indicators: enrichment.enriched,
      indicator_summary: enrichment.summary,
      conviction_reasons: convictionReasons,
      analyzed_at: new Date().toISOString(),
    };

    // Add to history
    smsMonitor.addToHistory(analyzedSms);

    // Push to SSE clients
    broadcastSSE(analyzedSms);

    return analyzedSms;

  } catch (error) {
    console.error('[SmsRoutes] Analysis error:', error.message);
    return null;
  }
}

/**
 * Broadcast analyzed SMS to all SSE clients
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

// Wire up SMS monitor events
smsMonitor.on('new_sms', async (smsData) => {
  console.log('[SmsRoutes] Processing new SMS from:', smsData.from);
  await analyzeSms(smsData);
});

smsMonitor.on('status', (status) => {
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
 * POST /api/sms/webhook
 * 
 * Receives SMS from the Android SMS Gateway app.
 * This is the primary ingestion endpoint.
 * 
 * Expected payload (from android_income_sms_gateway_webhook):
 *  { "from": "+1234567890", "text": "message body", "sentStamp": "1712800000" }
 * 
 * Also supports:
 *  { "from": "...", "body": "...", "message": "..." }
 */
router.post('/webhook', async (req, res) => {
  // Always respond 200 quickly so the Android app doesn't retry unnecessarily
  const smsData = req.body;
  
  if (!smsData || (!smsData.text && !smsData.body && !smsData.message)) {
    return res.status(400).json({ success: false, error: 'No SMS content in payload' });
  }

  // Normalize text field
  smsData.text = smsData.text || smsData.body || smsData.message || '';

  // Try to process it
  const result = smsMonitor.receiveSms(smsData);
  
  if (result) {
    res.json({ success: true, message: 'SMS received and queued for analysis', id: result.id });
  } else {
    res.json({ success: false, message: 'SMS monitoring is inactive or message was a duplicate' });
  }
});

/**
 * POST /api/sms/connect
 * Activate SMS monitoring (start accepting webhooks)
 */
router.post('/connect', (req, res) => {
  const { webhookUrl } = req.body;
  
  smsMonitor.activate({ webhookUrl });
  
  res.json({
    success: true,
    message: 'SMS monitoring activated — webhooks accepted',
    status: smsMonitor.getStatus(),
  });
});

/**
 * POST /api/sms/disconnect
 * Deactivate SMS monitoring (stop accepting webhooks)
 */
router.post('/disconnect', (req, res) => {
  smsMonitor.deactivate();
  
  res.json({
    success: true,
    message: 'SMS monitoring deactivated',
    status: smsMonitor.getStatus(),
  });
});

/**
 * GET /api/sms/status
 * Get monitoring status
 */
router.get('/status', (req, res) => {
  res.json(smsMonitor.getStatus());
});

/**
 * GET /api/sms/feed
 * SSE stream of analyzed SMS messages
 */
router.get('/feed', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial status
  res.write(`event: status\ndata: ${JSON.stringify(smsMonitor.getStatus())}\n\n`);

  // Send history
  const history = smsMonitor.getHistory();
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
 * GET /api/sms/history
 * Get recent analyzed SMS messages
 */
router.get('/history', (req, res) => {
  res.json({
    messages: smsMonitor.getHistory(),
    count: smsMonitor.getHistory().length,
  });
});

export default router;
