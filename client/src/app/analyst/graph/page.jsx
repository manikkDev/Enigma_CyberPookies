"use client";

import ProtectedRoute from "@/components/auth/protected-route";
import PhasePlaceholder from "@/components/risk/PhasePlaceholder";

export default function RiskGraphPage() {
  return <ProtectedRoute allowedRoles={["analyst", "admin"]}><PhasePlaceholder title="Risk graph investigation" description="Pseudonymised accounts, aggregated transaction relationships, communities, and risk campaigns will be investigated here." links={[{ href: "/analyst", label: "Back to dashboard" }]} /></ProtectedRoute>;
}
