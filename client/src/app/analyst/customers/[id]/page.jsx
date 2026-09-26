"use client";

import ProtectedRoute from "@/components/auth/protected-route";
import PhasePlaceholder from "@/components/risk/PhasePlaceholder";

export default function CustomerRiskPage() {
  return <ProtectedRoute allowedRoles={["analyst", "admin"]}><PhasePlaceholder title="Customer risk explanation" description="A calibrated risk score, model version, local feature contributions, and permitted graph context will appear here." links={[{ href: "/analyst", label: "Back to dashboard" }]} /></ProtectedRoute>;
}
