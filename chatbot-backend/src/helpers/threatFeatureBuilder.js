/**
 * Threat Feature Builder
 * 
 * Transforms extracted indicators, entities, and claims into structured features
 * for threat scoring and classification.
 */

/**
 * Build content features from text analysis
 */
function buildContentFeatures(text, entities, claims) {
  const features = {
    // Urgency indicators
    urgency_keywords_count: 0,
    urgency_score: 0,
    
    // Pressure tactics
    pressure_tactics_count: 0,
    fear_keywords_count: 0,
    
    // Credential/payment requests
    credential_request: false,
    payment_request: false,
    personal_info_request: false,
    
    // Impersonation
    brand_impersonation: false,
    authority_impersonation: false,
    
    // Call-to-action
    suspicious_cta_count: 0,
    
    // Obfuscation
    url_obfuscation: false,
    
    // Text quality
    has_typos: false,
    excessive_caps: false,
    excessive_punctuation: false
  };
  
  if (!text) return features;
  
  const lowerText = text.toLowerCase();
  
  // Check urgency
  const urgencyWords = ['urgent', 'immediately', 'asap', 'now', 'today', 'expires', 'expiring', 'deadline'];
  features.urgency_keywords_count = urgencyWords.filter(w => lowerText.includes(w)).length;
  features.urgency_score = Math.min(features.urgency_keywords_count * 20, 100);
  
  // Check fear/pressure
  const fearWords = ['suspend', 'locked', 'unauthorized', 'fraud', 'breach', 'compromised', 'terminated'];
  features.fear_keywords_count = fearWords.filter(w => lowerText.includes(w)).length;
  features.pressure_tactics_count = features.urgency_keywords_count + features.fear_keywords_count;
  
  // Check for requests
  features.credential_request = /password|username|login|pin|otp|verification code/.test(lowerText);
  features.payment_request = /payment|credit card|bank account|wire transfer|send money|paypal|venmo/.test(lowerText);
  features.personal_info_request = /social security|ssn|date of birth|driver.*license|passport/.test(lowerText);
  
  // Check for impersonation
  const brands = ['paypal', 'amazon', 'netflix', 'apple', 'microsoft', 'google', 'facebook', 'bank'];
  features.brand_impersonation = brands.some(b => lowerText.includes(b));
  features.authority_impersonation = /government|irs|police|fbi|official|support team/.test(lowerText);
  
  // Check CTAs
  const ctaPatterns = ['click here', 'click now', 'verify now', 'update now', 'confirm here', 'act now'];
  features.suspicious_cta_count = ctaPatterns.filter(cta => lowerText.includes(cta)).length;
  
  // Check text quality
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  features.excessive_caps = capsRatio > 0.3;
  features.excessive_punctuation = /[!?]{2,}/.test(text);
  
  return features;
}

/**
 * Build infrastructure features from indicators
 */
function buildInfrastructureFeatures(indicators) {
  const features = {
    // URL/Domain features
    suspicious_tld_count: 0,
    url_shortener_count: 0,
    ip_based_url_count: 0,
    total_urls: 0,
    total_domains: 0,
    unique_domains: 0,
    
    // Depth and complexity
    avg_url_depth: 0,
    has_multiple_redirects: false,
    
    // Mismatches
    domain_brand_mismatch: false,
    
    // Other IOCs
    email_count: 0,
    phone_count: 0,
    crypto_wallet_count: 0
  };
  
  if (!indicators || indicators.length === 0) return features;
  
  const urls = indicators.filter(i => i.type === 'url');
  const domains = indicators.filter(i => i.type === 'domain');
  const emails = indicators.filter(i => i.type === 'email');
  const phones = indicators.filter(i => i.type === 'phone');
  const wallets = indicators.filter(i => i.type === 'wallet');
  
  features.total_urls = urls.length;
  features.total_domains = domains.length;
  features.email_count = emails.length;
  features.phone_count = phones.length;
  features.crypto_wallet_count = wallets.length;
  
  // Count unique domains
  const uniqueDomainSet = new Set(domains.map(d => d.normalized_value || d.value));
  features.unique_domains = uniqueDomainSet.size;
  
  // Check for suspicious TLDs
  domains.forEach(domain => {
    if (domain.attributes?.suspicious_tld) {
      features.suspicious_tld_count++;
    }
  });
  
  // Check for URL shorteners and IP-based URLs
  urls.forEach(url => {
    if (url.attributes?.url_shortener) {
      features.url_shortener_count++;
      features.has_multiple_redirects = true;
    }
    if (url.attributes?.ip_based) {
      features.ip_based_url_count++;
    }
    
    // Calculate URL depth
    try {
      const urlObj = new URL(url.value);
      const pathDepth = urlObj.pathname.split('/').filter(p => p).length;
      features.avg_url_depth = (features.avg_url_depth + pathDepth) / 2;
    } catch (e) {
      // Invalid URL
    }
  });
  
  return features;
}

/**
 * Build behavioral features from entities and patterns
 */
