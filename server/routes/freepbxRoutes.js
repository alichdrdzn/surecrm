import express from "express";
const router = express.Router();

import auth from "../middlewares/auth.js";
import freepbx from "../controllers/freepbx.js";

// Admin configuration
router.get("/settings", auth, freepbx.requireAdmin, freepbx.getSettings);
router.put("/settings", auth, freepbx.requireAdmin, freepbx.saveSettings);
router.post("/settings/test", auth, freepbx.requireAdmin, freepbx.testConnection);

// Runtime introspection & telephony actions
router.get("/status", auth, freepbx.status);
router.get("/livecalls", auth, freepbx.livecalls);
router.get("/me", auth, freepbx.me);
router.put("/me/extension", auth, freepbx.setMyExtension);
router.post("/originate", auth, freepbx.originate);

// Real-time stream (JWT via ?token= - EventSource cannot send headers)
router.get("/events", freepbx.events);

export default router;
