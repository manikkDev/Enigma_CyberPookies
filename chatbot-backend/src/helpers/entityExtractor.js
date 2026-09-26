/**
 * Threat Entity Extraction
 * 
 * Extracts named entities and threat actors from content.
 * Currently uses heuristic rules; can be upgraded with NER models.
 */

import { createThreatEntity } from '../types/threatSchema.js';

/**
 * Extract sender information from email-like content
 */
function extractSender(text, metadata = {}) {
  const entities = [];
  
  // Check metadata first
  if (metadata.email_headers?.from) {
    entities.push(createThreatEntity(
      'sender',
      metadata.email_headers.from,
      'originator'
    ));
  }
  
  // Extract from "From:" line in text
  const fromMatch = text.match(/From:\s*(.+?)(?:\n|$)/i);
  if (fromMatch) {
    entities.push(createThreatEntity(
      'sender',
      fromMatch[1].trim(),
      'originator'
    ));
  }
  
  return entities;
}

/**
 * Extract target brand mentions
 */
function extractBrands(text) {
  const commonBrands = [
    'PayPal', 'Amazon', 'Netflix', 'Apple', 'Microsoft', 'Google',
    'Facebook', 'Instagram', 'Bank of America', 'Wells Fargo', 'Chase',
    'Citibank', 'HSBC', 'DHL', 'FedEx', 'UPS', 'IRS', 'Social Security'
  ];
  
  const entities = [];
  const lowerText = text.toLowerCase();
  
  commonBrands.forEach(brand => {
    if (lowerText.includes(brand.toLowerCase())) {
      entities.push(createThreatEntity(
        'brand',
        brand,
        'target',
        { impersonation_likely: true }
      ));
    }
  });
  
  return entities;
}

/**
 * Extract organization mentions
 */
function extractOrganizations(text) {
  // Simple heuristic: look for capitalized phrases
  // TODO: Upgrade with NER model for production
  
  const orgPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  const matches = text.match(orgPattern) || [];
  
  const commonOrgs = ['Microsoft Corporation', 'Google LLC', 'Amazon Web Services'];
  const entities = [];
  
  matches.forEach(match => {
    if (match.split(/\s+/).length >= 2) {
      entities.push(createThreatEntity(
        'organization',
        match,
        'mentioned'
      ));
    }
  });
  
  return entities.slice(0, 5); // Limit to top 5
}

/**
 * Extract recipient/victim information
 */
function extractRecipient(text, metadata = {}) {
  const entities = [];
  
  // Check metadata
  if (metadata.email_headers?.to) {
    entities.push(createThreatEntity(
      'recipient',
      metadata.email_headers.to,
      'target'
    ));
  }
  
  // Extract from "To:" line
  const toMatch = text.match(/To:\s*(.+?)(?:\n|$)/i);
  if (toMatch) {
    entities.push(createThreatEntity(
      'recipient',
      toMatch[1].trim(),
      'target'
    ));
  }
  
  return entities;
}

/**
 * Detect urgency and pressure tactics
 */
function detectUrgencyTactics(text) {
  const urgencyIndicators = {
    'urgent': 'immediate action required',
    'immediately': 'time pressure',
    'within 24 hours': 'deadline pressure',
    'account suspended': 'account threat',
    'unauthorized access': 'security threat',
    'verify now': 'verification pressure',
    'expires': 'expiration pressure',
    'limited time': 'scarcity pressure',
    'act now': 'action pressure'
  };
  
  const lowerText = text.toLowerCase();
  const detected = [];
  
  Object.entries(urgencyIndicators).forEach(([phrase, tactic]) => {
    if (lowerText.includes(phrase)) {
      detected.push({
        phrase,
        tactic,
        type: 'urgency_tactic'
      });
    }
  });
  
  return detected;
}

/**
 * Detect credential or payment requests
 */
function detectRequests(text) {
  const requestPatterns = {
    credential: ['password', 'username', 'login', 'sign in', 'verify account'],
    payment: ['payment', 'credit card', 'bank account', 'wire transfer', 'send money'],
    personal_info: ['social security', 'date of birth', 'ssn', 'personal information']
  };
  
  const lowerText = text.toLowerCase();
  const detected = [];
  
  Object.entries(requestPatterns).forEach(([requestType, keywords]) => {
    keywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        detected.push({
          request_type: requestType,
          keyword,
          confidence: 0.8
        });
      }
    });
  });
  
  return detected;
}

/**
 * Extract all entities from text
 */
function extractAllEntities(text, metadata = {}) {
  const entities = [
    ...extractSender(text, metadata),
    ...extractBrands(text),
    ...extractOrganizations(text),
    ...extractRecipient(text, metadata)
  ];
  
  // Add behavioral entities
  const urgencyTactics = detectUrgencyTactics(text);
  urgencyTactics.forEach(tactic => {
    entities.push(createThreatEntity(
      'tactic',
      tactic.phrase,
      'pressure',
      { tactic_type: tactic.tactic }
    ));
  });
  
  const requests = detectRequests(text);
  requests.forEach(req => {
    entities.push(createThreatEntity(
      'request',
      req.keyword,
      'solicitation',
      { request_type: req.request_type, confidence: req.confidence }
    ));
  });
  
  // Deduplicate
  const seen = new Set();
  return entities.filter(entity => {
    const key = `${entity.entity_type}:${entity.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Analyze content tone and language
 */
function analyzeContentTone(text) {
  const analysis = {
    urgency_level: 'low',
    fear_level: 'low',
    impersonation_signals: [],
    language_quality: 'normal'
  };
  
  const lowerText = text.toLowerCase();
  
  // Check urgency
  const urgencyWords = ['urgent', 'immediately', 'now', 'asap', 'today'];
  const urgencyCount = urgencyWords.filter(word => lowerText.includes(word)).length;
  if (urgencyCount >= 3) analysis.urgency_level = 'high';
  else if (urgencyCount >= 1) analysis.urgency_level = 'medium';
  
  // Check fear tactics
  const fearWords = ['suspend', 'locked', 'unauthorized', 'fraud', 'security breach'];
  const fearCount = fearWords.filter(word => lowerText.includes(word)).length;
  if (fearCount >= 2) analysis.fear_level = 'high';
  else if (fearCount >= 1) analysis.fear_level = 'medium';
  
  // Check impersonation
  const impersonationPhrases = [
    'from your bank',
    'your account',
    'verify your identity',
    'dear customer',
    'dear user'
  ];
  impersonationPhrases.forEach(phrase => {
    if (lowerText.includes(phrase)) {
      analysis.impersonation_signals.push(phrase);
    }
  });
  
  return analysis;
}

export {
  extractSender,
  extractBrands,
  extractOrganizations,
  extractRecipient,
  detectUrgencyTactics,
  detectRequests,
  extractAllEntities,
  analyzeContentTone
};
