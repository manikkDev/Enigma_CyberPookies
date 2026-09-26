/**
 * Unified Threat Analysis Schema
 * Version: 1.0.0
 * 
 * This module defines normalized data structures for digital threat intelligence analysis.
 * It provides a consistent contract between frontend, backend, and ML services.
 */

// ═══════════════════════════════════════════════════════════════
// Input Types
// ═══════════════════════════════════════════════════════════════

const INPUT_TYPES = {
  EMAIL_TEXT: 'email_text',
  SMS_TEXT: 'sms_text',
  SOCIAL_POST: 'social_post',
  SCREENSHOT: 'screenshot',
  PDF_REPORT: 'pdf_report',
  DOCUMENT: 'document',
  CSV: 'csv',
  URL: 'url',
  DOMAIN: 'domain',
  ATTACHMENT: 'attachment',
  RAW_TEXT: 'raw_text'
};

// ═══════════════════════════════════════════════════════════════
// Indicator Types
// ═══════════════════════════════════════════════════════════════

const INDICATOR_TYPES = {
  URL: 'url',
  DOMAIN: 'domain',
  EMAIL: 'email',
  PHONE: 'phone',
  IP: 'ip',
  USERNAME: 'username',
  WALLET: 'wallet',
  HASH: 'hash',
  BANK_ACCOUNT: 'bank_account',
  KEYWORD: 'keyword',
  CLAIM: 'claim'
};

// ═══════════════════════════════════════════════════════════════
// Core Schema Definitions
// ═══════════════════════════════════════════════════════════════

/**
 * ThreatArtifact - normalized representation of ingested content
 * @typedef {Object} ThreatArtifact
 * @property {string} artifact_id - unique identifier
 * @property {string} input_type - one of INPUT_TYPES
 * @property {string} raw_content - original content
 * @property {string} [extracted_text] - text extracted from binary formats
 * @property {Object} metadata - artifact metadata
 * @property {string} [metadata.source_platform] - e.g., "gmail", "twitter", "telegram"
 * @property {string} [metadata.claimed_sender] - reported sender
 * @property {string} [metadata.target_brand] - suspected impersonated brand
 * @property {string} [metadata.submission_time] - ISO timestamp
 * @property {string} [metadata.analyst_notes] - optional notes
 * @property {string} [metadata.urgency_level] - "low", "medium", "high"
 * @property {string} [metadata.suspected_attack_type] - e.g., "phishing", "malware", "scam"
 */

/**
 * ThreatAnalysisRequest - request payload for threat analysis
 * @typedef {Object} ThreatAnalysisRequest
 * @property {ThreatArtifact} artifact - content to analyze
 * @property {Object} [options] - analysis options
 * @property {boolean} [options.extract_iocs] - extract indicators
 * @property {boolean} [options.extract_entities] - extract entities
 * @property {boolean} [options.score_content] - compute risk score
 * @property {boolean} [options.build_graph] - generate graph payload
 * @property {boolean} [options.find_similar] - find related threats
 * @property {string} schema_version - schema version (e.g., "1.0.0")
 */

/**
 * ThreatIndicator - extracted IOC
 * @typedef {Object} ThreatIndicator
 * @property {string} type - one of INDICATOR_TYPES
 * @property {string} value - extracted value
 * @property {number} [confidence] - 0-1 confidence score
 * @property {string} [source_span] - location in original text
 * @property {Object} [enrichment] - external enrichment data
 */

/**
 * ThreatEntity - extracted entity
 * @typedef {Object} ThreatEntity
 * @property {string} entity_type - e.g., "sender", "brand", "victim", "actor"
 * @property {string} value - entity value
 * @property {string} [role] - entity role in the threat
 * @property {Object} [attributes] - additional attributes
 */

/**
 * ThreatEvidence - evidence item
 * @typedef {Object} ThreatEvidence
 * @property {string} evidence_id - unique identifier
 * @property {string} evidence_type - type of evidence
 * @property {string} description - human-readable description
 * @property {string} [source_ref] - reference to source artifact
 * @property {number} [confidence] - 0-1 confidence
 * @property {string} [extracted_from] - span or location
 */

/**
 * ThreatRiskScore - explainable risk score
 * @typedef {Object} ThreatRiskScore
 * @property {number} overall_score - 0-100 overall risk score
 * @property {number} content_score - content-based risk (0-100)
 * @property {number} infrastructure_score - infrastructure risk (0-100)
 * @property {number} behavior_score - behavioral risk (0-100)
 * @property {number} graph_score - graph-based risk (0-100)
 * @property {number} financial_score - financial risk (0-100)
 * @property {number} confidence - 0-1 confidence in the score
 * @property {string} severity - "low", "medium", "high", "critical"
 * @property {string[]} reasons - explainability reasons
 * @property {string[]} evidence_refs - references to evidence items
 */

