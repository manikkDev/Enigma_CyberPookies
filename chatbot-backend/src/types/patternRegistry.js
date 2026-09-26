/**
 * Unified Pattern Registry
 * 
 * Defines all pattern families: AML (P1-P6) and Digital Threat (T1-T6).
 * Each pattern has a consistent metadata shape usable by classifiers,
 * graph renderers, and frontend displays.
 */

// ─── Pattern Family Constants ────────────────────────────────────
const PATTERN_FAMILY = {
  AML: 'aml',
  DIGITAL_THREAT: 'digital_threat'
};

// ─── Severity levels ─────────────────────────────────────────────
const SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// ─── Node types used in threat graphs ────────────────────────────
const GRAPH_NODE_TYPES = {
  // Digital threat nodes
  ARTIFACT: 'artifact',
  SENDER: 'sender',
  RECIPIENT: 'recipient',
  CLAIMED_BRAND: 'claimed_brand',
  ORGANIZATION: 'organization',
  URL: 'url',
  DOMAIN: 'domain',
  ATTACHMENT: 'attachment',
  FILE_HASH: 'file_hash',
  PHONE: 'phone',
  EMAIL: 'email',
  WALLET: 'wallet',
  SOCIAL_ACCOUNT: 'social_account',
  PLATFORM: 'platform',
  CAMPAIGN: 'campaign',
  EVIDENCE: 'evidence',
  CLAIM: 'claim',
  IP: 'ip',
  // AML nodes (preserved)
  PERSON: 'person',
  COMPANY: 'company',
  BANK_ACCOUNT: 'bank_account',
  TRANSACTION: 'transaction',
  SHELL: 'shell',
  BORROWER: 'borrower'
};

// ─── Edge/relationship types ──────────────────────────────────────
const GRAPH_EDGE_TYPES = {
  // Digital threat relationships
  SENT: 'SENT',
  TARGETS: 'TARGETS',
  IMPERSONATES: 'IMPERSONATES',
  LINKS_TO: 'LINKS_TO',
  HOSTED_ON: 'HOSTED_ON',
  ATTACHED: 'ATTACHED',
  RELATED_TO: 'RELATED_TO',
  PART_OF_CAMPAIGN: 'PART_OF_CAMPAIGN',
  EXTRACTED_FROM: 'EXTRACTED_FROM',
  MENTIONS: 'MENTIONS',
  USES: 'USES',
  TRANSFERS_TO: 'TRANSFERS_TO',
  CONTAINS: 'CONTAINS',
  REDIRECTS_TO: 'REDIRECTS_TO',
  CLAIMS_TO_BE: 'CLAIMS_TO_BE',
  // AML relationships (preserved)
  TRANSACTS_WITH: 'TRANSACTS_WITH',
  CONTROLS: 'CONTROLS',
  BENEFICIARY_OF: 'BENEFICIARY_OF',
  LAYERED_THROUGH: 'LAYERED_THROUGH'
};

