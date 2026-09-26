"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/auth/protected-route";
import RiskShell, { ErrorPanel, LoadingPanel } from "@/components/risk/RiskShell";
import { api } from "@/lib/api";

const labels = {
  risk_scoring: ["Risk scoring", "Calculate and explain your personal risk signal"],
  fraud_monitoring: ["Fraud monitoring", "Detect suspicious activity and protect your account"],
  model_training: ["Local model training", "Use your records inside your institution to improve its model"],
  cross_institution_fl: ["Federated collaboration", "Contribute privacy-protected model updates across institutions"],
};

function Consent() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ticket, setTicket] = useState("");

  const load = () => api.consent.me().then(setData).catch((reason) => setError(reason.message));
  useEffect(() => {
    load();
  }, []);

  const update = async (purpose, granted) => {
    try {
      await api.consent.set(purpose, granted);
      setNotice(granted ? "Consent granted — scoring resumes." : "Consent withdrawn — scoring is paused immediately.");
      await load();
    } catch (reason) {
      setError(reason.message);
    }
  };

  const exportData = async () => {
    try {
      await api.consent.exportData();
      setNotice("Your data bundle was downloaded (DPDP access right).");
    } catch (reason) {
      setError(reason.message);
    }
  };

  const erase = async () => {
    try {
      const result = await api.consent.erase();
      setTicket(result.ticketId);
    } catch (reason) {
      setError(reason.message);
    }
  };

  return (
    <RiskShell
      role="citizen"
      title="Consent and data rights"
      subtitle="Purpose-specific controls aligned with India's DPDP Act: notice, choice, access and erasure. Withdrawal takes effect immediately."
    >
      {error && <ErrorPanel message={error} />}
      {notice && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700">{notice}</div>}
      {!data ? (
        <LoadingPanel />
      ) : (
        <section className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="text-xl font-semibold">Purpose controls</h2>
            {!data.purposes?.risk_scoring && (
              <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                Risk scoring is currently paused — the model will not evaluate your transactions until you re-enable it.
              </p>
            )}
            <div className="mt-5 divide-y">
              {Object.entries(labels).map(([purpose, [title, description]]) => (
                <div key={purpose} className="flex items-center justify-between gap-5 py-5">
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                  </div>
                  <button
                    onClick={() => update(purpose, !data.purposes[purpose])}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${data.purposes[purpose] ? "bg-indigo-600" : "bg-muted"}`}
                  >
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${data.purposes[purpose] ? "left-6" : "left-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-5">
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="text-xl font-semibold">Consent history</h2>
              <div className="mt-4 max-h-64 space-y-3 overflow-auto">
                {data.history.length ? (
                  data.history.slice(0, 15).map((entry) => (
                    <div key={entry._id} className="rounded-lg bg-muted p-3 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium">{labels[entry.purpose]?.[0] || entry.purpose}</span>
                        <span className={entry.granted ? "text-emerald-600" : "text-rose-600"}>{entry.granted ? "Granted" : "Withdrawn"}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="font-semibold">Download your data</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                A JSON bundle with your consents, consent history and the audit trail of actions on your account.
              </p>
              <button onClick={exportData} className="mt-4 rounded-xl border px-4 py-2 text-sm">
                Export my data (JSON)
              </button>
            </div>
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6">
              <h2 className="font-semibold">Request erasure</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Creates an auditable erasure ticket. Production execution requires institution verification and legal retention checks.
              </p>
              <button onClick={erase} className="mt-4 rounded-xl border border-rose-500/40 px-4 py-2 text-sm text-rose-700">
                Create erasure request
              </button>
              {ticket && <p className="mt-3 break-all text-xs text-emerald-600">Received: {ticket}</p>}
            </div>
          </div>
        </section>
      )}
    </RiskShell>
  );
}

export default function ConsentPage() {
  return (
    <ProtectedRoute allowedRoles={["citizen"]}>
      <Consent />
    </ProtectedRoute>
  );
}
