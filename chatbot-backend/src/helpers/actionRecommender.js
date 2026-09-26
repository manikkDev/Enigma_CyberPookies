/**
 * actionRecommender.js
 *
 * Mitigation action recommendation engine.
 * Analyzes threat family, indicators, entities, and severity to suggest
 * appropriate mitigation actions with explanations.
 */

import { ACTION_TYPES } from './actionStore.js';

// ─── Recommendation rules ─────────────────────────────────────────────────────
const THREAT_ACTION_RULES = {
  phishing: [
    { type: ACTION_TYPES.BLOCK_DOMAIN, reason: 'Block phishing domain to prevent further victim access' },
    { type: ACTION_TYPES.FLAG_SENDER, reason: 'Flag sender infrastructure for monitoring' },
    { type: ACTION_TYPES.WARN_BRAND, reason: 'Notify impersonated brand of phishing campaign' },
    { type: ACTION_TYPES.ADD_TO_WATCHLIST, reason: 'Add indicators to watchlist for future detection' },
  ],
  
  impersonation: [
    { type: ACTION_TYPES.BLOCK_DOMAIN, reason: 'Block impersonation domain' },
    { type: ACTION_TYPES.WARN_BRAND, reason: 'Alert target brand of impersonation' },
    { type: ACTION_TYPES.REQUEST_TAKEDOWN, reason: 'Request takedown from hosting provider' },
    { type: ACTION_TYPES.ADD_TO_WATCHLIST, reason: 'Monitor for related impersonation attempts' },
  ],

  malicious_url: [
    { type: ACTION_TYPES.BLOCK_DOMAIN, reason: 'Block malicious URL to prevent exploitation' },
    { type: ACTION_TYPES.BLOCK_IP, reason: 'Block hosting IP if part of known infrastructure' },
    { type: ACTION_TYPES.ADD_TO_WATCHLIST, reason: 'Track URL pattern for campaign detection' },
    { type: ACTION_TYPES.ESCALATE_REVIEW, reason: 'Escalate for deeper infrastructure analysis' },
  ],

  malicious_attachment: [
    { type: ACTION_TYPES.QUARANTINE_ATTACHMENT, reason: 'Quarantine malicious file to prevent execution' },
    { type: ACTION_TYPES.ADD_TO_WATCHLIST, reason: 'Add file hash to malware watchlist' },
    { type: ACTION_TYPES.FLAG_SENDER, reason: 'Flag sender for delivery infrastructure review' },
    { type: ACTION_TYPES.ESCALATE_REVIEW, reason: 'Escalate for malware analysis' },
  ],

  social_engineering_scam: [
    { type: ACTION_TYPES.SUSPEND_ACCOUNT, reason: 'Suspend scammer social account' },
    { type: ACTION_TYPES.MONITOR_NARRATIVE, reason: 'Monitor narrative spread across platforms' },
    { type: ACTION_TYPES.NOTIFY_ANALYST, reason: 'Alert fraud team to scam campaign' },
    { type: ACTION_TYPES.ADD_TO_WATCHLIST, reason: 'Track scam keywords and patterns' },
  ],

  misinformation: [
    { type: ACTION_TYPES.MONITOR_NARRATIVE, reason: 'Track misinformation narrative propagation' },
    { type: ACTION_TYPES.KEEP_MONITORING, reason: 'Continue monitoring for coordinated activity' },
    { type: ACTION_TYPES.ESCALATE_REVIEW, reason: 'Escalate to trust & safety for assessment' },
    { type: ACTION_TYPES.NOTIFY_ANALYST, reason: 'Alert disinformation analysts' },
  ],

  aml_financial_threat: [
    { type: ACTION_TYPES.MONITOR_WALLET, reason: 'Monitor flagged wallet for transaction patterns' },
    { type: ACTION_TYPES.ESCALATE_REVIEW, reason: 'Escalate to financial crime unit for investigation' },
    { type: ACTION_TYPES.ADD_TO_WATCHLIST, reason: 'Add entities to AML watchlist' },
    { type: ACTION_TYPES.KEEP_MONITORING, reason: 'Continue enhanced monitoring of related accounts' },
  ],

  unknown: [
    { type: ACTION_TYPES.ESCALATE_REVIEW, reason: 'Escalate for manual threat classification' },
    { type: ACTION_TYPES.KEEP_MONITORING, reason: 'Monitor for additional context' },
  ],
};