function buildBehavioralFeatures(entities, claims, contentFeatures) {
  const features = {
    // Pressure/manipulation
    has_urgency_tactics: false,
    has_fear_tactics: false,
    has_reward_bait: false,
    
    // Deception patterns
    impersonation_detected: false,
    authority_claim: false,
    
    // Request patterns
    multiple_request_types: 0,
    high_risk_request: false,
    
    // Communication style
    unsolicited_contact: false,
    unusual_sender: false,
    
    // Claims
    has_high_risk_claims: false,
    total_claims: 0
  };
  
  // Analyze urgency and fear from content features
  features.has_urgency_tactics = contentFeatures.urgency_keywords_count >= 2;
  features.has_fear_tactics = contentFeatures.fear_keywords_count >= 1;
  features.impersonation_detected = contentFeatures.brand_impersonation || contentFeatures.authority_impersonation;
  features.authority_claim = contentFeatures.authority_impersonation;
  
  // Count request types
  let requestCount = 0;
  if (contentFeatures.credential_request) requestCount++;
  if (contentFeatures.payment_request) requestCount++;
  if (contentFeatures.personal_info_request) requestCount++;
  features.multiple_request_types = requestCount;
  features.high_risk_request = requestCount >= 2;
  
  // Analyze claims
  if (claims && claims.length > 0) {
    features.total_claims = claims.length;
    features.has_high_risk_claims = claims.some(c => c.risk_level === 'high');
    features.has_reward_bait = claims.some(c => 
      c.claim_type === 'financial_scam' && /win|prize|reward/.test(c.claim_text.toLowerCase())
    );
  }
  
  // Analyze entities for unusual patterns
  if (entities) {
    const tactics = entities.filter(e => e.entity_type === 'tactic');
    const requests = entities.filter(e => e.entity_type === 'request');
    
    features.has_urgency_tactics = features.has_urgency_tactics || tactics.length >= 2;
    features.multiple_request_types = Math.max(features.multiple_request_types, requests.length);
  }
  
  return features;
}

/**
 * Build financial features from content and indicators
 */
function buildFinancialFeatures(text, indicators, entities) {
  const features = {
    // Payment methods
    has_bank_transfer_request: false,
    has_crypto_request: false,
    has_wire_transfer_request: false,
    has_payment_app_request: false,
    
    // AML-like indicators
    has_monetary_amount: false,
    has_account_numbers: false,
    suspicious_payment_flow: false,
    
    // Financial entities
    crypto_wallet_count: 0,
    bank_account_count: 0
  };
  
  if (!text) return features;
  
  const lowerText = text.toLowerCase();
  
  // Check payment methods
  features.has_bank_transfer_request = /bank transfer|wire transfer|ach|routing number/.test(lowerText);
  features.has_crypto_request = /bitcoin|ethereum|crypto|wallet address/.test(lowerText);
  features.has_wire_transfer_request = /wire.*money|western union|moneygram/.test(lowerText);
  features.has_payment_app_request = /paypal|venmo|cashapp|zelle/.test(lowerText);
  
  // Check for monetary amounts
  features.has_monetary_amount = /\$\d+|USD|EUR|₹/.test(text) || /\d+.*dollars|amount.*\d+/.test(lowerText);
  
  // Check indicators
  if (indicators) {
    const wallets = indicators.filter(i => i.type === 'wallet');
    const accounts = indicators.filter(i => i.type === 'bank_account');
    
    features.crypto_wallet_count = wallets.length;
    features.bank_account_count = accounts.length;
    features.has_account_numbers = accounts.length > 0;
  }
  
  // Suspicious payment flow detection
  const hasUrgentPayment = features.has_bank_transfer_request || features.has_wire_transfer_request;
  const hasMoneyMention = features.has_monetary_amount;
  features.suspicious_payment_flow = hasUrgentPayment && hasMoneyMention;
  
  return features;
}

/**
 * Build comprehensive feature set from all analysis components
 */
function buildThreatFeatures(text, indicators, entities, claims) {
  const contentFeatures = buildContentFeatures(text, entities, claims);
  const infraFeatures = buildInfrastructureFeatures(indicators);
  const behaviorFeatures = buildBehavioralFeatures(entities, claims, contentFeatures);
  const financialFeatures = buildFinancialFeatures(text, indicators, entities);
  
  return {
    content: contentFeatures,
    infrastructure: infraFeatures,
    behavior: behaviorFeatures,
    financial: financialFeatures,
    
    // Summary metrics
    total_risk_signals: calculateTotalRiskSignals(contentFeatures, infraFeatures, behaviorFeatures, financialFeatures)
  };
}

/**
 * Calculate total risk signals across all feature categories
 */
function calculateTotalRiskSignals(content, infra, behavior, financial) {
  let signals = 0;
  
  // Content signals
  if (content.urgency_keywords_count >= 2) signals++;
  if (content.fear_keywords_count >= 1) signals++;
  if (content.credential_request) signals++;
  if (content.payment_request) signals++;
  if (content.brand_impersonation) signals++;
  if (content.suspicious_cta_count >= 2) signals++;
  
  // Infrastructure signals
  if (infra.suspicious_tld_count > 0) signals++;
  if (infra.url_shortener_count > 0) signals++;
  if (infra.ip_based_url_count > 0) signals++;
  
  // Behavioral signals
  if (behavior.has_urgency_tactics) signals++;
  if (behavior.has_fear_tactics) signals++;
  if (behavior.high_risk_request) signals++;
  if (behavior.has_high_risk_claims) signals++;
  
  // Financial signals
  if (financial.has_crypto_request) signals++;
  if (financial.suspicious_payment_flow) signals++;
  
  return signals;
}

export {
  buildContentFeatures,
  buildInfrastructureFeatures,
  buildBehavioralFeatures,
  buildFinancialFeatures,
  buildThreatFeatures,
  calculateTotalRiskSignals
};
