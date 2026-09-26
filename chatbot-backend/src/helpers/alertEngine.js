/**
 * alertEngine.js
 *
 * Heuristic alert generation from:
 *   - threat analysis results (high risk scores)
 *   - watchlist matches
 *   - repeated domain / sender / pattern hits
 *   - campaign correlation hits
 *   - AML risk hits
 *
 * All alerts are explainable: every alert has a reasons[] array.
 */

import { addAlert, checkWatchlist } from './alertStore.js';

// ─── Severity thresholds ──────────────────────────────────────────────────────
const SEVERITY_THRESHOLDS = {
  critical: 85,
  high:     65,
  medium:   45,
  low:       0,
};

function scoreToSeverity(score) {
  if (score >= SEVERITY_THRESHOLDS.critical) return 'critical';
  if (score >= SEVERITY_THRESHOLDS.high)     return 'high';
  if (score >= SEVERITY_THRESHOLDS.medium)   return 'medium';
  return 'low';
}

// ─── Indicator extraction helpers ─────────────────────────────────────────────
function extractValueSets(analysis) {
  const domains  = [];
  const emails   = [];
  const urls     = [];
  const phones   = [];
  const wallets  = [];
  const keywords = [];
  const brands   = [];
  const usernames = [];

  const indicators = analysis?.indicators || [];
  for (const ind of indicators) {
    const v = String(ind.value || '').toLowerCase();
    if (!v) continue;
    switch (ind.type) {
      case 'domain':   domains.push(v);   break;
      case 'email':    emails.push(v);    break;
      case 'url':      urls.push(v);      break;
      case 'phone':    phones.push(v);    break;
      case 'wallet':   wallets.push(v);   break;
      case 'keyword':  keywords.push(v);  break;
    }
  }

  const entities = analysis?.entities || [];
  for (const ent of entities) {
    const v = String(ent.value || '').toLowerCase();
    if (!v) continue;
    if (ent.entity_type === 'claimed_brand' || ent.role === 'target_brand') brands.push(v);
    if (ent.entity_type === 'social_account' || ent.entity_type === 'username') usernames.push(v);
  }

  const claims = analysis?.claims || [];
  for (const cl of claims) {
    if (cl.claim_text) keywords.push(cl.claim_text.slice(0, 60).toLowerCase());
  }

  return { domains, emails, urls, phones, wallets, keywords, brands, usernames };
}

// ─── Main generator ───────────────────────────────────────────────────────────
/**
 * Generate alerts from a ThreatAnalysisResult.
 * Returns array of created alert objects.
 */
