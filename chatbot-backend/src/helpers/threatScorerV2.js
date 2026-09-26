/**
 * Threat Scoring Engine V2 - Enhanced
 * 
 * Explainable hybrid threat scoring with threat family classification.
 * Uses feature-based scoring with clear evidence trails.
 */

import { createThreatRiskScore, createThreatEvidence } from '../types/threatSchema.js';
import { buildThreatFeatures } from './threatFeatureBuilder.js';

/**
 * Threat family classifications
 */
const THREAT_FAMILIES = {
  PHISHING: 'phishing',
  SMISHING: 'smishing',
  MALICIOUS_URL: 'malicious_url',
  MALICIOUS_ATTACHMENT: 'malicious_attachment',
  IMPERSONATION: 'impersonation',
  SOCIAL_ENGINEERING_SCAM: 'social_engineering_scam',
  MISINFORMATION: 'misinformation',
  FINANCIAL_FRAUD: 'financial_fraud',
  UNKNOWN: 'unknown'
};

/**
 * Score content risk using features
 */
function scoreContentRisk(features, text) {
  let score = 0;
  const reasons = [];
  const evidence = [];
  
  const content = features.content;
  
  // Urgency scoring (max 25 points)
  if (content.urgency_keywords_count >= 3) {
    score += 25;
    reasons.push(`HIGH_URGENCY: ${content.urgency_keywords_count} urgency keywords detected`);
    evidence.push(createThreatEvidence(
      'urgency_pressure',
      `Multiple urgency indicators (${content.urgency_keywords_count} found)`,
      0.9
    ));
  } else if (content.urgency_keywords_count >= 1) {
    score += 15;
    reasons.push(`URGENCY: ${content.urgency_keywords_count} urgency keyword(s) present`);
    evidence.push(createThreatEvidence(
      'urgency_language',
      `Urgency language detected (${content.urgency_keywords_count} indicators)`,
      0.7
    ));
  }
  
  // Fear/pressure tactics (max 20 points)
  if (content.fear_keywords_count >= 2) {
    score += 20;
    reasons.push(`FEAR_TACTICS: Multiple fear-inducing terms (${content.fear_keywords_count})`);
    evidence.push(createThreatEvidence(
      'fear_manipulation',
      `Fear-based manipulation detected (${content.fear_keywords_count} terms)`,
      0.9
    ));
  } else if (content.fear_keywords_count === 1) {
    score += 10;
    reasons.push(`FEAR_LANGUAGE: Fear-based language present`);
    evidence.push(createThreatEvidence(
      'fear_language',
      'Fear-inducing terminology used',
      0.7
    ));
  }
  
  // Credential request (max 25 points)
  if (content.credential_request) {
    score += 25;
    reasons.push('CREDENTIAL_REQUEST: Soliciting authentication credentials');
    evidence.push(createThreatEvidence(
      'credential_phishing',
      'Requests username, password, or authentication codes',
      0.95
    ));
  }
  
  // Payment request (max 20 points)
  if (content.payment_request) {
    score += 20;
    reasons.push('PAYMENT_REQUEST: Soliciting financial information or payment');
    evidence.push(createThreatEvidence(
      'payment_solicitation',
      'Requests payment information or money transfer',
      0.9
    ));
  }
  
  // Personal info request (max 15 points)
  if (content.personal_info_request) {
    score += 15;
    reasons.push('PII_REQUEST: Requesting sensitive personal information');
    evidence.push(createThreatEvidence(
      'pii_phishing',
      'Solicits SSN, DOB, or government ID information',
      0.9
    ));
  }
  
  // Brand impersonation (max 15 points)
  if (content.brand_impersonation) {
    score += 15;
    reasons.push('BRAND_IMPERSONATION: Mentions known brand or service');
    evidence.push(createThreatEvidence(
      'brand_mention',
      'References legitimate brand name (potential impersonation)',
      0.75
    ));
  }
  
  // Suspicious CTAs (max 10 points)
  if (content.suspicious_cta_count >= 2) {
    score += 10;
    reasons.push(`SUSPICIOUS_CTA: Multiple suspicious call-to-actions (${content.suspicious_cta_count})`);
    evidence.push(createThreatEvidence(
      'manipulation_cta',
      `Repeated pressure to click/act (${content.suspicious_cta_count} CTAs)`,
      0.8
    ));
  }
  
  // Text quality issues (max 5 points)
  if (content.excessive_caps || content.excessive_punctuation) {
    score += 5;
    reasons.push('POOR_QUALITY: Excessive caps or punctuation');
    evidence.push(createThreatEvidence(
      'text_quality',
      'Unusual text formatting (excessive caps/punctuation)',
      0.6
    ));
  }
  
  // Cap at 100
  score = Math.min(score, 100);
  
  return { score, reasons, evidence };
}

