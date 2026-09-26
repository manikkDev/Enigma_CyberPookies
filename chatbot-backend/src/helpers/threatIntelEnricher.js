/**
 * Threat Intelligence Enricher
 * 
 * Real-time IOC enrichment using:
 * - Google Safe Browsing API (URL/domain reputation)
 * - DNS analysis (domain age, nameservers)
 * 
 * Caches results with a 5-minute TTL.
 */

const SAFE_BROWSING_KEY = process.env.GOOGLE_SAFE_BROWSING_KEY || '';
const SAFE_BROWSING_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

// In-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Check URLs against Google Safe Browsing API
 */
async function checkSafeBrowsing(urls) {
  if (!SAFE_BROWSING_KEY || urls.length === 0) {
    return urls.map(url => ({
      url,
      reputation: 'unknown',
      source: 'safe_browsing_unavailable',
      details: 'No API key configured'
    }));
  }

  // Check cache first
  const results = [];
  const uncached = [];

  for (const url of urls) {
    const cached = getCached(`sb:${url}`);
    if (cached) {
      results.push(cached);
    } else {
      uncached.push(url);
    }
  }

  if (uncached.length === 0) return results;

  try {
    const response = await fetch(`${SAFE_BROWSING_URL}?key=${SAFE_BROWSING_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: {
          clientId: 'arth-saathi',
          clientVersion: '2.0.0'
        },
        threatInfo: {
          threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: uncached.map(url => ({ url }))
        }
      })
    });

    if (!response.ok) {
      console.error('[SafeBrowsing] API error:', response.status, await response.text());
      // Return unknown for all uncached
      for (const url of uncached) {
        const result = {
          url,
          reputation: 'unknown',
          source: 'safe_browsing_error',
          details: `API returned ${response.status}`
        };
        setCache(`sb:${url}`, result);
        results.push(result);
      }
      return results;
    }

    const data = await response.json();
    const matches = data.matches || [];

    // Build lookup of flagged URLs
    const flaggedUrls = new Map();
    for (const match of matches) {
      const url = match.threat?.url || '';
      flaggedUrls.set(url, {
        threatType: match.threatType,
        platformType: match.platformType,
        metadata: match.threatEntryMetadata
      });
    }

    // Map results
    for (const url of uncached) {
      const flag = flaggedUrls.get(url);
      const result = flag ? {
        url,
        reputation: 'malicious',
        source: 'google_safe_browsing',
        threat_type: flag.threatType,
        details: `Flagged as ${flag.threatType} by Google Safe Browsing`
      } : {
        url,
        reputation: 'clean',
        source: 'google_safe_browsing',
        details: 'No threats detected by Google Safe Browsing'
      };
      setCache(`sb:${url}`, result);
      results.push(result);
    }

  } catch (error) {
    console.error('[SafeBrowsing] Error:', error.message);
    for (const url of uncached) {
      const result = {
        url,
        reputation: 'unknown',
        source: 'safe_browsing_error',
        details: error.message
      };
      results.push(result);
    }
  }

  return results;
}

/**
 * Analyze domain using DNS lookups
 */
async function analyzeDomain(domain) {
  const cached = getCached(`dns:${domain}`);
  if (cached) return cached;

  const result = {
    domain,
    reputation: 'unknown',
    source: 'dns_analysis',
    details: {}
  };

  try {
    const dns = await import('dns');
    const dnsPromises = dns.promises;

    // Try to resolve domain
    try {
      const addresses = await dnsPromises.resolve4(domain);
      result.details.ip_addresses = addresses;
      result.details.resolves = true;
    } catch (e) {
      result.details.resolves = false;
      result.details.dns_error = e.code;
    }

    // Check MX records (for email domains)
    try {
      const mx = await dnsPromises.resolveMx(domain);
      result.details.has_mx = mx.length > 0;
      result.details.mx_count = mx.length;
    } catch (e) {
      result.details.has_mx = false;
    }

    // Check nameservers
    try {
      const ns = await dnsPromises.resolveNs(domain);
      result.details.nameservers = ns;
    } catch (e) {
      result.details.nameservers = [];
    }

    // Heuristic: suspicious domain patterns
    const suspiciousPatterns = [
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IP address
      /[0-9]{5,}/, // Long number sequences
      /(paypa1|amaz0n|netfl1x|faceb00k|micros0ft|g00gle)/i, // Typosquatting
    ];

    const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.work', '.click', '.buzz'];

    let suspiciousScore = 0;
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(domain)) suspiciousScore += 30;
    }
    for (const tld of suspiciousTlds) {
      if (domain.endsWith(tld)) suspiciousScore += 20;
    }
    if (domain.length > 30) suspiciousScore += 10;
    if (domain.includes('-') && domain.split('-').length > 3) suspiciousScore += 15;

    if (suspiciousScore >= 30) {
      result.reputation = 'suspicious';
      result.details.suspicious_score = suspiciousScore;
    } else if (result.details.resolves) {
      result.reputation = 'clean';
    }

  } catch (error) {
    result.details.error = error.message;
  }

  setCache(`dns:${domain}`, result);
  return result;
}

/**
 * Enrich all IOCs extracted from content
 */
async function enrichIndicators(indicators) {
  if (!indicators || indicators.length === 0) {
    return { enriched: [], summary: { total: 0, malicious: 0, suspicious: 0, clean: 0, unknown: 0 } };
  }

  const enriched = [];
  const urls = [];
  const domains = [];

  // Separate IOCs by type
  for (const ioc of indicators) {
    if (ioc.type === 'url') {
      urls.push(ioc.value || ioc.normalized_value);
    } else if (ioc.type === 'domain') {
      domains.push(ioc.value || ioc.normalized_value);
    }
  }

  // Run Safe Browsing check on all URLs
  const safeBrowsingResults = await checkSafeBrowsing(urls);
  const sbMap = new Map(safeBrowsingResults.map(r => [r.url, r]));

  // Run DNS analysis on all domains (parallel)
  const dnsResults = await Promise.all(domains.map(d => analyzeDomain(d)));
  const dnsMap = new Map(dnsResults.map(r => [r.domain, r]));

  // Merge enrichment data back into indicators
  for (const ioc of indicators) {
    const value = ioc.value || ioc.normalized_value;
    let enrichment = null;

    if (ioc.type === 'url' && sbMap.has(value)) {
      enrichment = sbMap.get(value);
    } else if (ioc.type === 'domain' && dnsMap.has(value)) {
      enrichment = dnsMap.get(value);
    } else {
      enrichment = {
        reputation: 'unknown',
        source: 'no_enrichment',
        details: `No enrichment available for type: ${ioc.type}`
      };
    }

    enriched.push({
      ...ioc,
      enrichment
    });
  }

  // Summary
  const summary = {
    total: enriched.length,
    malicious: enriched.filter(e => e.enrichment?.reputation === 'malicious').length,
    suspicious: enriched.filter(e => e.enrichment?.reputation === 'suspicious').length,
    clean: enriched.filter(e => e.enrichment?.reputation === 'clean').length,
    unknown: enriched.filter(e => e.enrichment?.reputation === 'unknown').length,
  };

  return { enriched, summary };
}

export {
  checkSafeBrowsing,
  analyzeDomain,
  enrichIndicators,
};
