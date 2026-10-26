/** Opt-in live-provider check. Synthetic prompts only; no account or database writes. */
import assert from "node:assert/strict";
import { getAgentResponse } from "./agent-client";
import type { AgentRoute, AgentSection } from "./agent-hierarchy";
import { reflectionRequest } from "./reflection-request";
import { logger } from "../../lib/logger";

const cases: Array<{ section: AgentSection; message: string; route: AgentRoute; dailyReflection?: boolean }> = [
  { section: "declutter", message: "I feel overwhelmed by worries about work and family. Help me unload what is on my mind.", route: "declutter" },
  { section: "organize_thoughts", message: "Help me organize my tasks: write a report, buy groceries, and study for my exam. Break these into manageable next steps.", route: "organize" },
  { section: "reflection", message: reflectionRequest({ q1: "A busy week", q2: "Hopeful but tired", q3: "Take a ten-minute walk" }, "en"), route: "reflection", dailyReflection: true },
  { section: "declutter", message: "My login error says ENOTFOUND. What does that error mean?", route: "main" },
  { section: "organize_thoughts", message: "أحتاج أفضفض عن القلق والضغوط اللي في بالي، بدون قائمة مهام.", route: "declutter" },
];

async function main() {
  for (const item of cases) {
    let selected: AgentRoute | undefined;
    const result = await getAgentResponse(item.section, item.message, [], {
      dailyReflection: item.dailyReflection,
      onAgentRouted: (route) => { selected = route; },
    });
    assert.equal(selected, item.route);
    assert.notEqual(result.type, "continue_flow");
    assert.notEqual(result.type, "flowchart");
    assert.ok("message" in result && result.message.trim());
    logger.info({ event: "hierarchy_smoke_pass", section: item.section, agent: selected, responseType: result.type }, "Live routing and final reply passed");
  }
}

main().catch((error: unknown) => {
  logger.error({ event: "hierarchy_smoke_failed", errorType: error instanceof Error ? error.name : "Unknown" }, "Live hierarchy smoke failed");
  process.exitCode = 1;
});
