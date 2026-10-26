/** Live model verification with synthetic in-memory messages; no database/account actions. */
import assert from "node:assert/strict";
import { createAgentResponder, replySchema, flowchartReplySchema } from "./get-agent-response.ts";
import type { ConversationMessage } from "./conversation-context.ts";

const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
if (!baseUrl || !apiKey) throw new Error("The existing AI integration must be configured.");
const responder = createAgentResponder({
  retrieve: async () => [],
  complete: async (messages, options) => {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-5.4-mini", messages, max_completion_tokens: 1800,
        response_format: { type: "json_schema", json_schema: options.flowchartRequested ? flowchartReplySchema : replySchema },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
    const data = await response.json() as { choices?: Array<{ message: { content?: string } }> };
    const content = data.choices?.[0]?.message.content;
    if (!content) throw new Error("The AI provider returned no content.");
    return content;
  },
});
const history: ConversationMessage[] = [
  { role: "user", response: { type: "text", message: "The process is: receive a support ticket, check whether it is urgent, send urgent tickets to the on-call team, otherwise add it to the normal queue, then confirm receipt." } },
];
for (const item of [
  { message: "Explain this process briefly.", expected: "text" },
  { message: "Show me a flowchart of this process.", expected: "flowchart" },
  { message: "What happens to non-urgent tickets?", expected: "text" },
  { message: "ارسم لي مخطط انسيابي لنفس العملية بالعربي", expected: "flowchart" },
  { message: "لا ترسم مخطط، فقط اشرح الخطوة الأخيرة.", expected: "text" },
]) {
  const response = await responder("organize_thoughts", item.message, history);
  assert.equal(response.type, item.expected);
  if (response.type === "continue_flow") throw new Error("Unexpected tool continuation");
  if (response.type === "flowchart") {
    assert.match(response.mermaid, /flowchart|graph/);
    assert.match(response.mermaid, /-->/);
    assert.match(response.mermaid, /\{.*\}/);
    if (/[\u0600-\u06ff]/u.test(item.message)) assert.match(response.mermaid, /[\u0600-\u06ff]/u);
  }
  console.log(JSON.stringify({ request: item.message, response }));
  history.push({ role: "user", response: { type: "text", message: item.message } }, { role: "assistant", response });
}
console.log(JSON.stringify({ passed: true, model: "gpt-5.4-mini", turns: 5, databaseWrites: 0 }));
