/**
 * Digital Threat Pattern Fixtures — T1 through T6
 *
 * Synthetic but realistic examples for each digital threat pattern.
 * Used for graph rendering, correlation tests, and classifier demonstrations.
 * Each fixture matches the ThreatAnalysisResult shape.
 */

const T1_BRAND_IMPERSONATION = {
  analysis_id: 'fixture_T1_001',
  artifact_id: 'art_T1_001',
  pattern_code: 'T1',
  artifact_summary: {
    input_type: 'email_text',
    metadata: {
      source_platform: 'gmail',
      claimed_sender: 'security-team@paypa1-support.tk',
      target_brand: 'PayPal',
      submission_time: '2026-04-10T08:00:00Z',
      suspected_attack_type: 'phishing'
    }
  },
  indicators: [
    { type: 'url', value: 'https://paypa1-support.tk/verify/login', normalized_value: 'https://paypa1-support.tk/verify/login', confidence: 1.0, attributes: { suspicious_tld: true }, extraction_method: 'regex' },
    { type: 'domain', value: 'paypa1-support.tk', normalized_value: 'paypa1-support.tk', confidence: 1.0, attributes: { suspicious_tld: true }, extraction_method: 'regex' },
    { type: 'email', value: 'security-team@paypa1-support.tk', normalized_value: 'security-team@paypa1-support.tk', confidence: 1.0, attributes: {}, extraction_method: 'regex' }
  ],
  entities: [
    { entity_type: 'brand', value: 'PayPal', role: 'impersonation_target', attributes: {} },
    { entity_type: 'sender', value: 'security-team@paypa1-support.tk', role: 'spoofed_sender', attributes: {} },
    { entity_type: 'tactic', value: 'Credential harvesting', role: 'tactic', attributes: {} },
    { entity_type: 'request', value: 'Verify your account immediately', role: 'cta', attributes: {} }
  ],
  claims: [
    { claim_id: 'c1', claim_text: 'Your PayPal account has been suspended due to unusual activity', claim_type: 'impersonation_authority', confidence: 0.9, risk_level: 'high', risk_score: 81 },
    { claim_id: 'c2', claim_text: 'Verify your identity immediately or your account will be permanently closed', claim_type: 'urgency_panic', confidence: 0.88, risk_level: 'high', risk_score: 79 }
  ],
  evidence: [
    { evidence_id: 'ev_T1_1', evidence_type: 'credential_phishing', description: 'Requests PayPal login credentials', confidence: 0.95 },
    { evidence_id: 'ev_T1_2', evidence_type: 'suspicious_tld', description: 'Uses .tk TLD (high-risk free domain)', confidence: 0.9 },
    { evidence_id: 'ev_T1_3', evidence_type: 'brand_mention', description: 'Impersonates PayPal brand', confidence: 0.92 }
  ],
  risk_score: {
    overall_score: 82,
    content_score: 85,
    infrastructure_score: 65,
    behavior_score: 80,
    financial_score: 10,
    confidence: 0.92,
    severity: 'critical',
    reasons: ['CREDENTIAL_REQUEST', 'BRAND_IMPERSONATION', 'SUSPICIOUS_TLD', 'HIGH_URGENCY', 'FEAR_TACTICS'],
    evidence_refs: ['ev_T1_1', 'ev_T1_2', 'ev_T1_3']
  },
  classification: { primary_family: 'phishing', confidence: 0.9, family_scores: { phishing: 90 } },
  features: {
    total_risk_signals: 11,
    content: { credential_request: true, brand_impersonation: true, urgency_keywords_count: 3 },
    infrastructure: { suspicious_tld_count: 1, total_urls: 1 },
    behavior: { impersonation_detected: true, has_fear_tactics: true },
    financial: { has_payment_app_request: false }
  }
};