/**
 * Score infrastructure risk using features
 */
function scoreInfrastructureRisk(features) {
  let score = 0;
  const reasons = [];
  const evidence = [];
  
  const infra = features.infrastructure;
  
  // Suspicious TLDs (max 25 points)
  if (infra.suspicious_tld_count > 0) {
    score += Math.min(infra.suspicious_tld_count * 25, 25);
    reasons.push(`SUSPICIOUS_TLD: ${infra.suspicious_tld_count} domain(s) with high-risk TLD`);
    evidence.push(createThreatEvidence(
      'suspicious_tld',
      `Uses high-risk top-level domain(s): ${infra.suspicious_tld_count} found`,
      0.8
    ));
  }
  
  // URL shorteners (max 15 points)
  if (infra.url_shortener_count > 0) {
    score += 15;
    reasons.push(`URL_SHORTENER: ${infra.url_shortener_count} shortened URL(s) (obscures destination)`);
    evidence.push(createThreatEvidence(
      'url_obfuscation',
      `Uses URL shortening service to hide destination (${infra.url_shortener_count} links)`,
      0.7
    ));
  }
  
  // IP-based URLs (max 20 points)
  if (infra.ip_based_url_count > 0) {
    score += 20;
    reasons.push(`IP_URL: ${infra.ip_based_url_count} URL(s) using raw IP address`);
    evidence.push(createThreatEvidence(
      'ip_based_url',
      `Direct IP address in URL (${infra.ip_based_url_count} instances)`,
      0.85
    ));
  }
  
  // Multiple external links (max 15 points)
  if (infra.total_urls >= 5) {
    score += 15;
    reasons.push(`MULTIPLE_URLS: ${infra.total_urls} external links (potential redirect chain)`);
    evidence.push(createThreatEvidence(
      'link_spam',
      `Unusually high number of external links (${infra.total_urls})`,
      0.7
    ));
  } else if (infra.total_urls >= 3) {
    score += 8;
    reasons.push(`SEVERAL_URLS: ${infra.total_urls} external links present`);
    evidence.push(createThreatEvidence(
      'multiple_links',
      `Multiple external links (${infra.total_urls})`,
      0.6
    ));
  }
  
  // Crypto wallets (max 20 points)
  if (infra.crypto_wallet_count > 0) {
    score += 20;
    reasons.push(`CRYPTO_WALLET: ${infra.crypto_wallet_count} cryptocurrency address(es) found`);
    evidence.push(createThreatEvidence(
      'crypto_solicitation',
      `Contains cryptocurrency wallet address(es): ${infra.crypto_wallet_count}`,
      0.85
    ));
  }
  
  // Deep URL paths (max 10 points)
  if (infra.avg_url_depth > 4) {
    score += 10;
    reasons.push(`DEEP_URL: URLs have unusual depth (avg: ${infra.avg_url_depth.toFixed(1)})`);
    evidence.push(createThreatEvidence(
      'url_complexity',
      `URLs use deep or complex paths (may hide malicious content)`,
      0.6
    ));
  }
  
  // Cap at 100
  score = Math.min(score, 100);
  
  return { score, reasons, evidence };
}

/**
 * Score behavioral risk using features
 */
