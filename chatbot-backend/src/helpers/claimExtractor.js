/**
 * Claim Extraction for Misinformation and Harmful Content Analysis
 * 
 * Extracts structured claims from social posts, emails, and text content.
 * Uses heuristic patterns to identify claim types and confidence.
 */

/**
 * Claim types
 */
const CLAIM_TYPES = {
  FINANCIAL_SCAM: 'financial_scam',
  POLITICAL_SOCIAL: 'political_social',
  HEALTH_SAFETY: 'health_safety',
  IMPERSONATION_AUTHORITY: 'impersonation_authority',
  URGENCY_PANIC: 'urgency_panic',
  UNKNOWN: 'unknown'
};

/**
 * Extract claims from text
 */
function extractClaims(text) {
  if (!text) return [];
  
  const claims = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  sentences.forEach((sentence, idx) => {
    const trimmed = sentence.trim();
    if (!trimmed) return;
    
    const claim = analyzeSentenceForClaim(trimmed, idx);
    if (claim) {
      claims.push(claim);
    }
  });
  
  return claims;
}

/**
 * Analyze a sentence to determine if it contains a claim
 */
function analyzeSentenceForClaim(sentence, index) {
  const lowerSentence = sentence.toLowerCase();
  
  // Financial scam claim patterns
  const financialPatterns = [
    { pattern: /win|won|prize|reward|million|thousand.*dollars/, type: CLAIM_TYPES.FINANCIAL_SCAM, confidence: 0.8 },
    { pattern: /send.*money|transfer.*funds|payment.*required/, type: CLAIM_TYPES.FINANCIAL_SCAM, confidence: 0.85 },
    { pattern: /refund|tax.*return|owe.*money/, type: CLAIM_TYPES.FINANCIAL_SCAM, confidence: 0.7 },
    { pattern: /investment.*opportunity|guaranteed.*return/, type: CLAIM_TYPES.FINANCIAL_SCAM, confidence: 0.8 }
  ];
  
  // Impersonation/authority claim patterns
  const impersonationPatterns = [
    { pattern: /your.*account|verify.*identity|confirm.*information/, type: CLAIM_TYPES.IMPERSONATION_AUTHORITY, confidence: 0.85 },
    { pattern: /(from|official).*bank|IRS|government/, type: CLAIM_TYPES.IMPERSONATION_AUTHORITY, confidence: 0.8 },
    { pattern: /unauthorized.*access|suspicious.*activity/, type: CLAIM_TYPES.IMPERSONATION_AUTHORITY, confidence: 0.75 },
    { pattern: /support.*team|customer.*service.*urgent/, type: CLAIM_TYPES.IMPERSONATION_AUTHORITY, confidence: 0.7 }
  ];
  
  // Urgency/panic claim patterns
  const urgencyPatterns = [
    { pattern: /immediately|urgent|within.*hours|expire.*soon/, type: CLAIM_TYPES.URGENCY_PANIC, confidence: 0.85 },
    { pattern: /final.*notice|last.*chance|act.*now/, type: CLAIM_TYPES.URGENCY_PANIC, confidence: 0.8 },
    { pattern: /account.*suspended|account.*locked/, type: CLAIM_TYPES.URGENCY_PANIC, confidence: 0.85 }
  ];
  
  // Health/safety claim patterns
  const healthPatterns = [
    { pattern: /cure|treatment|health.*risk|disease/, type: CLAIM_TYPES.HEALTH_SAFETY, confidence: 0.7 },
    { pattern: /FDA.*approved|scientifically.*proven/, type: CLAIM_TYPES.HEALTH_SAFETY, confidence: 0.75 },
    { pattern: /vaccine|medication.*breakthrough/, type: CLAIM_TYPES.HEALTH_SAFETY, confidence: 0.7 }
  ];
  
  // Political/social claim patterns
  const politicalPatterns = [
    { pattern: /election|vote|ballot|fraud/, type: CLAIM_TYPES.POLITICAL_SOCIAL, confidence: 0.7 },
    { pattern: /government.*cover.*up|conspiracy/, type: CLAIM_TYPES.POLITICAL_SOCIAL, confidence: 0.65 }
  ];
  
  // Check all pattern categories
  const allPatterns = [
    ...financialPatterns,
    ...impersonationPatterns,
    ...urgencyPatterns,
    ...healthPatterns,
    ...politicalPatterns
  ];
  
  for (const { pattern, type, confidence } of allPatterns) {
    if (pattern.test(lowerSentence)) {
      return {
        claim_id: `claim_${Date.now()}_${index}`,
        claim_text: sentence,
        claim_type: type,
        confidence,
        source_ref: {
          sentence_index: index,
          text: sentence
        },
        extraction_method: 'heuristic_pattern',
        matched_pattern: pattern.source
      };
    }
  }
  
  // If sentence has imperative language or strong assertions, mark as unknown claim
  const imperativeWords = ['must', 'need to', 'have to', 'should', 'click', 'call', 'visit'];
  const hasImperative = imperativeWords.some(word => lowerSentence.includes(word));
  
  if (hasImperative && sentence.length > 20) {
    return {
      claim_id: `claim_${Date.now()}_${index}`,
      claim_text: sentence,
      claim_type: CLAIM_TYPES.UNKNOWN,
      confidence: 0.5,
      source_ref: {
        sentence_index: index,
        text: sentence
      },
      extraction_method: 'heuristic_imperative'
    };
  }
  
  return null;
}

