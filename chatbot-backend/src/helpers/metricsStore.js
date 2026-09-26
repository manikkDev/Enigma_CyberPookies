/**
 * metricsStore.js
 *
 * Lightweight operational metrics and analytics.
 * In-memory counters for demo and evaluation purposes.
 */

// Simple in-memory counters
const _metrics = {
  threats_analyzed: 0,
  alerts_generated: 0,
  cases_created: 0,
  actions_suggested: 0,
  actions_completed: 0,
  watchlist_hits: 0,
  
  // By severity
  critical_threats: 0,
  high_threats: 0,
  medium_threats: 0,
  low_threats: 0,
  
  // By threat family
  phishing_detected: 0,
  malicious_url_detected: 0,
  misinformation_detected: 0,
  scam_detected: 0,
  aml_detected: 0,
  
  // By input type
  email_analyzed: 0,
  sms_analyzed: 0,
  url_analyzed: 0,
  social_post_analyzed: 0,
  raw_text_analyzed: 0,
};

/**
 * Increment a metric counter
 */
export function incrementMetric(key, amount = 1) {
  if (_metrics.hasOwnProperty(key)) {
    _metrics[key] += amount;
  }
}

/**
 * Get all metrics
 */
export function getMetrics() {
  return { ..._metrics };
}

/**
 * Reset all metrics (for testing)
 */
export function resetMetrics() {
  Object.keys(_metrics).forEach(k => _metrics[k] = 0);
}

/**
 * Record a threat analysis
 */
export function recordThreatAnalyzed(analysis) {
  incrementMetric('threats_analyzed');
  
  if (analysis?.risk_score?.severity) {
    const sev = analysis.risk_score.severity;
    incrementMetric(`${sev}_threats`);
  }
  
  if (analysis?.classification?.primary_family) {
    const family = analysis.classification.primary_family;
    if (family === 'phishing' || family === 'impersonation') {
      incrementMetric('phishing_detected');
    } else if (family === 'malicious_url' || family === 'malicious_attachment') {
      incrementMetric('malicious_url_detected');
    } else if (family === 'misinformation') {
      incrementMetric('misinformation_detected');
    } else if (family.includes('scam')) {
      incrementMetric('scam_detected');
    } else if (family.includes('aml')) {
      incrementMetric('aml_detected');
    }
  }
  
  if (analysis?.input_type) {
    const type = analysis.input_type;
    if (type === 'email_text') incrementMetric('email_analyzed');
    else if (type === 'sms_text') incrementMetric('sms_analyzed');
    else if (type === 'url') incrementMetric('url_analyzed');
    else if (type === 'social_post') incrementMetric('social_post_analyzed');
    else incrementMetric('raw_text_analyzed');
  }
}

/**
 * Record an alert generated
 */
export function recordAlertGenerated(alert) {
  incrementMetric('alerts_generated');
  if (alert?.watchlist_hit) {
    incrementMetric('watchlist_hits');
  }
}

/**
 * Record a case created
 */
export function recordCaseCreated() {
  incrementMetric('cases_created');
}

/**
 * Record an action suggested/completed
 */
export function recordActionSuggested() {
  incrementMetric('actions_suggested');
}

export function recordActionCompleted() {
  incrementMetric('actions_completed');
}

/**
 * Get aggregated stats for dashboard
 */
export function getDashboardStats() {
  const m = getMetrics();
  return {
    total_threats: m.threats_analyzed,
    total_alerts: m.alerts_generated,
    total_cases: m.cases_created,
    total_actions: m.actions_suggested,
    completed_actions: m.actions_completed,
    watchlist_hits: m.watchlist_hits,
    
    by_severity: {
      critical: m.critical_threats,
      high: m.high_threats,
      medium: m.medium_threats,
      low: m.low_threats,
    },
    
    by_family: {
      phishing: m.phishing_detected,
      malicious_url: m.malicious_url_detected,
      misinformation: m.misinformation_detected,
      scam: m.scam_detected,
      aml: m.aml_detected,
    },
    
    by_input: {
      email: m.email_analyzed,
      sms: m.sms_analyzed,
      url: m.url_analyzed,
      social_post: m.social_post_analyzed,
      raw_text: m.raw_text_analyzed,
    },
  };
}

export default {
  incrementMetric,
  getMetrics,
  resetMetrics,
  recordThreatAnalyzed,
  recordAlertGenerated,
  recordCaseCreated,
  recordActionSuggested,
  recordActionCompleted,
  getDashboardStats,
};