function scoreBehaviorRisk(features) {
  let score = 0;
  const reasons = [];
  const evidence = [];
  
  const behavior = features.behavior;
  
  // Urgency + fear combo (max 25 points)
  if (behavior.has_urgency_tactics && behavior.has_fear_tactics) {
    score += 25;
    reasons.push('PRESSURE_COMBO: Combines urgency and fear tactics (manipulation pattern)');
    evidence.push(createThreatEvidence(
      'psychological_manipulation',
      'Uses both urgency and fear to pressure victim',
      0.9
    ));
  } else if (behavior.has_urgency_tactics) {
    score += 15;
    reasons.push('URGENCY_PATTERN: Urgency tactics detected');
    evidence.push(createThreatEvidence(
      'urgency_behavior',
      'Pressures for immediate action',
      0.75
    ));
  } else if (behavior.has_fear_tactics) {
    score += 15;
    reasons.push('FEAR_PATTERN: Fear-based manipulation');
    evidence.push(createThreatEvidence(
      'fear_behavior',
      'Uses fear to coerce action',
      0.75
    ));
  }
  
  // Impersonation (max 25 points)
  if (behavior.impersonation_detected) {
    score += 25;
    reasons.push('IMPERSONATION: Likely impersonating trusted entity');
    evidence.push(createThreatEvidence(
      'entity_impersonation',
      'Impersonates brand or authority figure',
      0.85
    ));
  }
  
  // Multiple sensitive requests (max 30 points)
  if (behavior.multiple_request_types >= 3) {
    score += 30;
    reasons.push('MULTI_REQUEST: Requests multiple types of sensitive data');
    evidence.push(createThreatEvidence(
      'excessive_requests',
      `Solicits ${behavior.multiple_request_types} types of sensitive information`,
      0.95
    ));
  } else if (behavior.multiple_request_types === 2) {
    score += 20;
    reasons.push('DUAL_REQUEST: Requests two types of sensitive data');
    evidence.push(createThreatEvidence(
      'multiple_requests',
      'Requests multiple categories of sensitive data',
      0.85
    ));
  }
  
  // High risk claims (max 20 points)
  if (behavior.has_high_risk_claims) {
    score += 20;
    reasons.push('HIGH_RISK_CLAIMS: Contains high-risk claims or assertions');
    evidence.push(createThreatEvidence(
      'dangerous_claims',
      'Makes high-risk claims (scam/fraud/urgent)',
      0.8
    ));
  }
  
  // Reward bait (max 10 points)
  if (behavior.has_reward_bait) {
    score += 10;
    reasons.push('REWARD_BAIT: Promises prizes or rewards');
    evidence.push(createThreatEvidence(
      'reward_scam',
      'Offers unrealistic prizes or rewards',
      0.75
    ));
  }
  
  // Cap at 100
  score = Math.min(score, 100);
  
  return { score, reasons, evidence };
}

/**
 * Score financial risk using features
 */
function scoreFinancialRisk(features) {
  let score = 0;
  const reasons = [];
  const evidence = [];
  
  const financial = features.financial;
  
  // Crypto requests (max 30 points)
  if (financial.has_crypto_request) {
    score += 30;
    reasons.push('CRYPTO_REQUEST: Solicits cryptocurrency payment');
    evidence.push(createThreatEvidence(
      'crypto_fraud',
      'Requests cryptocurrency transfer or wallet information',
      0.9
    ));
  }
  
  // Wire transfer (max 30 points)
  if (financial.has_wire_transfer_request) {
    score += 30;
    reasons.push('WIRE_TRANSFER: Requests wire transfer (high-risk payment method)');
    evidence.push(createThreatEvidence(
      'wire_fraud',
      'Solicits wire transfer or money service payment',
      0.9
    ));
  }
  
  // Bank transfer (max 25 points)
  if (financial.has_bank_transfer_request) {
    score += 25;
    reasons.push('BANK_TRANSFER: Requests bank account transfer');
    evidence.push(createThreatEvidence(
      'bank_fraud',
      'Requests direct bank transfer or routing information',
      0.85
    ));
  }
  
  // Payment app (max 15 points)
  if (financial.has_payment_app_request) {
    score += 15;
    reasons.push('PAYMENT_APP: Requests payment via app (PayPal, Venmo, etc.)');
    evidence.push(createThreatEvidence(
      'payment_app_fraud',
      'Solicits payment through PayPal, Venmo, or similar',
      0.75
    ));
  }
  
  // Suspicious payment flow (max 20 points)
  if (financial.suspicious_payment_flow) {
    score += 20;
    reasons.push('SUSPICIOUS_FLOW: Urgency combined with payment request');
    evidence.push(createThreatEvidence(
      'urgent_payment',
      'Combines urgent language with payment solicitation',
      0.85
    ));
  }
  
  // Has account numbers (max 10 points)
  if (financial.has_account_numbers) {
    score += 10;
    reasons.push('ACCOUNT_NUMBERS: Contains bank account or financial identifiers');
    evidence.push(createThreatEvidence(
      'financial_identifiers',
      'Includes account numbers or financial identifiers',
      0.7
    ));
  }
  
  // Cap at 100
  score = Math.min(score, 100);
  
  return { score, reasons, evidence };
}