const T2_MALICIOUS_URL = {
  analysis_id: 'fixture_T2_001',
  artifact_id: 'art_T2_001',
  pattern_code: 'T2',
  artifact_summary: {
    input_type: 'url',
    metadata: {
      source_platform: 'sms',
      claimed_sender: '+1-800-555-0199',
      target_brand: null,
      submission_time: '2026-04-10T09:00:00Z',
      suspected_attack_type: 'malicious_url'
    }
  },
  indicators: [
    { type: 'url', value: 'https://bit.ly/3xAb7Qz', normalized_value: 'https://bit.ly/3xab7qz', confidence: 0.9, attributes: { url_shortener: true }, extraction_method: 'regex' },
    { type: 'url', value: 'http://192.168.1.45/payload/download', normalized_value: 'http://192.168.1.45/payload/download', confidence: 1.0, attributes: { ip_based: true }, extraction_method: 'regex' },
    { type: 'ip', value: '192.168.1.45', normalized_value: '192.168.1.45', confidence: 1.0, attributes: {}, extraction_method: 'regex' },
    { type: 'domain', value: 'bit.ly', normalized_value: 'bit.ly', confidence: 0.9, attributes: { url_shortener: true }, extraction_method: 'regex' },
    { type: 'phone', value: '+1-800-555-0199', normalized_value: '18005550199', confidence: 0.95, attributes: {}, extraction_method: 'regex' }
  ],
  entities: [
    { entity_type: 'tactic', value: 'URL obfuscation via shortener', role: 'tactic', attributes: {} },
    { entity_type: 'tactic', value: 'IP-based payload delivery', role: 'tactic', attributes: {} }
  ],
  claims: [
    { claim_id: 'c1', claim_text: 'Click now to claim your delivery package', claim_type: 'urgency_panic', confidence: 0.78, risk_level: 'high', risk_score: 70 }
  ],
  evidence: [
    { evidence_id: 'ev_T2_1', evidence_type: 'url_obfuscation', description: 'Uses bit.ly to hide destination', confidence: 0.9 },
    { evidence_id: 'ev_T2_2', evidence_type: 'ip_based_url', description: 'Raw IP address used as delivery endpoint', confidence: 0.95 }
  ],
  risk_score: {
    overall_score: 72,
    content_score: 40,
    infrastructure_score: 85,
    behavior_score: 60,
    financial_score: 0,
    confidence: 0.88,
    severity: 'critical',
    reasons: ['URL_SHORTENER', 'IP_URL', 'MULTIPLE_URLS'],
    evidence_refs: ['ev_T2_1', 'ev_T2_2']
  },
  classification: { primary_family: 'malicious_url', confidence: 0.88, family_scores: { malicious_url: 88 } },
  features: {
    total_risk_signals: 8,
    content: { urgency_keywords_count: 1 },
    infrastructure: { url_shortener_count: 1, ip_based_url_count: 1, total_urls: 2 },
    behavior: { has_urgency_tactics: true },
    financial: {}
  }
};