/**
 * ThreatAnalysisResult - complete analysis result
 * @typedef {Object} ThreatAnalysisResult
 * @property {string} analysis_id - unique identifier
 * @property {string} artifact_id - reference to analyzed artifact
 * @property {ThreatArtifact} artifact_summary - normalized artifact
 * @property {ThreatIndicator[]} indicators - extracted IOCs
 * @property {ThreatEntity[]} entities - extracted entities
 * @property {ThreatEvidence[]} evidence - evidence items
 * @property {ThreatRiskScore} risk_score - computed risk score
 * @property {ThreatGraphPayload} [graph] - optional graph representation
 * @property {Object} [related_threats] - similar or related threats
 * @property {string} timestamp - ISO timestamp
 * @property {string} schema_version - schema version
 */

/**
 * ThreatGraphPayload - graph representation for threat network
 * @typedef {Object} ThreatGraphPayload
 * @property {Object[]} nodes - graph nodes
 * @property {string} nodes[].id - node identifier
 * @property {string} nodes[].type - node type
 * @property {string} nodes[].label - display label
 * @property {Object} nodes[].properties - node properties
 * @property {Object[]} edges - graph edges
 * @property {string} edges[].source - source node id
 * @property {string} edges[].target - target node id
 * @property {string} edges[].type - relationship type
 * @property {Object} edges[].properties - edge properties
 * @property {Object} [metadata] - graph metadata
 */

// ═══════════════════════════════════════════════════════════════
// Factory Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Create a new ThreatArtifact
 */
function createThreatArtifact(inputType, rawContent, metadata = {}) {
  return {
    artifact_id: `artifact_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    input_type: inputType,
    raw_content: rawContent,
    metadata: {
      submission_time: new Date().toISOString(),
      ...metadata
    }
  };
}

/**
 * Create a new ThreatAnalysisRequest
 */
function createThreatAnalysisRequest(artifact, options = {}) {
  return {
    artifact,
    options: {
      extract_iocs: true,
      extract_entities: true,
      score_content: true,
      build_graph: false,
      find_similar: false,
      ...options
    },
    schema_version: '1.0.0'
  };
}

/**
 * Create a new ThreatIndicator
 */
function createThreatIndicator(type, value, confidence = 1.0, sourceSpan = null) {
  return {
    type,
    value,
    confidence,
    ...(sourceSpan && { source_span: sourceSpan })
  };
}

/**
 * Create a new ThreatEntity
 */
function createThreatEntity(entityType, value, role = null, attributes = {}) {
  return {
    entity_type: entityType,
    value,
    ...(role && { role }),
    ...(Object.keys(attributes).length > 0 && { attributes })
  };
}

/**
 * Create a new ThreatEvidence
 */
function createThreatEvidence(evidenceType, description, confidence = 1.0) {
  return {
    evidence_id: `evidence_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    evidence_type: evidenceType,
    description,
    confidence
  };
}

/**
 * Create a new ThreatRiskScore
 */
function createThreatRiskScore(scores = {}) {
  const {
    overall_score = 0,
    content_score = 0,
    infrastructure_score = 0,
    behavior_score = 0,
    graph_score = 0,
    financial_score = 0,
    confidence = 0.5,
    reasons = [],
    evidence_refs = []
  } = scores;

  // Determine severity based on overall score
  let severity = 'low';
  if (overall_score >= 70) severity = 'critical';
  else if (overall_score >= 50) severity = 'high';
  else if (overall_score >= 30) severity = 'medium';

  return {
    overall_score,
    content_score,
    infrastructure_score,
    behavior_score,
    graph_score,
    financial_score,
    confidence,
    severity,
    reasons,
    evidence_refs
  };
}

/**
 * Create a new ThreatAnalysisResult
 */
function createThreatAnalysisResult(artifactId, artifactSummary, analysisData = {}) {
  return {
    analysis_id: `analysis_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    artifact_id: artifactId,
    artifact_summary: artifactSummary,
    indicators: analysisData.indicators || [],
    entities: analysisData.entities || [],
    evidence: analysisData.evidence || [],
    risk_score: analysisData.risk_score || createThreatRiskScore(),
    ...(analysisData.graph && { graph: analysisData.graph }),
    ...(analysisData.related_threats && { related_threats: analysisData.related_threats }),
    timestamp: new Date().toISOString(),
    schema_version: '1.0.0'
  };
}

/**
 * Create a new ThreatGraphPayload
 */
function createThreatGraphPayload(nodes = [], edges = [], metadata = {}) {
  return {
    nodes,
    edges,
    metadata
  };
}

// ═══════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════

export {
  // Constants
  INPUT_TYPES,
  INDICATOR_TYPES,
  
  // Factory functions
  createThreatArtifact,
  createThreatAnalysisRequest,
  createThreatIndicator,
  createThreatEntity,
  createThreatEvidence,
  createThreatRiskScore,
  createThreatAnalysisResult,
  createThreatGraphPayload
};
