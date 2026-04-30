/**
 * Spawns a Cursor Cloud Agent for a "deep investigation" of a flagged counterparty.
 *
 * Owner: D. Reads CURSOR_API_KEY from env. Streams events back to the FastAPI backend
 * (via POST/WS - simplest first cut: POST each event to /internal/investigation-events).
 *
 * Without a Cursor key this falls back to a stubbed sequence so the UI shell still works.
 */

type InvestigateInput = { riskEventId: string; counterpartyId?: string };
type InvestigateResult = { investigation_id: string; status: "running" | "fallback" };

export async function runInvestigation(input: InvestigateInput): Promise<InvestigateResult> {
  const apiKey = process.env.CURSOR_API_KEY;
  const investigation_id = `inv_${Date.now().toString(36)}`;

  if (!apiKey) {
    console.warn("[agent-svc] CURSOR_API_KEY missing - returning fallback investigation");
    void simulateFallback(input, investigation_id);
    return { investigation_id, status: "fallback" };
  }

  // TODO(D): wire up @cursor/sdk
  //
  //   import { Agent } from "@cursor/sdk";
  //   const agent = await Agent.create({
  //     apiKey,
  //     model: { id: "composer-2" },
  //     cloud: { repos: [{ url: "...repo for the agent's sandbox..." , startingRef: "main" }] },
  //   });
  //   const run = await agent.send(buildPrompt(input));
  //   for await (const event of run.stream()) {
  //     await postEvent(input.riskEventId, event);  // forward to FastAPI -> WS clients
  //   }
  //   const result = await run.wait();
  //   const artifacts = await agent.listArtifacts();
  //   ...
  //
  // For now: treat as not-yet-wired and return a stub.
  void simulateFallback(input, investigation_id);
  return { investigation_id, status: "running" };
}

async function simulateFallback(input: InvestigateInput, id: string) {
  // Fire some fake events so frontend devs can build the panel without a Cursor key.
  const apiUrl = process.env.API_URL || "http://localhost:8000";
  const beats = [
    { type: "thinking", payload: { text: "Pulling extended Specter profile…" } },
    { type: "tool_call", payload: { name: "specter.lookup", args: { id: input.counterpartyId } } },
    { type: "thinking", payload: { text: "Cross-referencing public filings…" } },
    { type: "tool_call", payload: { name: "web.search", args: { q: "STRP-COMM-EU shell company" } } },
    { type: "task", payload: { milestone: "Drafting forensic memo" } },
    { type: "assistant", payload: { text: "Memo drafted. See artifacts." } },
    { type: "artifact", payload: { path: "memo.md", mime: "text/markdown" } },
  ];
  for (const e of beats) {
    await new Promise((r) => setTimeout(r, 800));
    try {
      // Optional: forward to FastAPI which fans out to WS clients.
      await fetch(`${apiUrl}/internal/investigation-events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ investigation_id: id, event: { ...e, ts: new Date().toISOString() } }),
      }).catch(() => {});
    } catch { /* ignore - endpoint may not exist yet */ }
  }
}