const T3_MALWARE_ATTACHMENT = {
  analysis_id: 'fixture_T3_001',
  artifact_id: 'art_T3_001',
  pattern_code: 'T3',
  artifact_summary: {
    input_type: 'attachment',
    metadata: {
      source_platform: 'outlook',
      claimed_sender: 'invoices@acme-corp.net',
      target_brand: 'DHL',
      submission_time: '2026-04-10T10:00:00Z',
      suspected_attack_type: 'malware'
    }
  },
  indicators: [
    { type: 'email', value: 'invoices@acme-corp.net', normalized_value: 'invoices@acme-corp.net', confidence: 1.0, attributes: {}, extraction_method: 'regex' },
    { type: 'hash', value: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', normalized_value: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', confidence: 1.0, attributes: { algorithm: 'sha256', filename: 'Invoice_2026.xlsm' }, extraction_method: 'manual' },
    { type: 'domain', value: 'acme-corp.net', normalized_value: 'acme-corp.net', confidence: 0.9, attributes: {}, extraction_method: 'regex' },
    { type: 'url', value: 'https://cdn.acme-corp.net/macro-update/run.exe', normalized_value: 'https://cdn.acme-corp.net/macro-update/run.exe', confidence: 0.95, attributes: {}, extraction_method: 'regex' }
  ],
  entities: [
    { entity_type: 'brand', value: 'DHL', role: 'impersonation_target', attributes: {} },
    { entity_type: 'sender', value: 'invoices@acme-corp.net', role: 'spoofed_sender', attributes: {} },
    { entity_type: 'tactic', value: 'Macro-enabled Excel attachment', role: 'tactic', attributes: {} }
  ],
  claims: [
    { claim_id: 'c1', claim_text: 'Please open the attached invoice to complete your DHL shipment clearance', claim_type: 'impersonation_authority', confidence: 0.82, risk_level: 'high', risk_score: 74 }
  ],
  evidence: [
    { evidence_id: 'ev_T3_1', evidence_type: 'malicious_attachment', description: 'SHA256 hash matches known malware family', confidence: 0.97 },
    { evidence_id: 'ev_T3_2', evidence_type: 'brand_mention', description: 'Impersonates DHL delivery service', confidence: 0.88 },
    { evidence_id: 'ev_T3_3', evidence_type: 'macro_delivery', description: 'Excel macro file with remote payload URL', confidence: 0.95 }
  ],
  risk_score: {
    overall_score: 88,
    content_score: 75,
    infrastructure_score: 60,
    behavior_score: 85,
    financial_score: 0,
    confidence: 0.95,
    severity: 'critical',
    reasons: ['FILE_HASH_MALWARE', 'BRAND_IMPERSONATION', 'MACRO_PAYLOAD'],
    evidence_refs: ['ev_T3_1', 'ev_T3_2', 'ev_T3_3']
  },
  classification: { primary_family: 'malicious_attachment', confidence: 0.95, family_scores: { malicious_attachment: 95 } },
  features: {
    total_risk_signals: 10,
    content: { brand_impersonation: true, suspicious_cta_count: 1 },
    infrastructure: { total_urls: 1 },
    behavior: { impersonation_detected: true },
    financial: {}
  }
};

const T4_SOCIAL_ENGINEERING = {
  analysis_id: 'fixture_T4_001',
  artifact_id: 'art_T4_001',
  pattern_code: 'T4',
  artifact_summary: {
    input_type: 'sms_text',
    metadata: {
      source_platform: 'whatsapp',
      claimed_sender: '+44-7700-900123',
      target_brand: null,
      submission_time: '2026-04-10T11:00:00Z',
      suspected_attack_type: 'scam'
    }
  },
  indicators: [
    { type: 'phone', value: '+44-7700-900123', normalized_value: '447700900123', confidence: 1.0, attributes: {}, extraction_method: 'regex' },
    { type: 'wallet', value: '1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P', normalized_value: '1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p', confidence: 0.88, attributes: { currency: 'BTC' }, extraction_method: 'regex' },
    { type: 'url', value: 'https://prize-claim.xyz/redeem', normalized_value: 'https://prize-claim.xyz/redeem', confidence: 1.0, attributes: { suspicious_tld: false }, extraction_method: 'regex' }
  ],
  entities: [
    { entity_type: 'tactic', value: 'Advance fee / prize bait', role: 'tactic', attributes: {} },
    { entity_type: 'request', value: 'Send £200 BTC to claim your £50,000 prize', role: 'payment_request', attributes: {} }
  ],
  claims: [
    { claim_id: 'c1', claim_text: 'You have won £50,000 in the WhatsApp lottery', claim_type: 'financial_scam', confidence: 0.93, risk_level: 'high', risk_score: 84 },
    { claim_id: 'c2', claim_text: 'Send £200 BTC now to release your winnings', claim_type: 'financial_scam', confidence: 0.91, risk_level: 'high', risk_score: 82 }
  ],
  evidence: [
    { evidence_id: 'ev_T4_1', evidence_type: 'crypto_fraud', description: 'Requests Bitcoin payment via wallet address', confidence: 0.95 },
    { evidence_id: 'ev_T4_2', evidence_type: 'reward_scam', description: 'Promises large prize reward (advance fee fraud)', confidence: 0.93 }
  ],
  risk_score: {
    overall_score: 79,
    content_score: 60,
    infrastructure_score: 45,
    behavior_score: 75,
    financial_score: 85,
    confidence: 0.91,
    severity: 'critical',
    reasons: ['CRYPTO_REQUEST', 'REWARD_BAIT', 'HIGH_RISK_CLAIMS', 'PAYMENT_REQUEST'],
    evidence_refs: ['ev_T4_1', 'ev_T4_2']
  },
  classification: { primary_family: 'social_engineering_scam', confidence: 0.91, family_scores: { social_engineering_scam: 91, financial_fraud: 75 } },
  features: {
    total_risk_signals: 9,
    content: { payment_request: true, urgency_keywords_count: 2 },
    infrastructure: { crypto_wallet_count: 1, phone_count: 1 },
    behavior: { has_reward_bait: true, has_high_risk_claims: true },
    financial: { has_crypto_request: true }
  }
};

