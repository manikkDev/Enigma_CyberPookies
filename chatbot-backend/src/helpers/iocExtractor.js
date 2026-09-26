/**
 * IOC (Indicator of Compromise) Extraction - Enhanced V2
 * 
 * Extracts threat indicators from text content with normalization,
 * source references, and confidence scoring.
 */

import { createThreatIndicator, INDICATOR_TYPES } from '../types/threatSchema.js';

/**
 * Helper to find source span for a match in text
 */
function findSourceSpan(text, match, matchIndex = 0) {
  const index = text.indexOf(match, matchIndex);
  if (index === -1) return null;
  return {
    start: index,
    end: index + match.length,
    text: match
  };
}

/**
 * Normalize URL for comparison
 */
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    // Remove trailing slash, lowercase hostname
    let normalized = urlObj.protocol + '//' + urlObj.hostname.toLowerCase();
    if (urlObj.pathname && urlObj.pathname !== '/') {
      normalized += urlObj.pathname;
    }
    if (urlObj.search) {
      normalized += urlObj.search;
    }
    return normalized;
  } catch (e) {
    return url.toLowerCase();
  }
}

/**
 * Extract URLs from text with enhanced metadata
 */
function extractUrls(text) {
  if (!text) return [];
  
  // URL regex pattern - improved to capture more URL variations
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = [];
  let match;
  
  // Use exec to get match indices
  const regex = new RegExp(urlPattern);
  while ((match = regex.exec(text)) !== null) {
    const url = match[0];
    const normalized = normalizeUrl(url);
    const sourceSpan = findSourceSpan(text, url);
    
    const indicator = createThreatIndicator(INDICATOR_TYPES.URL, url, 1.0, sourceSpan);
    indicator.normalized_value = normalized;
    indicator.extraction_method = 'regex';
    
    // Check for URL shorteners
    const shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'rebrand.ly'];
    if (shorteners.some(s => url.includes(s))) {
      indicator.attributes = { url_shortener: true };
      indicator.confidence = 0.9; // Slightly lower due to obscured destination
    }
    
    // Check for IP-based URLs
    if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url)) {
      indicator.attributes = { ...indicator.attributes, ip_based: true };
    }
    
    matches.push(indicator);
  }
  
  return matches;
}

/**
 * Extract domains from text or URLs with normalization
 */
function extractDomains(text) {
  if (!text) return [];
  
  const domainMap = new Map(); // Use map to track source spans
  
  // Extract from URLs first
  const urls = extractUrls(text);
  urls.forEach(urlObj => {
    try {
      const url = new URL(urlObj.value);
      const domain = url.hostname.toLowerCase();
      if (!domainMap.has(domain)) {
        domainMap.set(domain, { source: urlObj.value, type: 'url' });
      }
    } catch (e) {
      // Invalid URL, skip
    }
  });
  
  // Also extract standalone domains
  const domainPattern = /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/gi;
  let match;
  const regex = new RegExp(domainPattern);
  while ((match = regex.exec(text)) !== null) {
    const domain = match[0].toLowerCase();
    if (!domainMap.has(domain)) {
      domainMap.set(domain, { source: match[0], type: 'standalone' });
    }
  }
  
  return Array.from(domainMap.entries()).map(([domain, info]) => {
    const sourceSpan = findSourceSpan(text, info.source);
    const indicator = createThreatIndicator(INDICATOR_TYPES.DOMAIN, domain, 0.9, sourceSpan);
    indicator.normalized_value = domain;
    indicator.extraction_method = 'regex';
    indicator.attributes = { extraction_source: info.type };
    
    // Check for suspicious TLDs
    const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.work', '.click'];
    if (suspiciousTLDs.some(tld => domain.endsWith(tld))) {
      indicator.attributes.suspicious_tld = true;
      indicator.confidence = 0.7;
    }
    
    return indicator;
  });
}

/**
 * Extract email addresses from text with normalization
 */
function extractEmails(text) {
  if (!text) return [];
  
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = [];
  let match;
  
  const regex = new RegExp(emailPattern);
  while ((match = regex.exec(text)) !== null) {
    const email = match[0];
    const normalized = email.toLowerCase();
    const sourceSpan = findSourceSpan(text, email);
    
    const indicator = createThreatIndicator(INDICATOR_TYPES.EMAIL, email, 1.0, sourceSpan);
    indicator.normalized_value = normalized;
    indicator.extraction_method = 'regex';
    
    // Extract domain from email
    const [localPart, domainPart] = normalized.split('@');
    indicator.attributes = {
      local_part: localPart,
      domain: domainPart
    };
    
    emails.push(indicator);
  }
  
  return emails;
}

/**
 * Extract phone numbers from text
 */
