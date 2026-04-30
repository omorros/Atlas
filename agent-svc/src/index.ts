import dotenv from "dotenv";
// Load service-local first, then fall back to the repo-root .env for shared keys.
dotenv.config();
dotenv.config({ path: "../.env" });
import express from "express";
import { runInvestigation } from "./investigate";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 8001);

app.get("/health", (_req, res) => res.json({ ok: true, service: "agent-svc" }));

app.post("/investigate", async (req, res) => {
  const { risk_event_id, counterparty_id, risk_event, counterparty, brief, toolkit } = req.body ?? {};
  if (!risk_event_id) return res.status(400).json({ error: "risk_event_id required" });
  try {
    const r = await runInvestigation({
      riskEventId: risk_event_id,
      counterpartyId: counterparty_id,
      riskEvent: risk_event,
      counterparty,
      brief,
      toolkit,
    });
    res.json(r);
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

app.listen(PORT, () => {
  console.log(`[agent-svc] listening on :${PORT}`);
});
