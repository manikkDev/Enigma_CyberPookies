"use client";

import ProtectedRoute from "@/components/auth/protected-route";
import PhasePlaceholder from "@/components/risk/PhasePlaceholder";

export default function FairnessPage() {
  return <ProtectedRoute allowedRoles={["analyst", "admin"]}><PhasePlaceholder title="Fairness audit" description="Segment-level model utility, calibration, false-positive rates, and fairness comparisons will appear here." links={[{ href: "/analyst", label: "Back to dashboard" }]} /></ProtectedRoute>;
}
