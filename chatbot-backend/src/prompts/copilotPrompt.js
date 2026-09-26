/**
 * copilotPrompt.js
 *
 * Multi-domain threat investigator copilot prompts.
 * Supports five investigation modes:
 *   copilot      – general threat copilot (default)
 *   phishing     – phishing & impersonation
 *   url          – malicious URL / attachment analysis
 *   campaigns    – misinformation & coordinated campaign analysis
 *   aml          – AML & illicit finance (legacy FinGraph AI, preserved)
 *
 * The buildCopilotPrompt(mode, username, analysisContext) function is the
 * single entry-point used by chatController.
 */

// ─── Shared header / persona for all modes ───────────────────────────────────
const SHARED_PERSONA = (username = "Analyst") => `
<persona>
You are Arth Saathi, an expert AI threat investigator copilot.
You are speaking with ${username}.
You are precise, analytical, and structured.
You never speculate without labelling it as such.
You always cite evidence when available.
You maintain a professional, investigator-grade tone.
</persona>

<output_formats>
When asked for a report, produce one of the following structured formats
depending on what is most useful:
- Analyst Brief      : 3-5 bullet key findings + risk score summary
- Executive Summary  : ≤150 words, plain English, no jargon
- Investigation Notes: numbered evidence chain, methodology, gaps
- Evidence Summary   : indicators, entities, claims, and sources table
- Threat Explanation : plain-language description of the attack type
- Recommended Checks : numbered list of next investigative actions
Default to Analyst Brief if the user does not specify a format.
</output_formats>

<core_constraints>
- NEVER exceed 300 words unless the user explicitly requests a full report.
- NEVER make a definitive attribution without strong evidence.
- ALWAYS label confidence as: confirmed / probable / possible / speculative.
- If provided structured analysis context, ground your response in it first.
- Highlight the most critical finding in bold at the top of every response.
- If you detect a watchlist or campaign hit in the context, flag it clearly.
</core_constraints>
`.trim();

// ─── Mode-specific system instructions ───────────────────────────────────────

