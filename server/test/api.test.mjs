import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.SERVER_URL || "http://localhost:5002";

const login = async (email, password) => {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, `login failed for ${email}`);
  return (await response.json()).token;
};

test("unauthenticated requests are rejected", async () => {
  for (const path of ["/api/consent/me", "/api/audit", "/api/risk-graph/overview"]) {
    const response = await fetch(`${BASE}${path}`);
    assert.equal(response.status, 401, `${path} should require auth`);
  }
});

test("citizen role cannot reach analyst-only endpoints", async () => {
  const token = await login("citizen@arthsaathi.demo", "Citizen@123");
  const response = await fetch(`${BASE}/api/risk-graph/overview`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 403);
});

test("consent revoke persists and re-grant restores it", async (t) => {
  const token = await login("citizen@arthsaathi.demo", "Citizen@123");
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  let response = await fetch(`${BASE}/api/consent`, {
    method: "POST",
    headers,
    body: JSON.stringify({ purpose: "risk_scoring", granted: false }),
  });
  assert.equal(response.status, 201);
  // The gateway enforces consent before calling the ML service — verified via
  // the chatbot backend; here we assert the persisted state flips.
  let me = await (await fetch(`${BASE}/api/consent/me`, { headers })).json();
  assert.equal(me.purposes.risk_scoring, false);

  response = await fetch(`${BASE}/api/consent`, {
    method: "POST",
    headers,
    body: JSON.stringify({ purpose: "risk_scoring", granted: true }),
  });
  assert.equal(response.status, 201);
  me = await (await fetch(`${BASE}/api/consent/me`, { headers })).json();
  assert.equal(me.purposes.risk_scoring, true);
});

test("export returns consent history and audit trail", async () => {
  const token = await login("citizen@arthsaathi.demo", "Citizen@123");
  const response = await fetch(`${BASE}/api/consent/export`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  const bundle = await response.json();
  assert.ok(bundle.subject);
  assert.ok(Array.isArray(bundle.consent_history));
  assert.ok(Array.isArray(bundle.audit_entries));
});
