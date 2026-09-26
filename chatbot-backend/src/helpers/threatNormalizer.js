/**
 * Threat Content Normalization Helpers
 * 
 * These helpers normalize various input types into ThreatArtifact objects
 * and extract text from different formats.
 */

import { createThreatArtifact, INPUT_TYPES } from '../types/threatSchema.js';

/**
 * Normalize raw analyst input into a ThreatArtifact
 */
function normalizeRawInput(inputType, content, metadata = {}) {
  // Validate input type
  const validTypes = Object.values(INPUT_TYPES);
  if (!validTypes.includes(inputType)) {
    throw new Error(`Invalid input type: ${inputType}. Must be one of: ${validTypes.join(', ')}`);
  }

  // Create base artifact
  const artifact = createThreatArtifact(inputType, content, metadata);

  // Add input-type-specific processing hints
  switch (inputType) {
    case INPUT_TYPES.EMAIL_TEXT:
      artifact.metadata.requires_header_parsing = true;
      artifact.metadata.extract_urls = true;
      artifact.metadata.extract_emails = true;
      break;
    
    case INPUT_TYPES.SMS_TEXT:
      artifact.metadata.extract_phones = true;
      artifact.metadata.extract_urls = true;
      artifact.metadata.check_urgency = true;
      break;
    
    case INPUT_TYPES.SOCIAL_POST:
      artifact.metadata.extract_usernames = true;
      artifact.metadata.extract_hashtags = true;
      artifact.metadata.extract_urls = true;
      artifact.metadata.check_amplification = true;
      break;
    
    case INPUT_TYPES.SCREENSHOT:
      artifact.metadata.requires_ocr = true;
      artifact.metadata.extract_visual_context = true;
      break;
    
    case INPUT_TYPES.URL:
    case INPUT_TYPES.DOMAIN:
      artifact.metadata.check_reputation = true;
      artifact.metadata.check_whois = true;
      artifact.metadata.check_ssl = true;
      break;
    
    case INPUT_TYPES.ATTACHMENT:
      artifact.metadata.compute_hash = true;
      artifact.metadata.check_signature = true;
      artifact.metadata.extract_metadata = true;
      break;
  }

  return artifact;
}

/**
 * Extract text from various artifact types
 * Currently a placeholder - full implementation would integrate OCR and parsing libraries
 */
async function extractTextFromArtifact(artifact) {
  const { input_type, raw_content, metadata } = artifact;

  // For text-based inputs, return content directly
  const textTypes = [
    INPUT_TYPES.EMAIL_TEXT,
    INPUT_TYPES.SMS_TEXT,
    INPUT_TYPES.SOCIAL_POST,
    INPUT_TYPES.RAW_TEXT
  ];

  if (textTypes.includes(input_type)) {
    return {
      extracted_text: raw_content,
      extraction_method: 'direct'
    };
  }

  // For URL/Domain, return the URL itself
  if (input_type === INPUT_TYPES.URL || input_type === INPUT_TYPES.DOMAIN) {
    return {
      extracted_text: raw_content,
      extraction_method: 'direct',
      url: raw_content
    };
  }

  // For screenshots - OCR placeholder
  if (input_type === INPUT_TYPES.SCREENSHOT) {
    // TODO: Integrate OCR service (e.g., Tesseract, Google Vision, Azure OCR)
    return {
      extracted_text: '',
      extraction_method: 'ocr_pending',
      ocr_status: 'not_implemented',
      note: 'OCR integration placeholder - connect OCR engine here'
    };
  }

  // For documents - extraction placeholder
  if ([INPUT_TYPES.PDF_REPORT, INPUT_TYPES.DOCUMENT].includes(input_type)) {
    // TODO: Use existing PDF/DOCX extractors from upload helpers
    return {
      extracted_text: '',
      extraction_method: 'document_parse_pending',
      note: 'Document parsing placeholder - integrate existing extractors'
    };
  }

  // Default: no extraction
  return {
    extracted_text: '',
    extraction_method: 'none'
  };
}

/**
 * Tag artifact with source platform
 */
function tagSourcePlatform(artifact, platform) {
  if (!artifact.metadata) artifact.metadata = {};
  
  const platformMappings = {
    'gmail': { platform: 'Gmail', type: 'email' },
    'outlook': { platform: 'Outlook', type: 'email' },
    'twitter': { platform: 'Twitter/X', type: 'social' },
    'facebook': { platform: 'Facebook', type: 'social' },
    'instagram': { platform: 'Instagram', type: 'social' },
    'telegram': { platform: 'Telegram', type: 'messaging' },
    'whatsapp': { platform: 'WhatsApp', type: 'messaging' },
    'sms': { platform: 'SMS', type: 'messaging' }
  };

  const platformInfo = platformMappings[platform?.toLowerCase()] || {
    platform: platform || 'Unknown',
    type: 'unknown'
  };

  artifact.metadata.source_platform = platformInfo.platform;
  artifact.metadata.platform_type = platformInfo.type;
  
  return artifact;
}

/**
 * Tag artifact with claimed brand or sender
 */
function tagClaimedBrand(artifact, brand) {
  if (!artifact.metadata) artifact.metadata = {};
  artifact.metadata.target_brand = brand;
  return artifact;
}

/**
 * Tag artifact with suspected attack type
 */
function tagAttackType(artifact, attackType) {
  if (!artifact.metadata) artifact.metadata = {};
  
  const validAttackTypes = [
    'phishing',
    'smishing',
    'malware',
    'scam',
    'fraud',
    'impersonation',
    'misinformation',
    'spam',
    'unknown'
  ];

  artifact.metadata.suspected_attack_type = validAttackTypes.includes(attackType)
    ? attackType
    : 'unknown';
  
  return artifact;
}

/**
 * Generate evidence reference ID
 */
function generateEvidenceRef(artifactId, evidenceType, index = 0) {
  return `${artifactId}::${evidenceType}::${index}`;
}

/**
 * Parse email headers (placeholder for full email parsing)
 */
function parseEmailHeaders(emailText) {
  // Simple regex-based header extraction
  // TODO: Use a proper email parsing library for production
  
  const headers = {};
  const lines = emailText.split('\n');
  
  for (const line of lines) {
    if (line.trim() === '') break; // End of headers
    
    const match = line.match(/^([A-Za-z-]+):\s*(.+)$/);
    if (match) {
      headers[match[1].toLowerCase()] = match[2].trim();
    }
  }

  return {
    from: headers.from || '',
    to: headers.to || '',
    subject: headers.subject || '',
    date: headers.date || '',
    reply_to: headers['reply-to'] || '',
    all_headers: headers
  };
}

/**
 * Normalize artifact metadata
 */
function normalizeArtifactMetadata(artifact) {
  const normalized = { ...artifact };
  
  // Ensure required metadata fields exist
  if (!normalized.metadata) normalized.metadata = {};
  if (!normalized.metadata.submission_time) {
    normalized.metadata.submission_time = new Date().toISOString();
  }
  
  // Set default urgency if not specified
  if (!normalized.metadata.urgency_level) {
    normalized.metadata.urgency_level = 'medium';
  }
  
  // Extract email headers if it's an email
  if (normalized.input_type === INPUT_TYPES.EMAIL_TEXT) {
    const headers = parseEmailHeaders(normalized.raw_content);
    normalized.metadata.email_headers = headers;
  }
  
  return normalized;
}

export {
  normalizeRawInput,
  extractTextFromArtifact,
  tagSourcePlatform,
  tagClaimedBrand,
  tagAttackType,
  generateEvidenceRef,
  parseEmailHeaders,
  normalizeArtifactMetadata
};
