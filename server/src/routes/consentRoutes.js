import crypto from "crypto";
import express from "express";

import Consent, { CONSENT_PURPOSES } from "../models/Consent.js";
import AuditLog from "../models/AuditLog.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/requireRole.js";
import { recordAudit } from "../utils/audit.js";

const router = express.Router();

router.post("/", protect, async (req, res) => {
  try {
    const { purpose, granted } = req.body;
    if (!CONSENT_PURPOSES.includes(purpose) || typeof granted !== "boolean") {
      return res.status(400).json({ message: "A valid purpose and boolean granted value are required" });
    }
    const consent = await Consent.create({
      user: req.user._id,
      purpose,
      granted,
      institutionId: req.user.institutionId,
      ip: req.ip,
    });
    await recordAudit({
      req,
      action: granted ? "consent.grant" : "consent.revoke",
      target: purpose,
      meta: { version: consent.version },
    });
    return res.status(201).json({ ok: true, consent });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/me", protect, async (req, res) => {
  try {
    const history = await Consent.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    const purposes = Object.fromEntries(CONSENT_PURPOSES.map((purpose) => [purpose, false]));
    const seen = new Set();
    for (const entry of history) {
      if (!(entry.purpose in purposes) || seen.has(entry.purpose)) continue;
      purposes[entry.purpose] = entry.granted;
      seen.add(entry.purpose);
    }
    return res.json({ purposes, history });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// DPDP access right: machine-readable export of everything held about the user.
router.get("/export", protect, async (req, res) => {
  try {
    const history = await Consent.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    const purposes = Object.fromEntries(CONSENT_PURPOSES.map((purpose) => [purpose, null]));
    const seen = new Set();
    for (const entry of history) {
      if (!(entry.purpose in purposes) || seen.has(entry.purpose)) continue;
      purposes[entry.purpose] = entry.granted;
      seen.add(entry.purpose);
    }
    const auditEntries = await AuditLog.find({ actor: req.user._id }).sort({ createdAt: -1 }).limit(200).lean();
    await recordAudit({ req, action: "data.export", target: req.user._id });
    return res.json({
      exported_at: new Date().toISOString(),
      subject: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        institutionId: req.user.institutionId,
        customerRef: req.user.customerRef,
      },
      purposes,
      consent_history: history,
      audit_entries: auditEntries,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/erase-request", protect, requireRole("citizen"), async (req, res) => {
  try {
    const ticketId = `erase_${crypto.randomUUID()}`;
    await recordAudit({ req, action: "data.erase_request", target: ticketId });
    return res.status(202).json({ ok: true, ticketId, status: "received" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;
