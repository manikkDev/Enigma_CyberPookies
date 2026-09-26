import express from "express";

import { ml } from "../helpers/mlClient.js";
import { consentState, fetchConsentMe, fetchProfile } from "../helpers/riskContext.js";
import { audit, authenticate, requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();
const secured = [authenticate, requireAuth];
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message });
  }
};

router.post("/start", ...secured, requireRole("analyst", "admin"), handle(async (req, res) => {
  const result = await ml.startFL(req.body);
  await audit(req, "fl.start", result.run_id, req.body);
  res.status(202).json(result);
}));

router.post("/stop/:id", ...secured, requireRole("analyst", "admin"), handle(async (req, res) => {
  const result = await ml.stopFL(req.params.id);
  await audit(req, "fl.stop", req.params.id);
  res.json(result);
}));

router.get("/runs", ...secured, handle(async (_req, res) => res.json(await ml.runs())));
router.get("/status/:id", ...secured, handle(async (req, res) => res.json(await ml.status(req.params.id))));
router.get("/summary", ...secured, handle(async (_req, res) => res.json(await ml.summary())));

router.post("/predict", ...secured, handle(async (req, res) => {
  const result = await ml.predict(req.body);
  await audit(req, "predict", req.body.run_id, { count: req.body.rows?.length || 0 });
  res.json(result);
}));

router.get("/customers", ...secured, requireRole("analyst", "admin"), handle(async (req, res) => {
  const dataset = req.query.dataset || "paysim_banks";
  const result = await ml.sample(dataset, req.query.run_id || "latest", {
    n: req.query.n || 50,
    client_id: req.user.role === "admin" ? req.query.client_id : req.user.institutionId,
  });
  res.json(result);
}));

router.get("/citizen", ...secured, requireRole("citizen"), handle(async (req, res) => {
  const consentMe = await fetchConsentMe(req);
  if (consentState(consentMe, "risk_scoring") === "revoked") {
    await audit(req, "citizen.view_blocked", req.user.id, { reason: "risk_scoring consent revoked" });
    return res.json({ scoring_disabled: true, purposes: consentMe.purposes });
  }
  // customerRef lives on the Mongo user — fetch it from the auth service.
  const profile = await fetchProfile(req).catch(() => null);
  res.json(await ml.citizen(profile?.customerRef || req.user.customerRef || req.user.id, req.query.run_id));
}));
router.get("/fairness", ...secured, requireRole("analyst", "admin"), handle(async (req, res) => res.json(await ml.fairness(req.query.run_id))));
router.get("/epsilon", ...secured, requireRole("analyst", "admin"), handle(async (req, res) => res.json(await ml.epsilon(req.query))));
router.post("/graph/seed", ...secured, requireRole("analyst", "admin"), handle(async (req, res) => {
  const result = await ml.seedGraph(req.body.run_id);
  await audit(req, "graph.seed", req.body.run_id || result.run_id, result);
  res.json(result);
}));

export default router;
