/**
 * Threat Graph Builder - Phase 6
 *
 * Converts a ThreatAnalysisResult into a rich frontend-ready graph payload.
 * Supports all digital-threat node types and relationship types defined in
 * patternRegistry.js. Preserves compatibility with AML graph shape.
 */

import { GRAPH_NODE_TYPES, GRAPH_EDGE_TYPES, getPatternByCode } from '../types/patternRegistry.js';

// ─── Node color hints for the frontend ────────────────────────────
const NODE_COLOR_CLASS = {
  [GRAPH_NODE_TYPES.ARTIFACT]:      'node-artifact',
  [GRAPH_NODE_TYPES.SENDER]:        'node-sender',
  [GRAPH_NODE_TYPES.RECIPIENT]:     'node-recipient',
  [GRAPH_NODE_TYPES.CLAIMED_BRAND]: 'node-brand',
  [GRAPH_NODE_TYPES.ORGANIZATION]:  'node-org',
  [GRAPH_NODE_TYPES.URL]:           'node-url',
  [GRAPH_NODE_TYPES.DOMAIN]:        'node-domain',
  [GRAPH_NODE_TYPES.ATTACHMENT]:    'node-attachment',
  [GRAPH_NODE_TYPES.FILE_HASH]:     'node-hash',
  [GRAPH_NODE_TYPES.PHONE]:         'node-phone',
  [GRAPH_NODE_TYPES.EMAIL]:         'node-email',
  [GRAPH_NODE_TYPES.WALLET]:        'node-wallet',
  [GRAPH_NODE_TYPES.SOCIAL_ACCOUNT]:'node-social',
  [GRAPH_NODE_TYPES.PLATFORM]:      'node-platform',
  [GRAPH_NODE_TYPES.CAMPAIGN]:      'node-campaign',
  [GRAPH_NODE_TYPES.EVIDENCE]:      'node-evidence',
  [GRAPH_NODE_TYPES.CLAIM]:         'node-claim',
  [GRAPH_NODE_TYPES.IP]:            'node-ip',
  // AML compat
  [GRAPH_NODE_TYPES.PERSON]:        'node-person',
  [GRAPH_NODE_TYPES.COMPANY]:       'node-company',
  [GRAPH_NODE_TYPES.BANK_ACCOUNT]:  'node-bank',
  [GRAPH_NODE_TYPES.TRANSACTION]:   'node-transaction',
  [GRAPH_NODE_TYPES.SHELL]:         'node-shell',
};

// ─── Risk-based node size hint ─────────────────────────────────────
function nodeSize(type, properties = {}) {
  const base = {
    [GRAPH_NODE_TYPES.ARTIFACT]: 18,
    [GRAPH_NODE_TYPES.CAMPAIGN]: 20,
    [GRAPH_NODE_TYPES.CLAIMED_BRAND]: 16,
    [GRAPH_NODE_TYPES.SENDER]: 14,
    [GRAPH_NODE_TYPES.DOMAIN]: 12,
    [GRAPH_NODE_TYPES.URL]: 10,
    [GRAPH_NODE_TYPES.EMAIL]: 10,
    [GRAPH_NODE_TYPES.WALLET]: 12,
    [GRAPH_NODE_TYPES.PHONE]: 10,
  };
  let size = base[type] || 10;
  if (properties.confidence && properties.confidence > 0.9) size += 2;
  return size;
}

