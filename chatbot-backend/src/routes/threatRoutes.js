/**
 * Threat Analysis API Routes
 * 
 * Endpoints for digital threat analysis and investigation.
 */

import express from 'express';

import {
  createThreatAnalysisRequest,
  createThreatAnalysisResult,
  createThreatGraphPayload
} from '../types/threatSchema.js';

import {
  normalizeRawInput,
  extractTextFromArtifact,
  normalizeArtifactMetadata
} from '../helpers/threatNormalizer.js';

import { extractAllIOCs } from '../helpers/iocExtractor.js';
import { extractAllEntities, analyzeContentTone } from '../helpers/entityExtractor.js';
import { computeThreatScore } from '../helpers/threatScorer.js';
import { extractAndClassifyClaims, getClaimSummary } from '../helpers/claimExtractor.js';
import { buildThreatFeatures } from '../helpers/threatFeatureBuilder.js';
import { computeEnhancedThreatScore, THREAT_FAMILIES } from '../helpers/threatScorerV2.js';
import { buildThreatGraph, mergeGraphs } from '../helpers/threatGraphBuilder.js';
import { correlateAnalysis, clusterAnalyses } from '../helpers/campaignCorrelator.js';
import {
  ALL_PATTERNS, DIGITAL_THREAT_PATTERNS, AML_PATTERNS,
  matchThreatFamilyToPattern, createUnifiedClassificationResult,
  GRAPH_NODE_TYPES, GRAPH_EDGE_TYPES
} from '../types/patternRegistry.js';
import { ALL_FIXTURES, FIXTURE_BY_CODE } from '../data/digitalThreatFixtures.js';
import { generateAlertsFromAnalysis } from '../helpers/alertEngine.js';
import { recordThreatAnalyzed } from '../helpers/metricsStore.js';
import { enrichIndicators } from '../helpers/threatIntelEnricher.js';

const ML_SERVER_URL = process.env.ML_SERVER_URL || 'http://localhost:8000';

const router = express.Router();

/**
 * POST /api/threats/normalize
 * 
 * Accept raw analyst input and convert it into a ThreatArtifact / ThreatAnalysisRequest
 */
router.post('/normalize', async (req, res) => {
  try {
    const { input_type, content, metadata = {} } = req.body;
    
    if (!input_type || !content) {
      return res.status(400).json({
        error: 'Missing required fields: input_type and content'
      });
    }
    
    // Normalize the input
    const artifact = normalizeRawInput(input_type, content, metadata);
    
    // Extract text if needed
    const extraction = await extractTextFromArtifact(artifact);
    if (extraction.extracted_text) {
      artifact.extracted_text = extraction.extracted_text;
    }
    artifact.extraction_method = extraction.extraction_method;
    
    // Normalize metadata
    const normalizedArtifact = normalizeArtifactMetadata(artifact);
    
    // Create analysis request
    const analysisRequest = createThreatAnalysisRequest(normalizedArtifact, {
      extract_iocs: true,
      extract_entities: true,
      score_content: true,
      build_graph: false
    });
    
    res.json({
      success: true,
      artifact: normalizedArtifact,
      analysis_request: analysisRequest
    });
    
  } catch (error) {
    console.error('Normalization error:', error);
    res.status(500).json({
      error: 'Failed to normalize input',
      message: error.message
    });
  }
});

/**
 * POST /api/threats/extract
 * 
 * Extract indicators and entities from normalized content
 */
router.post('/extract', async (req, res) => {
  try {
    const { artifact } = req.body;
    
    if (!artifact) {
      return res.status(400).json({
        error: 'Missing artifact in request body'
      });
    }
    
    // Determine which text to analyze
    const textToAnalyze = artifact.extracted_text || artifact.raw_content || '';
    
    // Extract IOCs with enhanced normalization
    const indicators = extractAllIOCs(textToAnalyze);
    
    // Extract entities
    const entities = extractAllEntities(textToAnalyze, artifact.metadata || {});
    
    // Extract claims
    const claims = extractAndClassifyClaims(textToAnalyze);
    const claimSummary = getClaimSummary(claims);
    
    // Analyze tone
    const toneAnalysis = analyzeContentTone(textToAnalyze);
    
    // Build features
    const features = buildThreatFeatures(textToAnalyze, indicators, entities, claims);
    
    res.json({
      success: true,
      artifact_id: artifact.artifact_id,
      indicators,
      entities,
      claims,
      claim_summary: claimSummary,
      tone_analysis: toneAnalysis,
      features: {
        total_risk_signals: features.total_risk_signals,
        content_features: features.content,
        infrastructure_features: features.infrastructure,
        behavior_features: features.behavior,
        financial_features: features.financial
      },
      extraction_metadata: {
        indicator_count: indicators.length,
        entity_count: entities.length,
        claim_count: claims.length,
        text_length: textToAnalyze.length,
        risk_signals: features.total_risk_signals
      }
    });
    
  } catch (error) {
    console.error('Extraction error:', error);
    res.status(500).json({
      error: 'Failed to extract indicators and entities',
      message: error.message
    });
  }
});