/**
 * Classify threat into family based on features and scores
 */
function classifyThreatFamily(features, scores, indicators, entities) {
  const { content, infrastructure, behavior, financial } = features;
  
  // Track evidence for each family
  const familyScores = {};
  
  // Phishing classification
  familyScores[THREAT_FAMILIES.PHISHING] = 0;
  if (content.credential_request) familyScores[THREAT_FAMILIES.PHISHING] += 40;
  if (content.brand_impersonation) familyScores[THREAT_FAMILIES.PHISHING] += 30;
  if (behavior.impersonation_detected) familyScores[THREAT_FAMILIES.PHISHING] += 20;
  if (infrastructure.total_urls >= 1) familyScores[THREAT_FAMILIES.PHISHING] += 10;
  
  // Smishing classification (SMS/text-based)
  familyScores[THREAT_FAMILIES.SMISHING] = 0;
  if (infrastructure.phone_count > 0) familyScores[THREAT_FAMILIES.SMISHING] += 30;
  if (content.urgency_keywords_count >= 2) familyScores[THREAT_FAMILIES.SMISHING] += 25;
  if (content.suspicious_cta_count >= 1) familyScores[THREAT_FAMILIES.SMISHING] += 20;
  if (infrastructure.url_shortener_count > 0) familyScores[THREAT_FAMILIES.SMISHING] += 15;
  
  // Malicious URL
  familyScores[THREAT_FAMILIES.MALICIOUS_URL] = 0;
  if (infrastructure.suspicious_tld_count > 0) familyScores[THREAT_FAMILIES.MALICIOUS_URL] += 35;
  if (infrastructure.ip_based_url_count > 0) familyScores[THREAT_FAMILIES.MALICIOUS_URL] += 30;
  if (infrastructure.url_shortener_count > 0) familyScores[THREAT_FAMILIES.MALICIOUS_URL] += 20;
  if (infrastructure.total_urls >= 3) familyScores[THREAT_FAMILIES.MALICIOUS_URL] += 15;
  
  // Social engineering scam
  familyScores[THREAT_FAMILIES.SOCIAL_ENGINEERING_SCAM] = 0;
  if (behavior.has_reward_bait) familyScores[THREAT_FAMILIES.SOCIAL_ENGINEERING_SCAM] += 35;
  if (behavior.has_urgency_tactics && behavior.has_fear_tactics) familyScores[THREAT_FAMILIES.SOCIAL_ENGINEERING_SCAM] += 30;
  if (content.personal_info_request) familyScores[THREAT_FAMILIES.SOCIAL_ENGINEERING_SCAM] += 20;
  if (behavior.multiple_request_types >= 2) familyScores[THREAT_FAMILIES.SOCIAL_ENGINEERING_SCAM] += 15;
  
  // Financial fraud
  familyScores[THREAT_FAMILIES.FINANCIAL_FRAUD] = 0;
  if (financial.has_crypto_request) familyScores[THREAT_FAMILIES.FINANCIAL_FRAUD] += 35;
  if (financial.has_wire_transfer_request) familyScores[THREAT_FAMILIES.FINANCIAL_FRAUD] += 30;
  if (financial.suspicious_payment_flow) familyScores[THREAT_FAMILIES.FINANCIAL_FRAUD] += 20;
  if (content.payment_request) familyScores[THREAT_FAMILIES.FINANCIAL_FRAUD] += 15;
  
  // Impersonation
  familyScores[THREAT_FAMILIES.IMPERSONATION] = 0;
  if (behavior.impersonation_detected) familyScores[THREAT_FAMILIES.IMPERSONATION] += 40;
  if (content.brand_impersonation) familyScores[THREAT_FAMILIES.IMPERSONATION] += 30;
  if (behavior.authority_claim) familyScores[THREAT_FAMILIES.IMPERSONATION] += 20;
  
  // Misinformation
  familyScores[THREAT_FAMILIES.MISINFORMATION] = 0;
  if (behavior.has_high_risk_claims) familyScores[THREAT_FAMILIES.MISINFORMATION] += 40;
  if (behavior.total_claims >= 3) familyScores[THREAT_FAMILIES.MISINFORMATION] += 25;
  
  // Find best match
  let bestFamily = THREAT_FAMILIES.UNKNOWN;
  let bestScore = 0;
  
  for (const [family, score] of Object.entries(familyScores)) {
    if (score > bestScore) {
      bestScore = score;
      bestFamily = family;
    }
  }
  
  // If no strong classification, default to unknown
  if (bestScore < 30) {
    bestFamily = THREAT_FAMILIES.UNKNOWN;
  }
  
  return {
    primary_family: bestFamily,
    confidence: Math.min(bestScore / 100, 1.0),
    family_scores: familyScores
  };
}

