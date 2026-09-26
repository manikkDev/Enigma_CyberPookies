/**
 * Campaign Correlation Engine
 *
 * Detects relationships between threat analysis results and clusters
 * them into inferred campaigns using explainable heuristic matching.
 */

import { matchThreatFamilyToPattern } from '../types/patternRegistry.js';

// ─── Correlation dimension weights ────────────────────────────────
const DIMENSION_WEIGHTS = {
  same_domain: 0.20,
  same_sender: 0.18,
  same_brand_target: 0.15,
  same_phone: 0.14,
  same_wallet: 0.16,
  same_file_hash: 0.18,
  similar_url_template: 0.12,
  same_platform: 0.08,
  similar_cta_pattern: 0.10,
  shared_claim_type: 0.09,
  same_threat_family: 0.12,
  shared_ip_block: 0.13,
  similar_message_template: 0.15
};

// ─── Helpers ──────────────────────────────────────────────────────

function extractDomains(analysis) {
  return (analysis.indicators || [])
    .filter(i => i.type === 'domain')
    .map(i => (i.normalized_value || i.value || '').toLowerCase())
    .filter(Boolean);
}

function extractEmails(analysis) {
  return (analysis.indicators || [])
    .filter(i => i.type === 'email')
    .map(i => (i.normalized_value || i.value || '').toLowerCase())
    .filter(Boolean);
}

function extractPhones(analysis) {
  return (analysis.indicators || [])
    .filter(i => i.type === 'phone')
    .map(i => (i.normalized_value || i.value || '').replace(/\D/g, ''))
    .filter(s => s.length >= 7);
}

function extractWallets(analysis) {
  return (analysis.indicators || [])
    .filter(i => i.type === 'wallet')
    .map(i => (i.normalized_value || i.value || '').toLowerCase())
    .filter(Boolean);
}

function extractHashes(analysis) {
  return (analysis.indicators || [])
    .filter(i => i.type === 'hash')
    .map(i => (i.normalized_value || i.value || '').toLowerCase())
    .filter(Boolean);
}

function extractUrls(analysis) {
  return (analysis.indicators || [])
    .filter(i => i.type === 'url')
    .map(i => (i.normalized_value || i.value || '').toLowerCase())
    .filter(Boolean);
}

function getClaimedBrand(analysis) {
  const fromMeta = analysis.artifact_summary?.metadata?.target_brand;
  if (fromMeta) return fromMeta.toLowerCase();
  const brandEntity = (analysis.entities || []).find(e => e.entity_type === 'brand');
  return brandEntity ? (brandEntity.value || '').toLowerCase() : null;
}

function getSender(analysis) {
  const fromMeta = analysis.artifact_summary?.metadata?.claimed_sender;
  if (fromMeta) return fromMeta.toLowerCase();
  const senderEntity = (analysis.entities || []).find(e => e.entity_type === 'sender');
  return senderEntity ? (senderEntity.value || '').toLowerCase() : null;
}

function getPlatform(analysis) {
  return (analysis.artifact_summary?.metadata?.source_platform || '').toLowerCase() || null;
}

function getThreatFamily(analysis) {
  return analysis.classification?.primary_family || null;
}

function getClaimTypes(analysis) {
  return (analysis.claims || []).map(c => c.claim_type).filter(Boolean);
}

function hasSetIntersection(setA, setB) {
  for (const item of setA) {
    if (setB.has(item)) return true;
  }
  return false;
}

function setIntersectionItems(arrA, arrB) {
  const setB = new Set(arrB);
  return arrA.filter(a => setB.has(a));
}

/**
 * Compute URL template similarity.
 * Strips query params and checks if base path patterns match.
 */
function urlTemplateSimilarity(urlsA, urlsB) {
  const templateOf = url => {
    try {
      const u = new URL(url);
      const segments = u.pathname.split('/').filter(Boolean);
      return u.hostname + '/' + segments.slice(0, 2).join('/');
    } catch {
      return url.split('?')[0];
    }
  };

  const templatesA = new Set(urlsA.map(templateOf));
  const templatesB = new Set(urlsB.map(templateOf));
  return hasSetIntersection(templatesA, templatesB);
}

/**
 * Check if two IP-based URLs share a /24 subnet.
 */
function sharesIpBlock(urlsA, urlsB) {
  const getBlock = url => {
    const m = url.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}/);
    return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
  };
  const blocksA = new Set(urlsA.map(getBlock).filter(Boolean));
  const blocksB = new Set(urlsB.map(getBlock).filter(Boolean));
  return hasSetIntersection(blocksA, blocksB);
}

// ─── Core correlation function ─────────────────────────────────────

/**
 * Correlate one analysis against a list of reference analyses.
 * @param {object} target - The new analysis result
 * @param {object[]} references - Existing analysis results to compare against
 * @returns {CorrelationResult}
 */