const T5_MISINFORMATION = {
  analysis_id: 'fixture_T5_001',
  artifact_id: 'art_T5_001',
  pattern_code: 'T5',
  artifact_summary: {
    input_type: 'social_post',
    metadata: {
      source_platform: 'twitter',
      claimed_sender: '@BreakingAlerts2026',
      target_brand: null,
      submission_time: '2026-04-10T12:00:00Z',
      suspected_attack_type: 'misinformation'
    }
  },
  indicators: [
    { type: 'url', value: 'https://truenewstoday.xyz/election-fraud-proof', normalized_value: 'https://truenewstoday.xyz/election-fraud-proof', confidence: 0.95, attributes: { suspicious_tld: false }, extraction_method: 'regex' },
    { type: 'domain', value: 'truenewstoday.xyz', normalized_value: 'truenewstoday.xyz', confidence: 0.9, attributes: { suspicious_tld: true }, extraction_method: 'regex' },
    { type: 'username', value: '@BreakingAlerts2026', normalized_value: '@breakingalerts2026', confidence: 0.9, attributes: { platform: 'twitter' }, extraction_method: 'regex' }
  ],
  entities: [
    { entity_type: 'sender', value: '@BreakingAlerts2026', role: 'inauthentic_account', attributes: { platform: 'twitter' } },
    { entity_type: 'platform', value: 'Twitter', role: 'distribution_channel', attributes: {} },
    { entity_type: 'tactic', value: 'False narrative injection', role: 'tactic', attributes: {} }
  ],
  claims: [
    { claim_id: 'c1', claim_text: 'BREAKING: Millions of ballots were destroyed before being counted', claim_type: 'political_social', confidence: 0.72, risk_level: 'medium', risk_score: 65 },
    { claim_id: 'c2', claim_text: 'Government is covering up election fraud evidence', claim_type: 'political_social', confidence: 0.69, risk_level: 'medium', risk_score: 62 }
  ],
  evidence: [
    { evidence_id: 'ev_T5_1', evidence_type: 'dangerous_claims', description: 'Political misinformation claims detected', confidence: 0.75 },
    { evidence_id: 'ev_T5_2', evidence_type: 'suspicious_tld', description: 'Domain uses .xyz TLD common in misinformation sites', confidence: 0.7 }
  ],
  risk_score: {
    overall_score: 55,
    content_score: 45,
    infrastructure_score: 35,
    behavior_score: 60,
    financial_score: 0,
    confidence: 0.72,
    severity: 'high',
    reasons: ['HIGH_RISK_CLAIMS', 'SUSPICIOUS_TLD', 'MULTIPLE_CLAIMS'],
    evidence_refs: ['ev_T5_1', 'ev_T5_2']
  },
  classification: { primary_family: 'misinformation', confidence: 0.72, family_scores: { misinformation: 72 } },
  features: {
    total_risk_signals: 6,
    content: { urgency_keywords_count: 1, excessive_caps: true },
    infrastructure: { suspicious_tld_count: 1, total_urls: 1 },
    behavior: { has_high_risk_claims: true, total_claims: 2 },
    financial: {}
  }
};

