import assert from "node:assert/strict";
import test from "node:test";
import { createAgentResponder } from "./get-agent-response.ts";
import { conversationContext, conversationLanguage, type ConversationMessage } from "./conversation-context.ts";
import { startInteractiveFlow } from "./interactive-flow.ts";

test("every follow-up includes ordered user AND assistant history and current input exactly once", async () => {
  const history: ConversationMessage[] = [];
  let calls = 0;
  const questions = ["My login is not working.", "It says ENOTFOUND.", "What should I do next?"];
  const answers = ["Which error appears when you sign in?", "ENOTFOUND means the authentication hostname cannot be resolved.", "Check the configured authentication hostname for a typo, then check its service status."];
  const responder = createAgentResponder({
    retrieve: async () => [],
    complete: async (messages) => {
      assert.equal(messages[0]!.role, "system");
      assert.deepEqual(messages.slice(1, -1), conversationContext(history));
      assert.equal(messages.at(-1)!.content, questions[calls]);
      assert.equal(messages.filter((entry) => entry.content === questions[calls]).length, 1);
      return JSON.stringify({ action: "reply", message: answers[calls++], clusters: [] });
    },
  });
  for (const question of questions) {
    const reply = await responder("declutter", question, history, { language: "en" });
    assert.notEqual(reply.type, "continue_flow");
    if (reply.type === "continue_flow") throw new Error("Unexpected flow");
    history.push({ role: "user", response: { type: "text", message: question } }, { role: "assistant", response: reply });
  }
  assert.equal(calls, 3);
  assert.equal(new Set(history.filter((entry) => entry.role === "assistant").map((entry) => entry.response.message)).size, 3);
});

test("Arabic follow-ups and uppercase error codes retain conversation language", () => {
  const history: ConversationMessage[] = [{ role: "user", response: { type: "text", message: "تسجيل الدخول ما يشتغل" } }];
  assert.equal(conversationLanguage("ENOTFOUND", history, "en"), "ar");
  assert.equal(conversationLanguage("وش أسوي الحين؟", history, "en"), "ar");
  assert.equal(conversationLanguage("What should I do next?", history, "ar"), "en");
  assert.equal(conversationLanguage("3", [], "ar"), "ar");
});

test("ordinary free text can interrupt the guided tool without advancing or resetting it", async () => {
  const started = startInteractiveFlow("ar");
  const snapshot = structuredClone(started.state);
  const responder = createAgentResponder({
    retrieve: async () => { throw new Error("Should not retrieve for organizer"); },
    complete: async (messages) => {
      assert.match(messages[0]!.content, /Current tool state/);
      assert.equal(messages.at(-1)!.content, "تسجيل الدخول ما يشتغل");
      return JSON.stringify({ action: "reply", message: "وش رسالة الخطأ اللي تظهر لك عند تسجيل الدخول؟", clusters: [] });
    },
  });
  const reply = await responder("organize_thoughts", "تسجيل الدخول ما يشتغل", [
    { role: "assistant", response: started.response },
  ], { state: started.state, language: "ar" });
  assert.equal(reply.type, "text");
  assert.deepEqual(started.state, snapshot);
});

test("explicit guided answers still support continuation and retain tool state", async () => {
  const started = startInteractiveFlow("en");
  const responder = createAgentResponder({
    retrieve: async () => [],
    complete: async () => JSON.stringify({ action: "continue_flow", message: "", clusters: [] }),
  });
  assert.deepEqual(await responder("organize_thoughts", "many_tasks", [], { state: started.state }), { type: "continue_flow" });
  await assert.rejects(responder("declutter", "many_tasks"), /Unexpected tool continuation/);
});

test("supplemental retrieval failure is reported but does not replace a contextual reply", async () => {
  let reported = 0;
  const responder = createAgentResponder({
    retrieve: async () => { throw new Error("Offline"); },
    complete: async (messages) => {
      assert.match(messages[0]!.content, /No reference excerpts/);
      return JSON.stringify({ action: "reply", message: "Check the authentication hostname.", clusters: [] });
    },
  });
  const reply = await responder("declutter", "What next?", [], { onKnowledgeUnavailable: () => { reported++; } });
  assert.equal(reply.type, "text");
  assert.equal(reported, 1);
});

test("history retains structured assistant steps and is bounded without mutating saved messages", () => {
  const history: ConversationMessage[] = [
    { role: "assistant", response: { type: "task_sequence", message: "Next steps", steps: [{ order: 1, title: "Check hostname", done: false }] } },
  ];
  assert.match(conversationContext(history)[0]!.content, /Check hostname/);
  const large = Array.from({ length: 100 }, (_, index) => ({ role: "user", response: { type: "text" as const, message: `${index}: ${"x".repeat(1000)}` } }));
  const recent = conversationContext(large);
  assert.ok(recent.length < 40);
  assert.match(recent.at(-1)!.content, /^99:/);
  assert.equal(large.length, 100);
});

test("rejects empty or malformed model answers rather than saving a generic fallback", async () => {
  for (const output of ["{}", "not json", '{"action":"reply","message":"","clusters":[]}', '{"action":"thought_clusters","message":"Grouped","clusters":[]}']) {
    const responder = createAgentResponder({ retrieve: async () => [], complete: async () => output });
    await assert.rejects(responder("declutter", "Hello"));
  }
});

test("image bytes reach the provider with current text and do not implicitly enable diagrams or mutate guided state", async () => {
  const started = startInteractiveFlow("en");
  const snapshot = structuredClone(started.state);
  const data = "data:image/jpeg;base64,c3ludGhldGlj";
  const responder = createAgentResponder({
    retrieve: async () => [],
    complete: async (messages, options) => {
      assert.equal(options.imageDataUrl, data);
      assert.equal(options.flowchartRequested, false);
      assert.match(messages[0]!.content, /Inspect its visible content directly/);
      assert.equal(messages.at(-1)!.content, "What does this say?");
      return JSON.stringify({ action: "reply", message: "The image contains a short note.", clusters: [] });
    },
  });
  const reply = await responder("organize_thoughts", "What does this say?", [], { state: started.state, imageDataUrl: data });
  assert.equal(reply.type, "text");
  assert.deepEqual(started.state, snapshot);
});

test("a past image does not prevent an explicit return to the guided tool", async () => {
  const started = startInteractiveFlow("en");
  const responder = createAgentResponder({
    retrieve: async () => [],
    complete: async () => JSON.stringify({ action: "continue_flow", message: "", clusters: [] }),
  });
  assert.deepEqual(await responder("organize_thoughts", "Resume the exercise", [], {
    state: started.state, imageDataUrl: "data:image/jpeg;base64,c3ludGhldGlj", imageFromHistory: true,
  }), { type: "continue_flow" });
});
