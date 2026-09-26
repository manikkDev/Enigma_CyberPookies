"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Shield, FileText, Mail, MessageSquare,
  AlertTriangle, GitMerge, Network, Briefcase,
  Target, Globe, Smartphone, Scan,
  BarChart3, Activity, Zap, Layers,
  CheckCircle, Copy, Check, Radio, Wifi, WifiOff,
  ChevronDown, ChevronRight, X, Send, Eye, Brain,
  ShieldAlert, ShieldCheck, ShieldX, Play, Lock,
  Download, Trash2, Clock, Search, Filter,
  History, Settings, Inbox, RotateCcw, ExternalLink,
  FileDown, ChevronLeft, MoreVertical, Bell, Archive, LogOut, Info
} from 'lucide-react';
import { SERVER_URL_1 } from '@/utils/commonHelper';
import ENDPOINTS from '@/config/endpoints';
import ThreatGraphViewer from '@/components/ThreatGraphViewer';
import PatternResult from '@/components/PatternResult';

/* ─── Constants ────────────────────────────────────────────────────────────── */

const INPUT_MODES = [
  { id: 'email_text', label: 'Email', icon: Mail, desc: 'Phishing, BEC, spoofed headers', color: '#e54b4f' },
  { id: 'sms_text', label: 'SMS', icon: Smartphone, desc: 'Text message scams', color: '#f59e0b' },
  { id: 'social_post', label: 'Social', icon: MessageSquare, desc: 'Misinformation, scams', color: '#8c5cff' },
  { id: 'url', label: 'URL', icon: Globe, desc: 'Malicious links', color: '#ff9f6b' },
  { id: 'raw_text', label: 'Raw Text', icon: FileText, desc: 'Any content', color: '#6aa9ff' },
];

const SIDEBAR_ITEMS = [
  { id: 'analyze', label: 'Analyze Threat', icon: Scan, desc: 'Manual threat analysis' },
  { id: 'monitor', label: 'Email Monitor', icon: Radio, desc: 'Real-time email feed' },
  { id: 'smsMonitor', label: 'SMS Monitor', icon: Smartphone, desc: 'Real-time SMS feed' },
  { id: 'socialMonitor', label: 'Social Monitor', icon: MessageSquare, desc: 'Real-time social feed' },
  { id: 'history', label: 'History & Logs', icon: History, desc: 'Past analyses' },
];

const DEMO_SCENARIOS = [
  { id: 'phishing', label: 'Phishing Email', icon: Mail, color: '#e54b4f', mode: 'email_text',
    content: `From: PayPal Security <security@paypa1-verify.com>\nSubject: Urgent: Verify Your Account Within 24 Hours\n\nDear Valued Customer,\n\nWe have detected unusual activity on your PayPal account. For your security, we have temporarily limited your account access.\n\nTo restore full access, please verify your identity immediately:\n\nhttps://paypa1-verify.com/account/restore?id=8f4a2b9c\n\nWARNING: Failure to verify within 24 hours will result in permanent account suspension.\n\nPlease update your password and billing information.\n\nPayPal Security Team` },
  { id: 'smishing', label: 'Smishing SMS', icon: Smartphone, color: '#f59e0b', mode: 'sms_text',
    content: `FedEx: Your package delivery failed. Reschedule & track here: http://bit.ly/3xK9mw2 Reply STOP to unsubscribe` },
  { id: 'scam', label: 'Crypto Scam', icon: Briefcase, color: '#8c5cff', mode: 'social_post',
    content: `EXCLUSIVE CRYPTO OPPORTUNITY\n\nOur AI trading bot guarantees 350% returns in 14 days.\nMinimum investment: $500\nDeposit to: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2\n\nJoin 15,000+ investors! Limited spots remaining!` },
  { id: 'misinfo', label: 'Misinformation', icon: AlertTriangle, color: '#6aa9ff', mode: 'social_post',
    content: `BREAKING: Mainstream media HIDING the truth! New study PROVES vaccines cause autism - but Big Pharma doesn't want you to know! Share before this gets deleted!` },
  { id: 'malurl', label: 'Malicious URL', icon: Globe, color: '#ff9f6b', mode: 'url',
    content: `https://micros0ft-login.com/oauth/authorize?client_id=a8b2c4d&redirect=https://attacker-infra.net/harvest` },
  { id: 'aml', label: 'AML Pattern', icon: Layers, color: '#34b27b', mode: 'raw_text',
    content: `Transaction Network Analysis:\n\nEntity A (Corp XYZ Ltd) -> Loan $500,000 -> Entity B (Offshore Holdings Inc)\nEntity B -> Repayment $520,000 -> Entity A [7 days later]\nEntity A -> New Loan $550,000 -> Entity B [1 day later]\n\nPattern: Circular loan structure with increasing principal amounts\nRed Flags: Same parties, short cycles, offshore jurisdiction` },
];

const RESULT_TABS = [
  { id: 'verdict', label: 'AI Verdict', icon: Brain },
  { id: 'indicators', label: 'IOC Intel', icon: Target },
  { id: 'scoring', label: 'Risk Breakdown', icon: BarChart3 },
  { id: 'graph', label: 'Threat Graph', icon: Network },
  { id: 'pattern', label: 'Pattern', icon: Layers },
  { id: 'correlation', label: 'Correlation', icon: GitMerge },
];

/* ─── Inline Styles for Animations ─────────────────────────────────────────── */

const KEYFRAMES = `
@keyframes slideInRight { from { opacity:0; transform:translateX(30px) } to { opacity:1; transform:translateX(0) } }
@keyframes slideInUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
@keyframes slideOutLeft { to { opacity:0; transform:translateX(-100%); margin-bottom: 0px; padding-top: 0px; padding-bottom: 0px; max-height: 0px; border-width: 0px; } }
@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
@keyframes scaleIn { from { opacity:0; transform:scale(0.95) } to { opacity:1; transform:scale(1) } }
@keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
@keyframes pulseRing { 0% { transform:scale(0.8); opacity:0.8 } 100% { transform:scale(2.5); opacity:0 } }
@keyframes progressFill { from { width:0% } to { width:100% } }
@keyframes toastIn { from { opacity:0; transform:translateY(20px) scale(0.95) } to { opacity:1; transform:translateY(0) scale(1) } }
@keyframes radarScan { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.slide-out { animation: slideOutLeft 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards; overflow: hidden; }
`;

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function extractScore(scoreObj) {
  if (typeof scoreObj === 'number') return Math.round(scoreObj);
  if (typeof scoreObj === 'object' && scoreObj !== null) {
    // Try multiple possible score field names
    const score = scoreObj.fused_score || scoreObj.overall_score || scoreObj.risk_score || 
                  scoreObj.content_score || scoreObj.ml_score || scoreObj.heuristic_score || scoreObj.intel_score || 0;
    return Math.round(typeof score === 'number' ? score : 0);
  }
  return 0;
}

function RiskGauge({ score, size = 180 }) {
  const normScore = extractScore(score);
  const radius = (size - 24) / 2;
  const circumference = Math.PI * radius;
  const offset = circumference - (normScore / 100) * circumference;
  const color = normScore >= 75 ? '#e54b4f' : normScore >= 50 ? '#f59e0b' : normScore >= 25 ? '#6aa9ff' : '#34b27b';
  const label = normScore >= 75 ? 'CRITICAL RISK' : normScore >= 50 ? 'HIGH RISK' : normScore >= 25 ? 'MEDIUM RISK' : 'LOW RISK';
  
  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size / 1.4 }}>
      <svg width={size} height={size / 1.5} viewBox={`0 0 ${size} ${size / 1.5}`}>
        <path d={`M 12,${size/1.5 - 8} A ${radius},${radius} 0 0,1 ${size - 12},${size/1.5 - 8}`}
              fill="none" stroke="var(--border)" strokeWidth="16" strokeLinecap="round" opacity="0.4" />
        <path d={`M 12,${size/1.5 - 8} A ${radius},${radius} 0 0,1 ${size - 12},${size/1.5 - 8}`}
              fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1), stroke 0.5s ease', filter: `drop-shadow(0 0 10px ${color}50)` }} />
      </svg>
      <div className="absolute bottom-2 text-center">
        <span className="text-4xl font-black tabular-nums" style={{ color, textShadow: `0 0 20px ${color}40` }}>{normScore}</span>
        <span className="text-xs font-mono font-bold block mt-1 tracking-widest uppercase" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

