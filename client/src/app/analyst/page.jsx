"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/auth/protected-route";
import RiskShell, { ErrorPanel, LoadingPanel, MetricCard } from "@/components/risk/RiskShell";
import { api } from "@/lib/api";

const percent = (value) => value == null ? "—" : `${(value * 100).toFixed(2)}%`;

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { Promise.all([api.fl.summary(), api.fl.customers({ dataset: "paysim_banks", run_id: "latest", n: "20" })]).then(([model, portfolio]) => { setSummary(model); setCustomers(portfolio.rows || []); }).catch((reason) => setError(reason.message)); }, []);
  if (error) return <RiskShell title="Bank risk command center" subtitle="Federated portfolio intelligence for your institution."><ErrorPanel message={`${error}. Run the demo seed command from the setup guide.`} /></RiskShell>;
  if (!summary) return <RiskShell title="Bank risk command center" subtitle="Federated portfolio intelligence for your institution."><LoadingPanel /></RiskShell>;
  const baseline = summary.baselines;
  const latest = summary.latest;
  const highRisk = customers.filter((row) => row.risk_band === "high").length;
  return <RiskShell title="Bank risk command center" subtitle="Compare siloed, centralized and federated performance while customer rows remain inside each institution."><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricCard label="Latest FL PR-AUC" value={percent(latest?.final?.pr_auc)} detail={latest?.run_id || "No run"} /><MetricCard label="Centralized ceiling" value={percent(baseline?.centralized?.pr_auc)} detail="Benchmark only—pooled data is not deployed" tone="emerald" /><MetricCard label="Isolated-bank mean" value={percent(baseline?.isolated_mean?.pr_auc)} detail="How banks perform alone" tone="amber" /><MetricCard label="High-risk sample" value={`${highRisk}/${customers.length}`} detail="Institution-scoped test portfolio" tone="rose" /></section><section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]"><div className="rounded-2xl border bg-card p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Priority review queue</h2><Link href="/analyst/graph" className="text-sm text-indigo-600">Investigate graph →</Link></div><div className="mt-5 overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-muted-foreground"><tr><th className="pb-3">Pseudonymous account</th><th>Type</th><th>Amount</th><th>Risk</th></tr></thead><tbody>{[...customers].sort((a,b) => b.score-a.score).slice(0,10).map((row) => <tr key={row.customer_id} className="border-t"><td className="py-3 font-mono text-xs"><Link href={`/analyst/customers/${row.customer_id}`}>{row.customer_id.slice(0,12)}…</Link></td><td>{row.type}</td><td>₹{Number(row.amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td><td><span className={`rounded-full px-2 py-1 text-xs ${row.risk_band === "high" ? "bg-rose-500/15 text-rose-700" : row.risk_band === "medium" ? "bg-amber-500/15 text-amber-700" : "bg-emerald-500/15 text-emerald-700"}`}>{percent(row.score)}</span></td></tr>)}</tbody></table></div></div><div className="rounded-2xl border bg-card p-6"><h2 className="text-xl font-semibold">Privacy controls</h2><dl className="mt-5 space-y-4 text-sm"><div className="flex justify-between"><dt>Raw rows centralized</dt><dd className="font-medium text-emerald-600">No</dd></div><div className="flex justify-between"><dt>Institutions</dt><dd>5</dd></div><div className="flex justify-between"><dt>Aggregation</dt><dd>{latest?.privacy?.secagg ? "Pairwise masks (demo)" : "Weighted average"}</dd></div><div className="flex justify-between"><dt>DP ε</dt><dd>{latest?.epsilon ? latest.epsilon.toFixed(2) : "Non-private run"}</dd></div></dl><Link href="/analyst/fl" className="mt-6 block rounded-xl bg-indigo-600 px-4 py-3 text-center text-sm font-medium text-white">Open FL control panel</Link></div></section></RiskShell>;
}

export default function AnalystDashboard() { return <ProtectedRoute allowedRoles={["analyst", "admin"]}><Dashboard /></ProtectedRoute>; }
