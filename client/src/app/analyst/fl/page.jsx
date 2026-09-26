"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/auth/protected-route";
import RiskShell, { ErrorPanel, MetricCard } from "@/components/risk/RiskShell";
import { api } from "@/lib/api";

const pct = (value) => value == null ? "—" : `${(value * 100).toFixed(2)}%`;

function Convergence({ rounds = [], baseline }) {
  const points = rounds.map((entry, index) => `${20 + index * (560 / Math.max(1, rounds.length - 1))},${220 - (entry.global?.pr_auc || 0) * 190}`).join(" ");
  return <div className="rounded-2xl border bg-card p-6"><h2 className="text-lg font-semibold">Live PR-AUC convergence</h2><svg viewBox="0 0 600 240" className="mt-4 h-64 w-full"><line x1="20" y1="220" x2="580" y2="220" stroke="currentColor" opacity=".2"/><line x1="20" y1="30" x2="20" y2="220" stroke="currentColor" opacity=".2"/>{baseline != null && <line x1="20" y1={220-baseline*190} x2="580" y2={220-baseline*190} stroke="#f59e0b" strokeDasharray="6 6"/>}<polyline fill="none" stroke="#4f46e5" strokeWidth="4" points={points}/>{rounds.map((entry,index)=><circle key={entry.round} cx={20+index*(560/Math.max(1,rounds.length-1))} cy={220-(entry.global?.pr_auc||0)*190} r="4" fill="#4f46e5"/>)}</svg><div className="flex justify-between text-xs text-muted-foreground"><span>Round 1</span><span>Orange: isolated mean</span><span>Round {rounds.length || 0}</span></div></div>;
}

function Control() {
  const [config, setConfig] = useState({ strategy: "fedprox", rounds: 8, local_epochs: 1, dp_enabled: false, dp_noise_multiplier: 2.5, dp_clipping_norm: 1, secagg_enabled: true });
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState(null);
  const [summary, setSummary] = useState(null);
  const [epsilon, setEpsilon] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.fl.summary().then(setSummary).catch(() => {}); }, []);
  useEffect(() => { api.fl.epsilon(config.dp_noise_multiplier, config.rounds).then(setEpsilon).catch(() => {}); }, [config.dp_noise_multiplier, config.rounds]);
  useEffect(() => { if (!runId) return; const timer = setInterval(() => api.fl.status(runId).then((value) => { setStatus(value); if (["finished","failed","stopped"].includes(value.status)) clearInterval(timer); }).catch((reason) => setError(reason.message)), 1500); return () => clearInterval(timer); }, [runId]);
  const latestRounds = status?.rounds || [];
  const privacy = latestRounds.at(-1)?.privacy;
  const start = async () => { setError(""); setStatus(null); try { const result = await api.fl.start(config); setRunId(result.run_id); } catch (reason) { setError(reason.message); } };
  return <RiskShell title="Federated learning control" subtitle="Five banks train locally. Only clipped model updates and aggregate statistics cross the boundary.">{error && <ErrorPanel message={error}/>}<section className="grid gap-4 md:grid-cols-3"><MetricCard label="Run status" value={status?.status || (runId ? "starting" : "ready")} detail={runId || "Configure a run below"}/><MetricCard label="Current PR-AUC" value={pct(latestRounds.at(-1)?.global?.pr_auc || status?.final?.final?.pr_auc)} detail={`${latestRounds.length}/${config.rounds} rounds`} tone="emerald"/><MetricCard label="Estimated privacy ε" value={config.dp_enabled ? (privacy?.epsilon?.toFixed(2) || epsilon?.epsilon?.toFixed(2) || "—") : "Off"} detail={`δ=${privacy?.delta || "1e-5"}; client-update estimate`} tone="amber"/></section><section className="grid gap-5 lg:grid-cols-[360px_1fr]"><div className="rounded-2xl border bg-card p-6"><h2 className="text-lg font-semibold">Run configuration</h2><div className="mt-5 space-y-4 text-sm"><label className="block">Strategy<select className="mt-1 w-full rounded-lg border bg-background p-2" value={config.strategy} onChange={(event)=>setConfig({...config,strategy:event.target.value})}><option value="fedavg">FedAvg</option><option value="fedprox">FedProx</option></select></label><label className="block">Rounds: {config.rounds}<input className="mt-2 w-full" type="range" min="2" max="20" value={config.rounds} onChange={(event)=>setConfig({...config,rounds:Number(event.target.value)})}/></label><label className="flex items-center justify-between">Differential privacy<input type="checkbox" checked={config.dp_enabled} onChange={(event)=>setConfig({...config,dp_enabled:event.target.checked})}/></label>{config.dp_enabled && <label className="block">Noise multiplier: {config.dp_noise_multiplier}<input className="mt-2 w-full" type="range" min="1" max="5" step="0.25" value={config.dp_noise_multiplier} onChange={(event)=>setConfig({...config,dp_noise_multiplier:Number(event.target.value)})}/></label>}<label className="flex items-center justify-between">Secure aggregation masks<input type="checkbox" checked={config.secagg_enabled} onChange={(event)=>setConfig({...config,secagg_enabled:event.target.checked})}/></label><button onClick={start} disabled={status?.status === "running"} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white disabled:opacity-50">Start five-bank training</button>{status?.status === "running" && <button onClick={()=>api.fl.stop(runId)} className="w-full rounded-xl border px-4 py-2">Stop run</button>}</div><div className="mt-6 grid grid-cols-5 gap-2">{[0,1,2,3,4].map((bank)=><div key={bank} className="rounded-lg bg-muted p-2 text-center text-xs">Bank {bank}<br/><span className="text-emerald-600">raw local</span></div>)}</div></div><Convergence rounds={latestRounds} baseline={summary?.baselines?.isolated_mean?.pr_auc}/></section></RiskShell>;
}

export default function FederatedLearningPage() { return <ProtectedRoute allowedRoles={["analyst","admin"]}><Control/></ProtectedRoute>; }