// ─── AML Pattern Definitions (P1–P6) ──────────────────────────────
const AML_PATTERNS = [
  {
    code: 'P1',
    label: 'P1 — Round Trip',
    name: 'Round Trip',
    family: PATTERN_FAMILY.AML,
    description: 'Money leaves origin jurisdiction and returns as apparently legitimate investment via offshore shells and treaty corridors.',
    severity: SEVERITY.HIGH,
    entities: ['person', 'company', 'shell', 'bank_account'],
    relationships: ['TRANSACTS_WITH', 'CONTROLS', 'LAYERED_THROUGH', 'BENEFICIARY_OF'],
    key_features: ['circular transfers', 'short settlement window', 'same-origin beneficiary', 'round-amount loops', 'reused counterparties'],
    graph_schema_hint: {
      central_node: 'person',
      flow_direction: 'circular',
      key_edge: 'LAYERED_THROUGH'
    },
    classifier_keywords: ['round trip', 'roundtrip', 'circular', 'loop', 'layering']
  },
  {
    code: 'P2',
    label: 'P2 — Loan Evergreening',
    name: 'Loan Evergreening',
    family: PATTERN_FAMILY.AML,
    description: 'New loans repay old loans to hide default risk, often routed through related shell companies.',
    severity: SEVERITY.HIGH,
    entities: ['borrower', 'shell', 'bank_account', 'company'],
    relationships: ['TRANSACTS_WITH', 'CONTROLS', 'BENEFICIARY_OF'],
    key_features: ['rollover payments', 'new loan repays old', 'payment just-before due date', 'interlinked lenders', 'repeated refinancing'],
    graph_schema_hint: {
      central_node: 'borrower',
      flow_direction: 'cyclic',
      key_edge: 'TRANSACTS_WITH'
    },
    classifier_keywords: ['loan', 'repay', 'repayment', 'evergreen']
  },
  {
    code: 'P3',
    label: 'P3 — Invoice Fraud (Trade-Based ML)',
    name: 'Invoice Fraud / TBML',
    family: PATTERN_FAMILY.AML,
    description: 'Over/under-invoicing imports or exports to move value across borders using trade transactions.',
    severity: SEVERITY.HIGH,
    entities: ['company', 'shell', 'bank_account'],
    relationships: ['TRANSACTS_WITH', 'CONTROLS'],
    key_features: ['over/under-invoicing', 'invoice–shipment mismatch', 'cross-border pricing gaps', 'unusual unit values', 'related-party trade'],
    graph_schema_hint: {
      central_node: 'company',
      flow_direction: 'cross_border',
      key_edge: 'TRANSACTS_WITH'
    },
    classifier_keywords: ['invoice', 'trade', 'shipment', 'declared_value']
  },
  {
    code: 'P4',
    label: 'P4 — Hawala Banking',
    name: 'Hawala Banking',
    family: PATTERN_FAMILY.AML,
    description: 'Informal cash settlement paired with formal remittance legs, often below reporting thresholds.',
    severity: SEVERITY.MEDIUM,
    entities: ['person', 'bank_account'],
    relationships: ['TRANSACTS_WITH', 'BENEFICIARY_OF'],
    key_features: ['cash-in cash-out loops', 'informal remittance chain', 'small repeated transfers', 'mirror settlements', 'high-velocity relays'],
    graph_schema_hint: {
      central_node: 'person',
      flow_direction: 'parallel',
      key_edge: 'TRANSACTS_WITH'
    },
    classifier_keywords: ['hawala', 'cash', 'wire', 'remittance']
  },
  {
    code: 'P5',
    label: 'P5 — Benami',
    name: 'Benami',
    family: PATTERN_FAMILY.AML,
    description: 'Assets held by proxies or nominees on behalf of the real beneficial owner to obscure ownership.',
    severity: SEVERITY.HIGH,
    entities: ['person', 'company', 'shell'],
    relationships: ['CONTROLS', 'BENEFICIARY_OF', 'LAYERED_THROUGH'],
    key_features: ['proxy ownership', 'beneficial owner mismatch', 'asset held by associate', 'opaque nominee entity', 'sudden title transfers'],
    graph_schema_hint: {
      central_node: 'person',
      flow_direction: 'proxy',
      key_edge: 'CONTROLS'
    },
    classifier_keywords: ['benami', 'nominee', 'property', 'proxy']
  },
  {
    code: 'P6',
    label: 'P6 — PEP Kickback',
    name: 'PEP Kickback',
    family: PATTERN_FAMILY.AML,
    description: 'Government-linked payments routed through shell intermediaries to benefit politically exposed persons.',
    severity: SEVERITY.CRITICAL,
    entities: ['person', 'company', 'shell', 'bank_account'],
    relationships: ['TRANSACTS_WITH', 'CONTROLS', 'LAYERED_THROUGH', 'BENEFICIARY_OF'],
    key_features: ['contractor pass-through', 'PEP proximity', 'shell intermediary', 'government-linked payments', 'circular benefit flows'],
    graph_schema_hint: {
      central_node: 'person',
      flow_direction: 'hub_spoke',
      key_edge: 'LAYERED_THROUGH'
    },
    classifier_keywords: ['pep', 'contract', 'government', 'kickback']
  }
];

