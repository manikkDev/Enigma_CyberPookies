"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Briefcase, ArrowLeft, Clock, User, AlertTriangle, FileText, Network, MessageCircle,
  Plus, Check, X, Play, Pause, Eye, Edit, Trash2, ChevronDown, ChevronRight
} from 'lucide-react';
import { SERVER_URL_1 } from '@/utils/commonHelper';
import Link from 'next/link';

const STATUS_STYLE = {
  new: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  triaging: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  investigating: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  escalated: 'bg-red-500/10 text-red-500 border-red-500/30',
  monitoring: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  mitigated: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  closed: 'bg-muted text-muted-foreground border-border',
};

const ACTION_STATUS_STYLE = {
  suggested: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  approved: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  in_progress: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  failed: 'bg-red-500/10 text-red-500 border-red-500/30',
  dismissed: 'bg-muted text-muted-foreground border-border',
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

function EvidenceCard({ evidence }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-0.5 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground uppercase">
              {evidence.type}
            </span>
            <span className="text-xs text-muted-foreground">{timeAgo(evidence.timestamp)}</span>
          </div>
          <h4 className="text-sm font-semibold text-foreground">{evidence.title}</h4>
          {evidence.short_summary && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{evidence.short_summary}</p>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-border pt-3 space-y-2 text-xs">
          {evidence.source && (
            <div>
              <span className="text-muted-foreground">Source:</span>
              <span className="ml-2 text-foreground">{evidence.source}</span>
            </div>
          )}
          {evidence.raw_excerpt && (
            <div>
              <span className="text-muted-foreground">Excerpt:</span>
              <p className="mt-1 rounded bg-muted p-2 font-mono text-xs text-foreground">
                {evidence.raw_excerpt}
              </p>
            </div>
          )}
          {evidence.linked_indicators?.length > 0 && (
            <div>
              <span className="text-muted-foreground">Indicators ({evidence.linked_indicators.length}):</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {evidence.linked_indicators.map((ind, i) => (
                  <span key={i} className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                    {ind}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionCard({ action, onStatusChange }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium uppercase ${ACTION_STATUS_STYLE[action.status] || ACTION_STATUS_STYLE.suggested}`}>
              {action.status}
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {action.action_type?.replace(/_/g, ' ')}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-foreground">{action.title}</h4>
          {action.description && (
            <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
          )}
          {action.outcome && (
            <p className="mt-2 text-xs text-emerald-600">Outcome: {action.outcome}</p>
          )}
        </div>

        {action.status === 'suggested' && (
          <div className="flex gap-1">
            <button
              onClick={() => onStatusChange(action.action_id, 'approved')}
              className="rounded p-1.5 text-emerald-600 hover:bg-emerald-500/10 transition-colors"
              title="Approve"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => onStatusChange(action.action_id, 'dismissed')}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted transition-colors"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {action.status === 'approved' && (
          <button
            onClick={() => onStatusChange(action.action_id, 'in_progress')}
            className="rounded p-1.5 text-orange-500 hover:bg-orange-500/10 transition-colors"
            title="Start"
          >
            <Play className="h-4 w-4" />
          </button>
        )}
        {action.status === 'in_progress' && (
          <button
            onClick={() => onStatusChange(action.action_id, 'completed', 'Action executed successfully')}
            className="rounded p-1.5 text-emerald-600 hover:bg-emerald-500/10 transition-colors"
            title="Complete"
          >
            <Check className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function TimelineEvent({ event }) {
  const icons = {
    case_created: Briefcase,
    status_changed: Edit,
    priority_changed: AlertTriangle,
    evidence_added: FileText,
    note_added: MessageCircle,
    action_created: Plus,
    action_updated: Edit,
    alert_linked: AlertTriangle,
    artifact_linked: FileText,
  };
  const Icon = icons[event.event_type] || Clock;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="w-px flex-1 bg-border" />
      </div>
      <div className="flex-1 pb-6">
        <p className="text-sm font-medium text-foreground">{event.description}</p>
        <p className="text-xs text-muted-foreground">{timeAgo(event.timestamp)}</p>
      </div>
    </div>
  );
}

export default function CaseDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params?.id;

  const [caseData, setCaseData] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('evidence');
  const [newNote, setNewNote] = useState('');

  const fetchCase = async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL_1}/api/cases/${caseId}`);
      const data = await res.json();
      
      if (data.case) setCaseData(data.case);
      if (data.evidence) setEvidence(data.evidence);
      if (data.timeline) setTimeline(data.timeline);
      if (data.actions) setActions(data.actions);
    } catch (error) {
      console.error('Fetch case error:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCase();
  }, [caseId]);

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await fetch(`${SERVER_URL_1}/api/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.case) {
        setCaseData(data.case);
        fetchCase(); // Refresh to get updated timeline
      }
    } catch (error) {
      console.error('Update status error:', error);
    }
  };

  const handleActionStatusChange = async (actionId, status, outcome = null) => {
    try {
      const res = await fetch(`${SERVER_URL_1}/api/actions/${actionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, outcome }),
      });
      const data = await res.json();
      if (data.action) {
        setActions(prev => prev.map(a => a.action_id === actionId ? data.action : a));
        fetchCase(); // Refresh timeline
      }
    } catch (error) {
      console.error('Update action status error:', error);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      const res = await fetch(`${SERVER_URL_1}/api/cases/${caseId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newNote, author: 'analyst' }),
      });
      if (res.ok) {
        setNewNote('');
        fetchCase();
      }
    } catch (error) {
      console.error('Add note error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading case…</p>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Case not found</p>
        <Link href="/cases" className="text-primary hover:underline">
          Back to cases
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <div className="flex items-center gap-4">
            <Link
              href="/cases"
              className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">{caseData.title}</h1>
              <p className="text-xs text-muted-foreground">
                {caseData.threat_family?.replace(/_/g, ' ')} • Created {timeAgo(caseData.created_at)}
              </p>
            </div>
          </div>

          {/* Status badges */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-sm font-semibold uppercase ${STATUS_STYLE[caseData.status]}`}>
              {caseData.status}
            </span>
            <span className="rounded-full border border-border px-3 py-1 text-sm bg-muted text-muted-foreground">
              {caseData.priority} priority
            </span>
            <span className="rounded-full border border-border px-3 py-1 text-sm bg-muted text-muted-foreground">
              {caseData.severity} severity
            </span>
            {caseData.assignee && (
              <span className="rounded-full border border-border px-3 py-1 text-sm bg-muted text-muted-foreground flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {caseData.assignee}
              </span>
            )}
          </div>

          {/* Quick actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            {caseData.status === 'new' && (
              <button
                onClick={() => handleStatusChange('triaging')}
                className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-sm font-medium text-yellow-600 hover:bg-yellow-500/20 transition-colors"
              >
                Start Triaging
              </button>
            )}
            {caseData.status === 'triaging' && (
              <button
                onClick={() => handleStatusChange('investigating')}
                className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-sm font-medium text-orange-500 hover:bg-orange-500/20 transition-colors"
              >
                Begin Investigation
              </button>
            )}
            {caseData.status === 'investigating' && (
              <>
                <button
                  onClick={() => handleStatusChange('mitigated')}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                >
                  Mark Mitigated
                </button>
                <button
                  onClick={() => handleStatusChange('escalated')}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/20 transition-colors"
                >
                  Escalate
                </button>
              </>
            )}
            {(caseData.status === 'mitigated' || caseData.status === 'monitoring') && (
              <button
                onClick={() => handleStatusChange('closed')}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Close Case
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary */}
            {caseData.summary && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-bold text-foreground mb-3">Case Summary</h2>
                <p className="text-sm text-muted-foreground">{caseData.summary}</p>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
              {[
                { id: 'evidence', label: `Evidence (${evidence.length})` },
                { id: 'actions', label: `Actions (${actions.length})` },
                { id: 'timeline', label: `Timeline (${timeline.length})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Evidence tab */}
            {activeTab === 'evidence' && (
              <div className="space-y-3">
                {evidence.length === 0 ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">No evidence attached yet</p>
                ) : (
                  evidence.map(ev => <EvidenceCard key={ev.evidence_id} evidence={ev} />)
                )}
              </div>
            )}

            {/* Actions tab */}
            {activeTab === 'actions' && (
              <div className="space-y-3">
                {actions.length === 0 ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">No actions yet</p>
                ) : (
                  actions.map(action => (
                    <ActionCard
                      key={action.action_id}
                      action={action}
                      onStatusChange={handleActionStatusChange}
                    />
                  ))
                )}
              </div>
            )}

            {/* Timeline tab */}
            {activeTab === 'timeline' && (
              <div className="rounded-xl border border-border bg-card p-5">
                {timeline.length === 0 ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">No timeline events</p>
                ) : (
                  <div>
                    {timeline.map(event => (
                      <TimelineEvent key={event.event_id} event={event} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Linked items */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold text-foreground mb-3">Linked Items</h3>
              <div className="space-y-2 text-sm">
                {caseData.linked_alert_ids?.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Alerts:</span>
                    <span className="ml-2 text-foreground">{caseData.linked_alert_ids.length}</span>
                  </div>
                )}
                {caseData.linked_artifact_ids?.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Artifacts:</span>
                    <span className="ml-2 text-foreground">{caseData.linked_artifact_ids.length}</span>
                  </div>
                )}
                {caseData.linked_pattern_ids?.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Patterns:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {caseData.linked_pattern_ids.map((p, i) => (
                        <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-xs">{p}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Add note */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold text-foreground mb-3">Add Note</h3>
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add investigation notes…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none min-h-[80px]"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="mt-2 w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                Add Note
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
