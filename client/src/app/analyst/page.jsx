"use client";

import ProtectedRoute from "@/components/auth/protected-route";
import PhasePlaceholder from "@/components/risk/PhasePlaceholder";

export default function AnalystDashboard() {
  const links = [{ href: "/analyst/fl", label: "Federated training" }, { href: "/analyst/graph", label: "Risk graph" }, { href: "/analyst/fairness", label: "Fairness audit" }];
  return <ProtectedRoute allowedRoles={["analyst", "admin"]}><PhasePlaceholder title="Bank analyst dashboard" description="Institution-scoped portfolio risk, model performance, federated participation, and investigations will appear here." links={links} /></ProtectedRoute>;
}