// ─── Digital Threat Pattern Definitions (T1–T6) ───────────────────
const DIGITAL_THREAT_PATTERNS = [
  {
    code: 'T1',
    label: 'T1 — Brand Impersonation Phishing',
    name: 'Brand Impersonation Phishing Campaign',
    family: PATTERN_FAMILY.DIGITAL_THREAT,
    description: 'Coordinated campaign impersonating trusted brands via email or web to harvest credentials or payments.',
    severity: SEVERITY.HIGH,
    entities: ['claimed_brand', 'sender', 'recipient', 'domain', 'url', 'email'],
    relationships: ['IMPERSONATES', 'TARGETS', 'SENT', 'LINKS_TO', 'CLAIMS_TO_BE'],
    key_features: [
      'brand_impersonation', 'credential_request', 'suspicious_tld',
      'urgency_language', 'fake_login_page', 'lookalike_domain'
    ],
    graph_schema_hint: {
      central_node: 'claimed_brand',
      flow_direction: 'hub_spoke',
      key_edge: 'IMPERSONATES'
    },
    classifier_keywords: ['phishing', 'impersonat', 'credential', 'login', 'password', 'verify account'],
    threat_family_match: 'phishing'
  },
  {
    code: 'T2',
    label: 'T2 — Malicious URL / Redirect Infrastructure',
    name: 'Malicious URL Redirect / Cloaking Infrastructure',
    family: PATTERN_FAMILY.DIGITAL_THREAT,
    description: 'Network of redirecting or cloaking URLs that obscure malicious destinations through multiple hops.',
    severity: SEVERITY.HIGH,
    entities: ['url', 'domain', 'ip', 'platform', 'sender'],
    relationships: ['REDIRECTS_TO', 'HOSTED_ON', 'LINKS_TO', 'USES', 'EXTRACTED_FROM'],
    key_features: [
      'url_shortener', 'ip_based_url', 'suspicious_tld', 'redirect_chain',
      'cloaking', 'multiple_hops'
    ],
    graph_schema_hint: {
      central_node: 'url',
      flow_direction: 'chain',
      key_edge: 'REDIRECTS_TO'
    },
    classifier_keywords: ['malicious url', 'redirect', 'cloaking', 'suspicious link', 'bit.ly', 'ip url'],
    threat_family_match: 'malicious_url'
  },
  {
    code: 'T3',
    label: 'T3 — Malware Attachment Delivery',
    name: 'Malware Attachment Delivery Chain',
    family: PATTERN_FAMILY.DIGITAL_THREAT,
    description: 'Delivery of malicious files or payloads via email attachments, often disguised as invoices or documents.',
    severity: SEVERITY.CRITICAL,
    entities: ['sender', 'recipient', 'attachment', 'file_hash', 'email', 'domain'],
    relationships: ['SENT', 'ATTACHED', 'EXTRACTED_FROM', 'TARGETS', 'USES'],
    key_features: [
      'malicious_attachment', 'macro_enabled', 'file_hash', 'spoofed_sender',
      'double_extension', 'delivery_vector'
    ],
    graph_schema_hint: {
      central_node: 'attachment',
      flow_direction: 'delivery',
      key_edge: 'ATTACHED'
    },
    classifier_keywords: ['attachment', 'malware', 'payload', 'invoice.doc', 'macro', 'file hash'],
    threat_family_match: 'malicious_attachment'
  },
  {
    code: 'T4',
    label: 'T4 — Social Engineering Scam',
    name: 'Social Engineering Scam and Payout Chain',
    family: PATTERN_FAMILY.DIGITAL_THREAT,
    description: 'Manipulation tactics to induce victims to transfer money or share sensitive information, with traceable payout routes.',
    severity: SEVERITY.HIGH,
    entities: ['sender', 'recipient', 'wallet', 'phone', 'platform', 'claimed_brand'],
    relationships: ['TARGETS', 'TRANSFERS_TO', 'USES', 'SENT', 'MENTIONS'],
    key_features: [
      'urgency_panic', 'fear_tactics', 'reward_bait', 'payment_request',
      'crypto_solicitation', 'wire_transfer', 'romance_scam'
    ],
    graph_schema_hint: {
      central_node: 'sender',
      flow_direction: 'extraction',
      key_edge: 'TRANSFERS_TO'
    },
    classifier_keywords: ['scam', 'romance', 'lottery', 'prize', 'wire transfer', 'crypto payment', 'advance fee'],
    threat_family_match: 'social_engineering_scam'
  },
  {
    code: 'T5',
    label: 'T5 — Coordinated Misinformation',
    name: 'Coordinated Misinformation / Inauthentic Amplification',
    family: PATTERN_FAMILY.DIGITAL_THREAT,
    description: 'Coordinated network of accounts amplifying false or harmful narratives across social platforms.',
    severity: SEVERITY.MEDIUM,
    entities: ['social_account', 'platform', 'campaign', 'claim', 'organization'],
    relationships: ['PART_OF_CAMPAIGN', 'MENTIONS', 'TARGETS', 'RELATED_TO', 'USES'],
    key_features: [
      'coordinated_amplification', 'inauthentic_accounts', 'false_claims',
      'narrative_injection', 'platform_manipulation', 'bot_network'
    ],
    graph_schema_hint: {
      central_node: 'campaign',
      flow_direction: 'broadcast',
      key_edge: 'PART_OF_CAMPAIGN'
    },
    classifier_keywords: ['misinformation', 'fake news', 'disinformation', 'coordinated', 'amplification', 'bot'],
    threat_family_match: 'misinformation'
  },
  {
    code: 'T6',
    label: 'T6 — Account Takeover / Identity Spread',
    name: 'Account Takeover / Identity Impersonation Spread',
    family: PATTERN_FAMILY.DIGITAL_THREAT,
    description: 'Compromised or cloned accounts used to spread malicious content, harvest victims, or commit fraud.',
    severity: SEVERITY.CRITICAL,
    entities: ['social_account', 'email', 'phone', 'sender', 'recipient', 'platform'],
    relationships: ['IMPERSONATES', 'TARGETS', 'USES', 'SENT', 'RELATED_TO'],
    key_features: [
      'account_compromise', 'identity_cloning', 'otp_bypass', 'credential_stuffing',
      'session_hijacking', 'pivot_targeting'
    ],
    graph_schema_hint: {
      central_node: 'social_account',
      flow_direction: 'spread',
      key_edge: 'IMPERSONATES'
    },
    classifier_keywords: ['account takeover', 'ato', 'identity', 'otp', 'hijack', 'compromised account'],
    threat_family_match: 'impersonation'
  }
];