export function generateAlertsFromAnalysis(analysis) {
  if (!analysis) return [];
  const alerts = [];
  const score     = analysis.risk_score?.overall_score || 0;
  const severity  = scoreToSeverity(score);
  const family    = analysis.classification?.primary_family || 'unknown';
  const artifactId = analysis.artifact_id;
  const reasons   = [];
  const evidenceRefs = [];

  // Only create alerts for medium-severity and above
  if (score < SEVERITY_THRESHOLDS.medium) return [];

  // ── Risk score signal ──────────────────────────────────────────────────────
  reasons.push(`Risk score: ${score}/100 (${severity})`);
  if (analysis.risk_score?.reasons?.length) {
    analysis.risk_score.reasons.slice(0, 3).forEach(r => reasons.push(r));
  }

  // ── Watchlist check ────────────────────────────────────────────────────────
  const valueSets = extractValueSets(analysis);
  const watchlistResult = checkWatchlist(valueSets);
  let watchlistHit = false;
  const watchlistTerms = [];

  if (watchlistResult.hit) {
    watchlistHit = true;
    watchlistResult.matches.forEach(w => {
      reasons.push(`Watchlist hit: [${w.type}] "${w.value}" (${w.label})`);
      watchlistTerms.push(w.value);
      evidenceRefs.push(`watchlist:${w.watchlist_id}`);
    });
  }

  // ── Indicator signals ──────────────────────────────────────────────────────
  const indicators = analysis.indicators || [];
  if (indicators.length >= 5) {
    reasons.push(`High indicator density: ${indicators.length} IOCs extracted`);
  }
  const maliciousInds = indicators.filter(i => (i.confidence || 0) >= 0.8);
  if (maliciousInds.length) {
    reasons.push(`${maliciousInds.length} high-confidence malicious indicators`);
    maliciousInds.slice(0, 3).forEach(i => evidenceRefs.push(`${i.type}:${i.value}`));
  }

  // ── Claims ─────────────────────────────────────────────────────────────────
  const claims = analysis.claims || [];
  const highRiskClaims = claims.filter(c => c.risk_level === 'high');
  if (highRiskClaims.length) {
    reasons.push(`${highRiskClaims.length} high-risk claims detected`);
  }

  // ── Campaign correlation ───────────────────────────────────────────────────
  const correlation = analysis.correlation;
  let campaignSummary = null;
  if (correlation?.campaign_hint) {
    const hint = correlation.campaign_hint;
    campaignSummary = hint.campaign_label;
    reasons.push(`Campaign correlation: "${hint.campaign_label}" (${Math.round((hint.confidence || 0) * 100)}% confidence)`);
    reasons.push(`Related incidents: ${hint.related_count}`);
    evidenceRefs.push(`campaign:${hint.campaign_label}`);
  } else if (correlation?.total_correlated >= 2) {
    reasons.push(`Correlated with ${correlation.total_correlated} existing incidents`);
  }

  // ── Top indicator and entity for card display ──────────────────────────────
  const topIndicator = indicators[0] ? `[${indicators[0].type}] ${indicators[0].value}` : null;
  const entities = analysis.entities || [];
  const topEntity = entities[0] ? `[${entities[0].entity_type}] ${entities[0].value}` : null;

  // ── Build alert title ──────────────────────────────────────────────────────
  let title = buildAlertTitle(family, score, watchlistHit, valueSets.brands, campaignSummary);

  const alert = addAlert({
    title,
    severity,
    confidence:       Math.min((score / 100) * (watchlistHit ? 1.1 : 1), 1),
    threat_family:    family,
    source:           analysis.artifact_summary?.input_type || 'analysis',
    reasons,
    evidence_refs:    evidenceRefs,
    related_entities: entities.slice(0, 5).map(e => `${e.entity_type}:${e.value}`),
    top_indicator:    topIndicator,
    top_entity:       topEntity,
    artifact_id:      artifactId,
    pattern_id:       family,
    watchlist_hit:    watchlistHit,
    watchlist_terms:  watchlistTerms,
  });

  alerts.push(alert);

  // ── Watchlist-specific supplementary alert if high severity ───────────────
  if (watchlistHit && severity !== 'critical' && watchlistTerms.length) {
    const wlAlert = addAlert({
      title: `Watchlist Match — ${watchlistTerms.slice(0, 2).join(', ')}`,
      severity: 'high',
      confidence: 0.9,
      threat_family: family,
      source: 'watchlist',
      reasons: [`Direct watchlist match for: ${watchlistTerms.join(', ')}`],
      evidence_refs: evidenceRefs.filter(r => r.startsWith('watchlist:')),
      artifact_id: artifactId,
      watchlist_hit: true,
      watchlist_terms: watchlistTerms,
      top_indicator: topIndicator,
    });
    alerts.push(wlAlert);
  }

  return alerts;
}

/**
 * Generate an alert directly from an AML classifier result (P1-P6 hit).
 */
export function generateAlertFromAmlResult(classificationResult, artifactId = null) {
  if (!classificationResult?.best_above_threshold) return null;

  const score    = Math.round((classificationResult.best_risk_score || 0) * 100);
  const severity = scoreToSeverity(score);
  const pattern  = classificationResult.best_pattern || 'AML Pattern';

  const alert = addAlert({
    title:         `AML Risk Detected — ${pattern}`,
    severity,
    confidence:    classificationResult.best_risk_score || 0,
    threat_family: 'aml_financial_threat',
    source:        'aml_classifier',
    reasons: [
      `Pattern match: ${pattern}`,
      `Risk score: ${score}/100`,
      `Decision: ${classificationResult.best_decision || 'suspicious'}`,
    ],
    top_indicator: pattern,
    artifact_id:   artifactId,
    pattern_id:    pattern,
    watchlist_hit: false,
  });

  return alert;
}

// ─── Title builder ────────────────────────────────────────────────────────────
function buildAlertTitle(family, score, watchlistHit, brands = [], campaignLabel = null) {
  const FAMILY_TITLES = {
    phishing:                 'Phishing Attempt Detected',
    malicious_url:            'Malicious URL Identified',
    malicious_attachment:     'Malicious Attachment Detected',
    social_engineering_scam:  'Social Engineering Scam',
    misinformation:           'Misinformation Campaign',
    impersonation:            'Brand Impersonation',
    aml_financial_threat:     'AML Risk Detected',
    unknown:                  'Suspicious Activity Detected',
  };

  let title = FAMILY_TITLES[family] || 'Threat Detected';

  if (brands.length) {
    title += ` — ${brands[0].charAt(0).toUpperCase() + brands[0].slice(1)}`;
  } else if (campaignLabel) {
    title += ` — ${campaignLabel}`;
  }

  if (watchlistHit) title = '⚑ ' + title;

  return title;
}
