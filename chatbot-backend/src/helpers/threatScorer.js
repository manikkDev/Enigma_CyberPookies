/**
 * Threat Scoring Engine V1
 * 
 * Hybrid heuristic-based scorer for digital threats.
 * Returns explainable risk scores with evidence.
 */

import { createThreatRiskScore, createThreatEvidence } from '../types/threatSchema.js';

/**
 * Score content-based risk
 */
function scoreContentRisk(text, entities, indicators) {
  let score = 0;
  const reasons = [];
  const evidence = [];
  
  if (!text) return { score: 0, reasons, evidence };
  
  const lowerText = text.toLowerCase();
  
  // Check for urgency keywords
  const urgencyWords = ['urgent', 'immediately', 'asap', 'now', 'today', 'expires'];
  const urgencyCount = urgencyWords.filter(word => lowerText.includes(word)).length;
  if (urgencyCount >= 2) {
    score += 15;
    reasons.push('Multiple urgency keywords detected');
    evidence.push(createThreatEvidence(
      'urgency_language',
      `Found ${urgencyCount} urgency indicators`,
      0.8
    ));
  }
  
  // Check for fear tactics
  const fearWords = ['suspend', 'locked', 'unauthorized', 'fraud', 'security breach', 'compromised'];
  const fearCount = fearWords.filter(word => lowerText.includes(word)).length;
  if (fearCount >= 1) {
    score += 20;
    reasons.push('Fear-based language detected');
    evidence.push(createThreatEvidence(
      'fear_tactics',
      `Found ${fearCount} fear-inducing terms`,
      0.9
    ));
  }
  
  // Check for credential requests
  const credentialWords = ['password', 'username', 'login', 'verify account', 'confirm identity'];
  const credentialCount = credentialWords.filter(word => lowerText.includes(word)).length;
  if (credentialCount >= 1) {
    score += 25;
    reasons.push('Credential solicitation detected');
    evidence.push(createThreatEvidence(
      'credential_request',
      `Requesting sensitive authentication information`,
      0.95
    ));
  }
  
  // Check for payment requests
  const paymentWords = ['payment', 'credit card', 'bank account', 'wire transfer', 'send money'];
  const paymentCount = paymentWords.filter(word => lowerText.includes(word)).length;
  if (paymentCount >= 1) {
    score += 20;
    reasons.push('Payment solicitation detected');
    evidence.push(createThreatEvidence(
      'payment_request',
      `Requesting financial information or payment`,
      0.9
    ));
  }
  
  // Check for impersonation signals
  const impersonationPhrases = ['from your bank', 'your account', 'dear customer', 'dear user'];
  const impersonationCount = impersonationPhrases.filter(phrase => lowerText.includes(phrase)).length;
  if (impersonationCount >= 1) {
    score += 15;
    reasons.push('Brand impersonation signals detected');
    evidence.push(createThreatEvidence(
      'impersonation',
      `Generic impersonation language used`,
      0.7
    ));
  }
  
  // Cap at 100
  score = Math.min(score, 100);
  
  return { score, reasons, evidence };
}

/**
 * Score infrastructure risk (domains, URLs)
 */
function scoreInfrastructureRisk(indicators) {
  let score = 0;
  const reasons = [];
  const evidence = [];
  
  // Check for suspicious domains
  const domains = indicators.filter(ioc => ioc.type === 'domain');
  const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top'];
  
  domains.forEach(domain => {
    const domainValue = domain.value.toLowerCase();
    
    // Check for suspicious TLDs
    if (suspiciousTLDs.some(tld => domainValue.endsWith(tld))) {
      score += 20;
      reasons.push(`Suspicious TLD in domain: ${domainValue}`);
      evidence.push(createThreatEvidence(
        'suspicious_tld',
        `Domain uses high-risk TLD: ${domainValue}`,
        0.8
      ));
    }
    
    // Check for typosquatting patterns (simple check)
    const commonBrands = ['paypal', 'amazon', 'google', 'microsoft', 'apple'];
    commonBrands.forEach(brand => {
      if (domainValue.includes(brand) && !domainValue.endsWith(`${brand}.com`)) {
        score += 25;
        reasons.push(`Potential typosquatting: ${domainValue}`);
        evidence.push(createThreatEvidence(
          'typosquatting',
          `Domain mimics legitimate brand: ${domainValue}`,
          0.9
        ));
      }
    });
  });
  
  // Check for shortened URLs
  const urls = indicators.filter(ioc => ioc.type === 'url');
  const shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl'];
  urls.forEach(url => {
    if (shorteners.some(short => url.value.includes(short))) {
      score += 10;
      reasons.push('URL shortener detected (obscures destination)');
      evidence.push(createThreatEvidence(
        'url_shortener',
        'Uses URL shortening service',
        0.6
      ));
    }
  });
  
  // Check for IP-based URLs
  const ipPattern = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
  urls.forEach(url => {
    if (ipPattern.test(url.value)) {
      score += 15;
      reasons.push('URL uses IP address instead of domain');
      evidence.push(createThreatEvidence(
        'ip_url',
        'Direct IP address in URL (suspicious)',
        0.8
      ));
    }
  });
  
  // Cap at 100
  score = Math.min(score, 100);
  
  return { score, reasons, evidence };
}