// ─── Unified registry ─────────────────────────────────────────────
const ALL_PATTERNS = [...AML_PATTERNS, ...DIGITAL_THREAT_PATTERNS];

const PATTERN_BY_CODE = ALL_PATTERNS.reduce((acc, p) => {
  acc[p.code] = p;
  return acc;
}, {});

/**
 * Look up a pattern by code (e.g. "P1", "T4")
 */
function getPatternByCode(code) {
  return PATTERN_BY_CODE[code] || null;
}

/**
 * Get all patterns in a family
 */
function getPatternsByFamily(family) {
  return ALL_PATTERNS.filter(p => p.family === family);
}

/**
 * Classify a threat family string into the best-matching T-pattern
 */
function matchThreatFamilyToPattern(threatFamily) {
  if (!threatFamily) return null;
  const match = DIGITAL_THREAT_PATTERNS.find(p => p.threat_family_match === threatFamily);
  return match || null;
}

/**
 * Build a unified classification result shape compatible with both
 * AML (P1-P6) and digital threat (T1-T6) outputs.
 */
function createUnifiedClassificationResult({
  pattern_code,
  pattern_name,
  pattern_label,
  family,
  risk_score,
  confidence,
  severity,
  decision,
  top_features = [],
  evidence_refs = [],
  explanation = '',
  all_results = [],
  model = 'heuristic'
}) {
  const patternMeta = getPatternByCode(pattern_code);

  return {
    pattern_code,
    pattern_name: pattern_name || patternMeta?.name || pattern_code,
    pattern_label: pattern_label || patternMeta?.label || pattern_code,
    family: family || patternMeta?.family || PATTERN_FAMILY.DIGITAL_THREAT,
    risk_score: Math.min(Math.max(Number(risk_score) || 0, 0), 1),
    confidence: Math.min(Math.max(Number(confidence) || 0, 0), 1),
    severity: severity || 'unknown',
    decision: decision || (risk_score >= 0.75 ? 'suspicious' : 'not_suspicious'),
    top_features,
    evidence_refs,
    explanation,
    all_results,
    model,
    schema_version: '1.0.0'
  };
}

export {
  PATTERN_FAMILY,
  SEVERITY,
  GRAPH_NODE_TYPES,
  GRAPH_EDGE_TYPES,
  AML_PATTERNS,
  DIGITAL_THREAT_PATTERNS,
  ALL_PATTERNS,
  PATTERN_BY_CODE,
  getPatternByCode,
  getPatternsByFamily,
  matchThreatFamilyToPattern,
  createUnifiedClassificationResult
};