function SeverityBadge({ severity, large }) {
  const styles = {
    critical: { bg: 'rgba(229,75,79,0.12)', color: '#e54b4f', border: 'rgba(229,75,79,0.35)' },
    high: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.35)' },
    medium: { bg: 'rgba(106,169,255,0.12)', color: '#6aa9ff', border: 'rgba(106,169,255,0.35)' },
    low: { bg: 'rgba(52,178,123,0.12)', color: '#34b27b', border: 'rgba(52,178,123,0.35)' },
  };
  const s = styles[severity?.toLowerCase()] || styles.medium;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full font-mono font-bold border ${large ? 'px-4 py-1.5 text-sm' : 'px-2.5 py-0.5 text-xs'}`}
      style={{ background: s.bg, color: s.color, borderColor: s.border }}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
      {(severity || 'unknown').toUpperCase()}
    </span>
  );
}

function ReputationBadge({ reputation }) {
  const map = {
    malicious: { icon: ShieldX, color: '#e54b4f', label: 'MALICIOUS' },
    suspicious: { icon: ShieldAlert, color: '#f59e0b', label: 'SUSPICIOUS' },
    clean: { icon: ShieldCheck, color: '#34b27b', label: 'CLEAN' },
    unknown: { icon: Shield, color: '#888', label: 'UNKNOWN' },
  };
  const c = map[reputation?.toLowerCase()] || map.unknown;
  const Icon = c.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold" style={{ color: c.color }}>
      <Icon size={16} /> {c.label}
    </span>
  );
}

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: '#34b27b', error: '#e54b4f', info: '#6aa9ff' };
  const icons = { success: CheckCircle, error: AlertTriangle, info: Bell };
  const Icon = icons[type];
  return (
    <div className="fixed bottom-8 right-8 z-[200] flex items-center gap-3 px-5 py-4 rounded-xl border shadow-[0_10px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl"
         style={{ background: 'var(--card)', borderColor: `${colors[type]}50`, animation: 'toastIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
      <Icon size={20} style={{ color: colors[type] }} />
      <span className="text-base font-medium text-[var(--foreground)]">{message}</span>
      <button onClick={onClose} className="ml-4 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><X size={16}/></button>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 opacity-70" style={{ animation: 'fadeIn 0.5s ease' }}>
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'rgba(52,178,123,0.08)', border: '1px solid rgba(52,178,123,0.15)' }}>
        <Icon size={36} className="text-[var(--primary)]" />
      </div>
      <p className="text-lg font-bold text-[var(--foreground)] mb-2">{title}</p>
      <p className="text-sm text-[var(--muted-foreground)] max-w-sm text-center leading-relaxed">{subtitle}</p>
    </div>
  );
}

/* ─── Report Generator ─────────────────────────────────────────────────────── */

function generateReport(analysis) {
  const ml = analysis?.ml_classification;
  const scoring = analysis?.scoring_breakdown;
  const iocData = analysis?.ioc_enrichment;
  const now = new Date().toLocaleString();
  const rScore = extractScore(analysis?.risk_score);
  let report = '';
  report += '═══════════════════════════════════════════════════\n';
  report += '         ARTH SAATHI — THREAT ANALYSIS REPORT\n';
  report += '═══════════════════════════════════════════════════\n\n';
  report += `Report Generated: ${now}\n`;
  report += `Analysis ID: ${analysis?.analysis_id || 'N/A'}\n\n`;
  report += '─── VERDICT ──────────────────────────────────────\n\n';
  if (ml) {
    report += `  Classification:  ${(ml.predicted_class || 'unknown').toUpperCase()}\n`;
    report += `  Confidence:      ${(ml.confidence * 100).toFixed(1)}%\n`;
    report += `  Severity:        ${(ml.severity || 'unknown').toUpperCase()}\n`;
  }
  report += `  Overall Risk Score: ${rScore}/100\n\n`;
  
  if (scoring) {
    report += '─── SCORING BREAKDOWN ────────────────────────────\n\n';
    report += `  Heuristic Score: ${extractScore(scoring.heuristic_score)} (Weight: 30%)\n`;
    report += `  ML Model Score:  ${extractScore(scoring.ml_score)} (Weight: 50%)\n`;
    report += `  Intel Score:     ${extractScore(scoring.intel_score)} (Weight: 20%)\n`;
    report += `  Fused Score:     ${extractScore(scoring.fused_score) || rScore}\n\n`;
  }
  if (ml?.all_probabilities) {
    report += '─── CLASS PROBABILITIES ──────────────────────────\n\n';
    Object.entries(ml.all_probabilities).sort(([, a], [, b]) => b - a).forEach(([cls, prob]) => {
      const bar = '█'.repeat(Math.round(prob * 30));
      report += `  ${cls.padEnd(20)} ${bar} ${(prob * 100).toFixed(1)}%\n`;
    });
    report += '\n';
  }
  if (iocData?.enriched?.length > 0) {
    report += '─── IOC INTELLIGENCE ─────────────────────────────\n\n';
    report += `  Total IOCs:    ${iocData.summary?.total || 0}\n`;
    report += `  Malicious:     ${iocData.summary?.malicious || 0}\n`;
    report += `  Suspicious:    ${iocData.summary?.suspicious || 0}\n`;
    report += `  Clean:         ${iocData.summary?.clean || 0}\n\n`;
    iocData.enriched.forEach(ioc => {
      report += `  [${(ioc.enrichment?.reputation || 'unknown').toUpperCase()}] ${ioc.type}: ${ioc.value || ioc.normalized_value}\n`;
      if (ioc.enrichment?.details && typeof ioc.enrichment.details === 'string')
        report += `    └─ ${ioc.enrichment.details}\n`;
    });
    report += '\n';
  }
  if (ml?.top_features?.length > 0) {
    report += '─── TOP ML FEATURES ──────────────────────────────\n\n';
    ml.top_features.forEach(f => {
      report += `  ${f.feature.padEnd(35)} Value: ${f.value?.toFixed(3) || 'N/A'}\n`;
    });
    report += '\n';
  }
  if (analysis?.tone_analysis) {
    const t = analysis.tone_analysis;
    report += '─── TONE ANALYSIS ────────────────────────────────\n\n';
    report += `  Urgency Level:  ${t.urgency_level || 'N/A'}\n`;
    report += `  Fear Level:     ${t.fear_level || 'N/A'}\n`;
    report += `  Impersonation:  ${t.impersonation_signals?.length || 0} signals\n\n`;
  }
  report += '═══════════════════════════════════════════════════\n';
  report += '  Powered by Arth Saathi Threat Intelligence Engine\n';
  report += '  ML Model: GradientBoosting + TF-IDF + 25 Features\n';
  report += '═══════════════════════════════════════════════════\n';
  return report;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function AnalyzePage() {
  // Navigation
  const [activeView, setActiveView] = useState('analyze');

  // Analysis state
  const [selectedMode, setSelectedMode] = useState(INPUT_MODES[0]);
  const [content, setContent] = useState('');
  const [sourcePlatform, setSourcePlatform] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [correlation, setCorrelation] = useState(null);
  const [patternResult, setPatternResult] = useState(null);
  const [activeTab, setActiveTab] = useState('verdict');
  const [isBuildingGraph, setIsBuildingGraph] = useState(false);
  const [error, setError] = useState(null);
  const [analyzeStep, setAnalyzeStep] = useState(0);

  // Email monitor state
  const [emailConnected, setEmailConnected] = useState(false);
  const [emailMonitoring, setEmailMonitoring] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [emailConfig, setEmailConfig] = useState({ email: '', password: '', host: 'imap.gmail.com' });
  const [emailConnecting, setEmailConnecting] = useState(false);
  const [liveFeed, setLiveFeed] = useState([]);
  const [selectedFeedItem, setSelectedFeedItem] = useState(null);
  const eventSourceRef = useRef(null);

  // SMS monitor state
  const [smsActive, setSmsActive] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showSmsDisconnectModal, setShowSmsDisconnectModal] = useState(false);
  const [smsLiveFeed, setSmsLiveFeed] = useState([]);
  const [selectedSmsFeedItem, setSelectedSmsFeedItem] = useState(null);
  const smsEventSourceRef = useRef(null);

  // Social media monitor state
  const [socialActive, setSocialActive] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [showSocialDisconnectModal, setShowSocialDisconnectModal] = useState(false);
  const [socialConsentGiven, setSocialConsentGiven] = useState(() => {
    try { return localStorage.getItem('app_social_consent') === 'true'; } catch { return false; }
  });
  const [socialLiveFeed, setSocialLiveFeed] = useState([]);
  const [selectedSocialFeedItem, setSelectedSocialFeedItem] = useState(null);
  const [socialShowSafe, setSocialShowSafe] = useState(false);
  const socialEventSourceRef = useRef(null);

  // History state
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('');
  const [historySort, setHistorySort] = useState('newest');
  const [deletingItems, setDeletingItems] = useState([]);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);

  // SSE connection
  useEffect(() => {
    fetch(ENDPOINTS.emailStatus || 'http://localhost:5001/api/email/status')
      .then(r => r.json())
      .then(s => { setEmailConnected(s.connected); setEmailMonitoring(s.monitoring); })
      .catch(e => { /* ignore */ });

    const es = new EventSource(ENDPOINTS.emailFeed);
    eventSourceRef.current = es;
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setLiveFeed(prev => [data, ...prev].slice(0, 100)); // Increased limit
      } catch (err) { /* ignore */ }
    };
    es.addEventListener('status', (e) => {
      try {
        const status = JSON.parse(e.data);
        setEmailConnected(status.connected);
        setEmailMonitoring(status.monitoring);
      } catch (err) { /* ignore */ }
    });
    es.addEventListener('history', (e) => {
      try { setLiveFeed(JSON.parse(e.data).slice(0, 100)); } catch (err) { /* ignore */ }
    });
    return () => es.close();
  }, []);

  // SMS SSE connection
  useEffect(() => {
    fetch(ENDPOINTS.smsStatus || 'http://localhost:5001/api/sms/status')
      .then(r => r.json())
      .then(s => { setSmsActive(s.active); })
      .catch(e => { /* ignore */ });

    const es = new EventSource(ENDPOINTS.smsFeed);
    smsEventSourceRef.current = es;
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setSmsLiveFeed(prev => [data, ...prev].slice(0, 100));
      } catch (err) { /* ignore */ }
    };
    es.addEventListener('status', (e) => {
      try {
        const status = JSON.parse(e.data);
        setSmsActive(status.active);
      } catch (err) { /* ignore */ }
    });
    es.addEventListener('history', (e) => {
      try { setSmsLiveFeed(JSON.parse(e.data).slice(0, 100)); } catch (err) { /* ignore */ }
    });
    return () => es.close();
  }, []);

  // Social Media: hybrid SSE + REST polling (guaranteed delivery)
  useEffect(() => {
    let es = null;
    let retryTimer = null;
    let pollInterval = null;
    let active = true;

    const SOCIAL_STATUS_URL = ENDPOINTS.socialStatus || 'http://localhost:5001/api/social/status';
    const SOCIAL_HISTORY_URL = ENDPOINTS.socialHistory || 'http://localhost:5001/api/social/history';
    const SOCIAL_FEED_URL = ENDPOINTS.socialFeed || 'http://localhost:5001/api/social/feed';

    // REST poll — always works regardless of SSE state
    function pollHistory() {
      fetch(SOCIAL_HISTORY_URL)
        .then(r => r.json())
        .then(({ messages }) => {
          if (!active || !Array.isArray(messages) || messages.length === 0) return;
          setSocialLiveFeed(prev => {
            // Merge: add any new messages not already in the feed
            const ids = new Set(prev.map(m => m.id));
            const newOnes = messages.filter(m => !ids.has(m.id));
            if (newOnes.length === 0) return prev;
            return [...newOnes, ...prev].slice(0, 150);
          });
        })
        .catch(() => {});

      fetch(SOCIAL_STATUS_URL)
        .then(r => r.json())
        .then(s => { if (active) setSocialActive(s.active); })
        .catch(() => {});
    }

    // SSE — real-time layer on top of polling
    function connectSSE() {
      if (!active) return;
      if (es) { try { es.close(); } catch { } es = null; }

      es = new EventSource(SOCIAL_FEED_URL);
      socialEventSourceRef.current = es;

      es.onopen = () => { pollHistory(); }; // sync on connect

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data && data.id) {
            setSocialLiveFeed(prev => {
              if (prev.some(item => item.id === data.id)) return prev;
              return [data, ...prev].slice(0, 150);
            });
          }
        } catch { /* ignore */ }
      };

      es.addEventListener('status', (e) => {
        try { const s = JSON.parse(e.data); if (active) setSocialActive(s.active); } catch { }
      });

      es.addEventListener('history', (e) => {
        try {
          const history = JSON.parse(e.data);
          if (active && Array.isArray(history) && history.length > 0) {
            setSocialLiveFeed(prev => {
              const ids = new Set(prev.map(m => m.id));
              const newOnes = history.filter(m => !ids.has(m.id));
              if (newOnes.length === 0) return prev;
              return [...newOnes, ...prev].slice(0, 150);
            });
          }
        } catch { }
      });

      es.onerror = () => {
        if (es) { try { es.close(); } catch { } es = null; }
        if (active) {
          retryTimer = setTimeout(connectSSE, 5000);
        }
      };
    }

    // Start: immediate poll + SSE + polling interval
    pollHistory();
    setTimeout(connectSSE, 200);
    pollInterval = setInterval(pollHistory, 4000); // poll every 4 seconds

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (pollInterval) clearInterval(pollInterval);
      if (es) { try { es.close(); } catch { } es = null; }
    };
  }, []);


  // Load history from localStorage
  useEffect(() => {
    try { const h = JSON.parse(localStorage.getItem('app_analysis_history') || '[]'); setAnalysisHistory(h); } catch (e) { /* ignore */ }
  }, []);
  const saveHistory = useCallback((history) => {
    setAnalysisHistory(history);
    try { localStorage.setItem('app_analysis_history', JSON.stringify(history.slice(0, 150))); } catch (e) { /* ignore */ }
  }, []);

  /* ─── Handlers ───────────────────────────────────────────────────────── */

  const loadDemo = (demo) => {
    setContent(demo.content);
    const mode = INPUT_MODES.find(m => m.id === demo.mode) || INPUT_MODES[0];
    setSelectedMode(mode);
    setActiveView('analyze');
  };

  const handleAnalyze = async () => {
    if (!content || !content.trim()) { setError('Please provide content to analyze'); return; }
    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);
    setActiveTab('verdict');
    setAnalyzeStep(1);

    try {
      setAnalyzeStep(1);
      const normalizeRes = await fetch(`${SERVER_URL_1}/api/threats/normalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_type: selectedMode.id, content: content.trim(), metadata: { source_platform: sourcePlatform || undefined } }),
      });
      if (!normalizeRes.ok) throw new Error('Normalization failed');
      const { artifact } = await normalizeRes.json();
      if (!artifact) throw new Error('Invalid normalization');

      setAnalyzeStep(2);
      const analyzeRes = await fetch(`${SERVER_URL_1}/api/threats/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifact, options: { extract_iocs: true, extract_entities: true, score_content: true } }),
      });
      if (!analyzeRes.ok) throw new Error('Analysis failed');
      const { analysis } = await analyzeRes.json();
      if (!analysis) throw new Error('Invalid analysis result');

      setAnalyzeStep(3);
      setAnalysisResult(analysis);

      // Score extraction cascade across multiple possible endpoints mapping targets
      const rScore = extractScore(analysis.scoring_breakdown) || extractScore(analysis.risk_score) || extractScore(analysis.ml_classification) || 0;

      // Build graph immediately after analysis
      buildGraph(analysis);
      correlateAnalysis(analysis);

      if (analysis?.classification) {
        const family = analysis.classification.primary_family;
        const FAMILY_TO_CODE = { phishing: 'T1', malicious_url: 'T2', malicious_attachment: 'T3', social_engineering_scam: 'T4', misinformation: 'T5', impersonation: 'T6' };
        setPatternResult({
          pattern_code: FAMILY_TO_CODE[family] || 'T?',
          pattern_label: `${FAMILY_TO_CODE[family] || 'T?'} - ${family?.replace(/_/g, ' ') || 'Unknown'}`,
          family: 'digital_threat',
          risk_score: rScore / 100,
          confidence: analysis.ml_classification?.confidence || 0.7,
          severity: analysis.ml_classification?.severity || 'medium',
          decision: rScore >= 75 ? 'highly_suspicious' : rScore >= 40 ? 'likely_suspicious' : 'not_suspicious',
          top_features: analysis.ml_classification?.top_features?.slice(0, 5) || [],
          explanation: `ML Model: ${analysis.ml_classification?.predicted_class || 'unknown'}. Risk: ${rScore}/100.`,
          all_results: [],
        });
      }

      // Save to history
      const historyItem = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        content: content.substring(0, 300),
        mode: selectedMode.id,
        modeLabel: selectedMode.label,
        risk_score: rScore,
        classification: analysis.ml_classification?.predicted_class || 'unknown',
        severity: analysis.ml_classification?.severity || 'unknown',
        confidence: analysis.ml_classification?.confidence || 0,
        analysis,
      };
      saveHistory([historyItem, ...analysisHistory]);

      showToast('Analysis complete', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
      setAnalyzeStep(0);
    }
  };

  const buildGraph = async (analysis) => {
    if (!analysis) {
      console.warn('[buildGraph] No analysis provided');
      return;
    }
    setIsBuildingGraph(true);
    console.log('[buildGraph] Building graph for analysis:', analysis.analysis_id);
    
    try {
      const res = await fetch(`${SERVER_URL_1}/api/threats/graph`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ analysis }) 
      });
      
      console.log('[buildGraph] API response status:', res.status);
      
      if (res.ok) { 
        const data = await res.json();
        console.log('[buildGraph] API response data:', data);
        
        if (data?.graph && data.graph.nodes && data.graph.nodes.length > 0) {
          console.log('[buildGraph] Setting graph data with', data.graph.nodes.length, 'nodes');
          // Ensure risk_score is set in metadata if missing
          if (data.graph.metadata && data.graph.metadata.risk_score === undefined) {
            data.graph.metadata.risk_score = extractScore(analysis.scoring_breakdown) || extractScore(analysis.risk_score) || extractScore(analysis.ml_classification) || 0;
          }
          setGraphData(data.graph);
        } else {
          console.warn('[buildGraph] API returned empty graph, generating fallback');
          const fallbackGraph = generateFallbackGraph(analysis);
          setGraphData(fallbackGraph);
        }
      } else {
        const errorText = await res.text();
        console.error('[buildGraph] API error:', res.status, errorText);
        // Generate fallback graph on API failure
        const fallbackGraph = generateFallbackGraph(analysis);
        setGraphData(fallbackGraph);
      }
    } catch (e) { 
      console.error('[buildGraph] Exception:', e);
      // Generate fallback graph on exception
      const fallbackGraph = generateFallbackGraph(analysis);
      setGraphData(fallbackGraph);
    } finally { 
      setIsBuildingGraph(false); 
    }
  };

  // Fallback graph generator when API fails
  const generateFallbackGraph = (analysis) => {
    console.log('[generateFallbackGraph] Creating fallback graph from analysis');
    const nodes = [];
    const edges = [];
    let nodeId = 0;

    // Central artifact node
    const artifactNode = {
      id: `node_${nodeId++}`,
      type: 'artifact',
      label: 'Analyzed Content',
      size: 16,
      properties: {
        severity: analysis.ml_classification?.severity || 'medium',
        confidence: analysis.ml_classification?.confidence || 0.5,
      }
    };
    nodes.push(artifactNode);

    // Add classification node
    if (analysis.ml_classification?.predicted_class) {
      const classNode = {
        id: `node_${nodeId++}`,
        type: 'claim',
        label: analysis.ml_classification.predicted_class.replace(/_/g, ' '),
        size: 12,
        properties: { confidence: analysis.ml_classification.confidence }
      };
      nodes.push(classNode);
      edges.push({ source: artifactNode.id, target: classNode.id, type: 'CLAIMS_TO_BE' });
    }

    // Add IOC nodes from enrichment — handle both structures
    const iocs = analysis.ioc_enrichment?.enriched || analysis.indicators || [];
    iocs.slice(0, 10).forEach(ioc => {
      // Support both {type, value} and {indicator_type, indicator/url/domain} structures
      const iocType = ioc.type || ioc.indicator_type || 'unknown';
      const iocValue = ioc.value || ioc.normalized_value || ioc.indicator || ioc.url || ioc.domain || '';
      if (!iocValue) return; // skip empty
      const nodeType = iocType === 'url' ? 'url' : iocType === 'domain' ? 'domain' : iocType === 'email' ? 'email' : iocType === 'wallet' ? 'wallet' : iocType === 'ip' ? 'ip' : iocType === 'phone' ? 'phone' : 'evidence';
      const iocNode = {
        id: `node_${nodeId++}`,
        type: nodeType,
        label: iocValue.substring(0, 35),
        size: 10,
        properties: { 
          reputation: ioc.enrichment?.reputation || ioc.reputation || 'unknown',
          source: ioc.enrichment?.source || ioc.source,
          ioc_type: iocType,
        }
      };
      nodes.push(iocNode);
      edges.push({ source: artifactNode.id, target: iocNode.id, type: 'CONTAINS' });
    });

    // Add sender node from email if available
    if (analysis.email?.from) {
      const senderNode = {
        id: `node_${nodeId++}`,
        type: 'sender',
        label: analysis.email.from.substring(0, 35),
        size: 12,
        properties: { role: 'sender' }
      };
      nodes.push(senderNode);
      edges.push({ source: senderNode.id, target: artifactNode.id, type: 'SENT' });
    }

    // Add sender/recipient if available from entities
    const entities = analysis.entities || [];
    entities.slice(0, 5).forEach(entity => {
      const entityNode = {
        id: `node_${nodeId++}`,
        type: entity.type === 'PERSON' ? 'person' : entity.type === 'ORG' ? 'organization' : 'evidence',
        label: (entity.text || entity.value || '').substring(0, 25),
        size: 10,
        properties: { entity_type: entity.type }
      };
      nodes.push(entityNode);
      edges.push({ source: artifactNode.id, target: entityNode.id, type: 'MENTIONS' });
    });

    // Risk score: prefer direct number, then extract from objects
    const graphRiskScore = typeof analysis.risk_score === 'number'
      ? analysis.risk_score
      : typeof analysis.ml_classification?.risk_score === 'number'
        ? analysis.ml_classification.risk_score
        : extractScore(analysis.scoring_breakdown) || extractScore(analysis.risk_score) || extractScore(analysis.ml_classification) || 0;

    const graph = {
      nodes,
      edges,
      metadata: {
        node_count: nodes.length,
        edge_count: edges.length,
        severity: analysis.ml_classification?.severity || 'medium',
        threat_family: analysis.classification?.primary_family || analysis.ml_classification?.predicted_class,
        risk_score: graphRiskScore,
        generated_by: 'fallback'
      }
    };

    console.log('[generateFallbackGraph] Generated graph:', graph);
    return graph;
  };

  const correlateAnalysis = async (analysis) => {
    if (!analysis) return;
    try {
      const res = await fetch(`${SERVER_URL_1}/api/threats/correlate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analysis }) });
      if (res.ok) { const data = await res.json(); if (data) setCorrelation(data); }
    } catch (e) { /* ignore */ }
  };

  const handleReset = () => {
    setContent(''); setSourcePlatform(''); setAnalysisResult(null); setGraphData(null);
    setCorrelation(null); setPatternResult(null); setActiveTab('verdict'); setError(null);
  };

  /* ── Email Connection Handlers ── */
  const handleEmailConnect = async () => {
    if (!emailConfig.email || !emailConfig.password) return;
    setEmailConnecting(true);
    try {
      const res = await fetch(ENDPOINTS.emailConnect, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(emailConfig) });
      const data = await res.json();
      if (data.success) { 
        setEmailConnected(true); 
        setEmailMonitoring(true); 
        setShowEmailModal(false); 
        showToast('Live email monitoring connected and active', 'success'); 
      }
      else setError(data.error || 'Failed to connect');
    } catch (err) { setError('Connection failed: ' + err.message); }
    finally { setEmailConnecting(false); }
  };

  const handleEmailDisconnect = async () => {
    try { 
      await fetch(ENDPOINTS.emailDisconnect, { method: 'POST' }); 
      setEmailConnected(false); 
      setEmailMonitoring(false); 
      setShowDisconnectModal(false);
      showToast('Live monitoring disconnected', 'info'); 
    } catch (err) { console.error(err); }
  };

  /* ── SMS Connection Handlers ── */
  const handleSmsConnect = async () => {
    try {
      const res = await fetch(ENDPOINTS.smsConnect, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      if (data.success) {
        setSmsActive(true);
        setShowSmsModal(false);
        showToast('SMS Webhook server activated', 'success');
      }
    } catch (e) {
      setError('Connection failed: ' + e.message);
    }
  };

  const handleSmsDisconnect = async () => {
    try {
      await fetch(ENDPOINTS.smsDisconnect, { method: 'POST' });
      setSmsActive(false);
      setShowSmsDisconnectModal(false);
      showToast('SMS Webhook Offline', 'info');
    } catch (e) {
      console.error(e);
    }
  };

  /* ── Utility Handlers ── */
  const downloadReport = () => {
    if (!analysisResult) return;
    const report = generateReport(analysisResult);
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threat-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Detailed report downloaded successfully', 'success');
  };

  const deleteHistoryItem = (id) => {
    setDeletingItems(prev => [...prev, id]);
    setTimeout(() => {
      const updated = analysisHistory.filter(h => h.id !== id);
      saveHistory(updated);
      setDeletingItems(prev => prev.filter(i => i !== id));
      showToast('Analysis removed from history', 'info');
    }, 450); // wait for slideOutLeft animation
  };

  const deleteFeedItem = (id) => {
    setDeletingItems(prev => [...prev, id]);
    setTimeout(() => {
      setLiveFeed(prev => prev.filter(item => item.id !== id));
      setDeletingItems(prev => prev.filter(i => i !== id));
      showToast('Feed item removed', 'info');
    }, 450);
  };

  const deleteSmsFeedItem = (id) => {
    setDeletingItems(prev => [...prev, id]);
    setTimeout(() => {
      setSmsLiveFeed(prev => prev.filter(item => item.id !== id));
      setDeletingItems(prev => prev.filter(i => i !== id));
      showToast('SMS removed', 'info');
    }, 450);
  };

  // Social Media handlers
  const handleSocialConnect = async () => {
    try {
      await fetch(ENDPOINTS.socialConnect, { method: 'POST' });
      setSocialActive(true);
      setShowSocialModal(false);
      localStorage.setItem('app_social_consent', 'true');
      setSocialConsentGiven(true);
      showToast('Social media monitoring activated', 'success');
    } catch (err) { showToast('Connection failed', 'error'); }
  };

  const handleSocialDisconnect = async () => {
    try {
      await fetch(ENDPOINTS.socialDisconnect, { method: 'POST' });
      setSocialActive(false);
      setShowSocialDisconnectModal(false);
      showToast('Social media monitoring disconnected', 'info');
    } catch (err) { console.error(err); }
  };

  const deleteSocialFeedItem = (id) => {
    setDeletingItems(prev => [...prev, id]);
    setTimeout(() => {
      setSocialLiveFeed(prev => prev.filter(item => item.id !== id));
      setDeletingItems(prev => prev.filter(i => i !== id));
      showToast('Message removed', 'info');
      // Tell backend to permanently delete it so it doesn't reappear on next poll
      fetch(`${ENDPOINTS.socialHistory || 'http://localhost:5001/api/social/history'}/${id}`, {
        method: 'DELETE'
      }).catch(err => console.error('Failed to permanently delete item:', err));
    }, 450);
  };

  const loadHistoryItemToAnalyze = (item) => {
    console.log('[loadHistoryItemToAnalyze] Loading item:', item);
    
    // History items have data at root level OR nested under 'analysis'
    // Check which structure we have
    const analysis = item.analysis || item;
    const emailBody = item.email?.body || item.email?.bodyPreview || '';
    
    // Construct proper analysisResult structure
    const mlClass = analysis.ml_classification;
    const rScore = mlClass?.risk_score || extractScore(analysis.scoring_breakdown) || extractScore(analysis.risk_score) || 0;
    
    // Derive scoring_breakdown from ml_classification if missing
    const scoringBreakdown = analysis.scoring_breakdown || (mlClass ? {
      ml_score: Math.round(rScore * 0.5),
      heuristic_score: Math.round(rScore * 0.3),
      intel_score: Math.round(rScore * 0.2),
      fused_score: rScore,
    } : null);
    
    // Normalize indicators: handle both {type, value} and {indicator_type, indicator} field names
    const rawIndicators = analysis.indicators || [];
    const normalizedIndicators = rawIndicators.map(ind => ({
      type: ind.type || ind.indicator_type || 'unknown',
      value: ind.value || ind.indicator || ind.url || ind.domain || '',
      normalized_value: ind.normalized_value || ind.value || ind.indicator || '',
      enrichment: ind.enrichment || { reputation: ind.reputation || 'unknown', source: ind.source },
    }));
    
    const analysisResult = {
      ml_classification: mlClass,
      scoring_breakdown: scoringBreakdown,
      classification: analysis.classification,
      risk_score: rScore,
      ioc_enrichment: {
        enriched: normalizedIndicators,
        summary: analysis.indicator_summary || { total: normalizedIndicators.length, malicious: 0, suspicious: 0, clean: 0, unknown: normalizedIndicators.length }
      },
      entities: analysis.entities || [],
      features: analysis.features || {},
      analysis_id: analysis.id || item.id,
      timestamp: analysis.analyzed_at || analysis.timestamp || item.timestamp,
    };
    
    console.log('[loadHistoryItemToAnalyze] Constructed analysisResult:', analysisResult);
    
    // Set all the state
    setAnalysisResult(analysisResult);
    setContent(emailBody || item.content || '');
    const mode = INPUT_MODES.find(m => m.id === (item.mode || 'email')) || INPUT_MODES[4];
    setSelectedMode(mode);
    setActiveView('analyze');
    setActiveTab('verdict');
    
    // Clear previous state
    setGraphData(null);
    setCorrelation(null);
    setPatternResult(null);
    
    // Setup pattern result
    if (analysis.classification || analysis.ml_classification) {
      const mlClass = analysis.classification || analysis.ml_classification;
      const rScore = extractScore(analysis.scoring_breakdown) || extractScore(analysis.risk_score) || extractScore(analysis.ml_classification) || 0;
      const family = mlClass.primary_family || mlClass.predicted_class || 'unknown';
      const FAMILY_TO_CODE = { phishing: 'T1', malicious_url: 'T2', malicious_attachment: 'T3', social_engineering_scam: 'T4', misinformation: 'T5', impersonation: 'T6' };
      setPatternResult({
        pattern_code: FAMILY_TO_CODE[family] || 'T?',
        pattern_label: `${FAMILY_TO_CODE[family] || 'T?'} - ${family?.replace(/_/g, ' ') || 'Unknown'}`,
        family: 'digital_threat',
        risk_score: rScore / 100,
        confidence: mlClass.confidence || 0.7,
        severity: mlClass.severity || 'medium',
        decision: rScore >= 75 ? 'highly_suspicious' : 'likely_suspicious',
        top_features: mlClass.top_features?.slice(0, 5) || [],
        explanation: `Loaded from history. ML Model: ${mlClass.predicted_class || 'unknown'}.`,
        all_results: [],
      });
    }
    
    // Rebuild graph and correlation — merge email/raw data into analysisResult for graph
    const analysisForGraph = { ...analysisResult, email: analysis.email, indicators: analysis.indicators };
    console.log('[loadHistoryItemToAnalyze] Rebuilding graph and correlation');
    buildGraph(analysisForGraph);
    correlateAnalysis(analysisResult);
    
    showToast('Analysis loaded into workbench', 'success');
  };

  const copyJSON = () => {
    if (!analysisResult) return;
    navigator.clipboard.writeText(JSON.stringify(analysisResult, null, 2));
    showToast('JSON Copied to clipboard', 'info');
  };

  const filteredHistory = analysisHistory.filter(h => {
    if (!historyFilter) return true;
    const q = historyFilter.toLowerCase();
    return h.content?.toLowerCase().includes(q) || h.classification?.toLowerCase().includes(q) || h.severity?.toLowerCase().includes(q);
  }).sort((a, b) => historySort === 'newest' ? new Date(b.timestamp) - new Date(a.timestamp) : new Date(a.timestamp) - new Date(b.timestamp));

  const ml = analysisResult?.ml_classification;
  const scoring = analysisResult?.scoring_breakdown;
  const iocSummary = analysisResult?.ioc_enrichment?.summary;
  const currentRiskScore = extractScore(analysisResult?.scoring_breakdown) || extractScore(analysisResult?.risk_score) || extractScore(analysisResult?.ml_classification) || 0;
  
  // Debug logging
  if (analysisResult && !ml && !scoring) {
    console.warn('[AnalyzePage] analysisResult exists but missing ml_classification and scoring_breakdown:', analysisResult);
  }

  /* ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen bg-[#0a0f0d] flex">
      <style>{KEYFRAMES}</style>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="sticky top-0 h-screen w-[260px] flex-shrink-0 border-r border-white/5 bg-[#0f1714] flex flex-col z-40">
        <div className="px-6 h-16 flex items-center gap-3 border-b border-white/5 bg-[#141f1a]">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
            <Shield className="text-[var(--primary)]" size={20} />
          </div>
          <div>
            <span className="text-base font-bold text-[var(--foreground)] tracking-tight block leading-tight">Arth Saathi</span>
            <span className="text-[10px] text-[var(--primary)] font-mono uppercase tracking-widest block">Threat Engine</span>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {SIDEBAR_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            const isEmailMonitor = item.id === 'monitor';
            const isSmsMonitor = item.id === 'smsMonitor';
            const isSocialMonitor = item.id === 'socialMonitor';
            const isMonitorActive = (isEmailMonitor && emailMonitoring) || (isSmsMonitor && smsActive) || (isSocialMonitor && socialActive);
            
            return (
              <button key={item.id} onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-[14px] transition-all group ${
                  isActive ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/5'
                }`}>
                <Icon size={18} className={`${isMonitorActive ? 'animate-pulse text-green-400' : ''} ${isActive ? 'text-[var(--primary)]' : 'group-hover:text-[var(--foreground)]'} transition-colors`} />
                <span className="font-semibold">{item.label}</span>
                {isMonitorActive && (
                  <span className="ml-auto w-2.5 h-2.5 rounded-full bg-green-400" style={{ boxShadow: '0 0 10px #34b27b', animation: 'pulseRing 2s infinite' }} />
                )}
                {item.id === 'history' && analysisHistory.length > 0 && (
                  <span className="ml-auto text-[11px] font-mono bg-white/5 px-2 py-0.5 rounded-md group-hover:bg-white/10 transition-colors">{analysisHistory.length}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Connection Status */}
        <div className="p-4 border-t border-white/5 bg-[#0a0f0d]/50 space-y-4">
          <div>
            <p className="text-[10px] font-mono uppercase text-[var(--muted-foreground)] mb-2 px-1 tracking-widest">IMAP Ingestion</p>
            <button
              onClick={() => emailConnected ? setShowDisconnectModal(true) : setShowEmailModal(true)}
              className={`w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold transition-all border ${
                emailMonitoring
                  ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                  : 'bg-white/5 border-white/10 text-[var(--muted-foreground)] hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]'
              }`}
            >
              {emailMonitoring ? (
                <>
                  <div className="relative flex items-center justify-center">
                    <Wifi size={16} />
                    <span className="absolute w-full h-full rounded-full border border-green-400" style={{ animation: 'radarScan 2s linear infinite' }} />
                  </div>
                  <span>Live Active</span>
                </>
              ) : (
                <><WifiOff size={16} /> <span>Connect Mailbox</span></>
              )}
            </button>
          </div>

          <div>
            <p className="text-[10px] font-mono uppercase text-[var(--muted-foreground)] mb-2 px-1 tracking-widest">SMS Webhook</p>
            <button
              onClick={() => smsActive ? setShowSmsDisconnectModal(true) : setShowSmsModal(true)}
              className={`w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold transition-all border ${
                smsActive
                  ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                  : 'bg-white/5 border-white/10 text-[var(--muted-foreground)] hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]'
              }`}
            >
              {smsActive ? (
                <>
                  <div className="relative flex items-center justify-center">
                    <Smartphone size={16} />
                    <span className="absolute w-full h-full rounded-full border border-green-400" style={{ animation: 'radarScan 2s linear infinite' }} />
                  </div>
                  <span>Gateway Active</span>
                </>
              ) : (
                <><Smartphone size={16} /> <span>Start Gateway</span></>
              )}
            </button>
          </div>

          <div>
            <p className="text-[10px] font-mono uppercase text-[var(--muted-foreground)] mb-2 px-1 tracking-widest">Social Gateway</p>
            <button
              onClick={() => socialActive ? setShowSocialDisconnectModal(true) : setShowSocialModal(true)}
              className={`w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold transition-all border ${
                socialActive
                  ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                  : 'bg-white/5 border-white/10 text-[var(--muted-foreground)] hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]'
              }`}
            >
              {socialActive ? (
                <>
                  <div className="relative flex items-center justify-center">
                    <MessageSquare size={16} />
                    <span className="absolute w-full h-full rounded-full border border-green-400" style={{ animation: 'radarScan 2s linear infinite' }} />
                  </div>
                  <span>Live Active</span>
                </>
              ) : (
                <><MessageSquare size={16} /> <span>Connect Socials</span></>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto w-full relative bg-[#0a0f0d]">
        
        {/* Subtle Background Glows */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[var(--primary)]/5 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none -z-10" />

        {/* ══ ANALYZE VIEW ════════════════════════════════════════════════ */}
        {activeView === 'analyze' && (
          <div className="w-full max-w-[1400px] mx-auto px-10 py-8" style={{ animation: 'fadeIn 0.4s ease' }}>
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
              <div>
                <h1 className="text-3xl font-black text-[var(--foreground)] flex items-center gap-3">
                  Threat Intelligence Workbench
                </h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-2 font-medium">Input suspicious content below for ML-powered classification, structural feature analysis, and real-time IOC enrichment.</p>
              </div>
              <div className="flex items-center gap-3">
                {analysisResult && (
                  <>
                    <button onClick={downloadReport} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-[var(--foreground)] hover:bg-[var(--primary)] hover:border-[var(--primary)] hover:text-black transition-all">
                      <Download size={16} /> Download Report
                    </button>
                    <button onClick={copyJSON} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-transparent text-[var(--foreground)] hover:bg-white/10 transition-all">
                      <Copy size={16} /> Raw JSON
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8">
              {/* ── Left: Input + Results ────────────────────────────────── */}
              <div className="space-y-6">
                
                {/* Mode Selector */}
                <div className="flex gap-3 flex-wrap">
                  {INPUT_MODES.map(mode => {
                    const Icon = mode.icon;
                    const isActive = selectedMode.id === mode.id;
                    return (
                      <button key={mode.id} onClick={() => setSelectedMode(mode)}
                        className={`inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-bold transition-all border ${
                          isActive
                            ? 'text-white border-transparent'
                            : 'border-white/10 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/5'
                        }`}
                        style={isActive ? { background: `linear-gradient(135deg, ${mode.color}20, ${mode.color}40)`, border: `1px solid ${mode.color}60`, boxShadow: `0 8px 24px -8px ${mode.color}50` } : {}}
                      >
                        <Icon size={18} style={isActive ? { color: '#fff' } : {}} /> {mode.label}
                      </button>
                    );
                  })}
                </div>

                {/* Input Area */}
                <div className="relative group rounded-2xl overflow-hidden border border-white/10 bg-[#111614] shadow-inner focus-within:border-[var(--primary)]/50 focus-within:shadow-[0_0_0_4px_rgba(52,178,123,0.1)] transition-all">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#161c1a]">
                    <span className="text-xs font-mono font-bold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                       <FileText size={14}/> Raw Payload Input
                    </span>
                    <span className="text-[11px] font-mono text-[var(--primary)]">{(content || '').length} bytes</span>
                  </div>
                  <textarea
                    value={content || ''}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={`Paste the ${selectedMode.desc?.toLowerCase()} payload here...\n\nExample: Raw email headers + body, or a suspicious SMS.`}
                    rows={10}
                    className="w-full bg-transparent p-5 text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/30 focus:outline-none resize-none font-mono leading-relaxed"
                  />
                  {content && (
                    <button onClick={handleReset} className="absolute bottom-4 right-5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 text-[var(--foreground)] hover:bg-red-500/20 hover:text-red-400 transition-colors">
                      CLEAR TEXT
                    </button>
                  )}
                </div>

                {/* Action Bar */}
                <div className="flex items-center gap-4 bg-[#111614] p-3 rounded-2xl border border-white/10">
                  <div className="flex-1 relative">
                    <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                    <input
                      value={sourcePlatform}
                      onChange={(e) => setSourcePlatform(e.target.value)}
                      placeholder="Source context (e.g., WhatsApp, Outlook)"
                      className="w-full bg-transparent border-none pl-11 pr-4 py-3 text-sm font-medium text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !content || !content.trim()}
                    className="inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl text-base font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--primary)] text-[var(--primary-foreground)] hover:shadow-[0_0_30px_rgba(52,178,123,0.4)] hover:-translate-y-0.5 active:translate-y-0 disabled:hover:shadow-none disabled:hover:translate-y-0"
                  >
                    <Scan size={20} /> Execute Analysis
                  </button>
                </div>

                {error && (
                  <div className="flex items-center gap-3 px-5 py-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-sm font-semibold text-red-400" style={{ animation: 'slideInUp 0.3s ease' }}>
                    <AlertTriangle size={20} /> {error}
                    <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-500/20 rounded-lg"><X size={16} /></button>
                  </div>
                )}

                {/* ── Results Panel ──────────────────────────────────────────────── */}
                {analysisResult && (
                  <div className="mt-10" style={{ animation: 'slideInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                    {/* High-Level Conclusion Strip */}
                    <div className="mb-6 flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-[#161c1a]">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${currentRiskScore >= 75 ? 'bg-red-500/20 text-red-400' : currentRiskScore >= 50 ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'}`}>
                          {currentRiskScore >= 75 ? <ShieldX size={24} /> : currentRiskScore >= 50 ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}
                        </div>
                        <div>
                          <p className="text-sm text-[var(--muted-foreground)] font-mono uppercase tracking-widest">Analysis Result</p>
                          <p className="text-xl font-bold text-[var(--foreground)] capitalize flex items-center gap-2">
                            {ml?.predicted_class?.replace(/_/g, ' ') || 'Completed'} 
                            <SeverityBadge severity={ml?.severity} />
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase tracking-widest mb-1">Threat Score</p>
                        <p className="text-3xl font-black tabular-nums" style={{ color: currentRiskScore >= 75 ? '#e54b4f' : currentRiskScore >= 50 ? '#f59e0b' : '#34b27b' }}>{currentRiskScore}<span className="text-sm font-medium text-[var(--muted-foreground)]">/100</span></p>
                      </div>
                    </div>

                    {/* Result Tabs */}
                    <div className="flex items-center gap-2 mb-6 bg-white/5 p-1.5 rounded-2xl overflow-x-auto">
                      {RESULT_TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                              isActive ? 'bg-[#1a221f] text-[var(--primary)] shadow-md border border-white/10' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/5'
                            }`}>
                            <Icon size={18} className={isActive ? 'opacity-100' : 'opacity-60'} /> {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Tab Contents Container */}
                    <div className="min-h-[400px]">
                      
                      {/* ── VERDICT TAB ──────────────────────────────────── */}
                      {activeTab === 'verdict' && (
                        <div className="space-y-6" style={{ animation: 'fadeIn 0.3s ease' }}>
                          
                          {/* ML Confidence & Model Matrix */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left: Probabilities */}
                            <div className="p-6 rounded-2xl border border-white/10 bg-[#111614]">
                              <h3 className="text-sm font-bold text-[var(--foreground)] mb-5 flex items-center gap-2"><Brain size={16} className="text-[var(--primary)]"/> Class Probabilities</h3>
                              {ml?.all_probabilities ? (
                                <div className="space-y-4">
                                  {Object.entries(ml.all_probabilities).sort(([, a], [, b]) => b - a).map(([cls, prob], i) => (
                                    <div key={cls} className="flex items-center gap-4" style={{ animation: `slideInRight 0.4s ease ${i * 0.05}s both` }}>
                                      <span className="text-xs font-mono font-medium text-[var(--foreground)] w-36 truncate capitalize">{cls.replace(/_/g, ' ')}</span>
                                      <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                        <div className="h-full rounded-full" style={{ width: `${prob * 100}%`, background: i === 0 ? 'var(--primary)' : 'var(--muted-foreground)', opacity: i === 0 ? 1 : 0.4, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                                      </div>
                                      <span className="text-xs font-mono font-bold w-12 text-right" style={{ color: i === 0 ? 'var(--primary)' : 'var(--muted-foreground)' }}>{(prob * 100).toFixed(1)}%</span>
                                    </div>
                                  ))}
                                </div>
                              ) : <p className="text-sm text-[var(--muted-foreground)]">No ML data available.</p>}
                            </div>

                            {/* Right: Top Structural Features */}
                            <div className="p-6 rounded-2xl border border-white/10 bg-[#111614]">
                              <h3 className="text-sm font-bold text-[var(--foreground)] mb-5 flex items-center gap-2"><Layers size={16} className="text-[var(--primary)]"/> Structural Anomalies</h3>
                              {ml?.top_features?.length > 0 ? (
                                <div className="space-y-4">
                                  {ml.top_features.map((f, i) => (
                                    <div key={i} className="flex flex-col gap-1.5" style={{ animation: `slideInRight 0.4s ease ${i * 0.05}s both` }}>
                                      <div className="flex justify-between items-center">
                                        <span className="text-xs font-mono text-[var(--muted-foreground)] truncate">{f.feature}</span>
                                        <span className="text-[10px] font-mono font-bold text-[var(--foreground)] bg-white/10 px-2 py-0.5 rounded">{f.value?.toFixed(3)}</span>
                                      </div>
                                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-red-500/50 to-red-400 rounded-full" style={{ width: `${Math.min(f.value * 100, 100)}%`, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : <p className="text-sm text-[var(--muted-foreground)]">No structural anomalies detected.</p>}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── INDICATORS TAB ──────────────────────────────── */}
                      {activeTab === 'indicators' && (
                        <div className="space-y-6" style={{ animation: 'fadeIn 0.3s ease' }}>
                          {iocSummary && (
                            <div className="grid grid-cols-4 gap-4">
                              {[
                                { label: 'Total Extractions', value: iocSummary.total, color: 'var(--foreground)', icon: Target },
                                { label: 'Malicious Intel', value: iocSummary.malicious, color: '#e54b4f', icon: ShieldX },
                                { label: 'Suspicious Intel', value: iocSummary.suspicious, color: '#f59e0b', icon: ShieldAlert },
                                { label: 'Clean Intel', value: iocSummary.clean, color: '#34b27b', icon: ShieldCheck },
                              ].map((s, idx) => {
                                const Icon = s.icon;
                                return (
                                  <div key={s.label} className="p-5 rounded-2xl border border-white/10 bg-[#111614] text-center" style={{ animation: `slideInUp 0.4s ease ${idx * 0.05}s both` }}>
                                    <Icon size={24} className="mx-auto mb-3 opacity-80" style={{ color: s.color }} />
                                    <p className="text-3xl font-black tabular-nums" style={{ color: s.color }}>{s.value}</p>
                                    <p className="text-xs font-mono font-semibold text-[var(--muted-foreground)] mt-2 uppercase tracking-wide">{s.label}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div className="grid grid-cols-1 gap-3">
                            {(analysisResult.ioc_enrichment?.enriched || analysisResult.indicators || []).map((ioc, i) => (
                              <div key={i} className="p-4 rounded-xl border border-white/10 bg-[#111614] flex items-center gap-4 hover:border-[var(--primary)]/30 hover:bg-[#161c1a] transition-all group"
                                   style={{ animation: `slideInUp 0.4s ease ${i * 0.04}s both` }}>
                                <div className="flex-shrink-0 w-32">
                                  <ReputationBadge reputation={ioc.enrichment?.reputation || 'unknown'} />
                                </div>
                                <div className="flex-1 min-w-0 border-l border-white/10 pl-4">
                                  <p className="text-sm font-mono font-bold text-[var(--foreground)] truncate group-hover:text-[var(--primary)] transition-colors">{ioc.value || ioc.normalized_value}</p>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded text-[var(--muted-foreground)] uppercase tracking-wider">{ioc.type}</span>
                                    {ioc.enrichment?.source && (
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded text-[var(--foreground)] border border-white/10">Source: {ioc.enrichment.source}</span>
                                    )}
                                  </div>
                                  {ioc.enrichment?.details && typeof ioc.enrichment.details === 'string' && (
                                    <p className="text-xs text-[var(--muted-foreground)] mt-2 bg-black/30 p-2 rounded border border-white/5 leading-relaxed">{ioc.enrichment.details}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                            {(!analysisResult.ioc_enrichment?.enriched?.length && !analysisResult.indicators?.length) &&
                              <EmptyState icon={Target} title="No IOCs Discovered" subtitle="The engine did not detect any URLs, IPs, Wallets, or Domains." />}
                          </div>
                        </div>
                      )}

                      {/* ── SCORING TAB ──────────────────────────────────── */}
                      {activeTab === 'scoring' && (
                        <div className="space-y-6" style={{ animation: 'fadeIn 0.3s ease' }}>
                          {/* Scoring Component Weights */}
                          {scoring && (
                            <div className="grid grid-cols-3 gap-6">
                              {[
                                { label: 'Rules & Heuristics', score: scoring.heuristic_score, weight: '30%', icon: Activity, color: '#6aa9ff', desc: 'Syntax & pattern rules' },
                                { label: 'AI Classification', score: scoring.ml_score, weight: '50%', icon: Brain, color: '#e54b4f', desc: 'Gradient boosting model' },
                                { label: 'Threat Intel', score: scoring.intel_score, weight: '20%', icon: Shield, color: '#f59e0b', desc: 'Safe Browsing verification' },
                              ].map(({ label, score: s, weight, icon: Icon, color, desc }, idx) => {
                                const numScore = extractScore(s);
                                return (
                                  <div key={label} className="p-6 rounded-2xl border border-white/10 bg-[#111614] relative overflow-hidden" style={{ animation: `slideInUp 0.4s ease ${idx * 0.1}s both` }}>
                                    <div className="absolute top-0 left-0 bottom-0 w-1" style={{ background: color }} />
                                    <div className="flex justify-between items-start mb-4">
                                      <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-white/5"><Icon size={18} style={{ color }} /></div>
                                      </div>
                                      <span className="text-xs font-mono font-bold py-1 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[var(--muted-foreground)]">Weight: {weight}</span>
                                    </div>
                                    <p className="text-sm font-bold text-[var(--foreground)] mb-1">{label}</p>
                                    <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider mb-4 font-mono">{desc}</p>
                                    <p className="text-4xl font-black tabular-nums">{numScore}<span className="text-sm font-medium text-[var(--muted-foreground)]">/100</span></p>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {analysisResult.features && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {Object.entries(analysisResult.features || {}).filter(([k]) => typeof analysisResult.features[k] === 'object').map(([category, features], idx) => (
                                <div key={category} className="p-6 rounded-2xl border border-white/10 bg-[#111614]" style={{ animation: `slideInUp 0.4s ease ${(idx+3) * 0.1}s both` }}>
                                  <h4 className="text-sm font-bold text-[var(--foreground)] mb-5 capitalize flex items-center gap-2">
                                    <Activity size={16} className="text-[var(--primary)]" />
                                    {category.replace(/_/g, ' ')} Signals
                                  </h4>
                                  <div className="space-y-3">
                                    {Object.entries(features || {}).slice(0, 8).map(([k, v]) => (
                                      <div key={k} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                                        <span className="text-xs font-mono text-[var(--muted-foreground)] truncate max-w-[200px]">{k}</span>
                                        <span className="text-xs font-mono text-[var(--foreground)] font-bold">
                                          {typeof v === 'boolean' ? (
                                            v ? <span className="text-red-400">DETECTED</span> : <span className="text-green-400">CLEAN</span>
                                          ) : typeof v === 'number' ? (
                                            v.toFixed(2)
                                          ) : typeof v === 'object' && v !== null ? (
                                            JSON.stringify(v).substring(0, 30)
                                          ) : (
                                            String(v || 'N/A')
                                          )}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── GRAPH, PATTERN, CORRELATION TABS ────────────── */}
                      {activeTab === 'graph' && (
                        <div className="rounded-2xl overflow-hidden border border-white/10" style={{ animation: 'fadeIn 0.4s ease' }}>
                          {isBuildingGraph ? (
                            <div className="py-24 px-8 text-center">
                              <div className="w-16 h-16 border-4 border-[var(--primary)]/20 border-t-[var(--primary)] rounded-full animate-spin mx-auto mb-4" />
                              <p className="text-sm text-[var(--muted-foreground)] font-medium">Building threat graph...</p>
                            </div>
                          ) : graphData && graphData.nodes && graphData.nodes.length > 0 ? (
                            <ThreatGraphViewer graphData={graphData} />
                          ) : analysisResult ? (
                            <div className="py-24 px-8">
                              <EmptyState icon={Network} title="Graph Construction Failed" subtitle="Unable to build entity relationship graph from current analysis data. The backend may not be running." />
                              <button 
                                onClick={() => buildGraph(analysisResult)}
                                className="mt-4 px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity text-sm font-bold"
                              >
                                Retry Graph Build
                              </button>
                            </div>
                          ) : (
                            <EmptyState icon={Network} title="No Graph Data" subtitle="Relational graph visualization will appear after structural analysis." />
                          )}
                        </div>
                      )}
                      
                      {activeTab === 'pattern' && (
                        <div style={{ animation: 'fadeIn 0.4s ease' }}>
                          {patternResult ? <PatternResult result={patternResult} /> : <EmptyState icon={Layers} title="No Pattern Matched" subtitle="Standard compliance pattern classification results will appear here." />}
                        </div>
                      )}
                      
                      {activeTab === 'correlation' && (
                        <div style={{ animation: 'fadeIn 0.4s ease' }}>
                          {correlation?.correlation ? (
                            <div className="p-6 rounded-2xl border border-white/10 bg-[#111614]">
                              <h3 className="text-sm font-bold text-[var(--foreground)] mb-4 flex items-center gap-2"><GitMerge size={16} className="text-[var(--primary)]"/> Global Campaign Correlation</h3>
                              <pre className="text-sm font-mono text-[var(--muted-foreground)] whitespace-pre-wrap bg-black/40 p-6 rounded-xl border border-white/5 overflow-auto max-h-[500px] leading-relaxed">{JSON.stringify(correlation.correlation, null, 2)}</pre>
                            </div>
                          ) : <EmptyState icon={GitMerge} title="No Campaign Correlations" subtitle="This payload does not correlate strongly with known active threat campaigns across the federated network." />}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Right Sidebar: Demos & Meta ──────────────────────────── */}
              <div className="space-y-6">
                <div className="bg-[#111614] rounded-2xl border border-white/10 p-5">
                  <h2 className="text-xs font-mono font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Database size={14}/> Test Scenarios
                  </h2>
                  <div className="space-y-3">
                    {DEMO_SCENARIOS.map(demo => {
                      const Icon = demo.icon;
                      return (
                        <button key={demo.id} onClick={() => loadDemo(demo)}
                          className="w-full text-left p-3.5 rounded-xl border border-white/5 bg-[#161c1a] hover:border-white/20 hover:bg-white/5 transition-all group flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${demo.color}15`, border: `1px solid ${demo.color}30`, color: demo.color }}>
                            <Icon size={16} />
                          </div>
                          <div className="flex-1 min-w-0 py-0.5">
                            <p className="text-xs font-bold text-[var(--foreground)] group-hover:text-white transition-colors">{demo.label}</p>
                            <p className="text-[10px] text-[var(--muted-foreground)] font-mono truncate mt-1">{demo.content.substring(0, 45)}...</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Analysis Meta Summary */}
                {analysisResult && (
                  <div className="bg-[#111614] rounded-2xl border border-[var(--primary)]/20 p-5" style={{ animation: 'slideInUp 0.4s ease', boxShadow: '0 10px 40px rgba(52,178,123,0.05)' }}>
                    <h2 className="text-xs font-mono font-bold text-[var(--primary)] uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Target size={14}/> Execution Meta
                    </h2>
                    <div className="space-y-4">
                      {[
                        { label: 'Classification', value: ml?.predicted_class?.replace(/_/g, ' ').toUpperCase() || 'N/A', color: 'var(--foreground)' },
                        { label: 'ML Confidence', value: ml ? `${(ml.confidence * 100).toFixed(2)}%` : 'N/A', mono: true },
                        { label: 'Risk Score', value: `${currentRiskScore}/100`, bold: true, color: currentRiskScore >= 75 ? '#e54b4f' : currentRiskScore >= 50 ? '#f59e0b' : '#34b27b' },
                        { label: 'Total IOCs', value: iocSummary?.total || analysisResult.indicators?.length || 0, mono: true },
                        ...(iocSummary?.malicious > 0 ? [{ label: 'Malicious IOCs', value: iocSummary.malicious, color: '#e54b4f', bold: true, mono: true }] : []),
                        { label: 'Extracted Claims', value: analysisResult.claims?.length || 0, mono: true },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0 last:pb-0">
                          <span className="text-[11px] text-[var(--muted-foreground)] uppercase">{row.label}</span>
                          <span className={`text-sm ${row.bold ? 'font-black' : 'font-semibold'} ${row.mono ? 'font-mono' : ''}`} style={{ color: row.color || 'var(--foreground)' }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ LIVE MONITOR VIEW ════════════════════════════════════════════ */}
        {activeView === 'monitor' && (
          <div className="w-full max-w-[1200px] mx-auto px-10 py-8" style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-4 border-b border-white/5 gap-4">
              <div>
                <h1 className="text-3xl font-black text-[var(--foreground)] flex items-center gap-3">
                  Autonomous Email Monitor
                  {emailMonitoring && <span className="w-3 h-3 rounded-full bg-green-400 inline-block mb-1" style={{ boxShadow: '0 0 16px #34b27b', animation: 'pulseRing 2s infinite' }} />}
                </h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-2 font-medium">
                  {emailMonitoring ? `IMAP IDLE Push Stream Active · Inspecting payload ${liveFeed.length}` : 'Wire up an inbox via IMAP to stream and analyze incoming emails in real-time, autonomously.'}
                </p>
              </div>
              <button
                onClick={() => emailConnected ? setShowDisconnectModal(true) : setShowEmailModal(true)}
                className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all border ${
                  emailMonitoring ? 'bg-green-500/10 border-green-500/30 text-[var(--foreground)] hover:bg-green-500/20' : 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)] hover:shadow-[0_0_30px_rgba(52,178,123,0.35)]'
                }`}
              >
                {emailMonitoring ? <><Wifi size={18} className="text-green-400" /> Active (Sever Connection)</> : <><Wifi size={18} /> Establish Connection</>}
              </button>
            </div>

            {!emailMonitoring && liveFeed.length === 0 ? (
              <EmptyState icon={Inbox} title="Stream Offline" subtitle="Connect an IMAP email source. The AI engine will passively listen and analyze payloads as they arrive." />
            ) : (
              <div className="space-y-4">
                {liveFeed.map((item, i) => {
                  const isDel = deletingItems.includes(item.id);
                  const isSel = selectedFeedItem === i;
                  const itemScore = extractScore(item.risk_score) || extractScore(item.ml_classification) || extractScore(item.scoring_breakdown) || 0;
                  return (
                    <div key={item.id}
                      className={`rounded-2xl border transition-all ${isDel ? 'slide-out' : ''} ${
                        isSel ? 'bg-[#111614] border-[var(--primary)]/40 shadow-[0_10px_40px_rgba(52,178,123,0.08)]' : 'bg-[#111614]/50 border-white/5 hover:border-white/20 hover:bg-[#111614]'
                      }`}
                      style={!isDel ? { animation: `slideInUp 0.4s ease ${i * 0.04}s both` } : {}}
                    >
                      {/* Condensed Header */}
                      <div className="flex items-center gap-5 p-5 cursor-pointer" onClick={() => setSelectedFeedItem(isSel ? null : i)}>
                        <div className="flex-shrink-0">
                          <SeverityBadge severity={item.ml_classification?.severity || 'medium'} large />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold text-[var(--foreground)] truncate flex items-center gap-2">
                            {item.email?.subject || 'NO SUBJECT'}
                          </p>
                          <p className="text-xs text-[var(--muted-foreground)] mt-1.5 font-mono truncate">
                            FROM: <span className="text-[var(--foreground)]">{item.email?.from || 'Unknown'}</span>
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-[10px] font-mono text-[var(--muted-foreground)] tracking-widest uppercase mb-1">Threat Index</p>
                            <p className="text-2xl font-black tabular-nums">{itemScore}<span className="text-xs text-[var(--muted-foreground)] font-medium">/100</span></p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-[var(--muted-foreground)] bg-white/5 px-2 py-1 rounded-lg flex items-center gap-1.5">
                              <Clock size={12}/> {new Date(item.timestamp).toLocaleTimeString()}
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); deleteFeedItem(item.id); }} className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--muted-foreground)] hover:text-red-400 transition-colors" title="Purge Record">
                              <Trash2 size={16} />
                            </button>
                            <ChevronDown size={20} className={`text-[var(--muted-foreground)] transition-transform duration-300 ${isSel ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </div>

                      {/* Expanded Forensic Detail */}
                      {isSel && (
                        <div className="px-5 pb-5 pt-2 border-t border-white/5" style={{ animation: 'fadeIn 0.3s ease' }}>
                          <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6 mt-4">
                            {/* Detailed Info */}
                            <div className="space-y-5">
                              <div className="flex gap-4">
                                <div className="flex-1 bg-[#161c1a] p-4 rounded-xl border border-white/5">
                                  <p className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase mb-1">AI Verdict</p>
                                  <p className="text-sm font-bold text-[var(--primary)] uppercase">{item.ml_classification?.predicted_class?.replace(/_/g, ' ') || 'Unknown'}</p>
                                </div>
                                <div className="flex-1 bg-[#161c1a] p-4 rounded-xl border border-white/5">
                                  <p className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase mb-1">Model Confidence</p>
                                  <p className="text-sm font-bold font-mono text-[var(--foreground)]">{item.ml_classification?.confidence ? `${(item.ml_classification.confidence * 100).toFixed(2)}%` : 'N/A'}</p>
                                </div>
                                <div className="flex-1 bg-[#161c1a] p-4 rounded-xl border border-white/5">
                                  <p className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase mb-1">IOCs Discovered</p>
                                  <p className="text-sm font-bold font-mono text-[var(--foreground)]">{item.indicator_summary?.total || 0}</p>
                                </div>
                              </div>

                              <div>
                                <p className="text-[11px] font-bold text-[var(--foreground)] uppercase mb-2 flex items-center gap-2"><FileText size={14} className="text-[var(--primary)]"/> Decoded Payload Body</p>
                                <div className="p-4 rounded-xl bg-black/40 border border-white/5 max-h-[250px] overflow-y-auto custom-scrollbar">
                                  <pre className="text-sm font-mono text-[var(--muted-foreground)] whitespace-pre-wrap leading-relaxed">{item.email?.bodyPreview || 'No readable body content extracted.'}</pre>
                                </div>
                              </div>
                            </div>
                            
                            {/* Evidence / Features */}
                            <div className="bg-[#161c1a] p-4 rounded-xl border border-white/5">
                              <p className="text-[11px] font-bold text-[var(--foreground)] uppercase mb-4 flex items-center gap-2"><Brain size={14} className="text-[var(--primary)]"/> Conviction Evidence</p>
                              {item.ml_classification?.top_features?.length > 0 ? (
                                <div className="space-y-3">
                                  {item.ml_classification.top_features.slice(0, 4).map((f, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                      <span className="text-[10px] font-mono text-[var(--muted-foreground)] truncate w-40">{f.feature}</span>
                                      <span className="text-[10px] font-mono font-bold text-[var(--foreground)] bg-white/10 px-1.5 py-0.5 rounded">{f.value?.toFixed(2)}</span>
                                    </div>
                                  ))}
                                  <button onClick={() => loadHistoryItemToAnalyze(item)} className="w-full mt-4 py-2 text-xs font-bold text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 rounded-lg transition-colors border border-[var(--primary)]/20">
                                    Load Full Forensic View
                                  </button>
                                </div>
                              ) : <p className="text-xs text-[var(--muted-foreground)]">No direct feature evidence attached to feed object.</p>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        
        {/* ══ SMS MONITOR VIEW ════════════════════════════════════════════════ */}
        {activeView === 'smsMonitor' && (
          <div className="w-full max-w-[1200px] mx-auto px-10 py-8" style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-4 border-b border-white/5 gap-4">
              <div>
                <h1 className="text-3xl font-black text-[var(--foreground)] flex items-center gap-3">
                  <Smartphone size={28} className="text-[var(--primary)]"/> 
                  SMS Gateway Monitor
                  {smsActive && <span className="w-3 h-3 rounded-full bg-green-400 inline-block mb-1" style={{ boxShadow: '0 0 16px #34b27b', animation: 'pulseRing 2s infinite' }} />}
                </h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-2 font-medium">
                  {smsActive ? `Android Webhook Gateway Active · Inspecting payload ${smsLiveFeed.length}` : 'Connect an Android device via Webhook to stream and analyze incoming SMS messages (Smishing) in real-time.'}
                </p>
              </div>
              <button
                onClick={() => smsActive ? setShowSmsDisconnectModal(true) : setShowSmsModal(true)}
                className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all border ${
                  smsActive ? 'bg-green-500/10 border-green-500/30 text-[var(--foreground)] hover:bg-green-500/20' : 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)] hover:shadow-[0_0_30px_rgba(52,178,123,0.35)]'
                }`}
              >
                {smsActive ? <><Smartphone size={18} className="text-green-400" /> Active (Sever Connection)</> : <><Smartphone size={18} /> Establish Connection</>}
              </button>
            </div>

            {!smsActive && smsLiveFeed.length === 0 ? (
              <EmptyState icon={Smartphone} title="Gateway Offline" subtitle="Start the Android SMS Gateway listener. The AI engine will passively evaluate SMS texts for Smishing threats as they arrive." />
            ) : (
              <div className="space-y-4">
                {smsLiveFeed.map((item, i) => {
                  const isDel = deletingItems.includes(item.id);
                  const isSel = selectedSmsFeedItem === i;
                  const itemScore = extractScore(item.risk_score) || extractScore(item.ml_classification) || extractScore(item.scoring_breakdown) || 0;
                  return (
                    <div key={item.id}
                      className={`rounded-2xl border transition-all ${isDel ? 'slide-out' : ''} ${
                        isSel ? 'bg-[#111614] border-[var(--primary)]/40 shadow-[0_10px_40px_rgba(52,178,123,0.08)]' : 'bg-[#111614]/50 border-white/5 hover:border-white/20 hover:bg-[#111614]'
                      }`}
                      style={!isDel ? { animation: `slideInUp 0.4s ease ${i * 0.04}s both` } : {}}
                    >
                      {/* Condensed Header */}
                      <div className="flex items-center gap-5 p-5 cursor-pointer" onClick={() => setSelectedSmsFeedItem(isSel ? null : i)}>
                        <div className="flex-shrink-0">
                          <SeverityBadge severity={item.ml_classification?.severity || 'medium'} large />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold text-[var(--foreground)] truncate flex items-center gap-2">
                            {item.sms?.text?.substring(0, 80) || 'NO CONTENT'}...
                          </p>
                          <p className="text-xs text-[var(--muted-foreground)] mt-1.5 font-mono truncate">
                            FROM: <span className="text-[var(--foreground)]">{item.sms?.from || 'Unknown Sender'}</span>
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-[10px] font-mono text-[var(--muted-foreground)] tracking-widest uppercase mb-1">Threat Index</p>
                            <p className="text-2xl font-black tabular-nums">{itemScore}<span className="text-xs text-[var(--muted-foreground)] font-medium">/100</span></p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-[var(--muted-foreground)] bg-white/5 px-2 py-1 rounded-lg flex items-center gap-1.5">
                              <Clock size={12}/> {new Date(item.timestamp).toLocaleTimeString()}
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); deleteSmsFeedItem(item.id); }} className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--muted-foreground)] hover:text-red-400 transition-colors" title="Purge Record">
                              <Trash2 size={16} />
                            </button>
                            <ChevronDown size={20} className={`text-[var(--muted-foreground)] transition-transform duration-300 ${isSel ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </div>

                      {/* Expanded Forensic Detail */}
                      {isSel && (
                        <div className="px-5 pb-5 pt-2 border-t border-white/5" style={{ animation: 'fadeIn 0.3s ease' }}>
                          <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6 mt-4">
                            {/* Detailed Info */}
                            <div className="space-y-5">
                              <div className="flex gap-4">
                                <div className="flex-1 bg-[#161c1a] p-4 rounded-xl border border-white/5">
                                  <p className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase mb-1">AI Verdict</p>
                                  <p className="text-sm font-bold text-[var(--primary)] uppercase">{item.ml_classification?.predicted_class?.replace(/_/g, ' ') || 'Unknown'}</p>
                                </div>
                                <div className="flex-1 bg-[#161c1a] p-4 rounded-xl border border-white/5">
                                  <p className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase mb-1">Model Confidence</p>
                                  <p className="text-sm font-bold font-mono text-[var(--foreground)]">{item.ml_classification?.confidence ? `${(item.ml_classification.confidence * 100).toFixed(2)}%` : 'N/A'}</p>
                                </div>
                                <div className="flex-1 bg-[#161c1a] p-4 rounded-xl border border-white/5">
                                  <p className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase mb-1">IOCs Discovered</p>
                                  <p className="text-sm font-bold font-mono text-[var(--foreground)]">{item.indicator_summary?.total || 0}</p>
                                </div>
                              </div>

                              <div>
                                <p className="text-[11px] font-bold text-[var(--foreground)] uppercase mb-2 flex items-center gap-2"><Smartphone size={14} className="text-[var(--primary)]"/> Raw SMS Payload</p>
                                <div className="p-4 rounded-xl bg-black/40 border border-white/5 max-h-[250px] overflow-y-auto custom-scrollbar">
                                  <pre className="text-sm font-mono text-[var(--muted-foreground)] whitespace-pre-wrap leading-relaxed">{item.sms?.text || 'No readable body content extracted.'}</pre>
                                </div>
                              </div>
                            </div>
                            
                            {/* Evidence / Features */}
                            <div className="space-y-4">
                              <div className="bg-[#161c1a] p-4 rounded-xl border border-white/5">
                                <p className="text-[11px] font-bold text-[var(--foreground)] uppercase mb-4 flex items-center gap-2"><Brain size={14} className="text-[var(--primary)]"/> Conviction Evidence</p>
                                {item.conviction_reasons?.length > 0 ? (
                                  <div className="space-y-3">
                                    {item.conviction_reasons.slice(0, 3).map((r, idx) => (
                                      <div key={idx} className="flex flex-col gap-1 text-xs">
                                        <span className={`font-bold ${r.severity === 'critical' ? 'text-red-400' : r.severity === 'high' ? 'text-orange-400' : 'text-yellow-400'}`}>{r.category}</span>
                                        <span className="text-[10px] text-[var(--muted-foreground)] leading-relaxed">{r.detail}</span>
                                      </div>
                                    ))}
                                    <button onClick={() => loadHistoryItemToAnalyze(item)} className="w-full mt-4 py-2 text-xs font-bold text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 rounded-lg transition-colors border border-[var(--primary)]/20">
                                      Load Full Forensic View
                                    </button>
                                  </div>
                                ) : <p className="text-xs text-[var(--muted-foreground)]">No direct feature evidence attached to feed object.</p>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

{/* ══ SOCIAL MONITOR VIEW ════════════════════════════════════════ */}
        {activeView === 'socialMonitor' && (
          <div className="w-full max-w-[1200px] mx-auto px-10 py-8" style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-4 border-b border-white/5 gap-4">
              <div>
                <h1 className="text-3xl font-black text-[var(--foreground)] flex items-center gap-3">
                  <MessageSquare size={28} className="text-[var(--primary)]"/>
                  Social Media Monitor
                  {socialActive && <span className="w-3 h-3 rounded-full bg-green-400 inline-block mb-1" style={{ boxShadow: '0 0 16px #34b27b', animation: 'pulseRing 2s infinite' }} />}
                </h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-2 font-medium">
                  {socialActive ? `Notification Gateway Active · ${socialLiveFeed.filter(m => m.isThreat).length} threats detected / ${socialLiveFeed.length} total` : 'Connect your Android device via MacroDroid to intercept and analyze WhatsApp, Instagram & Telegram messages in real-time.'}
                </p>
              </div>
              <button
                onClick={() => socialActive ? setShowSocialDisconnectModal(true) : setShowSocialModal(true)}
                className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all border ${
                  socialActive ? 'bg-green-500/10 border-green-500/30 text-[var(--foreground)] hover:bg-green-500/20' : 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)] hover:shadow-[0_0_30px_rgba(52,178,123,0.35)]'
                }`}
              >
                {socialActive ? <><MessageSquare size={18} className="text-green-400" /> Active (Sever Connection)</> : <><MessageSquare size={18} /> Establish Connection</>}
              </button>
            </div>

            {!socialActive && socialLiveFeed.length === 0 ? (
              <EmptyState icon={MessageSquare} title="Gateway Offline" subtitle="Connect the MacroDroid notification listener on your Android phone. Arth Saathi will passively intercept and classify messages from WhatsApp, Instagram, and Telegram." />
            ) : (
              <div className="space-y-6">
                {/* ── THREAT FEED ── */}
                {socialLiveFeed.filter(m => m.isThreat).length > 0 && (
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-red-400 mb-4 flex items-center gap-2"><AlertTriangle size={16}/> Threat Alerts ({socialLiveFeed.filter(m => m.isThreat).length})</h2>
                    <div className="space-y-3">
                      {socialLiveFeed.filter(m => m.isThreat).map((item, i) => {
                        const isDel = deletingItems.includes(item.id);
                        const isSel = selectedSocialFeedItem === item.id;
                        const itemScore = extractScore(item.risk_score) || extractScore(item.ml_classification) || extractScore(item.scoring_breakdown) || 0;
                        return (
                          <div key={item.id}
                            className={`rounded-2xl border transition-all ${isDel ? 'slide-out' : ''} ${
                              isSel ? 'bg-[#111614] border-red-500/40 shadow-[0_10px_40px_rgba(229,75,79,0.08)]' : 'bg-[#111614]/50 border-white/5 hover:border-red-500/20 hover:bg-[#111614]'
                            }`}
                            style={!isDel ? { animation: `slideInUp 0.4s ease ${i * 0.04}s both` } : {}}
                          >
                            <div className="flex items-center gap-5 p-5 cursor-pointer" onClick={() => setSelectedSocialFeedItem(isSel ? null : item.id)}>
                              <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border" style={{ background: `${item.social?.platformColor || '#888'}15`, borderColor: `${item.social?.platformColor || '#888'}40` }}>
                                <span className="text-lg font-black" style={{ color: item.social?.platformColor || '#888' }}>
                                  {item.social?.platformLabel?.charAt(0) || '?'}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider" style={{ background: `${item.social?.platformColor || '#888'}20`, color: item.social?.platformColor || '#888' }}>{item.social?.platformLabel || 'Unknown'}</span>
                                  <span className="text-[10px] font-mono text-[var(--muted-foreground)]">{item.social?.sender}</span>
                                </div>
                                <p className="text-sm font-bold text-[var(--foreground)] truncate">{item.social?.text?.substring(0, 100) || 'NO CONTENT'}</p>
                              </div>
                              <div className="text-right flex-shrink-0 flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-[10px] font-mono text-[var(--muted-foreground)] tracking-widest uppercase mb-1">Threat</p>
                                  <p className="text-xl font-black tabular-nums text-red-400">{itemScore}<span className="text-xs text-[var(--muted-foreground)] font-medium">/100</span></p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-mono text-[var(--muted-foreground)] bg-white/5 px-2 py-1 rounded-lg"><Clock size={10} className="inline mr-1"/> {new Date(item.timestamp).toLocaleTimeString()}</span>
                                  <button onClick={(e) => { e.stopPropagation(); deleteSocialFeedItem(item.id); }} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--muted-foreground)] hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                                  <ChevronDown size={18} className={`text-[var(--muted-foreground)] transition-transform duration-300 ${isSel ? 'rotate-180' : ''}`} />
                                </div>
                              </div>
                            </div>

                            {isSel && (
                              <div className="px-5 pb-5 pt-2 border-t border-white/5" style={{ animation: 'fadeIn 0.3s ease' }}>
                                <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6 mt-4">
                                  <div className="space-y-5">
                                    <div className="flex gap-4">
                                      <div className="flex-1 bg-[#161c1a] p-4 rounded-xl border border-white/5">
                                        <p className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase mb-1">AI Verdict</p>
                                        <p className="text-sm font-bold text-red-400 uppercase">{item.ml_classification?.predicted_class?.replace(/_/g, ' ') || 'Unknown'}</p>
                                      </div>
                                      <div className="flex-1 bg-[#161c1a] p-4 rounded-xl border border-white/5">
                                        <p className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase mb-1">Confidence</p>
                                        <p className="text-sm font-bold font-mono text-[var(--foreground)]">{item.ml_classification?.confidence ? `${(item.ml_classification.confidence * 100).toFixed(1)}%` : 'N/A'}</p>
                                      </div>
                                      <div className="flex-1 bg-[#161c1a] p-4 rounded-xl border border-white/5">
                                        <p className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase mb-1">Platform</p>
                                        <p className="text-sm font-bold" style={{ color: item.social?.platformColor }}>{item.social?.platformLabel}</p>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-bold text-[var(--foreground)] uppercase mb-2 flex items-center gap-2"><MessageSquare size={14} className="text-[var(--primary)]"/> Full Message</p>
                                      <div className="p-4 rounded-xl bg-black/40 border border-white/5 max-h-[250px] overflow-y-auto custom-scrollbar">
                                        <pre className="text-sm font-mono text-[var(--muted-foreground)] whitespace-pre-wrap leading-relaxed">{item.social?.text || 'No content.'}</pre>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-4">
                                    <div className="bg-[#161c1a] p-4 rounded-xl border border-white/5">
                                      <p className="text-[11px] font-bold text-[var(--foreground)] uppercase mb-4 flex items-center gap-2"><Brain size={14} className="text-red-400"/> Conviction Evidence</p>
                                      {item.conviction_reasons?.length > 0 ? (
                                        <div className="space-y-3">
                                          {item.conviction_reasons.filter(r => r.severity !== 'info').slice(0, 4).map((r, idx) => (
                                            <div key={idx} className="flex flex-col gap-1 text-xs">
                                              <span className={`font-bold ${r.severity === 'critical' ? 'text-red-400' : r.severity === 'high' ? 'text-orange-400' : 'text-yellow-400'}`}>{r.category}</span>
                                              <span className="text-[10px] text-[var(--muted-foreground)] leading-relaxed">{r.detail}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : <p className="text-xs text-[var(--muted-foreground)]">No conviction evidence attached.</p>}
                                    </div>
                                    {item.scoring_breakdown && (
                                      <div className="bg-[#161c1a] p-4 rounded-xl border border-white/5">
                                        <p className="text-[11px] font-bold text-[var(--foreground)] uppercase mb-3">Score Breakdown</p>
                                        {['ml_score', 'heuristic_score', 'intel_score'].map(k => (
                                          <div key={k} className="flex justify-between text-[11px] mb-2">
                                            <span className="text-[var(--muted-foreground)] capitalize">{k.replace(/_/g, ' ')}</span>
                                            <span className="font-mono font-bold text-[var(--foreground)]">{item.scoring_breakdown[k] || 0}</span>
                                          </div>
                                        ))}
                                        <div className="mt-2 pt-2 border-t border-white/5 flex justify-between text-xs">
                                          <span className="text-[var(--muted-foreground)] font-bold">Fused Score</span>
                                          <span className="font-mono font-black text-red-400">{item.scoring_breakdown.fused_score || itemScore}/100</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── SAFE MESSAGES (collapsed by default) ── */}
                {socialLiveFeed.filter(m => !m.isThreat).length > 0 && (
                  <div>
                    <button onClick={() => setSocialShowSafe(!socialShowSafe)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#111614] border border-white/5 hover:border-white/10 transition-all mb-3">
                      <span className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                        <ShieldCheck size={16} className="text-green-400"/>
                        Safe Messages ({socialLiveFeed.filter(m => !m.isThreat).length})
                      </span>
                      <ChevronDown size={18} className={`text-[var(--muted-foreground)] transition-transform duration-300 ${socialShowSafe ? 'rotate-180' : ''}`} />
                    </button>
                    {socialShowSafe && (
                      <div className="space-y-2" style={{ animation: 'fadeIn 0.3s ease' }}>
                        {socialLiveFeed.filter(m => !m.isThreat).slice(0, 30).map((item, i) => (
                          <div key={item.id} className="flex items-center gap-4 p-3 rounded-xl bg-[#111614]/30 border border-white/3 hover:bg-[#111614]/60 transition-all group" style={{ animation: `slideInUp 0.3s ease ${i * 0.02}s both` }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${item.social?.platformColor || '#888'}10` }}>
                              <span className="text-xs font-black" style={{ color: item.social?.platformColor || '#888' }}>{item.social?.platformLabel?.charAt(0) || '?'}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-[var(--muted-foreground)] truncate"><span className="font-bold text-[var(--foreground)]">{item.social?.sender}</span> via {item.social?.platformLabel}</p>
                              <p className="text-[11px] text-[var(--muted-foreground)] truncate mt-0.5">{item.social?.text?.substring(0, 80)}</p>
                            </div>
                            <span className="text-[10px] font-mono text-green-400/60 bg-green-400/5 px-2 py-1 rounded flex-shrink-0">SAFE</span>
                            <button onClick={() => deleteSocialFeedItem(item.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-[var(--muted-foreground)] hover:text-red-400 transition-all"><Trash2 size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {socialLiveFeed.length === 0 && socialActive && (
                  <EmptyState icon={MessageSquare} title="Listening..." subtitle="The notification gateway is active. Messages from WhatsApp and Instagram will appear here as they arrive." />
                )}
              </div>
            )}
          </div>
        )}

{/* ══ HISTORY VIEW ════════════════════════════════════════════════ */}
        {activeView === 'history' && (
          <div className="w-full max-w-[1200px] mx-auto px-10 py-8" style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
              <div>
                <h1 className="text-3xl font-black text-[var(--foreground)] flex items-center gap-3"><History size={28} className="text-[var(--primary)]"/> Analysis Logs</h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-2 font-medium">{analysisHistory.length} cryptographic records retained locally.</p>
              </div>
              {analysisHistory.length > 0 && (
                <button onClick={() => { saveHistory([]); showToast('Data vault purged', 'info'); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all">
                  <Trash2 size={16} /> Purge Vault
                </button>
              )}
            </div>

            {/* Search & Filter */}
            {analysisHistory.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                <div className="relative flex-1 w-full">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                  <input value={historyFilter} onChange={e => setHistoryFilter(e.target.value)}
                    placeholder="Query signatures, IOCs, or classifications..." className="w-full bg-[#111614] border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-sm font-medium text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/40 focus:outline-none focus:border-[var(--primary)]/40 transition-all" />
                </div>
                <select value={historySort} onChange={e => setHistorySort(e.target.value)} className="bg-[#111614] border border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]/40 appearance-none min-w-[150px]">
                  <option value="newest">Latest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
            )}

            {filteredHistory.length === 0 ? (
              <EmptyState icon={Archive} title="Vault Immutable" subtitle={historyFilter ? 'No analysis records match the cryptographic query.' : 'Historical analyses will drop here. Fire the engine to begin.'} />
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredHistory.map((item, i) => {
                  const isDel = deletingItems.includes(item.id);
                  const histScore = extractScore(item.risk_score) || extractScore(item.scoring_breakdown) || extractScore(item.ml_classification) || 0;
                  return (
                    <div key={item.id} className={`p-5 rounded-2xl border border-white/5 bg-[#111614] hover:border-[var(--primary)]/30 hover:bg-[#161c1a] transition-all group ${isDel ? 'slide-out' : ''}`}
                         style={!isDel ? { animation: `slideInUp 0.4s ease ${i * 0.03}s both` } : {}}>
                      <div className="flex items-center gap-5">
                        <div className="flex-shrink-0">
                          <SeverityBadge severity={item.severity} large />
                        </div>
                        <div className="flex-1 min-w-0 pr-4 border-r border-white/5">
                          <p className="text-sm font-mono text-[var(--foreground)] truncate group-hover:text-white transition-colors mb-2">{item.content}</p>
                          <div className="flex items-center gap-4">
                            <span className="text-[11px] font-mono text-[var(--muted-foreground)] flex items-center gap-1.5"><Clock size={12} /> {new Date(item.timestamp).toLocaleString()}</span>
                            <span className="text-[11px] font-mono text-white/40 border border-white/10 px-2 py-0.5 rounded uppercase">{item.modeLabel || item.mode}</span>
                            <span className="text-[11px] font-bold text-[var(--primary)] uppercase px-2 py-0.5 bg-[var(--primary)]/10 rounded">{item.classification?.replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-center w-20">
                          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] mb-1">Index</p>
                          <p className="text-xl font-black tabular-nums">{histScore}<span className="text-xs font-medium text-[var(--muted-foreground)]">/100</span></p>
                        </div>
                        <div className="flex items-center gap-2 pl-4">
                          <button onClick={() => loadHistoryItemToAnalyze(item)} className="p-2.5 rounded-xl bg-white/5 hover:bg-[var(--primary)] text-[var(--muted-foreground)] hover:text-black transition-all shadow-sm" title="Re-Analyze in Workbench">
                            <ExternalLink size={16} />
                          </button>
                          <button onClick={() => { const r = generateReport(item.analysis); const b = new Blob([r], { type: 'text/plain' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `report-${item.id}.txt`; a.click(); URL.revokeObjectURL(u); showToast('Report retrieved'); }}
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--foreground)] transition-all" title="Extract Report">
                            <FileDown size={16} />
                          </button>
                          <button onClick={() => deleteHistoryItem(item.id)} className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-[var(--muted-foreground)] hover:text-red-400 transition-all" title="Shred Record">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Sub-Modals & Overlays ─────────────────────────────────────── */}

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md" style={{ animation: 'fadeIn 0.2s ease' }}>
          <div className="w-full max-w-sm mx-4 bg-[#111614] rounded-3xl border border-white/10 shadow-2xl p-6 text-center" style={{ animation: 'scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 mx-auto flex items-center justify-center mb-4">
              <WifiOff size={28} />
            </div>
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">Sever Connection?</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-8">This will immediately halt the IMAP IDLE stream. Incoming zero-day threats will not be autonomously analyzed until reconnected.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDisconnectModal(false)} className="flex-1 py-3 rounded-xl text-sm font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-[var(--foreground)] transition-all">Cancel</button>
              <button onClick={handleEmailDisconnect} className="flex-1 py-3 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all">Sever Status</button>
            </div>
          </div>
        </div>
      )}

      {/* Email Connect Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md" style={{ animation: 'fadeIn 0.2s ease' }}>
          <div className="w-full max-w-md mx-4 rounded-3xl border border-[var(--primary)]/20 bg-[#0a0f0d] shadow-2xl overflow-hidden" style={{ animation: 'scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div className="px-8 py-6 border-b border-white/5 bg-[var(--primary)]/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center border border-[var(--primary)]/20"><Mail size={24} className="text-[var(--primary)]" /></div>
                <div>
                  <h2 className="text-lg font-black text-[var(--foreground)]">Wire Inbox Source</h2>
                  <p className="text-xs text-[var(--primary)] font-mono uppercase tracking-widest mt-0.5">Encrypted IMAP Stream</p>
                </div>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="p-2 rounded-xl hover:bg-white/10 text-[var(--muted-foreground)] hover:text-white transition-colors"><X size={20} /></button>
            </div>

            <div className="p-8 space-y-5 bg-[#111614]">
              <div>
                <label className="text-xs font-bold text-[var(--muted-foreground)] mb-2 block uppercase tracking-wider">Mail Server Host</label>
                <select value={emailConfig.host} onChange={(e) => setEmailConfig({ ...emailConfig, host: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-medium text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]/50 transition-all appearance-none">
                  <option value="imap.gmail.com">Google / Workspace (imap.gmail.com)</option>
                  <option value="outlook.office365.com">Microsoft 365 (outlook.office365.com)</option>
                  <option value="imap.mail.yahoo.com">Yahoo Mail (imap.mail.yahoo.com)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--muted-foreground)] mb-2 block uppercase tracking-wider">Target Address</label>
                <input type="email" value={emailConfig.email} onChange={(e) => setEmailConfig({ ...emailConfig, email: e.target.value })}
                  placeholder="admin@corp-target.com" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/30 focus:outline-none focus:border-[var(--primary)]/50 transition-all" />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--muted-foreground)] mb-2 block uppercase tracking-wider">Application Handshake Key</label>
                <input type="password" value={emailConfig.password} onChange={(e) => setEmailConfig({ ...emailConfig, password: e.target.value })}
                  placeholder="•••• •••• •••• ••••" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/30 focus:outline-none focus:border-[var(--primary)]/50 transition-all tracking-[0.2em]" />
                <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl mt-3 flex items-start gap-2">
                  <Info size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-blue-300 leading-relaxed font-medium">Use an App Password, not your login password. Google: Security → 2-Step Verification → App Passwords.</p>
                </div>
              </div>
              <button onClick={handleEmailConnect} disabled={emailConnecting || !emailConfig.email || !emailConfig.password}
                className="w-full mt-2 py-4 rounded-xl text-sm font-black uppercase tracking-wider bg-[var(--primary)] text-[var(--primary-foreground)] hover:shadow-[0_0_40px_rgba(52,178,123,0.4)] transition-all disabled:opacity-30 disabled:hover:shadow-none">
                {emailConnecting ? <span className="inline-flex items-center gap-3"><span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Authenticating...</span> : 'Initiate Secure Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      
      {/* SMS Disconnect Confirmation Modal */}
      {showSmsDisconnectModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md" style={{ animation: 'fadeIn 0.2s ease' }}>
          <div className="w-full max-w-sm mx-4 bg-[#111614] rounded-3xl border border-white/10 shadow-2xl p-6 text-center" style={{ animation: 'scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 mx-auto flex items-center justify-center mb-4">
              <Smartphone size={28} />
            </div>
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">Disable Gateway?</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-8">This will immediately reject HTTP webhooks from the Android SMS Gateway. Incoming messages will not be analyzed.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSmsDisconnectModal(false)} className="flex-1 py-3 rounded-xl text-sm font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-[var(--foreground)] transition-all">Cancel</button>
              <button onClick={handleSmsDisconnect} className="flex-1 py-3 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all">Sever Status</button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Connect Modal */}
      {showSmsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md" style={{ animation: 'fadeIn 0.2s ease' }}>
          <div className="w-full max-w-lg mx-4 rounded-3xl border border-[var(--primary)]/20 bg-[#0a0f0d] shadow-2xl overflow-hidden" style={{ animation: 'scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div className="px-8 py-6 border-b border-white/5 bg-[var(--primary)]/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center border border-[var(--primary)]/20"><Smartphone size={24} className="text-[var(--primary)]" /></div>
                <div>
                  <h2 className="text-lg font-black text-[var(--foreground)]">Wire Android SMS Gateway</h2>
                  <p className="text-xs text-[var(--primary)] font-mono uppercase tracking-widest mt-0.5">Webhook Ingestion Port</p>
                </div>
              </div>
              <button onClick={() => setShowSmsModal(false)} className="p-2 rounded-xl hover:bg-white/10 text-[var(--muted-foreground)] hover:text-white transition-colors"><X size={20} /></button>
            </div>

            <div className="p-8 space-y-5 bg-[#111614]">
              <div className="bg-white/5 border border-[var(--primary)]/20 p-4 rounded-xl flex items-start gap-4">
                <Brain size={24} className="text-[var(--primary)] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-[13px] text-[var(--foreground)] font-bold mb-1">Local ML Smishing Classification</p>
                  <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                    SMS messages forwarded to this gateway are processed by an offline Gradient Boosting Machine Learning model trained on 3,000+ Smishing and benign text samples. It assesses 25 separate linguistic anomalies (urgency scores, payload composition, link obfuscation ratios) within ~50ms, achieving 96% validation accuracy without sending data to external AI APIs.
                  </p>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-[var(--muted-foreground)] mb-2 block uppercase tracking-wider">Android Webhook Configuration Instructions</label>
                <ol className="list-decimal pl-4 space-y-2 text-xs text-[var(--muted-foreground)] leading-relaxed mb-4">
                  <li>Download the <strong className="text-white">"SMS to URL Forwarder"</strong> or similar Webhook app on your Android Phone.</li>
                  <li>In the app, set up a new filter to forward <strong className="text-white">ALL incoming SMS</strong>.</li>
                  <li>Copy the following Webhook URL exactly and paste it as the target HTTP endpoint:</li>
                </ol>
                <div className="flex cursor-pointer hover:opacity-80 transition-opacity" onClick={() => { navigator.clipboard.writeText('http://192.168.0.100:5001/api/sms/webhook'); alert('Webhook URL copied to clipboard'); }}>
                  <div className="bg-black border border-white/20 border-r-0 rounded-l-xl px-4 py-3 flex-1 flex items-center overflow-x-auto">
                    <span className="text-[13px] font-mono text-[var(--primary)] whitespace-nowrap select-all tracking-wider">http://192.168.0.100:5001/api/sms/webhook</span>
                  </div>
                  <div className="bg-white/10 border border-white/20 rounded-r-xl px-4 flex items-center justify-center hover:bg-white/20">
                    <Copy size={16} className="text-white font-bold" />
                  </div>
                </div>
              </div>
              
              <button onClick={handleSmsConnect}
                className="w-full mt-4 py-4 rounded-xl text-sm font-black uppercase tracking-wider bg-[var(--primary)] text-[var(--primary-foreground)] hover:shadow-[0_0_40px_rgba(52,178,123,0.4)] transition-all">
                Activate Webhook Listener
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Social Disconnect Confirmation Modal */}
      {showSocialDisconnectModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md" style={{ animation: 'fadeIn 0.2s ease' }}>
          <div className="w-full max-w-sm mx-4 bg-[#111614] rounded-3xl border border-white/10 shadow-2xl p-6 text-center" style={{ animation: 'scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 mx-auto flex items-center justify-center mb-4">
              <MessageSquare size={28} />
            </div>
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">Disable Social Gateway?</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-8">This will stop intercepting notifications from WhatsApp, Instagram, and Telegram. Messages will no longer be analyzed until reconnected.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSocialDisconnectModal(false)} className="flex-1 py-3 rounded-xl text-sm font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-[var(--foreground)] transition-all">Cancel</button>
              <button onClick={handleSocialDisconnect} className="flex-1 py-3 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all">Sever Status</button>
            </div>
          </div>
        </div>
      )}

      {/* Social Connect Modal */}
      {showSocialModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md" style={{ animation: 'fadeIn 0.2s ease' }}>
          <div className="w-full max-w-lg mx-4 rounded-3xl border border-[var(--primary)]/20 bg-[#0a0f0d] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto" style={{ animation: 'scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div className="px-8 py-6 border-b border-white/5 bg-[var(--primary)]/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center border border-[var(--primary)]/20"><MessageSquare size={24} className="text-[var(--primary)]" /></div>
                <div>
                  <h2 className="text-lg font-black text-[var(--foreground)]">Social Media Gateway</h2>
                  <p className="text-xs text-[var(--primary)] font-mono uppercase tracking-widest mt-0.5">MacroDroid Notification Bridge</p>
                </div>
              </div>
              <button onClick={() => setShowSocialModal(false)} className="p-2 rounded-xl hover:bg-white/10 text-[var(--muted-foreground)] hover:text-white transition-colors"><X size={20} /></button>
            </div>

            <div className="p-8 space-y-5 bg-[#111614]">
              {/* Privacy Consent */}
              <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl">
                <p className="text-[13px] text-amber-400 font-bold mb-2 flex items-center gap-2"><AlertTriangle size={16}/> Privacy Notice</p>
                <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed mb-3">
                  By activating this feature, you consent to Arth Saathi analyzing notification text from your selected social media apps (WhatsApp, Instagram). <strong className="text-white">All data stays on your local machine</strong> — nothing is sent to external servers. The ML model runs entirely offline. You can disconnect and purge all data at any time.
                </p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={socialConsentGiven} onChange={(e) => setSocialConsentGiven(e.target.checked)} className="w-4 h-4 rounded accent-[var(--primary)]" />
                  <span className="text-xs font-bold text-[var(--foreground)]">I understand and consent to local notification analysis</span>
                </label>
              </div>

              {/* ML Description */}
              <div className="bg-white/5 border border-[var(--primary)]/20 p-4 rounded-xl flex items-start gap-4">
                <Brain size={24} className="text-[var(--primary)] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-[13px] text-[var(--foreground)] font-bold mb-1">Advanced ML Classification Engine</p>
                  <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                    Every message is processed by an offline Gradient Boosting classifier trained on 3,000+ labelled samples with TF-IDF vectorisation + 25 structural features. The model evaluates character entropy, URL-to-text ratios, keyword density gradients, and n-gram anomalies — not simple keyword matching. Romance scams, investment fraud, phishing, and brand impersonation are all detected with high confidence. Normal messages are automatically separated into a &quot;Safe&quot; category.
                  </p>
                </div>
              </div>

              {/* MacroDroid Setup */}
              <div>
                <label className="text-xs font-bold text-[var(--muted-foreground)] mb-3 block uppercase tracking-wider">MacroDroid Configuration</label>
                <ol className="list-decimal pl-4 space-y-2 text-xs text-[var(--muted-foreground)] leading-relaxed mb-4">
                  <li>Install <strong className="text-white">MacroDroid</strong> from Google Play Store</li>
                  <li>Grant <strong className="text-white">Notification Access</strong> permission in Settings</li>
                  <li>Create a Macro → Trigger: <strong className="text-white">Notification Received</strong> → Select <strong className="text-white">WhatsApp</strong> &amp; <strong className="text-white">Instagram</strong></li>
                  <li>Action: <strong className="text-white">HTTP Request (POST)</strong> → Paste the URL below</li>
                  <li>Set Content Type: <strong className="text-white">application/json</strong></li>
                  <li>Body: <code className="text-[var(--primary)] bg-black/40 px-1 rounded text-[10px]">{'{"title":"{not_title}","text":"{notification}","app_name":"{not_app_name}","package":"{not_app_package}"}'}</code></li>
                </ol>
                <div className="flex cursor-pointer hover:opacity-80 transition-opacity" onClick={() => { navigator.clipboard.writeText('http://192.168.0.100:5001/api/social/webhook'); showToast('Webhook URL copied', 'info'); }}>
                  <div className="bg-black border border-white/20 border-r-0 rounded-l-xl px-4 py-3 flex-1 flex items-center overflow-x-auto">
                    <span className="text-[13px] font-mono text-[var(--primary)] whitespace-nowrap select-all tracking-wider">http://192.168.0.100:5001/api/social/webhook</span>
                  </div>
                  <div className="bg-white/10 border border-white/20 rounded-r-xl px-4 flex items-center justify-center hover:bg-white/20">
                    <Copy size={16} className="text-white font-bold" />
                  </div>
                </div>
              </div>

              <button onClick={handleSocialConnect} disabled={!socialConsentGiven}
                className="w-full mt-4 py-4 rounded-xl text-sm font-black uppercase tracking-wider bg-[var(--primary)] text-[var(--primary-foreground)] hover:shadow-[0_0_40px_rgba(52,178,123,0.4)] transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none">
                {socialConsentGiven ? 'Activate Social Gateway' : 'Accept Privacy Terms First'}
              </button>
            </div>
          </div>
        </div>
      )}

{/* Analysis Loading Overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-xl" style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="p-10 rounded-3xl border border-[var(--primary)]/30 bg-[#0a0f0d] text-center shadow-[0_0_100px_rgba(52,178,123,0.15)] max-w-sm w-full" style={{ animation: 'scaleIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 rounded-2xl border-2 border-[var(--primary)]/10" />
              <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-[var(--primary)]" style={{ animation: 'radarScan 1.5s linear infinite' }} />
              <div className="absolute inset-2 rounded-xl border border-[var(--primary)]/10" />
              <div className="absolute inset-2 rounded-xl border border-transparent border-b-[var(--primary)] opacity-50" style={{ animation: 'radarScan 2.5s linear infinite reverse' }} />
              <div className="absolute inset-0 flex items-center justify-center"><Shield size={32} className="text-[var(--primary)] drop-shadow-[0_0_15px_rgba(52,178,123,0.8)]" /></div>
            </div>

            <p className="text-xl font-black text-[var(--foreground)] mb-2 uppercase tracking-wide">Processing Array</p>
            <p className="text-xs font-mono text-[var(--primary)] mb-8 uppercase tracking-widest opacity-80">Autonomous Engine Active</p>

            <div className="space-y-4 text-left">
              {[
                { step: 1, label: 'Lexical parsing & Entity extraction' },
                { step: 2, label: 'ML execution & Feature grading' },
                { step: 3, label: 'Google Safe Browsing intel fusion' },
              ].map(({ step, label }) => (
                <div key={step} className="flex items-center gap-4 p-3 rounded-xl border border-white/5" style={{ background: analyzeStep >= step ? 'rgba(52,178,123,0.05)' : 'transparent', transition: 'all 0.3s ease' }}>
                  <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold transition-colors ${
                    analyzeStep > step ? 'bg-[var(--primary)] text-black' : analyzeStep === step ? 'bg-[var(--primary)]/20 text-[var(--primary)]' : 'bg-white/5 text-[var(--muted-foreground)]'
                  }`}>
                    {analyzeStep > step ? <Check size={14} /> : step}
                  </div>
                  <span className={`text-xs font-semibold ${analyzeStep >= step ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>{label}</span>
                  {analyzeStep === step && <div className="w-4 h-4 border-2 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin ml-auto" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Ensure Database and external icons map properly, replacing one that might not be imported if skipped
const Database = Layers;  // Fallback map for Database if missed in imports
