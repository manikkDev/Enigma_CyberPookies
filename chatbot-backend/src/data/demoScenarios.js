/**
 * demoScenarios.js
 *
 * Curated demo scenarios.
 * Each scenario is designed to showcase a different threat detection capability.
 */

export const DEMO_SCENARIOS = {
  phishing_paypal: {
    id: 'demo_phishing_1',
    title: 'PayPal Account Verification Phishing',
    description: 'Classic phishing email impersonating PayPal with urgent CTA and typosquatted domain',
    input_type: 'email_text',
    category: 'phishing',
    content: `From: PayPal Security <security@paypa1-verify.com>
Subject: Urgent: Verify Your Account Within 24 Hours

Dear Valued Customer,

We have detected unusual activity on your PayPal account. For your security, we have temporarily limited your account access.

To restore full access, please verify your identity immediately:

https://paypa1-verify.com/account/restore?id=8f4a2b9c

⚠️ WARNING: Failure to verify within 24 hours will result in permanent account suspension.

Required Actions:
• Confirm your identity
• Update payment information
• Review recent transactions

Click here to begin verification process.

Best regards,
PayPal Security Team

This is an automated message. Please do not reply to this email.`,
    expected_outputs: {
      threat_family: 'phishing',
      severity: 'high',
      indicators: ['paypa1-verify.com', 'security@paypa1-verify.com'],
      entities: ['PayPal'],
      claims: ['account_suspension', 'urgent_action_required'],
    },
  },

  smishing_delivery: {
    id: 'demo_smishing_1',
    title: 'Fake Package Delivery SMS',
    description: 'Smishing attack claiming failed delivery with malicious tracking link',
    input_type: 'sms_text',
    category: 'phishing',
    content: `FedEx: Your package delivery failed. Reschedule & track here: http://fedex-tracking[.]xyz/track?id=FDX9872461 Reply STOP to unsubscribe`,
    expected_outputs: {
      threat_family: 'phishing',
      severity: 'high',
      indicators: ['fedex-tracking.xyz'],
      entities: ['FedEx'],
    },
  },

  malicious_url: {
    id: 'demo_url_1',
    title: 'Typosquatted Login Portal',
    description: 'Malicious URL mimicking Microsoft login page',
    input_type: 'url',
    category: 'malicious_url',
    content: 'https://microso ft-login.com/oauth/authorize?client_id=a8b2c4d&redirect=https://attacker-infra.net/harvest',
    expected_outputs: {
      threat_family: 'malicious_url',
      severity: 'critical',
      indicators: ['microso ft-login.com', 'attacker-infra.net'],
    },
  },

  misinformation_health: {
    id: 'demo_misinfo_1',
    title: 'Health Misinformation Campaign',
    description: 'Coordinated misinformation about medical treatment',
    input_type: 'social_post',
    category: 'misinformation',
    content: `🚨 BREAKING: Mainstream media HIDING the truth! 

New study PROVES that [REDACTED CLAIM] - but Big Pharma doesn't want you to know!

💊 They profit from keeping you sick!
📰 Mainstream news refuses to cover this!
🔬 Independent researchers SILENCED!

Share before this gets deleted! #TruthRevealed #WakeUp #BigPharmaLies

👉 Read full report: alt-health-truth[.]info/expose`,
    expected_outputs: {
      threat_family: 'misinformation',
      severity: 'medium',
      claims: ['conspiracy_theory', 'medical_misinformation', 'call_to_amplify'],
    },
  },

  scam_crypto: {
    id: 'demo_scam_1',
    title: 'Cryptocurrency Investment Scam',
    description: 'Too-good-to-be-true crypto investment scheme with fake testimonials',
    input_type: 'social_post',
    category: 'social_engineering_scam',
    content: `💰 I turned $500 into $12,000 in just 2 WEEKS! 

No experience needed! My mentor Sarah helped me unlock the CRYPTO SECRET that banks don't want you to know.

✅ Guaranteed daily returns
✅ No risk - 100% money back
✅ Join 10,000+ successful investors

Limited spots available! DM me "READY" to get started.

Investment Fund: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2

⚠️ Offer expires in 48 hours!`,
    expected_outputs: {
      threat_family: 'social_engineering_scam',
      severity: 'high',
      indicators: ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2'],
      claims: ['too_good_to_be_true', 'urgency', 'guaranteed_returns'],
    },
  },

  aml_loan_evergreen: {
    id: 'demo_aml_1',
    title: 'Loan Evergreening Pattern (P2)',
    description: 'Suspicious loan repayment cycle indicating potential money laundering',
    input_type: 'raw_text',
    category: 'aml_financial_threat',
    content: `Transaction Network Analysis:

Entity A (Corp XYZ Ltd) → Loan $500,000 → Entity B (Offshore Holdings Inc)
Entity B → Repayment $520,000 → Entity A [7 days later]
Entity A → New Loan $550,000 → Entity B [1 day later]
Entity B → Repayment $575,000 → Entity A [7 days later]
Entity A → New Loan $600,000 → Entity B [1 day later]

Pattern: Circular loan structure with increasing principal amounts
Red Flags: Same parties, short cycles, offshore jurisdiction, no business rationale
Risk Score: 0.89
Pattern: P2 - Loan Evergreening`,
    expected_outputs: {
      threat_family: 'aml_financial_threat',
      severity: 'critical',
      pattern: 'P2',
      entities: ['Corp XYZ Ltd', 'Offshore Holdings Inc'],
    },
  },
};

/**
 * Get scenario by ID
 */
export function getDemoScenario(id) {
  return Object.values(DEMO_SCENARIOS).find(s => s.id === id);
}

/**
 * Get scenarios by category
 */
export function getDemoScenariosByCategory(category) {
  return Object.values(DEMO_SCENARIOS).filter(s => s.category === category);
}

/**
 * Get all scenario summaries for display
 */
export function getAllDemoScenarioSummaries() {
  return Object.values(DEMO_SCENARIOS).map(s => ({
    id: s.id,
    title: s.title,
    description: s.description,
    category: s.category,
    input_type: s.input_type,
  }));
}

export default DEMO_SCENARIOS;
