"use client";

import ProtectedRoute from "@/components/auth/protected-route";
import PhasePlaceholder from "@/components/risk/PhasePlaceholder";

export default function ConsentPage() {
  return <ProtectedRoute allowedRoles={["citizen"]}><PhasePlaceholder title="Privacy and consent" description="Purpose-level consent, consent history, data access, and erasure requests will be managed here." links={[{ href: "/citizen", label: "Back to dashboard" }]} /></ProtectedRoute>;
}