// ─── Main recommender ─────────────────────────────────────────────────────────
/**
 * Generate recommended actions for a case based on threat family, severity, and evidence.
 * Returns array of { action_type, title, description, reason, priority, auto_approve }
 */
export function recommendActionsForCase(caseData, evidence = []) {
  const family = caseData.threat_family || 'unknown';
  const severity = caseData.severity || 'medium';
  const confidence = caseData.confidence || 0.5;
  
  const baseRules = THREAT_ACTION_RULES[family] || THREAT_ACTION_RULES.unknown;
  const recommendations = [];

  for (const rule of baseRules) {
    const rec = {
      action_type: rule.type,
      title: buildActionTitle(rule.type, caseData, evidence),
      description: buildActionDescription(rule.type, caseData, evidence),
      reason: rule.reason,
      priority: derivePriority(severity, confidence, rule.type),
      auto_approve: shouldAutoApprove(severity, confidence, rule.type),
      metadata: {
        threat_family: family,
        severity,
        confidence,
      },
    };
    recommendations.push(rec);
  }

  // Add severity-based escalations
  if (severity === 'critical' && !recommendations.some(r => r.action_type === ACTION_TYPES.ESCALATE_REVIEW)) {
    recommendations.push({
      action_type: ACTION_TYPES.ESCALATE_REVIEW,
      title: 'Escalate Critical Threat',
      description: `Critical severity threat requires immediate analyst review`,
      reason: 'Critical severity requires human oversight',
      priority: 'critical',
      auto_approve: false,
      metadata: { severity, triggered_by: 'severity_rule' },
    });
  }

  // Add indicator-specific actions
  const domains = evidence.filter(e => e.type === 'domain' || e.type === 'indicator_domain');
  if (domains.length >= 3 && !recommendations.some(r => r.action_type === ACTION_TYPES.BLOCK_DOMAIN)) {
    recommendations.push({
      action_type: ACTION_TYPES.BLOCK_DOMAIN,
      title: `Block ${domains.length} Related Domains`,
      description: `Multiple related domains detected: ${domains.slice(0, 3).map(d => d.title).join(', ')}`,
      reason: 'High domain indicator density suggests coordinated infrastructure',
      priority: 'high',
      auto_approve: severity === 'critical',
      metadata: { domain_count: domains.length },
    });
  }

  return recommendations.slice(0, 6); // Limit to top 6 recommendations
}

// ─── Title builders ───────────────────────────────────────────────────────────
function buildActionTitle(actionType, caseData, evidence) {
  const templates = {
    [ACTION_TYPES.BLOCK_DOMAIN]: () => {
      const domains = evidence.filter(e => e.type === 'domain' || e.type === 'indicator_domain');
      return domains.length > 0 ? `Block Domain: ${domains[0].title}` : 'Block Malicious Domain';
    },
    [ACTION_TYPES.FLAG_SENDER]: () => 'Flag Sender Infrastructure',
    [ACTION_TYPES.QUARANTINE_ATTACHMENT]: () => 'Quarantine Malicious Attachment',
    [ACTION_TYPES.WATCH_BRAND]: () => {
      const brands = evidence.filter(e => e.type === 'entity_brand');
      return brands.length > 0 ? `Monitor Brand: ${brands[0].title}` : 'Monitor Targeted Brand';
    },
    [ACTION_TYPES.MONITOR_WALLET]: () => {
      const wallets = evidence.filter(e => e.type === 'wallet');
      return wallets.length > 0 ? `Monitor Wallet: ${wallets[0].title}` : 'Monitor Suspicious Wallet';
    },
    [ACTION_TYPES.MONITOR_NARRATIVE]: () => 'Monitor Narrative Spread',
    [ACTION_TYPES.ESCALATE_REVIEW]: () => `Escalate ${caseData.threat_family?.replace(/_/g, ' ')} Case`,
    [ACTION_TYPES.NOTIFY_ANALYST]: () => 'Notify Analyst Team',
    [ACTION_TYPES.MARK_FALSE_POSITIVE]: () => 'Mark as False Positive',
    [ACTION_TYPES.KEEP_MONITORING]: () => 'Continue Monitoring',
    [ACTION_TYPES.BLOCK_IP]: () => 'Block Hosting IP',
    [ACTION_TYPES.SUSPEND_ACCOUNT]: () => 'Suspend Malicious Account',
    [ACTION_TYPES.ADD_TO_WATCHLIST]: () => 'Add Indicators to Watchlist',
    [ACTION_TYPES.REQUEST_TAKEDOWN]: () => 'Request Content Takedown',
    [ACTION_TYPES.WARN_BRAND]: () => 'Warn Impersonated Brand',
  };
  
  const builder = templates[actionType];
  return builder ? builder() : actionType.replace(/_/g, ' ');
}

