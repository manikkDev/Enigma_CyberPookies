"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, AlertTriangle, Bell, Filter, CheckCircle, Clock, X, Plus, Trash2, RefreshCw, Network, ChevronDown, ChevronRight } from 'lucide-react';
import { SERVER_URL_1 } from '@/utils/commonHelper';

// ─── Severity config ──────────────────────────────────────────────────────────
const SEV = {
  critical: { cls: 'bg-destructive text-destructive-foreground',     badge: 'bg-destructive/10 text-destructive border-destructive/30',     dot: 'bg-destructive'     },
  high:     { cls: 'bg-orange-500 text-white',                        badge: 'bg-orange-500/10 text-orange-500 border-orange-500/30',        dot: 'bg-orange-500'      },
  medium:   { cls: 'bg-yellow-500 text-white',                        badge: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',        dot: 'bg-yellow-500'      },
  low:      { cls: 'bg-emerald-500 text-white',                       badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',     dot: 'bg-emerald-500'     },
};

const STATUS_STYLE = {
  open:          'bg-blue-500/10 text-blue-500 border-blue-500/30',
  investigating: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  resolved:      'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  dismissed:     'bg-muted text-muted-foreground border-border',
};

const FAMILY_LABEL = {
  phishing:                 'Phishing',
  malicious_url:            'Malicious URL',
  malicious_attachment:     'Malware Attach.',
  social_engineering_scam:  'Social Eng.',
  misinformation:           'Misinfo Campaign',
  impersonation:            'Impersonation',
  aml_financial_threat:     'AML / Finance',
  unknown:                  'Unknown',
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

// ─── Alert Card ───────────────────────────────────────────────────────────────
function AlertCard({ alert, onStatusChange, onViewGraph, onCreateCase }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEV[alert.severity] || SEV.medium;

  return (
    <div className={`rounded-xl border bg-card transition-all ${
      alert.status === 'dismissed' ? 'opacity-50' : ''
    } ${alert.watchlist_hit ? 'border-primary/40' : 'border-border'}`}>
      {/* Top bar */}
      <div className="flex items-start gap-3 p-4">
        {/* Severity dot */}
        <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${sev.dot}`} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {alert.watchlist_hit && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">⚑ WATCHLIST</span>
            )}
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${sev.badge}`}>
              {alert.severity}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[alert.status] || STATUS_STYLE.open}`}>
              {alert.status}
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {FAMILY_LABEL[alert.threat_family] || alert.threat_family}
            </span>
          </div>

          <h3 className="text-sm font-bold text-foreground leading-snug">{alert.title}</h3>

          {/* Top indicator / entity */}
          {(alert.top_indicator || alert.top_entity) && (
            <p className="mt-1 text-xs text-muted-foreground truncate">
              {alert.top_indicator || alert.top_entity}
            </p>
          )}

          {/* Meta row */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{timeAgo(alert.created_at)}</span>
            <span>Confidence: {Math.round((alert.confidence || 0) * 100)}%</span>
            {alert.artifact_id && (
              <span className="font-mono truncate max-w-[120px]">{alert.artifact_id.slice(0, 16)}…</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={() => setExpanded(e => !e)}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {onViewGraph && alert.artifact_id && (
            <button
              onClick={() => onViewGraph(alert.artifact_id)}
              className="rounded p-1 text-muted-foreground hover:text-primary"
              title="View graph"
            >
              <Network className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          {/* Reasons */}
          {alert.reasons?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Why this alert</p>
              <ul className="space-y-0.5">
                {alert.reasons.map((r, i) => (
                  <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">›</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Related entities */}
          {alert.related_entities?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Related Entities</p>
              <div className="flex flex-wrap gap-1">
                {alert.related_entities.map((e, i) => (
                  <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">{e}</span>
                ))}
              </div>
            </div>
          )}

          {/* Watchlist terms */}
          {alert.watchlist_terms?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Watchlist Matches</p>
              <div className="flex flex-wrap gap-1">
                {alert.watchlist_terms.map((t, i) => (
                  <span key={i} className="rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-xs text-primary">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Status actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {alert.status === 'open' && (
              <>
                <button onClick={() => onStatusChange(alert.alert_id, 'investigating')}
                  className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-600 hover:bg-yellow-500/20 transition-colors">
                  Investigate
                </button>
                <button onClick={() => onStatusChange(alert.alert_id, 'dismissed')}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                  Dismiss
                </button>
              </>
            )}
            {alert.status === 'investigating' && (
              <button onClick={() => onStatusChange(alert.alert_id, 'resolved')}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 transition-colors">
                Mark Resolved
              </button>
            )}
            {(alert.status === 'resolved' || alert.status === 'dismissed') && (
              <button onClick={() => onStatusChange(alert.alert_id, 'open')}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                Reopen
              </button>
            )}
            <button
              onClick={() => onCreateCase && onCreateCase(alert)}
              className="rounded-lg border border-primary bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              Create Case
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Group Card ───────────────────────────────────────────────────────────────
function GroupCard({ group }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              {FAMILY_LABEL[group.threat_family] || group.threat_family}
            </span>
            <span className="text-xs text-muted-foreground">{group.member_count} alerts</span>
          </div>
          <h4 className="text-sm font-semibold text-foreground">{group.label}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{group.reason}</p>
        </div>
        <button onClick={() => setExpanded(e => !e)} className="p-1 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
      {expanded && group.member_ids?.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground mb-1.5">Alert IDs in group:</p>
          <div className="flex flex-col gap-1">
            {group.member_ids.map(id => (
              <span key={id} className="font-mono text-xs text-muted-foreground">{id}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Watchlist Modal ──────────────────────────────────────────────────────
const WATCHLIST_TYPES = ['brand', 'domain', 'email', 'phone', 'wallet', 'username', 'keyword', 'narrative'];

function AddWatchlistModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ type: 'domain', value: '', label: '', severity: 'medium' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.value.trim()) { setError('Value is required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${SERVER_URL_1}/api/alerts/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      onAdded(data.entry);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">Add Watchlist Entry</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Type</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
              {WATCHLIST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Value *</label>
            <input type="text" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
              placeholder={`e.g. paypa1.com`}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Label</label>
            <input type="text" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. PayPal typosquat"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Severity</label>
            <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
              {['critical','high','medium','low'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="mt-5 flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {saving ? 'Saving…' : 'Add to Watchlist'}
          </button>
          <button onClick={onClose}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Alerts Page ─────────────────────────────────────────────────────────
export default function AlertsPage() {
  const [alerts, setAlerts]         = useState([]);
  const [groups, setGroups]         = useState([]);
  const [watchlist, setWatchlist]   = useState([]);
  const [stats, setStats]           = useState(null);
  const [activeTab, setActiveTab]   = useState('alerts');
  const [filterSev, setFilterSev]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFamily, setFilterFamily] = useState('');
  const [loading, setLoading]       = useState(true);
  const [streamStatus, setStreamStatus] = useState('connecting');
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [newAlertPulse, setNewAlertPulse] = useState(false);
  const eventSourceRef = useRef(null);

  // ── Fetch helpers ───────────────────────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterSev)    params.set('severity', filterSev);
      if (filterStatus) params.set('status', filterStatus);
      if (filterFamily) params.set('threat_family', filterFamily);
      const res = await fetch(`${SERVER_URL_1}/api/alerts?${params}`);
      const data = await res.json();
      if (data.alerts) setAlerts(data.alerts);
    } catch (e) { console.error('fetchAlerts error:', e); }
  }, [filterSev, filterStatus, filterFamily]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [alertRes, groupRes, watchRes, statsRes] = await Promise.all([
        fetch(`${SERVER_URL_1}/api/alerts`),
        fetch(`${SERVER_URL_1}/api/alerts/groups`),
        fetch(`${SERVER_URL_1}/api/alerts/watchlist`),
        fetch(`${SERVER_URL_1}/api/alerts/stats`),
      ]);
      const [ad, gd, wd, sd] = await Promise.all([alertRes.json(), groupRes.json(), watchRes.json(), statsRes.json()]);
      if (ad.alerts)   setAlerts(ad.alerts);
      if (gd.groups)   setGroups(gd.groups);
      if (wd.entries)  setWatchlist(wd.entries);
      if (sd.stats)    setStats(sd.stats);
    } catch (e) { console.error('fetchAll error:', e); }
    setLoading(false);
  }, []);

  // ── SSE stream ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchAll();

    const es = new EventSource(`${SERVER_URL_1}/api/alerts/stream`);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => setStreamStatus('live'));
    es.addEventListener('heartbeat', () => {});
    es.addEventListener('alert', (e) => {
      try {
        const alert = JSON.parse(e.data);
        setAlerts(prev => [alert, ...prev]);
        setStats(prev => prev ? { ...prev, total: (prev.total || 0) + 1, open: (prev.open || 0) + 1 } : prev);
        setNewAlertPulse(true);
        setTimeout(() => setNewAlertPulse(false), 2000);
      } catch (_) {}
    });
    es.addEventListener('alertUpdated', (e) => {
      try {
        const updated = JSON.parse(e.data);
        setAlerts(prev => prev.map(a => a.alert_id === updated.alert_id ? updated : a));
      } catch (_) {}
    });
    es.addEventListener('watchlistUpdated', () => { fetchAll(); });
    es.onerror = () => setStreamStatus('disconnected');

    return () => { es.close(); };
  }, [fetchAll]);

  // Re-fetch when filters change
  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // ── Status change ───────────────────────────────────────────────────────────
  const handleStatusChange = async (alertId, status) => {
    try {
      const res = await fetch(`${SERVER_URL_1}/api/alerts/${alertId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.alert) {
        setAlerts(prev => prev.map(a => a.alert_id === alertId ? data.alert : a));
      }
    } catch (e) { console.error('status change error:', e); }
  };

  const handleCreateCase = async (alert) => {
    try {
      const caseData = {
        title: alert.title,
        summary: alert.reasons?.join('\n') || '',
        threat_family: alert.threat_family,
        severity: alert.severity,
        confidence: alert.confidence,
        priority: alert.severity === 'critical' ? 'critical' : alert.severity === 'high' ? 'high' : 'medium',
        linked_alert_ids: [alert.alert_id],
        linked_artifact_ids: alert.artifact_id ? [alert.artifact_id] : [],
        linked_pattern_ids: alert.pattern_id ? [alert.pattern_id] : [],
        auto_recommend_actions: true,
        created_by: 'alert_system',
      };
      
      const res = await fetch(`${SERVER_URL_1}/api/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(caseData),
      });
      
      const data = await res.json();
      if (data.case) {
        window.location.href = `/cases/${data.case.case_id}`;
      }
    } catch (e) { console.error('create case error:', e); }
  };

  const handleDeleteWatchlist = async (id) => {
    try {
      await fetch(`${SERVER_URL_1}/api/alerts/watchlist/${id}`, { method: 'DELETE' });
      setWatchlist(prev => prev.filter(w => w.watchlist_id !== id));
    } catch (e) { console.error('delete watchlist error:', e); }
  };

  const FAMILIES = [...new Set(alerts.map(a => a.threat_family))].filter(Boolean);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className={`h-7 w-7 text-primary ${newAlertPulse ? 'animate-bounce' : ''}`} />
                {stats?.open > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white">
                    {stats.open > 9 ? '9+' : stats.open}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Alerts Dashboard</h1>
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${streamStatus === 'live' ? 'bg-emerald-500' : streamStatus === 'connecting' ? 'bg-yellow-500' : 'bg-destructive'}`} />
                  <p className="text-xs text-muted-foreground capitalize">{streamStatus === 'live' ? 'Live stream active' : streamStatus}</p>
                </div>
              </div>
            </div>
            <button onClick={fetchAll} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Stats bar */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {[
              { label: 'Total',    val: stats.total,    cls: 'text-foreground' },
              { label: 'Open',     val: stats.open,     cls: 'text-blue-500' },
              { label: 'Critical', val: stats.critical, cls: 'text-destructive' },
              { label: 'High',     val: stats.high,     cls: 'text-orange-500' },
              { label: 'Medium',   val: stats.medium,   cls: 'text-yellow-600' },
              { label: 'Watchlist Hits', val: stats.watchlist_hits, cls: 'text-primary' },
              { label: 'Groups',   val: stats.groups,   cls: 'text-muted-foreground' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
                <p className={`text-xl font-bold ${s.cls}`}>{s.val ?? 0}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-5 flex gap-1 rounded-lg border border-border bg-card p-1">
          {[
            { id: 'alerts',    label: `Alerts (${alerts.length})` },
            { id: 'groups',    label: `Groups (${groups.length})` },
            { id: 'watchlist', label: `Watchlist (${watchlist.length})` },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Alerts Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select value={filterSev} onChange={e => setFilterSev(e.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                <option value="">All Severities</option>
                {['critical','high','medium','low'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                <option value="">All Statuses</option>
                {['open','investigating','resolved','dismissed'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterFamily} onChange={e => setFilterFamily(e.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                <option value="">All Families</option>
                {FAMILIES.map(f => <option key={f} value={f}>{FAMILY_LABEL[f] || f}</option>)}
              </select>
              {(filterSev || filterStatus || filterFamily) && (
                <button onClick={() => { setFilterSev(''); setFilterStatus(''); setFilterFamily(''); }}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" /> Clear
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">Loading alerts…</div>
            ) : alerts.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
                <p className="text-sm">No alerts match the current filters.</p>
                <p className="text-xs">Run an analysis from the workbench to generate alerts.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map(alert => (
                  <AlertCard
                    key={alert.alert_id}
                    alert={alert}
                    onStatusChange={handleStatusChange}
                    onViewGraph={(id) => window.open(`/analyze?artifact_id=${id}`, '_blank')}
                    onCreateCase={handleCreateCase}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Groups Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'groups' && (
          <div className="space-y-3">
            {groups.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
                No alert groups yet. Groups form automatically when similar alerts are generated.
              </div>
            ) : groups.map(g => <GroupCard key={g.group_id} group={g} />)}
          </div>
        )}

        {/* ── Watchlist Tab ──────────────────────────────────────────────── */}
        {activeTab === 'watchlist' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {watchlist.length} monitored {watchlist.length === 1 ? 'entry' : 'entries'}
              </p>
              <button
                onClick={() => setShowWatchlistModal(true)}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                <Plus className="h-4 w-4" /> Add Entry
              </button>
            </div>

            {watchlist.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
                No watchlist entries. Add brands, domains, or keywords to monitor.
              </div>
            ) : (
              <div className="space-y-2">
                {watchlist.map(entry => {
                  const sev = SEV[entry.severity] || SEV.medium;
                  return (
                    <div key={entry.watchlist_id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${sev.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground uppercase">{entry.type}</span>
                          <span className="text-sm font-medium text-foreground">{entry.value}</span>
                          {entry.label && <span className="text-xs text-muted-foreground truncate">{entry.label}</span>}
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className={`rounded-full border px-1.5 py-0.5 ${sev.badge}`}>{entry.severity}</span>
                          {entry.hit_count > 0 && <span>{entry.hit_count} hit{entry.hit_count !== 1 ? 's' : ''}</span>}
                          {entry.last_hit_at && <span>Last: {timeAgo(entry.last_hit_at)}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteWatchlist(entry.watchlist_id)}
                        className="rounded p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showWatchlistModal && (
        <AddWatchlistModal
          onClose={() => setShowWatchlistModal(false)}
          onAdded={(entry) => setWatchlist(prev => [entry, ...prev])}
        />
      )}
    </div>
  );
}
