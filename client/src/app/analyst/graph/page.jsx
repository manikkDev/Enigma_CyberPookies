"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/auth/protected-route";
import RiskShell, { ErrorPanel, LoadingPanel, MetricCard } from "@/components/risk/RiskShell";
import { api } from "@/lib/api";

function GraphView() {
  const [graph, setGraph] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [error, setError] = useState("");
  const load = () => Promise.all([api.graph.overview(0.3, 250), api.graph.campaigns()]).then(([network, rings]) => { setGraph(network); setCampaigns(rings); }).catch((reason)=>setError(reason.message));
  useEffect(() => { load(); }, []);
  const seed = async () => { setError(""); try { await api.fl.seedGraph("demo_fedprox"); await load(); } catch (reason) { setError(reason.message); } };
  return <RiskShell title="Cross-institution risk graph" subtitle="Only pseudonymous accounts, model scores and aggregated transfer statistics enter Neo4j. Raw account identifiers and balances are excluded.">{error && <ErrorPanel message={error}/>}<div className="flex justify-end"><button onClick={seed} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Rebuild derived graph</button></div>{!graph ? <LoadingPanel/> : <><section className="grid gap-4 md:grid-cols-3"><MetricCard label="Visible accounts" value={graph.nodes.length}/><MetricCard label="Derived transfer edges" value={graph.edges.length} tone="emerald"/><MetricCard label="Detected campaigns" value={campaigns.length} tone="rose"/></section><section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]"><div className="relative min-h-[520px] overflow-hidden rounded-2xl border bg-slate-950 p-4"><svg viewBox="0 0 800 500" className="h-full min-h-[500px] w-full">{graph.edges.slice(0,250).map((edge,index)=>{ const source=graph.nodes.findIndex(node=>node.id===edge.source); const target=graph.nodes.findIndex(node=>node.id===edge.target); const sx=40+(source%12)*65, sy=45+(Math.floor(source/12)%7)*65, tx=40+(target%12)*65, ty=45+(Math.floor(target/12)%7)*65; return <line key={index} x1={sx} y1={sy} x2={tx} y2={ty} stroke="#64748b" strokeOpacity=".25"/>;})}{graph.nodes.slice(0,84).map((node,index)=>{const x=40+(index%12)*65,y=45+(Math.floor(index/12)%7)*65; return <g key={node.id}><circle cx={x} cy={y} r={node.band==="high"?9:6} fill={node.band==="high"?"#fb7185":node.band==="medium"?"#fbbf24":"#34d399"}/><title>{node.id} · {(node.score*100).toFixed(1)}%</title></g>;})}</svg><div className="absolute bottom-4 left-4 rounded-lg bg-black/60 px-3 py-2 text-xs text-white">Green low · Amber medium · Rose high</div></div><div className="rounded-2xl border bg-card p-6"><h2 className="text-xl font-semibold">Fraud-ring candidates</h2><div className="mt-4 space-y-3">{campaigns.slice(0,12).map((campaign)=><button key={campaign.id} onClick={()=>api.graph.campaign(campaign.id).then(setGraph)} className="w-full rounded-xl border p-3 text-left hover:bg-muted"><div className="flex justify-between"><span className="font-medium">{campaign.label}</span><span className="text-rose-600">{campaign.n_high} high</span></div><div className="mt-1 text-xs text-muted-foreground">{campaign.size} accounts · average risk {(campaign.avg_score*100).toFixed(1)}%</div></button>)}</div></div></section></>}</RiskShell>;
}

export default function RiskGraphPage(){return <ProtectedRoute allowedRoles={["analyst","admin"]}><GraphView/></ProtectedRoute>;}