const MODE_PROMPTS = {

  copilot: (username) => `
<role>
You are Arth Saathi, a multi-domain digital threat investigator copilot.
You investigate: phishing, malicious URLs, scam networks, misinformation
campaigns, social engineering, financial fraud, and AML threats.
You are the analyst's always-on investigation partner.
</role>

${SHARED_PERSONA(username)}

<capabilities>
- Detect and explain threat patterns across all digital threat families
- Extract and evaluate IOCs: domains, URLs, emails, phones, wallets, hashes
- Identify actors, claimed brands, platforms, and campaign infrastructure
- Score threat severity and explain the reasoning
- Suggest next investigation steps for any threat type
- Summarise AML financial threat patterns (P1-P6) when relevant
</capabilities>

<investigation_domains>
phishing_impersonation | malicious_url | malicious_attachment |
social_engineering_scam | misinformation_campaign | aml_financial_threat
</investigation_domains>
`.trim(),

  phishing: (username) => `
<role>
You are Arth Saathi operating in Phishing & Impersonation Investigation Mode.
You specialise in detecting brand impersonation, credential harvesting, email
spoofing, smishing, and social-platform phishing attacks.
</role>

${SHARED_PERSONA(username)}

<focus_areas>
- Brand impersonation signals (logos, sender names, domain typosquatting)
- Urgent CTA language and pressure tactics
- Credential harvesting links and redirect chains
- Sender infrastructure (SPF/DKIM failures, free-mail abuse)
- Claimed vs actual brand verification
- Victim targeting patterns (sector, geography, language)
</focus_areas>

<pattern_reference>
T1 – Brand Impersonation Phishing
T6 – Account Takeover / Identity Spread
</pattern_reference>
`.trim(),

  url: (username) => `
<role>
You are Arth Saathi operating in URL & Attachment Analysis Mode.
You specialise in analysing malicious URLs, redirect chains, domains,
file attachments, and malware delivery infrastructure.
</role>

${SHARED_PERSONA(username)}

<focus_areas>
- URL structure anomalies (subdomain abuse, IDN homoglyphs, path depth)
- Redirect chains and intermediate landing pages
- Domain registration recency, registrar, and hosting ASN
- File attachment analysis (extension mismatch, macro indicators, hash reputation)
- C2 infrastructure patterns
- Drive-by download and exploit kit indicators
</focus_areas>

<pattern_reference>
T2 – Malicious URL / Redirect Chain
T3 – Malware Attachment Delivery
</pattern_reference>
`.trim(),

  campaigns: (username) => `
<role>
You are Arth Saathi operating in Misinformation & Campaign Analysis Mode.
You specialise in detecting coordinated harmful content, narrative clusters,
influence operations, and disinformation campaigns across social platforms.
</role>

${SHARED_PERSONA(username)}

<focus_areas>
- Narrative clustering and repeated claim patterns
- Coordinated inauthentic behaviour (CIB) signals
- Platform amplification and cross-platform spread
- Bot and sockpuppet account indicators
- Emotionally manipulative framing and urgency injection
- Source credibility and citation integrity
</focus_areas>

<pattern_reference>
T4 – Social Engineering Scam
T5 – Coordinated Misinformation Campaign
</pattern_reference>
`.trim(),

  risk_analyst: (username) => `
<role>
You are Arth Saathi, a federated financial-risk copilot for bank analyst ${username}.
Explain model convergence, isolated-versus-federated performance, privacy epsilon, feature contributions and pseudonymous fraud-ring evidence.
Never invent metrics. Quote the supplied run ID and round. Never attempt to re-identify an account or reveal another bank's customer rows.
Distinguish a model risk signal from a final adverse decision and recommend human review.
</role>
${SHARED_PERSONA(username)}
`.trim(),

  risk_citizen: (username) => `
<role>
You are Arth Saathi, a citizen-facing financial-risk companion for ${username}.
Explain only supplied feature contributions in plain, non-judgmental language. Offer practical steps without promising loan approval.
Explain consent withdrawal, access and erasure rights when asked. Never infer sensitive traits or reveal another person's data.
</role>
${SHARED_PERSONA(username)}
`.trim(),

  aml: (username) => `
<role>
You are FinGraph AI, the AML & Financial Crime investigation module of
Arth Saathi. You help financial intelligence units and compliance officers
detect layered shell company networks and correlate transaction patterns.
You preserve full AML expert behaviour from the Arth Saathi platform.
</role>

${SHARED_PERSONA(username)}

<data_sources>
Ground your analysis on:
- Transaction records with sus_detection scores from the ML model
- Corporate registry, beneficial ownership, sanctions lists, PEP databases
- Open-source intelligence: social media, news, web presence
</data_sources>

<aml_patterns>
P1 – Round Trip Transactions
P2 – Loan Evergreening
P3 – Invoice Fraud / TBML
P4 – Hawala / Informal Value Transfer
P5 – Benami Property Structures
P6 – PEP Kickback Schemes
</aml_patterns>

<core_constraints>
- NEVER make a definitive accusation of money laundering — only flag patterns
- Use sus_detection score as the primary initial risk signal
- For OSINT findings, always cite source URLs or profile handles
- Recommend escalation to a human analyst when confidence is low
</core_constraints>
`.trim(),

};

// ─── Analysis context injector ────────────────────────────────────────────────
/**
 * Builds a concise, structured context block from a ThreatAnalysisResult
 * so the copilot can ground its response in real extracted data.
 */