/**
 * Score behavioral risk
 */
function scoreBehaviorRisk(entities, indicators) {
  let score = 0;
  const reasons = [];
  const evidence = [];
  
  // Check for urgency tactics
  const urgencyTactics = entities.filter(e => e.entity_type === 'tactic');
  if (urgencyTactics.length >= 2) {
    score += 20;
    reasons.push('Multiple pressure tactics detected');
    evidence.push(createThreatEvidence(
      'pressure_tactics',
      `${urgencyTactics.length} urgency tactics identified`,
      0.8
    ));
  }
  
  // Check for request patterns
  const requests = entities.filter(e => e.entity_type === 'request');
  if (requests.length >= 2) {
    score += 25;
    reasons.push('Multiple suspicious requests');
    evidence.push(createThreatEvidence(
      'multiple_requests',
      `Soliciting ${requests.length} types of information`,
      0.9
    ));
  }
  
  // Check for brand + credential combo (strong phishing signal)
  const hasBrand = entities.some(e => e.entity_type === 'brand');
  const hasCredentialRequest = requests.some(r => 
    r.attributes?.request_type === 'credential'
  );
  if (hasBrand && hasCredentialRequest) {
    score += 30;
    reasons.push('Brand impersonation + credential request (phishing pattern)');
    evidence.push(createThreatEvidence(
      'phishing_pattern',
      'Classic phishing: impersonates brand while requesting credentials',
      0.95
    ));
  }
  
  // Cap at 100
  score = Math.min(score, 100);
  
  return { score, reasons, evidence };
}

/**
 * Compute overall threat risk score
 */
function computeThreatScore(text, indicators, entities) {
  const contentResult = scoreContentRisk(text, entities, indicators);
  const infraResult = scoreInfrastructureRisk(indicators);
  const behaviorResult = scoreBehaviorRisk(entities, indicators);
  
  // Weighted average
  const weights = {
    content: 0.4,
    infrastructure: 0.3,
    behavior: 0.3
  };
  
  const overallScore = Math.round(
    contentResult.score * weights.content +
    infraResult.score * weights.infrastructure +
    behaviorResult.score * weights.behavior
  );
  
  // Combine reasons and evidence
  const allReasons = [
    ...contentResult.reasons,
    ...infraResult.reasons,
    ...behaviorResult.reasons
  ];
  
  const allEvidence = [
    ...contentResult.evidence,
    ...infraResult.evidence,
    ...behaviorResult.evidence
  ];
  
  // Calculate confidence based on evidence count
  const confidence = Math.min(0.5 + (allEvidence.length * 0.1), 1.0);
  
  // Create risk score object
  const riskScore = createThreatRiskScore({
    overall_score: overallScore,
    content_score: contentResult.score,
    infrastructure_score: infraResult.score,
    behavior_score: behaviorResult.score,
    graph_score: 0, // Not computed yet in V1
    financial_score: 0, // Not computed yet in V1
    confidence,
    reasons: allReasons,
    evidence_refs: allEvidence.map(e => e.evidence_id)
  });
  
  return {
    risk_score: riskScore,
    evidence: allEvidence
  };
}

export {
  scoreContentRisk,
  scoreInfrastructureRisk,
  scoreBehaviorRisk,
  computeThreatScore
};
