/**
 * Spawns a Cursor Cloud Agent for a "deep investigation" of a flagged counterparty.
 *
 * Owner: D. Reads CURSOR_API_KEY from env. Streams events back to the FastAPI backend
 * (via POST/WS - simplest first cut: POST each event to /internal/investigation-events).
 *
 * Without a Cursor key this falls back to a stubbed sequence so the UI shell still works.
 */

type InvestigationEventType = "thinking" | "tool_call" | "task" | "assistant" | "status" | "artifact";
type InvestigationEvent = { type: InvestigationEventType; payload: Record<string, unknown>; ts?: string };
type InvestigateInput = {
  riskEventId: string;
  counterpartyId?: string;
  riskEvent?: Record<string, unknown>;
  counterparty?: Record<string, unknown> | null;
  brief?: Record<string, unknown> | null;
  toolkit?: Record<string, unknown>;
};
type InvestigateResult = { investigation_id: string; status: "running" | "fallback" };

export async function runInvestigation(input: InvestigateInput): Promise<InvestigateResult> {
  const apiKey = process.env.CURSOR_API_KEY;
  const investigation_id = `inv_${Date.now().toString(36)}`;

  if (!apiKey) {
    console.warn("[agent-svc] CURSOR_API_KEY missing - returning fallback investigation");
    void simulateFallback(input, investigation_id);
    return { investigation_id, status: "fallback" };
  }

  void runCursorInvestigation(input, investigation_id, apiKey).catch(async (error) => {
    console.error("[agent-svc] Cursor investigation failed; falling back", error);
    await postEvent(input, investigation_id, {
      type: "status",
      payload: { status: "error", message: String(error?.message ?? error) },
    }, "error");
    await simulateFallback(input, investigation_id);
  });
  return { investigation_id, status: "running" };
}

async function runCursorInvestigation(input: InvestigateInput, id: string, apiKey: string) {
  const { Agent } = await import("@cursor/sdk");
  const repoUrl = process.env.CURSOR_REPO_URL;
  const startingRef = process.env.CURSOR_STARTING_REF || "main";
  const model = process.env.CURSOR_MODEL ? { id: process.env.CURSOR_MODEL } : undefined;
  const cloud = repoUrl
    ? { env: { type: "cloud" as const }, repos: [{ url: repoUrl, startingRef }] }
    : { env: { type: "cloud" as const } };

  await postEvent(input, id, { type: "status", payload: { status: "creating" } });
  const agent = await Agent.create({
    apiKey,
    name: `Radar investigation ${input.riskEventId}`,
    model,
    cloud,
  });

  try {
    await postEvent(input, id, {
      type: "status",
      payload: { status: "running", cursor_agent_id: agent.agentId },
    });

    const run = await agent.send(buildPrompt(input));
    if (run.supports("stream")) {
      for await (const message of run.stream()) {
        const event = mapSdkMessage(message);
        if (event) await postEvent(input, id, event, undefined, agent.agentId);
      }
    }

    const result = await run.wait();
    await postEvent(
      input,
      id,
      {
        type: "assistant",
        payload: { text: result.result || `Cursor agent finished with status ${result.status}` },
      },
      result.status === "finished" ? "finished" : "error",
      agent.agentId,
    );

    for (const artifact of await agent.listArtifacts()) {
      let content: string | undefined;
      try {
        content = (await agent.downloadArtifact(artifact.path)).toString("utf8");
      } catch {
        content = undefined;
      }
      await postEvent(
        input,
        id,
        {
          type: "artifact",
          payload: {
            path: artifact.path,
            mime: mimeForPath(artifact.path),
            size_bytes: artifact.sizeBytes,
            content,
          },
        },
        undefined,
        agent.agentId,
      );
    }
  } finally {
    agent.close();
  }
}