function buildActionDescription(actionType, caseData, evidence) {
  const threat = caseData.threat_family?.replace(/_/g, ' ') || 'threat';
  const severity = caseData.severity;
  
  const templates = {
    [ACTION_TYPES.BLOCK_DOMAIN]: () => `Block identified ${threat} domain to prevent victim access. Severity: ${severity}.`,
    [ACTION_TYPES.FLAG_SENDER]: () => `Flag sender infrastructure for enhanced monitoring and potential blocking.`,
    [ACTION_TYPES.QUARANTINE_ATTACHMENT]: () => `Quarantine malicious attachment to prevent execution and lateral spread.`,
    [ACTION_TYPES.WATCH_BRAND]: () => `Add brand to watchlist for future impersonation detection.`,
    [ACTION_TYPES.MONITOR_WALLET]: () => `Monitor wallet activity for suspicious transaction patterns.`,
    [ACTION_TYPES.MONITOR_NARRATIVE]: () => `Track narrative keywords and hashtags across platforms for spread analysis.`,
    [ACTION_TYPES.ESCALATE_REVIEW]: () => `Escalate to specialized analyst team for deeper investigation.`,
    [ACTION_TYPES.NOTIFY_ANALYST]: () => `Send alert notification to relevant analyst group.`,
    [ACTION_TYPES.MARK_FALSE_POSITIVE]: () => `Mark case as false positive and adjust detection rules.`,
    [ACTION_TYPES.KEEP_MONITORING]: () => `Continue monitoring without immediate intervention.`,
    [ACTION_TYPES.BLOCK_IP]: () => `Block hosting IP address to disrupt infrastructure.`,
    [ACTION_TYPES.SUSPEND_ACCOUNT]: () => `Suspend account involved in ${threat} activity.`,
    [ACTION_TYPES.ADD_TO_WATCHLIST]: () => `Add extracted indicators to watchlist for future alerts.`,
    [ACTION_TYPES.REQUEST_TAKEDOWN]: () => `Submit takedown request to hosting provider or platform.`,
    [ACTION_TYPES.WARN_BRAND]: () => `Notify impersonated brand of ongoing ${threat} campaign.`,
  };
  
  const builder = templates[actionType];
  return builder ? builder() : `Execute ${actionType.replace(/_/g, ' ')} action.`;
}

// ─── Priority derivation ──────────────────────────────────────────────────────
function derivePriority(severity, confidence, actionType) {
  // High-impact actions get higher priority
  const highImpactActions = [
    ACTION_TYPES.BLOCK_DOMAIN,
    ACTION_TYPES.QUARANTINE_ATTACHMENT,
    ACTION_TYPES.SUSPEND_ACCOUNT,
    ACTION_TYPES.ESCALATE_REVIEW,
  ];

  if (severity === 'critical') return 'critical';
  if (severity === 'high' && confidence >= 0.7) return 'high';
  if (highImpactActions.includes(actionType) && severity === 'high') return 'high';
  if (severity === 'medium' && confidence >= 0.8) return 'medium';
  return 'medium';
}

// ─── Auto-approval logic ──────────────────────────────────────────────────────
function shouldAutoApprove(severity, confidence, actionType) {
  // Only auto-approve low-risk monitoring actions with high confidence
  const safeActions = [
    ACTION_TYPES.KEEP_MONITORING,
    ACTION_TYPES.ADD_TO_WATCHLIST,
    ACTION_TYPES.NOTIFY_ANALYST,
  ];

  return safeActions.includes(actionType) && confidence >= 0.85;
}