function correlateAnalysis(target, references) {
  if (!target || !Array.isArray(references) || references.length === 0) {
    return {
      correlation_id: `corr_${Date.now()}`,
      target_id: target?.analysis_id || 'unknown',
      matches: [],
      campaign_hint: null,
      total_correlated: 0,
      schema_version: '1.0.0'
    };
  }

  const targetDomains = new Set(extractDomains(target));
  const targetEmails = new Set(extractEmails(target));
  const targetPhones = new Set(extractPhones(target));
  const targetWallets = new Set(extractWallets(target));
  const targetHashes = new Set(extractHashes(target));
  const targetUrls = extractUrls(target);
  const targetBrand = getClaimedBrand(target);
  const targetSender = getSender(target);
  const targetPlatform = getPlatform(target);
  const targetFamily = getThreatFamily(target);
  const targetClaimTypes = new Set(getClaimTypes(target));

  const matches = [];

  for (const ref of references) {
    if (ref.analysis_id === target.analysis_id) continue;

    const refDomains = extractDomains(ref);
    const refEmails = extractEmails(ref);
    const refPhones = extractPhones(ref);
    const refWallets = extractWallets(ref);
    const refHashes = extractHashes(ref);
    const refUrls = extractUrls(ref);
    const refBrand = getClaimedBrand(ref);
    const refSender = getSender(ref);
    const refPlatform = getPlatform(ref);
    const refFamily = getThreatFamily(ref);
    const refClaimTypes = new Set(getClaimTypes(ref));

    const hitDimensions = {};
    let totalWeight = 0;

    // Same domain
    const sharedDomains = setIntersectionItems([...targetDomains], refDomains);
    if (sharedDomains.length > 0) {
      hitDimensions.same_domain = { matched: sharedDomains, weight: DIMENSION_WEIGHTS.same_domain };
      totalWeight += DIMENSION_WEIGHTS.same_domain;
    }

    // Same sender
    if (targetSender && refSender && targetSender === refSender) {
      hitDimensions.same_sender = { matched: [targetSender], weight: DIMENSION_WEIGHTS.same_sender };
      totalWeight += DIMENSION_WEIGHTS.same_sender;
    }

    // Same brand target
    if (targetBrand && refBrand && targetBrand === refBrand) {
      hitDimensions.same_brand_target = { matched: [targetBrand], weight: DIMENSION_WEIGHTS.same_brand_target };
      totalWeight += DIMENSION_WEIGHTS.same_brand_target;
    }

    // Same phone
    const sharedPhones = setIntersectionItems([...targetPhones], refPhones);
    if (sharedPhones.length > 0) {
      hitDimensions.same_phone = { matched: sharedPhones, weight: DIMENSION_WEIGHTS.same_phone };
      totalWeight += DIMENSION_WEIGHTS.same_phone;
    }

    // Same wallet
    const sharedWallets = setIntersectionItems([...targetWallets], refWallets);
    if (sharedWallets.length > 0) {
      hitDimensions.same_wallet = { matched: sharedWallets, weight: DIMENSION_WEIGHTS.same_wallet };
      totalWeight += DIMENSION_WEIGHTS.same_wallet;
    }

    // Same file hash
    const sharedHashes = setIntersectionItems([...targetHashes], refHashes);
    if (sharedHashes.length > 0) {
      hitDimensions.same_file_hash = { matched: sharedHashes, weight: DIMENSION_WEIGHTS.same_file_hash };
      totalWeight += DIMENSION_WEIGHTS.same_file_hash;
    }

    // Similar URL template
    if (targetUrls.length > 0 && refUrls.length > 0 && urlTemplateSimilarity(targetUrls, refUrls)) {
      hitDimensions.similar_url_template = { matched: ['url_pattern'], weight: DIMENSION_WEIGHTS.similar_url_template };
      totalWeight += DIMENSION_WEIGHTS.similar_url_template;
    }

    // Shared IP block
    if (sharesIpBlock(targetUrls, refUrls)) {
      hitDimensions.shared_ip_block = { matched: ['ip_block'], weight: DIMENSION_WEIGHTS.shared_ip_block };
      totalWeight += DIMENSION_WEIGHTS.shared_ip_block;
    }

    // Same platform
    if (targetPlatform && refPlatform && targetPlatform === refPlatform) {
      hitDimensions.same_platform = { matched: [targetPlatform], weight: DIMENSION_WEIGHTS.same_platform };
      totalWeight += DIMENSION_WEIGHTS.same_platform;
    }

    // Same threat family
    if (targetFamily && refFamily && targetFamily === refFamily) {
      hitDimensions.same_threat_family = { matched: [targetFamily], weight: DIMENSION_WEIGHTS.same_threat_family };
      totalWeight += DIMENSION_WEIGHTS.same_threat_family;
    }

    // Shared claim types
    const sharedClaims = [...targetClaimTypes].filter(c => refClaimTypes.has(c));
    if (sharedClaims.length > 0) {
      hitDimensions.shared_claim_type = { matched: sharedClaims, weight: DIMENSION_WEIGHTS.shared_claim_type };
      totalWeight += DIMENSION_WEIGHTS.shared_claim_type;
    }

    // Only record matches above noise floor
    if (totalWeight > 0.08) {
      matches.push({
        artifact_id: ref.analysis_id || ref.artifact_id,
        correlation_score: Math.min(Math.round(totalWeight * 100) / 100, 1.0),
        matching_dimensions: hitDimensions,
        dimension_count: Object.keys(hitDimensions).length,
        explanation: buildExplanation(hitDimensions)
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.correlation_score - a.correlation_score);

  const campaignHint = inferCampaign(target, matches);

  return {
    correlation_id: `corr_${Date.now()}`,
    target_id: target.analysis_id || 'unknown',
    matches,
    campaign_hint: campaignHint,
    total_correlated: matches.length,
    schema_version: '1.0.0'
  };
}

/**
 * Build a human-readable explanation string for the hit dimensions.
 */
function buildExplanation(hitDimensions) {
  const parts = [];
  const d = hitDimensions;

  if (d.same_domain) parts.push(`Shared domain(s): ${d.same_domain.matched.slice(0, 2).join(', ')}`);
  if (d.same_sender) parts.push(`Same sender identity: ${d.same_sender.matched[0]}`);
  if (d.same_brand_target) parts.push(`Same brand targeted: ${d.same_brand_target.matched[0]}`);
  if (d.same_phone) parts.push(`Same phone number(s): ${d.same_phone.matched.slice(0, 2).join(', ')}`);
  if (d.same_wallet) parts.push(`Same wallet address(es) detected`);
  if (d.same_file_hash) parts.push(`Identical file hash(es) — same payload`);
  if (d.similar_url_template) parts.push(`Similar URL path structure`);
  if (d.shared_ip_block) parts.push(`URLs share same /24 IP subnet`);
  if (d.same_platform) parts.push(`Same platform/channel`);
  if (d.same_threat_family) parts.push(`Same threat family classification`);
  if (d.shared_claim_type) parts.push(`Shared claim types: ${d.shared_claim_type.matched.join(', ')}`);

  return parts.join('. ') + (parts.length ? '.' : 'No significant overlap detected.');
}

/**
 * Infer a campaign label from the target analysis and its top matches.
 */
function inferCampaign(target, matches) {
  if (matches.length === 0) return null;

  const topMatch = matches[0];
  if (topMatch.correlation_score < 0.15) return null;

  const family = getThreatFamily(target);
  const brand = getClaimedBrand(target);
  const patternMeta = family ? matchThreatFamilyToPattern(family) : null;
  const patternCode = patternMeta?.code || 'T?';

  // Build campaign label
  let label = `Campaign-${Date.now().toString(36).toUpperCase().slice(-5)}`;
  if (brand) label = `${brand.toUpperCase()}-${label}`;
  else if (family) label = `${family.replace(/_/g, '-').toUpperCase()}-${label}`;

  return {
    campaign_label: label,
    inferred_pattern: patternCode,
    related_count: matches.length,
    confidence: Math.min(topMatch.correlation_score * (1 + matches.length * 0.05), 0.95),
    top_dimensions: Object.keys(topMatch.matching_dimensions),
    description: `Likely coordinated campaign targeting ${brand || family || 'unknown'} (${matches.length} related artifact${matches.length !== 1 ? 's' : ''} detected)`
  };
}

/**
 * Pairwise correlate a list of analyses and return all campaign clusters.
 * Used for /graph/merge and /correlate batch mode.
 */
function clusterAnalyses(analyses) {
  if (!Array.isArray(analyses) || analyses.length < 2) return [];

  const clusters = [];
  const assigned = new Set();

  for (let i = 0; i < analyses.length; i++) {
    if (assigned.has(i)) continue;

    const target = analyses[i];
    const result = correlateAnalysis(target, analyses);

    const clusterMembers = [i];
    result.matches.forEach(match => {
      const idx = analyses.findIndex(a =>
        (a.analysis_id || a.artifact_id) === match.artifact_id
      );
      if (idx !== -1 && !assigned.has(idx) && match.correlation_score >= 0.15) {
        clusterMembers.push(idx);
        assigned.add(idx);
      }
    });

    assigned.add(i);

    if (clusterMembers.length > 1) {
      const family = getThreatFamily(target);
      const brand = getClaimedBrand(target);
      clusters.push({
        cluster_id: `cluster_${Date.now()}_${i}`,
        member_count: clusterMembers.length,
        member_ids: clusterMembers.map(idx => analyses[idx].analysis_id || analyses[idx].artifact_id),
        inferred_family: family,
        inferred_brand: brand,
        campaign_hint: result.campaign_hint,
        avg_correlation_score: result.matches.length > 0
          ? result.matches.reduce((s, m) => s + m.correlation_score, 0) / result.matches.length
          : 0
      });
    }
  }

  return clusters;
}

export {
  correlateAnalysis,
  clusterAnalyses,
  buildExplanation,
  inferCampaign,
  DIMENSION_WEIGHTS
};