function extractPhones(text) {
  if (!text) return [];
  
  // Pattern for various phone formats
  const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const matches = text.match(phonePattern) || [];
  
  return matches.map(phone =>
    createThreatIndicator(INDICATOR_TYPES.PHONE, phone.trim(), 0.8)
  );
}

/**
 * Extract IP addresses from text
 */
function extractIPs(text) {
  if (!text) return [];
  
  const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  const matches = text.match(ipPattern) || [];
  
  // Filter out invalid IPs
  const validIPs = matches.filter(ip => {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  });
  
  return validIPs.map(ip =>
    createThreatIndicator(INDICATOR_TYPES.IP, ip, 0.9)
  );
}

/**
 * Extract usernames from text (social media handles, etc.)
 */
function extractUsernames(text) {
  if (!text) return [];
  
  // Pattern for @mentions and social handles
  const usernamePattern = /@([a-zA-Z0-9_]{1,15})\b/g;
  const matches = text.match(usernamePattern) || [];
  
  return matches.map(username =>
    createThreatIndicator(INDICATOR_TYPES.USERNAME, username, 0.7)
  );
}

/**
 * Extract cryptocurrency wallet addresses
 */
function extractWallets(text) {
  if (!text) return [];
  
  const wallets = [];
  
  // Bitcoin addresses (simplified pattern)
  const btcPattern = /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g;
  const btcMatches = text.match(btcPattern) || [];
  btcMatches.forEach(wallet => {
    wallets.push(createThreatIndicator(INDICATOR_TYPES.WALLET, wallet, 0.8));
  });
  
  // Ethereum addresses
  const ethPattern = /0x[a-fA-F0-9]{40}/g;
  const ethMatches = text.match(ethPattern) || [];
  ethMatches.forEach(wallet => {
    wallets.push(createThreatIndicator(INDICATOR_TYPES.WALLET, wallet, 0.9));
  });
  
  return wallets;
}

/**
 * Extract file hashes (MD5, SHA1, SHA256)
 */
function extractHashes(text) {
  if (!text) return [];
  
  const hashes = [];
  
  // MD5 (32 hex characters)
  const md5Pattern = /\b[a-fA-F0-9]{32}\b/g;
  const md5Matches = text.match(md5Pattern) || [];
  md5Matches.forEach(hash => {
    hashes.push(createThreatIndicator(INDICATOR_TYPES.HASH, hash, 0.7));
  });
  
  // SHA256 (64 hex characters)
  const sha256Pattern = /\b[a-fA-F0-9]{64}\b/g;
  const sha256Matches = text.match(sha256Pattern) || [];
  sha256Matches.forEach(hash => {
    hashes.push(createThreatIndicator(INDICATOR_TYPES.HASH, hash, 0.9));
  });
  
  return hashes;
}

/**
 * Extract bank account numbers (simple pattern)
 */
function extractBankAccounts(text) {
  if (!text) return [];
  
  // Pattern for account-like numbers
  const accountPattern = /\b\d{10,18}\b/g;
  const matches = text.match(accountPattern) || [];
  
  // Only return if context suggests it's a bank account
  const contextKeywords = ['account', 'bank', 'routing', 'iban', 'swift'];
  const lowerText = text.toLowerCase();
  
  if (contextKeywords.some(keyword => lowerText.includes(keyword))) {
    return matches.map(account =>
      createThreatIndicator(INDICATOR_TYPES.BANK_ACCOUNT, account, 0.6)
    );
  }
  
  return [];
}

/**
 * Extract threat-related keywords
 */
function extractKeywords(text) {
  if (!text) return [];
  
  const threatKeywords = [
    'urgent', 'verify', 'suspend', 'security', 'alert', 'action required',
    'confirm', 'click here', 'account', 'password', 'update', 'expire',
    'limited time', 'act now', 'immediate', 'unauthorized', 'locked'
  ];
  
  const found = [];
  const lowerText = text.toLowerCase();
  
  threatKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) {
      found.push(createThreatIndicator(INDICATOR_TYPES.KEYWORD, keyword, 0.7));
    }
  });
  
  return found;
}

/**
 * Extract all IOCs from text
 */
function extractAllIOCs(text) {
  if (!text) return [];
  
  const allIOCs = [
    ...extractUrls(text),
    ...extractDomains(text),
    ...extractEmails(text),
    ...extractPhones(text),
    ...extractIPs(text),
    ...extractUsernames(text),
    ...extractWallets(text),
    ...extractHashes(text),
    ...extractBankAccounts(text),
    ...extractKeywords(text)
  ];
  
  // Deduplicate by type and value
  const seen = new Set();
  return allIOCs.filter(ioc => {
    const key = `${ioc.type}:${ioc.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export {
  extractUrls,
  extractDomains,
  extractEmails,
  extractPhones,
  extractIPs,
  extractUsernames,
  extractWallets,
  extractHashes,
  extractBankAccounts,
  extractKeywords,
  extractAllIOCs
};
