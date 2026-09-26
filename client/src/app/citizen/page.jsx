"use client";

import ProtectedRoute from "@/components/auth/protected-route";
import PhasePlaceholder from "@/components/risk/PhasePlaceholder";

export default function CitizenDashboard() {
  return <ProtectedRoute allowedRoles={["citizen"]}><PhasePlaceholder title="Citizen dashboard" description="Your privacy-preserving financial risk profile, explanations, and recommended actions will appear here." links={[{ href: "/citizen/consent", label: "Privacy and consent" }, { href: "/chat", label: "Ask Arth Saathi" }]} /></ProtectedRoute>;
}
