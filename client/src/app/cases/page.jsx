"use client";
import { useState, useEffect } from 'react';
import { Briefcase, Filter, Plus, ChevronDown, ChevronRight, Clock, User, AlertTriangle, CheckCircle2, Eye, RefreshCw } from 'lucide-react';
import { SERVER_URL_1 } from '@/utils/commonHelper';
import Link from 'next/link';

const STATUS_STYLE = {
  new:          'bg-blue-500/10 text-blue-500 border-blue-500/30',
  triaging:     'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  investigating: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  escalated:    'bg-red-500/10 text-red-500 border-red-500/30',
  monitoring:   'bg-purple-500/10 text-purple-500 border-purple-500/30',
  mitigated:    'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  closed:       'bg-muted text-muted-foreground border-border',
};

const PRIORITY_STYLE = {
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
  high:     'bg-orange-500/10 text-orange-500 border-orange-500/30',
  medium:   'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  low:      'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
};

const SEV = {
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
  high:     'bg-orange-500/10 text-orange-500 border-orange-500/30',
  medium:   'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  low:      'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
};

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CaseCard({ caseData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card transition-all hover:border-primary/40">
      <div className="flex items-start gap-3 p-4">
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-1 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${STATUS_STYLE[caseData.status] || STATUS_STYLE.new}`}>
              {caseData.status}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium uppercase ${PRIORITY_STYLE[caseData.priority] || PRIORITY_STYLE.medium}`}>
              {caseData.priority}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-xs ${SEV[caseData.severity] || SEV.medium}`}>
              {caseData.severity}
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {caseData.threat_family?.replace(/_/g, ' ') || 'Unknown'}
            </span>
          </div>

          <Link href={`/cases/${caseData.case_id}`}>
            <h3 className="text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer">
              {caseData.title}
            </h3>
          </Link>

          {caseData.summary && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{caseData.summary}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {timeAgo(caseData.created_at)}
            </span>
            {caseData.assignee && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {caseData.assignee}
              </span>
            )}
            {caseData.linked_alert_ids?.length > 0 && (
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {caseData.linked_alert_ids.length} alert{caseData.linked_alert_ids.length !== 1 ? 's' : ''}
              </span>
            )}
            {caseData.linked_artifact_ids?.length > 0 && (
              <span className="flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" />
                {caseData.linked_artifact_ids.length} artifact{caseData.linked_artifact_ids.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <Link
          href={`/cases/${caseData.case_id}`}
          className="rounded-lg border border-primary bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors flex items-center gap-1"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </Link>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Case ID:</span>
              <span className="ml-2 font-mono text-foreground">{caseData.case_id.slice(0, 16)}…</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created by:</span>
              <span className="ml-2 text-foreground">{caseData.created_by}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Confidence:</span>
              <span className="ml-2 text-foreground">{Math.round((caseData.confidence || 0) * 100)}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">Updated:</span>
              <span className="ml-2 text-foreground">{timeAgo(caseData.updated_at)}</span>
            </div>
          </div>
          
          {caseData.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2">
              {caseData.tags.map((tag, i) => (
                <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CasesPage() {
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterFamily, setFilterFamily] = useState('');

  const fetchCases = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterPriority) params.set('priority', filterPriority);
      if (filterSeverity) params.set('severity', filterSeverity);
      if (filterFamily) params.set('threat_family', filterFamily);

      const [casesRes, statsRes] = await Promise.all([
        fetch(`${SERVER_URL_1}/api/cases?${params}`),
        fetch(`${SERVER_URL_1}/api/cases/stats`),
      ]);

      const [casesData, statsData] = await Promise.all([casesRes.json(), statsRes.json()]);
      
      if (casesData.cases) setCases(casesData.cases);
      if (statsData.stats) setStats(statsData.stats);
    } catch (error) {
      console.error('Fetch cases error:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCases();
  }, [filterStatus, filterPriority, filterSeverity, filterFamily]);

  const FAMILIES = [...new Set(cases.map(c => c.threat_family))].filter(Boolean);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Briefcase className="h-7 w-7 text-primary" />
              <div>
                <h1 className="text-xl font-bold text-foreground">Case Management</h1>
                <p className="text-xs text-muted-foreground">Investigation workspace</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchCases}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <Link
                href="/cases/new"
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Case
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Stats bar */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Total', val: stats.total, cls: 'text-foreground' },
              { label: 'New', val: stats.new, cls: 'text-blue-500' },
              { label: 'Investigating', val: stats.investigating, cls: 'text-orange-500' },
              { label: 'Critical', val: stats.critical_priority, cls: 'text-destructive' },
              { label: 'Mitigated', val: stats.mitigated, cls: 'text-emerald-600' },
              { label: 'Closed', val: stats.closed, cls: 'text-muted-foreground' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
                <p className={`text-xl font-bold ${s.cls}`}>{s.val ?? 0}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="mb-5 flex flex-wrap gap-3">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">All Statuses</option>
            {['new', 'triaging', 'investigating', 'escalated', 'monitoring', 'mitigated', 'closed'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">All Priorities</option>
            {['critical', 'high', 'medium', 'low'].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">All Severities</option>
            {['critical', 'high', 'medium', 'low'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterFamily}
            onChange={e => setFilterFamily(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">All Threat Families</option>
            {FAMILIES.map(f => (
              <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {/* Cases list */}
        {loading ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
            Loading cases…
          </div>
        ) : cases.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-sm">No cases match the current filters.</p>
            <p className="text-xs">Create a case from an alert or analysis result.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map(c => (
              <CaseCard key={c.case_id} caseData={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
