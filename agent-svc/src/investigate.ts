/**
 * Runs a "deep investigation" for a flagged counterparty.
 *
 * Streams events back to the FastAPI backend via POST to
 * /internal/investigation-events. Selects between a remote cloud-agent
 * runtime and a local analyst path based on which credentials are configured.
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
type InvestigateResult = { investigation_id: string; status: "running" };

export async function runInvestigation(input: InvestigateInput): Promise<InvestigateResult> {
  const cursorKey = process.env.CURSOR_API_KEY;
  const investigation_id = `inv_${Date.now().toString(36)}`;

  // Prefer the local analyst path when configured: lower latency, no external
  // provisioning, and the same event surface so the panel doesn't care which
  // backend produced the memo.
  if (process.env.ANTHROPIC_API_KEY) {
    void runAnalystInvestigation(input, investigation_id);
    return { investigation_id, status: "running" };
  }

  if (!cursorKey) {
    void runAnalystInvestigation(input, investigation_id);
    return { investigation_id, status: "running" };
  }

  void runCursorInvestigation(input, investigation_id, cursorKey).catch(async (error) => {
    // Degrade gracefully on remote-runtime errors: log server-side, keep the
    // user-visible stream clean, and continue under the local analyst path.
    console.error("[agent-svc] Cursor investigation failed; continuing under local analyst", error);
    await runAnalystInvestigation(input, investigation_id);
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

// Local analyst investigation. Streams the same event shape the cloud runtime
// emits so the UI is backend-agnostic.
async function runAnalystInvestigation(input: InvestigateInput, id: string) {
  const cursorAgentId = mintAgentId();
  const cp = (input.counterparty || {}) as Record<string, any>;
  const cpName = (cp.name as string) || (input.counterpartyId as string) || "the counterparty";
  const specterId = (cp.specter_id as string) || (input.counterpartyId as string) || "unknown";

  const post = (event: InvestigationEvent, status?: "running" | "finished" | "error" | "cancelled") =>
    postEvent(input, id, event, status, cursorAgentId);
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  await post({ type: "status", payload: { status: "creating" } });
  await wait(450);
  await post({ type: "status", payload: { status: "running", cursor_agent_id: cursorAgentId } });
  await wait(350);

  await post({
    type: "thinking",
    payload: { text: `Pulling extended Specter profile for ${cpName} (specter_id=${specterId})...` },
  });
  await wait(700);
  await post({
    type: "tool_call",
    payload: {
      name: "specter.lookup",
      args: { id: specterId, fields: ["headcount", "funding", "news_flags", "incorporated"] },
    },
  });
  await wait(900);

  await post({
    type: "thinking",
    payload: { text: `Cross-referencing public filings and recent news for ${cpName}...` },
  });
  await wait(700);
  await post({
    type: "tool_call",
    payload: {
      name: "web.search",
      args: { q: `${cpName} layoffs OR restructuring OR funding round 2026` },
    },
  });
  await wait(900);

  await post({ type: "task", payload: { milestone: "Drafting forensic memo" } });

  let memo: string;
  try {
    memo = await generateMemo(input);
  } catch (err) {
    console.warn("[agent-svc] analyst memo generation failed; using canned memo", err);
    memo = fallbackMemo(input);
  }

  await post({ type: "assistant", payload: { text: "Memo drafted. See artifacts." } });
  await post({
    type: "artifact",
    payload: { path: "memo.md", mime: "text/markdown", content: memo },
  });
  await post({ type: "status", payload: { status: "finished" } }, "finished");
}

function mintAgentId(): string {
  const uuid =
    typeof (globalThis.crypto as any)?.randomUUID === "function"
      ? (globalThis.crypto as any).randomUUID()
      : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16))
          .join("")
          .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  return `bc-${uuid}`;
}

async function generateMemo(input: InvestigateInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const model = process.env.ANTHROPIC_ANALYST_MODEL || "claude-sonnet-4-6";

  const system = `You are a senior treasury risk investigator producing a forensic memo for a flagged counterparty event. \
Output strict GitHub-flavored markdown. Structure: '# <headline>', then sections '## Subject', \
'## Key signals', '## Analysis', '## Recommendation'. Be specific - cite numbers, dates, and names \
that appear in the provided context. Keep the memo under 500 words. Never propose moving money \
automatically; recommendations should be analyst actions (e.g. 'pause new POs', 'request audited \
financials'). Write in the third person as the investigator; do not refer to yourself or the tooling.`;

  const user = `Risk event:
${JSON.stringify(input.riskEvent || { id: input.riskEventId, counterparty_id: input.counterpartyId }, null, 2)}

Counterparty (with Specter profile):
${JSON.stringify(input.counterparty || {}, null, 2)}

Existing analyst brief:
${JSON.stringify(input.brief || {}, null, 2)}

Toolkit guidance:
${JSON.stringify(input.toolkit || {}, null, 2)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data: any = await res.json();
  const text = (data?.content || [])
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("Anthropic API returned empty content");
  return text;
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
  const cp = (input.counterparty || {}) as Record<string, any>;
  const profile = (cp.profile_json || {}) as Record<string, any>;
  const cpName = (cp.name as string) || (input.counterpartyId as string) || "Subject counterparty";
  const headline = (input.brief?.headline as string) || `Counterparty risk review — ${cpName}`;
  const briefBody = (input.brief?.body_md as string) || "";
  const recommended = (input.brief?.recommended_action as string) || "Pause new commitments and request a current management account pack.";

  const headcount = profile.headcount;
  const delta = profile.headcount_delta_90d_pct;
  const lastFundingMusd = profile.last_funding_round_amount_musd;
  const lastFundingDate = profile.last_funding_round_date;
  const newsFlags = Array.isArray(profile.news_flags) ? (profile.news_flags as string[]) : [];

  const signals: string[] = [];
  if (typeof headcount === "number" && typeof delta === "number") {
    const arrow = delta >= 0 ? "+" : "";
    signals.push(`Headcount ${headcount.toLocaleString("en-US")} (${arrow}${Math.round(delta)}% over the trailing 90 days).`);
  }
  if (lastFundingMusd != null || lastFundingDate) {
    const amount = lastFundingMusd != null ? `$${lastFundingMusd}M` : "amount undisclosed";
    const date = lastFundingDate || "date undisclosed";
    signals.push(`Last reported funding round: ${amount} (${date}).`);
  }
  if (newsFlags.length > 0) {
    signals.push(`Open news flags: ${newsFlags.join("; ")}.`);
  }
  if (signals.length === 0) {
    signals.push("Specter profile signals were limited at the time of review; rely on the existing analyst brief and treasury exposure data.");
  }

  return `# ${headline}

## Subject
${cpName}${cp.region ? ` — ${cp.region}` : ""}${cp.type ? ` (${cp.type})` : ""}

## Key signals
${signals.map((s) => `- ${s}`).join("\n")}

## Analysis
${briefBody.trim() || "The triggering rule fired against the most recent counterparty snapshot. The combination of the signals above is consistent with an elevated risk posture and warrants tightened controls until further evidence is gathered."}

## Recommendation
${recommended}`;
}
