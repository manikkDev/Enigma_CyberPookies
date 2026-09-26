"use client";

import ProtectedRoute from "@/components/auth/protected-route";
import PhasePlaceholder from "@/components/risk/PhasePlaceholder";

export default function FederatedLearningPage() {
  return <ProtectedRoute allowedRoles={["analyst", "admin"]}><PhasePlaceholder title="Federated learning control" description="Start training runs, monitor client participation and convergence, and compare privacy budgets here." links={[{ href: "/analyst", label: "Back to dashboard" }]} /></ProtectedRoute>;
}