/**
 * Compute overall threat score with classification
 */
function computeEnhancedThreatScore(text, indicators, entities, claims) {
  // Build features
  const features = buildThreatFeatures(text, indicators, entities, claims);
  
  // Score each component
  const contentResult = scoreContentRisk(features, text);
  const infraResult = scoreInfrastructureRisk(features);
  const behaviorResult = scoreBehaviorRisk(features);
  const financialResult = scoreFinancialRisk(features);
  
  // Weighted average for overall score
  const weights = {
    content: 0.35,
    infrastructure: 0.25,
    behavior: 0.30,
    financial: 0.10
  };
  
  const overallScore = Math.round(
    contentResult.score * weights.content +
    infraResult.score * weights.infrastructure +
    behaviorResult.score * weights.behavior +
    financialResult.score * weights.financial
  );
  
  // Combine all reasons and evidence
  const allReasons = [
    ...contentResult.reasons,
    ...infraResult.reasons,
    ...behaviorResult.reasons,
    ...financialResult.reasons
  ];
  
  const allEvidence = [
    ...contentResult.evidence,
    ...infraResult.evidence,
    ...behaviorResult.evidence,
    ...financialResult.evidence
  ];
  
  // Calculate confidence based on evidence and feature coverage
  const totalSignals = features.total_risk_signals;
  const confidence = Math.min(0.5 + (totalSignals * 0.05), 1.0);
  
  // Classify threat family
  const classification = classifyThreatFamily(
    features,
    {
      content: contentResult.score,
      infrastructure: infraResult.score,
      behavior: behaviorResult.score,
      financial: financialResult.score
    },
    indicators,
    entities
  );
  
  // Create risk score object
  const riskScore = createThreatRiskScore({
    overall_score: overallScore,
    content_score: contentResult.score,
    infrastructure_score: infraResult.score,
    behavior_score: behaviorResult.score,
    graph_score: 0, // Stub for Phase 6
    financial_score: financialResult.score,
    confidence,
    reasons: allReasons,
    evidence_refs: allEvidence.map(e => e.evidence_id)
  });
  
  return {
    risk_score: riskScore,
    evidence: allEvidence,
    features,
    classification,
    total_risk_signals: totalSignals
  };
}

export {
  THREAT_FAMILIES,
  scoreContentRisk,
  scoreInfrastructureRisk,
  scoreBehaviorRisk,
  scoreFinancialRisk,
  classifyThreatFamily,
  computeEnhancedThreatScore
};