/**
 * Classify claim risk level
 */
function classifyClaimRisk(claim) {
  const riskFactors = {
    [CLAIM_TYPES.FINANCIAL_SCAM]: 0.9,
    [CLAIM_TYPES.IMPERSONATION_AUTHORITY]: 0.85,
    [CLAIM_TYPES.URGENCY_PANIC]: 0.75,
    [CLAIM_TYPES.HEALTH_SAFETY]: 0.7,
    [CLAIM_TYPES.POLITICAL_SOCIAL]: 0.6,
    [CLAIM_TYPES.UNKNOWN]: 0.5
  };
  
  const baseRisk = riskFactors[claim.claim_type] || 0.5;
  const adjustedRisk = baseRisk * claim.confidence;
  
  let riskLevel = 'low';
  if (adjustedRisk >= 0.7) riskLevel = 'high';
  else if (adjustedRisk >= 0.5) riskLevel = 'medium';
  
  return {
    ...claim,
    risk_score: Math.round(adjustedRisk * 100),
    risk_level: riskLevel
  };
}

/**
 * Extract and classify all claims with risk assessment
 */
function extractAndClassifyClaims(text) {
  const claims = extractClaims(text);
  return claims.map(claim => classifyClaimRisk(claim));
}

/**
 * Get claim summary statistics
 */
function getClaimSummary(claims) {
  const summary = {
    total_claims: claims.length,
    by_type: {},
    by_risk: { low: 0, medium: 0, high: 0 },
    avg_confidence: 0,
    high_risk_claims: []
  };
  
  claims.forEach(claim => {
    // Count by type
    summary.by_type[claim.claim_type] = (summary.by_type[claim.claim_type] || 0) + 1;
    
    // Count by risk
    summary.by_risk[claim.risk_level] = (summary.by_risk[claim.risk_level] || 0) + 1;
    
    // Track high risk claims
    if (claim.risk_level === 'high') {
      summary.high_risk_claims.push(claim);
    }
  });
  
  // Calculate average confidence
  if (claims.length > 0) {
    summary.avg_confidence = claims.reduce((sum, c) => sum + c.confidence, 0) / claims.length;
  }
  
  return summary;
}

export {
  CLAIM_TYPES,
  extractClaims,
  analyzeSentenceForClaim,
  classifyClaimRisk,
  extractAndClassifyClaims,
  getClaimSummary
};