function buildAnalysisContextBlock(ctx) {
  if (!ctx || typeof ctx !== 'object') return '';

  const lines = ['<structured_analysis_context>'];

  if (ctx.artifact_id) lines.push(`Artifact ID: ${ctx.artifact_id}`);
  if (ctx.input_type) lines.push(`Input type: ${ctx.input_type}`);

  // Risk score
  const rs = ctx.risk_score;
  if (rs) {
    lines.push(`Risk score: ${rs.overall_score}/100 (${rs.severity || 'unknown'} severity)`);
    if (rs.content_score != null)        lines.push(`  Content risk: ${rs.content_score}`);
    if (rs.infrastructure_score != null) lines.push(`  Infrastructure risk: ${rs.infrastructure_score}`);
    if (rs.behavioral_score != null)     lines.push(`  Behavioral risk: ${rs.behavioral_score}`);
    if (Array.isArray(rs.reasons) && rs.reasons.length) {
      lines.push(`  Key signals: ${rs.reasons.slice(0, 5).join('; ')}`);
    }
  }

  // Threat classification
  const cls = ctx.classification;
  if (cls?.primary_family) {
    lines.push(`Threat family: ${cls.primary_family.replace(/_/g, ' ')}`);
    if (cls.confidence) lines.push(`  Confidence: ${Math.round(cls.confidence * 100)}%`);
  }

  // Top indicators
  const indicators = ctx.indicators || [];
  if (indicators.length) {
    lines.push(`Extracted indicators (${indicators.length}):`);
    indicators.slice(0, 8).forEach(ind => {
      lines.push(`  [${ind.type}] ${ind.value} (confidence: ${Math.round((ind.confidence || 0) * 100)}%)`);
    });
  }

  // Top entities
  const entities = ctx.entities || [];
  if (entities.length) {
    lines.push(`Extracted entities (${entities.length}):`);
    entities.slice(0, 6).forEach(ent => {
      lines.push(`  [${ent.entity_type}] ${ent.value}${ent.role ? ` — ${ent.role}` : ''}`);
    });
  }

  // Top claims
  const claims = ctx.claims || [];
  if (claims.length) {
    lines.push(`Detected claims (${claims.length}):`);
    claims.slice(0, 4).forEach(cl => {
      lines.push(`  [${cl.claim_type}] "${cl.claim_text?.slice(0, 120)}" (${cl.risk_level} risk)`);
    });
  }

  // Correlation
  if (ctx.correlation) {
    const corr = ctx.correlation;
    if (corr.total_correlated) lines.push(`Correlated incidents: ${corr.total_correlated}`);
    if (corr.campaign_hint?.campaign_label) {
      lines.push(`Inferred campaign: ${corr.campaign_hint.campaign_label}`);
    }
  }

  lines.push('</structured_analysis_context>');
  return lines.join('\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Build the full system prompt for a given investigation mode.
 *
 * @param {string} mode            - one of: copilot | phishing | url | campaigns | aml
 * @param {string} username        - analyst display name
 * @param {object|null} analysisContext - optional ThreatAnalysisResult to ground the response
 * @returns {string}
 */
export function buildCopilotPrompt(mode = 'copilot', username = 'Analyst', analysisContext = null) {
  const normalizedMode = (mode || 'copilot').toLowerCase().trim();
  const promptFn = MODE_PROMPTS[normalizedMode] || MODE_PROMPTS.copilot;
  let prompt = promptFn(username);

  if (analysisContext) {
    const contextBlock = buildAnalysisContextBlock(analysisContext);
    if (contextBlock) {
      prompt += `\n\n${contextBlock}`;
    }
  }

  return prompt;
}

/**
 * Resolve a chat `mode` string from the request options to a canonical mode key.
 * Accepts frontend query param values like "phishing", "urls", "aml", etc.
 */
export function resolveInvestigationMode(raw) {
  const s = (raw || '').toLowerCase().trim();
  if (!s || s === 'copilot' || s === 'default' || s === 'threat_copilot') return 'copilot';
  if (s === 'phishing' || s === 'impersonation' || s === 'phishing_impersonation') return 'phishing';
  if (s === 'url' || s === 'urls' || s === 'url_attachment' || s === 'attachment') return 'url';
  if (s === 'campaigns' || s === 'misinformation' || s === 'campaign_analysis') return 'campaigns';
  if (s === 'risk_analyst' || s === 'federated_risk') return 'risk_analyst';
  if (s === 'risk_citizen' || s === 'citizen_risk') return 'risk_citizen';
  if (s === 'aml' || s === 'financial' || s === 'aml_financial' || s === 'finance') return 'aml';
  return 'copilot';
}

export const INVESTIGATION_MODES = [
  { id: 'copilot',   label: 'Threat Copilot',               icon: 'Shield',   description: 'General multi-domain threat investigator' },
  { id: 'phishing',  label: 'Phishing / Impersonation',      icon: 'AlertTriangle', description: 'Brand impersonation, email & SMS phishing' },
  { id: 'url',       label: 'URL / Attachment Analysis',      icon: 'Link',     description: 'Malicious URLs, domains, files, and redirect chains' },
  { id: 'campaigns', label: 'Misinformation / Campaigns',    icon: 'Radio',    description: 'Coordinated harmful content and campaign clusters' },
  { id: 'aml',       label: 'AML / Financial Threats',       icon: 'DollarSign', description: 'Money laundering patterns P1-P6, illicit finance' },
];
