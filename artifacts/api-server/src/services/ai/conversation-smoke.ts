/**
 * Opt-in live-provider check: synthetic in-memory chats only, no authentication
 * actions, account creation, database access, or conversation persistence.
 * Run: node --experimental-strip-types src/services/ai/conversation-smoke.ts
 */
import assert from "node:assert/strict";
import { createAgentResponder, replySchema } from "./get-agent-response.ts";
import { startInteractiveFlow } from "./interactive-flow.ts";
import type { ConversationMessage } from "./conversation-context.ts";

const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
if (!baseUrl || !apiKey) throw new Error("The existing AI integration must be configured.");
let calls = 0;
const respond = createAgentResponder({
  retrieve: async () => [],
  complete: async (messages) => {
    calls++;
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        messages,
        max_completion_tokens: 1800,
        response_format: { type: "json_schema", json_schema: replySchema },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
    const payload = await response.json() as { choices?: Array<{ message: { content?: string } }> };
    const content = payload.choices?.[0]?.message.content;
    if (!content) throw new Error("AI provider returned no content.");
    return content;
  },
});

for (const scenario of [
  { language: "en" as const, questions: ["My login is not working.", "It says ENOTFOUND.", "What should I do next?"] },
  { language: "ar" as const, questions: ["تسجيل الدخول ما يشتغل.", "يطلع لي ENOTFOUND.", "وش أسوي الحين؟"] },
]) {
  const started = startInteractiveFlow(scenario.language);
  const history: ConversationMessage[] = [{ role: "assistant", response: started.response }];
  const answers: string[] = [];
  for (const [index, question] of scenario.questions.entries()) {
    const reply = await respond("organize_thoughts", question, history, { language: scenario.language, state: started.state });
    assert.equal(reply.type, "text", "Technical conversation must not be forced into the guided task tool.");
    assert.ok(reply.message.trim());
    assert.ok(!answers.includes(reply.message), "The agent repeated a previous answer verbatim.");
    if (scenario.language === "ar") assert.match(reply.message, /[\u0600-\u06ff]/u);
    if (index === 1) assert.match(reply.message, /DNS|host|domain|resolv|server name|دومين|نطاق|اسم|عنوان|خادم|اتصال/i);
    if (index === 2) assert.match(reply.message, /DNS|host|domain|auth|service|URL|دومين|نطاق|عنوان|خادم|رابط|خدمة|مصادقة|اتصال|السيرفر/i);
    console.log(JSON.stringify({ language: scenario.language, turn: index + 1, response: reply.message }));
    answers.push(reply.message);
    history.push({ role: "user", response: { type: "text", message: question } }, { role: "assistant", response: reply });
  }
}
console.log(JSON.stringify({ passed: true, model: "gpt-5.4-mini", calls, databaseWrites: 0, accountChanges: 0 }));