const T6_ACCOUNT_TAKEOVER = {
  analysis_id: 'fixture_T6_001',
  artifact_id: 'art_T6_001',
  pattern_code: 'T6',
  artifact_summary: {
    input_type: 'sms_text',
    metadata: {
      source_platform: 'sms',
      claimed_sender: 'HSBC-ALERT',
      target_brand: 'HSBC',
      submission_time: '2026-04-10T13:00:00Z',
      suspected_attack_type: 'account_takeover'
    }
  },
  indicators: [
    { type: 'url', value: 'https://hsbc-secure-login.ml/otp-verify', normalized_value: 'https://hsbc-secure-login.ml/otp-verify', confidence: 1.0, attributes: { suspicious_tld: true }, extraction_method: 'regex' },
    { type: 'domain', value: 'hsbc-secure-login.ml', normalized_value: 'hsbc-secure-login.ml', confidence: 1.0, attributes: { suspicious_tld: true }, extraction_method: 'regex' },
    { type: 'phone', value: 'HSBC-ALERT', normalized_value: 'HSBCALERT', confidence: 0.8, attributes: { alphanumeric: true }, extraction_method: 'regex' }
  ],
  entities: [
    { entity_type: 'brand', value: 'HSBC', role: 'impersonation_target', attributes: {} },
    { entity_type: 'sender', value: 'HSBC-ALERT', role: 'spoofed_sender', attributes: { alphanumeric: true } },
    { entity_type: 'tactic', value: 'OTP interception via fake portal', role: 'tactic', attributes: {} },
    { entity_type: 'request', value: 'Enter your OTP to prevent account suspension', role: 'credential_request', attributes: {} }
  ],
  claims: [
    { claim_id: 'c1', claim_text: 'Your HSBC account has been flagged for suspicious login', claim_type: 'impersonation_authority', confidence: 0.91, risk_level: 'high', risk_score: 82 },
    { claim_id: 'c2', claim_text: 'Enter your OTP immediately to prevent account closure', claim_type: 'urgency_panic', confidence: 0.89, risk_level: 'high', risk_score: 80 }
  ],
  evidence: [
    { evidence_id: 'ev_T6_1', evidence_type: 'credential_phishing', description: 'Requests OTP / authentication code', confidence: 0.97 },
    { evidence_id: 'ev_T6_2', evidence_type: 'suspicious_tld', description: 'Domain uses .ml TLD (high-risk)', confidence: 0.92 },
    { evidence_id: 'ev_T6_3', evidence_type: 'entity_impersonation', description: 'Impersonates HSBC bank brand', confidence: 0.93 }
  ],
  risk_score: {
    overall_score: 85,
    content_score: 88,
    infrastructure_score: 70,
    behavior_score: 88,
    financial_score: 15,
    confidence: 0.94,
    severity: 'critical',
    reasons: ['CREDENTIAL_REQUEST', 'BRAND_IMPERSONATION', 'SUSPICIOUS_TLD', 'HIGH_URGENCY', 'PRESSURE_COMBO', 'IMPERSONATION'],
    evidence_refs: ['ev_T6_1', 'ev_T6_2', 'ev_T6_3']
  },
  classification: { primary_family: 'impersonation', confidence: 0.94, family_scores: { impersonation: 94, phishing: 85 } },
  features: {
    total_risk_signals: 12,
    content: { credential_request: true, brand_impersonation: true, urgency_keywords_count: 3, fear_keywords_count: 2 },
    infrastructure: { suspicious_tld_count: 1, total_urls: 1 },
    behavior: { impersonation_detected: true, has_urgency_tactics: true, has_fear_tactics: true },
    financial: {}
  }
};

const ALL_FIXTURES = [
  T1_BRAND_IMPERSONATION,
  T2_MALICIOUS_URL,
  T3_MALWARE_ATTACHMENT,
  T4_SOCIAL_ENGINEERING,
  T5_MISINFORMATION,
  T6_ACCOUNT_TAKEOVER
];

const FIXTURE_BY_CODE = ALL_FIXTURES.reduce((acc, f) => {
  acc[f.pattern_code] = f;
  return acc;
}, {});

export {
  T1_BRAND_IMPERSONATION,
  T2_MALICIOUS_URL,
  T3_MALWARE_ATTACHMENT,
  T4_SOCIAL_ENGINEERING,
  T5_MISINFORMATION,
  T6_ACCOUNT_TAKEOVER,
  ALL_FIXTURES,
  FIXTURE_BY_CODE
};