async function simulateFallback(input: InvestigateInput, id: string) {
  // Fire some fake events so frontend devs can build the panel without a Cursor key.
  const beats: InvestigationEvent[] = [
    { type: "status", payload: { status: "running", mode: "fallback" } },
    { type: "thinking", payload: { text: "Pulling extended Specter profile..." } },
    { type: "tool_call", payload: { name: "specter.lookup", args: { id: input.counterpartyId } } },
    { type: "thinking", payload: { text: "Cross-referencing public filings..." } },
    { type: "tool_call", payload: { name: "web.search", args: { q: "STRP-COMM-EU shell company" } } },
    { type: "task", payload: { milestone: "Drafting forensic memo" } },
    { type: "assistant", payload: { text: "Memo drafted. See artifacts." } },
    {
      type: "artifact",
      payload: {
        path: "memo.md",
        mime: "text/markdown",
        content: fallbackMemo(input),
      },
    },
    { type: "status", payload: { status: "finished", mode: "fallback" } },
  ];
  for (const e of beats) {
    await new Promise((r) => setTimeout(r, 800));
    await postEvent(input, id, e, e.type === "status" && e.payload.status === "finished" ? "finished" : undefined);
  }
}

async function postEvent(
  input: InvestigateInput,
  id: string,
  event: InvestigationEvent,
  status?: "running" | "finished" | "error" | "cancelled",
  cursorAgentId?: string,
) {
  const apiUrl = process.env.API_URL || "http://localhost:8000";
  try {
    await fetch(`${apiUrl}/internal/investigation-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        investigation_id: id,
        risk_event_id: input.riskEventId,
        cursor_agent_id: cursorAgentId,
        status,
        event: { ...event, ts: event.ts || new Date().toISOString() },
      }),
    }).catch(() => {});
  } catch {
    /* ignore - backend may be restarting in dev */
  }
}

function buildPrompt(input: InvestigateInput): string {
  return `You are a treasury risk investigator for Counterparty Risk Radar.

Produce a concise forensic memo for the flagged risk event. Focus on payment/counterparty risk, what changed, what evidence supports it, and what the CFO should do next. Do not suggest moving money automatically.

Risk event:
${JSON.stringify(input.riskEvent || { id: input.riskEventId, counterparty_id: input.counterpartyId }, null, 2)}

Counterparty:
${JSON.stringify(input.counterparty || {}, null, 2)}

Existing analyst brief:
${JSON.stringify(input.brief || {}, null, 2)}

Toolkit guidance:
${JSON.stringify(input.toolkit || {}, null, 2)}

Return the memo as markdown and keep it under 600 words.`;
}

function mapSdkMessage(message: any): InvestigationEvent | null {
  if (!message || typeof message !== "object") return null;
  if (message.type === "thinking") return { type: "thinking", payload: { text: message.text || "" } };
  if (message.type === "tool_call") {
    return {
      type: "tool_call",
      payload: { name: message.name, status: message.status, args: message.args, result: message.result },
    };
  }
  if (message.type === "task") return { type: "task", payload: { status: message.status, text: message.text } };
  if (message.type === "status") return { type: "status", payload: { status: message.status, message: message.message } };
  if (message.type === "assistant") {
    const text = message.message?.content
      ?.filter((block: any) => block?.type === "text")
      ?.map((block: any) => block.text)
      ?.join("\n");
    return { type: "assistant", payload: { text: text || "" } };
  }
  return null;
}

function mimeForPath(path: string): string {
  if (path.endsWith(".md")) return "text/markdown";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

function fallbackMemo(input: InvestigateInput): string {
  const cp = (input.counterparty?.name as string | undefined) || input.counterpartyId || "counterparty";
  const headline = (input.brief?.headline as string | undefined) || "Counterparty risk investigation";
  return `# ${headline}

## Subject
${cp}

## Findings
- Cursor SDK key is not configured, so this is a simulated investigation stream.
- Specter and analyst context were forwarded successfully to the sidecar.
- The demo path is healthy: API -> sidecar -> internal event ingress -> WebSocket clients.

## Recommendation
Keep this event in review until the live Cursor Cloud Agent key is configured, then rerun Investigate Further for a real memo.`;
}