// ─── Stable node ID generator ─────────────────────────────────────
function makeNodeId(type, value) {
  const safe = String(value || '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
  return `${type}_${safe}`;
}

// ─── Deduplication map ────────────────────────────────────────────
function addNode(nodeMap, id, type, label, properties = {}) {
  if (nodeMap.has(id)) return id;
  nodeMap.set(id, {
    id,
    type,
    label: String(label || '').slice(0, 80),
    color_class: NODE_COLOR_CLASS[type] || 'node-default',
    size: nodeSize(type, properties),
    properties
  });
  return id;
}

function addEdge(edgeList, source, target, type, properties = {}) {
  edgeList.push({ source, target, type, properties });
}

// ─── Main builder ─────────────────────────────────────────────────

/**
 * Build a full graph payload from a ThreatAnalysisResult.
 * @param {object} analysis - ThreatAnalysisResult
 * @param {object} options
 * @param {string} [options.campaign_id] - optional campaign node to attach to
 * @returns {ThreatGraphPayload}
 */
function buildThreatGraph(analysis, options = {}) {
  const nodeMap = new Map();
  const edges = [];

  const artifactId = analysis.artifact_id || analysis.analysis_id || `artifact_${Date.now()}`;
  const inputType = analysis.artifact_summary?.input_type || 'raw_text';
  const metadata = analysis.artifact_summary?.metadata || {};
  const riskScore = analysis.risk_score?.overall_score || 0;
  const severity = analysis.risk_score?.severity || 'unknown';
  const classFamily = analysis.classification?.primary_family || null;

  // ── Root artifact node ──────────────────────────────────────────
  const artifactNodeId = makeNodeId('artifact', artifactId);
  addNode(nodeMap, artifactNodeId, GRAPH_NODE_TYPES.ARTIFACT, inputType, {
    artifact_id: artifactId,
    input_type: inputType,
    risk_score: riskScore,
    severity,
    submission_time: metadata.submission_time
  });

  // ── Campaign node (if correlation provided) ─────────────────────
  if (options.campaign_id) {
    const campaignNodeId = makeNodeId('campaign', options.campaign_id);
    addNode(nodeMap, campaignNodeId, GRAPH_NODE_TYPES.CAMPAIGN, options.campaign_label || 'Inferred Campaign', {
      campaign_id: options.campaign_id,
      inferred_family: classFamily
    });
    addEdge(edges, artifactNodeId, campaignNodeId, GRAPH_EDGE_TYPES.PART_OF_CAMPAIGN, {});
  }

  // ── Sender node ─────────────────────────────────────────────────
  const claimedSender = metadata.claimed_sender;
  if (claimedSender) {
    const senderId = makeNodeId('sender', claimedSender);
    addNode(nodeMap, senderId, GRAPH_NODE_TYPES.SENDER, claimedSender, { value: claimedSender });
    addEdge(edges, senderId, artifactNodeId, GRAPH_EDGE_TYPES.SENT, {});
  }

  // ── Claimed brand / impersonation target ────────────────────────
  const targetBrand = metadata.target_brand;
  if (targetBrand) {
    const brandId = makeNodeId('claimed_brand', targetBrand);
    addNode(nodeMap, brandId, GRAPH_NODE_TYPES.CLAIMED_BRAND, targetBrand, {
      brand: targetBrand,
      impersonation_target: true
    });
    addEdge(edges, artifactNodeId, brandId, GRAPH_EDGE_TYPES.IMPERSONATES, {
      confidence: 0.85
    });
  }

  // ── Platform node ───────────────────────────────────────────────
  const platform = metadata.source_platform;
  if (platform) {
    const platformId = makeNodeId('platform', platform);
    addNode(nodeMap, platformId, GRAPH_NODE_TYPES.PLATFORM, platform, { platform });
    addEdge(edges, artifactNodeId, platformId, GRAPH_EDGE_TYPES.USES, {});
  }

  // ── Indicators ──────────────────────────────────────────────────
  const indicators = analysis.indicators || [];
  const urlNodes = new Map();   // value → nodeId
  const domainNodes = new Map();

  for (const indicator of indicators) {
    const { type, value, normalized_value, confidence, attributes } = indicator;
    const displayVal = normalized_value || value || '';
    if (!displayVal) continue;

    let nodeType, edgeType;

    switch (type) {
      case 'url':
        nodeType = GRAPH_NODE_TYPES.URL;
        edgeType = GRAPH_EDGE_TYPES.LINKS_TO;
        break;
      case 'domain':
        nodeType = GRAPH_NODE_TYPES.DOMAIN;
        edgeType = GRAPH_EDGE_TYPES.HOSTED_ON;
        break;
      case 'email':
        nodeType = GRAPH_NODE_TYPES.EMAIL;
        edgeType = GRAPH_EDGE_TYPES.MENTIONS;
        break;
      case 'phone':
        nodeType = GRAPH_NODE_TYPES.PHONE;
        edgeType = GRAPH_EDGE_TYPES.MENTIONS;
        break;
      case 'ip':
        nodeType = GRAPH_NODE_TYPES.IP;
        edgeType = GRAPH_EDGE_TYPES.HOSTED_ON;
        break;
      case 'wallet':
        nodeType = GRAPH_NODE_TYPES.WALLET;
        edgeType = GRAPH_EDGE_TYPES.TRANSFERS_TO;
        break;
      case 'hash':
        nodeType = GRAPH_NODE_TYPES.FILE_HASH;
        edgeType = GRAPH_EDGE_TYPES.ATTACHED;
        break;
      case 'username':
        nodeType = GRAPH_NODE_TYPES.SOCIAL_ACCOUNT;
        edgeType = GRAPH_EDGE_TYPES.MENTIONS;
        break;
      case 'bank_account':
        nodeType = GRAPH_NODE_TYPES.BANK_ACCOUNT;
        edgeType = GRAPH_EDGE_TYPES.TRANSFERS_TO;
        break;
      default:
        nodeType = GRAPH_NODE_TYPES.EVIDENCE;
        edgeType = GRAPH_EDGE_TYPES.EXTRACTED_FROM;
    }

    const nodeId = makeNodeId(type, displayVal);
    addNode(nodeMap, nodeId, nodeType, displayVal, {
      value: displayVal,
      confidence: confidence || 1,
      ...(attributes || {})
    });
    addEdge(edges, artifactNodeId, nodeId, edgeType, {
      extraction_method: indicator.extraction_method || 'regex',
      confidence: confidence || 1
    });

    if (type === 'url') urlNodes.set(displayVal, nodeId);
    if (type === 'domain') domainNodes.set(displayVal, nodeId);
  }

  // ── URL → Domain edges ──────────────────────────────────────────
  for (const [urlVal, urlNodeId] of urlNodes.entries()) {
    try {
      const hostname = new URL(urlVal).hostname.toLowerCase();
      if (domainNodes.has(hostname)) {
        addEdge(edges, urlNodeId, domainNodes.get(hostname), GRAPH_EDGE_TYPES.HOSTED_ON, {
          auto_inferred: true
        });
      }
    } catch { /* skip invalid URLs */ }
  }

  // ── Entity nodes ────────────────────────────────────────────────
  const entities = analysis.entities || [];
  for (const entity of entities) {
    const { entity_type, value, role, attributes } = entity;
    if (!value) continue;

    let nodeType;
    let edgeType = GRAPH_EDGE_TYPES.MENTIONS;

    switch (entity_type) {
      case 'brand':
        nodeType = GRAPH_NODE_TYPES.CLAIMED_BRAND;
        edgeType = GRAPH_EDGE_TYPES.IMPERSONATES;
        break;
      case 'sender':
      case 'sender_identity':
        nodeType = GRAPH_NODE_TYPES.SENDER;
        edgeType = GRAPH_EDGE_TYPES.SENT;
        break;
      case 'victim':
      case 'victim_persona':
        nodeType = GRAPH_NODE_TYPES.RECIPIENT;
        edgeType = GRAPH_EDGE_TYPES.TARGETS;
        break;
      case 'organization':
        nodeType = GRAPH_NODE_TYPES.ORGANIZATION;
        break;
      case 'platform':
        nodeType = GRAPH_NODE_TYPES.PLATFORM;
        edgeType = GRAPH_EDGE_TYPES.USES;
        break;
      case 'tactic':
        nodeType = GRAPH_NODE_TYPES.EVIDENCE;
        edgeType = GRAPH_EDGE_TYPES.EXTRACTED_FROM;
        break;
      default:
        nodeType = GRAPH_NODE_TYPES.EVIDENCE;
    }

    const nodeId = makeNodeId(entity_type, value);
    if (!nodeMap.has(nodeId)) {
      addNode(nodeMap, nodeId, nodeType, value, {
        entity_type,
        role: role || entity_type,
        ...(attributes || {})
      });
      addEdge(edges, artifactNodeId, nodeId, edgeType, { role });
    }
  }

  // ── Claim nodes (top 3 only to keep graph readable) ─────────────
  const claims = analysis.claims || [];
  claims.slice(0, 3).forEach((claim, idx) => {
    const claimId = `claim_${artifactId}_${idx}`;
    addNode(nodeMap, claimId, GRAPH_NODE_TYPES.CLAIM,
      claim.claim_text?.slice(0, 60) || 'Claim',
      {
        claim_type: claim.claim_type,
        risk_level: claim.risk_level,
        confidence: claim.confidence
      }
    );
    addEdge(edges, artifactNodeId, claimId, GRAPH_EDGE_TYPES.MENTIONS, {
      claim_type: claim.claim_type
    });
  });

  // ── Evidence nodes (top 4) ──────────────────────────────────────
  const evidence = analysis.evidence || [];
  evidence.slice(0, 4).forEach((ev, idx) => {
    const evId = ev.evidence_id || `evidence_${artifactId}_${idx}`;
    addNode(nodeMap, evId, GRAPH_NODE_TYPES.EVIDENCE,
      ev.description?.slice(0, 60) || `Evidence ${idx + 1}`,
      {
        evidence_type: ev.evidence_type,
        confidence: ev.confidence
      }
    );
    addEdge(edges, artifactNodeId, evId, GRAPH_EDGE_TYPES.EXTRACTED_FROM, {
      evidence_type: ev.evidence_type
    });
  });

  const nodes = Array.from(nodeMap.values());

  return {
    graph_id: `graph_${artifactId}`,
    analysis_id: analysis.analysis_id,
    artifact_id: artifactId,
    nodes,
    edges,
    metadata: {
      node_count: nodes.length,
      edge_count: edges.length,
      risk_score: riskScore,
      severity,
      threat_family: classFamily,
      schema_version: '1.0.0',
      generated_at: new Date().toISOString()
    }
  };
}

/**
 * Merge multiple graph payloads into a single unified graph.
 * Deduplicates nodes by id, union-merges edges.
 * Optionally adds a shared campaign node bridging the artifacts.
 *
 * @param {object[]} graphs - Array of ThreatGraphPayload objects
 * @param {object} [campaignMeta] - Optional { campaign_id, campaign_label }
 * @returns {ThreatGraphPayload}
 */
function mergeGraphs(graphs, campaignMeta = null) {
  const nodeMap = new Map();
  const edgeSignatures = new Set();
  const mergedEdges = [];

  for (const g of graphs) {
    for (const node of (g.nodes || [])) {
      if (!nodeMap.has(node.id)) nodeMap.set(node.id, node);
    }
    for (const edge of (g.edges || [])) {
      const sig = `${edge.source}|${edge.type}|${edge.target}`;
      if (!edgeSignatures.has(sig)) {
        edgeSignatures.add(sig);
        mergedEdges.push(edge);
      }
    }
  }

  // Add campaign hub node if requested
  if (campaignMeta?.campaign_id) {
    const campaignNodeId = makeNodeId('campaign', campaignMeta.campaign_id);
    if (!nodeMap.has(campaignNodeId)) {
      nodeMap.set(campaignNodeId, {
        id: campaignNodeId,
        type: GRAPH_NODE_TYPES.CAMPAIGN,
        label: campaignMeta.campaign_label || 'Merged Campaign',
        color_class: NODE_COLOR_CLASS[GRAPH_NODE_TYPES.CAMPAIGN],
        size: 22,
        properties: { campaign_id: campaignMeta.campaign_id }
      });
    }

    // Link each artifact node to the campaign
    for (const g of graphs) {
      const artifactNodes = (g.nodes || []).filter(n => n.type === GRAPH_NODE_TYPES.ARTIFACT);
      for (const an of artifactNodes) {
        const sig = `${an.id}|${GRAPH_EDGE_TYPES.PART_OF_CAMPAIGN}|${campaignNodeId}`;
        if (!edgeSignatures.has(sig)) {
          edgeSignatures.add(sig);
          mergedEdges.push({
            source: an.id,
            target: campaignNodeId,
            type: GRAPH_EDGE_TYPES.PART_OF_CAMPAIGN,
            properties: {}
          });
        }
      }
    }
  }

  const nodes = Array.from(nodeMap.values());

  return {
    graph_id: `merged_${Date.now()}`,
    nodes,
    edges: mergedEdges,
    metadata: {
      node_count: nodes.length,
      edge_count: mergedEdges.length,
      merged_from: graphs.map(g => g.graph_id).filter(Boolean),
      campaign_id: campaignMeta?.campaign_id || null,
      schema_version: '1.0.0',
      generated_at: new Date().toISOString()
    }
  };
}

export {
  buildThreatGraph,
  mergeGraphs,
  NODE_COLOR_CLASS,
  makeNodeId
};