/**
 * POST /api/threats/analyze
 * 
 * Run end-to-end normalized analysis and return score + evidence + extracted items
 */
router.post('/analyze', async (req, res) => {
  try {
    const { artifact, options = {} } = req.body;
    
    if (!artifact) {
      return res.status(400).json({
        error: 'Missing artifact in request body'
      });
    }
    
    // Normalize artifact if needed
    let normalizedArtifact = artifact;
    if (!artifact.metadata?.submission_time) {
      normalizedArtifact = normalizeArtifactMetadata(artifact);
    }
    
    // Extract text if needed
    if (!normalizedArtifact.extracted_text && normalizedArtifact.raw_content) {
      const extraction = await extractTextFromArtifact(normalizedArtifact);
      if (extraction.extracted_text) {
        normalizedArtifact.extracted_text = extraction.extracted_text;
      }
    }
    
    const textToAnalyze = normalizedArtifact.extracted_text || normalizedArtifact.raw_content || '';
    
    // ── LAYER 1: Heuristic extraction (existing) ──────────────────────────
    const indicators = extractAllIOCs(textToAnalyze);
    const entities = extractAllEntities(textToAnalyze, normalizedArtifact.metadata || {});
    const claims = extractAndClassifyClaims(textToAnalyze);
    const scoringResult = computeEnhancedThreatScore(textToAnalyze, indicators, entities, claims);
    const toneAnalysis = analyzeContentTone(textToAnalyze);
    const claimSummary = getClaimSummary(claims);
    
    // ── LAYER 2: ML Model Classification (NEW — parallel) ─────────────────
    let mlClassification = null;
    const mlPromise = (async () => {
      try {
        const mlResponse = await fetch(`${ML_SERVER_URL}/threat/classify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: textToAnalyze,
            input_type: normalizedArtifact.input_type || 'raw_text',
          }),
          signal: AbortSignal.timeout(10000), // 10s timeout
        });
        if (mlResponse.ok) {
          mlClassification = await mlResponse.json();
        }
      } catch (err) {
        console.error('[ThreatAnalysis] ML server error:', err.message);
      }
    })();
    
    // ── LAYER 3: IOC Enrichment (NEW — parallel) ──────────────────────────
    let iocEnrichment = { enriched: [], summary: { total: 0, malicious: 0, suspicious: 0, clean: 0, unknown: 0 } };
    const enrichPromise = (async () => {
      try {
        iocEnrichment = await enrichIndicators(indicators);
      } catch (err) {
        console.error('[ThreatAnalysis] Enrichment error:', err.message);
      }
    })();
    
    // Wait for both ML and enrichment to complete
    await Promise.all([mlPromise, enrichPromise]);
    
    // ── FUSION: Weighted risk scoring ──────────────────────────────────────
    const heuristicScore = scoringResult.risk_score || 0;
    const mlScore = mlClassification?.risk_score || 0;
    const intelScore = iocEnrichment.summary.malicious > 0 ? 90 :
                       iocEnrichment.summary.suspicious > 0 ? 50 : 10;
    
    // Weighted fusion: 30% heuristic + 50% ML + 20% intel
    const fusedRiskScore = Math.round(
      (heuristicScore * 0.3) + (mlScore * 0.5) + (intelScore * 0.2)
    );
    
    // Build result
    const analysisResult = createThreatAnalysisResult(
      normalizedArtifact.artifact_id,
      normalizedArtifact,
      {
        indicators: iocEnrichment.enriched.length > 0 ? iocEnrichment.enriched : indicators,
        entities,
        risk_score: fusedRiskScore,
        evidence: scoringResult.evidence
      }
    );
    
    // Add enhanced analysis data
    analysisResult.tone_analysis = toneAnalysis;
    analysisResult.claims = claims;
    analysisResult.claim_summary = claimSummary;
    analysisResult.features = scoringResult.features;
    analysisResult.classification = scoringResult.classification;
    analysisResult.total_risk_signals = scoringResult.total_risk_signals;
    
    // ── NEW: ML Classification + Enrichment results ──────────────────────
    analysisResult.ml_classification = mlClassification;
    analysisResult.ioc_enrichment = iocEnrichment;
    analysisResult.scoring_breakdown = {
      heuristic_score: heuristicScore,
      heuristic_weight: 0.3,
      ml_score: mlScore,
      ml_weight: 0.5,
      intel_score: intelScore,
      intel_weight: 0.2,
      fused_score: fusedRiskScore,
    };
    analysisResult.risk_score = fusedRiskScore;

    // Auto-generate alerts (fire-and-forget, never block the response)
    const generatedAlerts = generateAlertsFromAnalysis(analysisResult);

    // Record metrics (fire-and-forget)
    try {
      recordThreatAnalyzed(analysisResult);
    } catch (e) {
      console.error('Metrics error:', e);
    }

    res.json({
      success: true,
      analysis: analysisResult,
      alerts_generated: generatedAlerts.length,
      alert_ids: generatedAlerts.map(a => a.alert_id)
    });
    
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze threat',
      message: error.message
    });
  }
});

/**
 * POST /api/threats/graph
 *
 * Build a rich threat investigation graph from one analysis result.
 * Uses the expanded graph builder supporting all digital-threat node/edge types.
 */
router.post('/graph', async (req, res) => {
  try {
    const { analysis, campaign_id, campaign_label } = req.body;

    if (!analysis) {
      return res.status(400).json({ error: 'Missing analysis in request body' });
    }

    const graph = buildThreatGraph(analysis, { campaign_id, campaign_label });

    // Attach unified pattern classification to response
    const threatFamily = analysis.classification?.primary_family;
    const patternMeta = threatFamily ? matchThreatFamilyToPattern(threatFamily) : null;

    res.json({
      success: true,
      graph,
      pattern: patternMeta ? {
        code: patternMeta.code,
        label: patternMeta.label,
        name: patternMeta.name,
        family: patternMeta.family,
        severity: patternMeta.severity
      } : null
    });

  } catch (error) {
    console.error('Graph generation error:', error);
    res.status(500).json({ error: 'Failed to generate graph', message: error.message });
  }
});

/**
 * POST /api/threats/correlate
 *
 * Compare one analysis against a list of reference analyses.
 * Returns correlation score, matching dimensions, and campaign hints.
 */
router.post('/correlate', async (req, res) => {
  try {
    const { target, references } = req.body;

    if (!target) {
      return res.status(400).json({ error: 'Missing target analysis' });
    }

    // If no references provided, use the T1-T6 fixtures as the reference set
    const refs = Array.isArray(references) && references.length > 0
      ? references
      : ALL_FIXTURES;

    const result = correlateAnalysis(target, refs);

    res.json({
      success: true,
      correlation: result
    });

  } catch (error) {
    console.error('Correlation error:', error);
    res.status(500).json({ error: 'Failed to correlate analysis', message: error.message });
  }
});

/**
 * POST /api/threats/graph/merge
 *
 * Merge multiple analysis results into one unified graph.
 * Optionally adds a campaign hub node connecting all artifact nodes.
 */
router.post('/graph/merge', async (req, res) => {
  try {
    const { analyses, campaign_id, campaign_label } = req.body;

    if (!Array.isArray(analyses) || analyses.length < 2) {
      return res.status(400).json({ error: 'Provide at least 2 analyses to merge' });
    }

    // Build individual graphs first
    const graphs = analyses.map(a => buildThreatGraph(a, {}));

    // Cluster correlation
    const clusters = clusterAnalyses(analyses);

    // Merge into one graph
    const mergedGraph = mergeGraphs(graphs, campaign_id ? { campaign_id, campaign_label } : null);

    res.json({
      success: true,
      graph: mergedGraph,
      clusters
    });

  } catch (error) {
    console.error('Merge error:', error);
    res.status(500).json({ error: 'Failed to merge graphs', message: error.message });
  }
});

/**
 * GET /api/threats/patterns
 *
 * Return the full pattern registry (P1-P6 AML + T1-T6 digital threat).
 */
router.get('/patterns', (req, res) => {
  res.json({
    success: true,
    aml_patterns: AML_PATTERNS.map(p => ({
      code: p.code,
      label: p.label,
      name: p.name,
      family: p.family,
      description: p.description,
      severity: p.severity,
      key_features: p.key_features
    })),
    digital_threat_patterns: DIGITAL_THREAT_PATTERNS.map(p => ({
      code: p.code,
      label: p.label,
      name: p.name,
      family: p.family,
      description: p.description,
      severity: p.severity,
      key_features: p.key_features,
      threat_family_match: p.threat_family_match
    })),
    total: ALL_PATTERNS.length
  });
});

/**
 * GET /api/threats/fixtures
 *
 * Return all T1-T6 synthetic sample fixtures (for demos and correlation testing).
 */
router.get('/fixtures', (req, res) => {
  res.json({
    success: true,
    fixtures: ALL_FIXTURES.map(f => ({
      analysis_id: f.analysis_id,
      pattern_code: f.pattern_code,
      input_type: f.artifact_summary?.input_type,
      severity: f.risk_score?.severity,
      overall_score: f.risk_score?.overall_score,
      threat_family: f.classification?.primary_family,
      indicator_count: f.indicators?.length,
      claim_count: f.claims?.length
    })),
    total: ALL_FIXTURES.length
  });
});

/**
 * GET /api/threats/fixtures/:code
 *
 * Return one T-pattern fixture by code (T1..T6).
 */
router.get('/fixtures/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase();
  const fixture = FIXTURE_BY_CODE[code];
  if (!fixture) {
    return res.status(404).json({ error: `No fixture found for code: ${code}` });
  }
  res.json({ success: true, fixture });
});

/**
 * GET /api/threats/health
 *
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'threat-analysis',
    version: '2.0.0',
    endpoints: [
      'POST /normalize',
      'POST /extract',
      'POST /analyze',
      'POST /graph',
      'POST /correlate',
      'POST /graph/merge',
      'GET  /patterns',
      'GET  /fixtures',
      'GET  /fixtures/:code',
      'GET  /health'
    ],
    pattern_count: ALL_PATTERNS.length,
    fixture_count: ALL_FIXTURES.length
  });
});

export default router;
