import assert from "node:assert/strict";
import test from "node:test";
import { explicitlyRequestsFlowchart, safeFlowchartSource } from "./flowchart-request.ts";
import { createAgentResponder } from "./get-agent-response.ts";
import type { ConversationMessage } from "./conversation-context.ts";

test("recognizes explicit English and Arabic visual requests", () => {
  for (const message of [
    "Show me a flowchart.", "Can you draw a flow chart of this?",
    "Visualize this process", "Visualise my login process",
    "Turn that into a diagram.", "I'd like a Mermaid flowchart",
    "I want a flowchart", "Could you show the login process as a flowchart?",
    "Make it a decision tree", "diagram this", "flowchart please",
    "Can I get a flowchart?", "Show a diagram without extra text", "Map out this process",
    "Could I see a detailed flowchart?", "I'd like to see a diagram", "وريني مخطط العملية",
    "ارسم لي مخطط انسيابي", "أبي مخطط للعملية", "سوي لي مخطط",
    "حوّلها لمخطط", "اعرض النتيجة في مخطط", "وضح العملية بصريًا",
    "اعرض مخطط بدون شرح",
    "Don't explain it, show me a flowchart instead.",
  ]) assert.equal(explicitlyRequestsFlowchart(message), true, message);
});

test("does not trigger for ordinary questions, mentions, quotations or opt-outs", () => {
  for (const message of [
    "My login is not working.", "It says ENOTFOUND.", "What should I do next?",
    "Explain the steps.", "Summarize the results.", "What is a flowchart?",
    "Why do flowcharts appear automatically?", "Show me why flowcharts help.",
    'The text says "show me a flowchart". What does that mean?',
    "What does 'show me a flowchart' mean?",
    "Don't show me a flowchart.", "Do not visualize this process",
    "Explain it without a flowchart.", "No need to create a diagram.",
    "Stop drawing flowcharts.", "لا ترسم مخطط", "بدون مخطط اشرح لي",
    "ما أبي مخطط", "وش معنى مخطط انسيابي؟", "اشرح لي وش اسوي الحين",
  ]) assert.equal(explicitlyRequestsFlowchart(message), false, message);
});

test("accepts bounded Mermaid flowcharts and blocks directives, links and executable content", () => {
  assert.match(safeFlowchartSource('flowchart TD\n A["Start"] --> B{"Ready?"}\n B -->|Yes| C["Finish"]'), /^flowchart TD/);
  assert.match(safeFlowchartSource('flowchart TD\n A["Escalate to on-call team"] --> B["Confirm receipt"]'), /on-call team/);
  assert.match(safeFlowchartSource('```mermaid\nflowchart LR\n A["ابدأ"] --> B["انتهى"]\n```'), /^flowchart LR/);
  for (const source of [
    "sequenceDiagram\nA->B: hello", 'flowchart TD\n%%{init: {"securityLevel":"loose"}}%%\nA-->B',
    'flowchart TD\nA-->B\nclick A "https://example.test"',
    'flowchart TD\nA["<img src=x onerror=alert(1)>"]',
    `flowchart TD\nA["${"x".repeat(8000)}"]`,
  ]) assert.throws(() => safeFlowchartSource(source));
});

const requestedReply = {
  action: "flowchart", message: "Here is the process.", title: "Login checks",
  mermaid: 'flowchart TD\n A["Login fails"] --> B["Read error"]\n B --> C["Check hostname"]',
  clusters: [],
};

test("a requested flowchart uses existing answer context and does not mutate guided state", async () => {
  const history: ConversationMessage[] = [
    { role: "user", response: { type: "text", message: "My login shows ENOTFOUND." } },
    { role: "assistant", response: { type: "text", message: "Read the error, then check the authentication hostname." } },
  ];
  const responder = createAgentResponder({
    retrieve: async () => [],
    complete: async (messages, options) => {
      assert.equal(options.flowchartRequested, true);
      assert.match(messages[2]!.content, /check the authentication hostname/);
      assert.match(messages[0]!.content, /Do not invent steps/);
      return JSON.stringify(requestedReply);
    },
  });
  const reply = await responder("organize_thoughts", "Show me a flowchart", history);
  assert.deepEqual(reply, { type: "flowchart", message: requestedReply.message, title: requestedReply.title, mermaid: requestedReply.mermaid });
  assert.equal(history.length, 2);
});

test("model cannot force unsolicited diagrams, and a previous flowchart request is not sticky", async () => {
  const history: ConversationMessage[] = [
    { role: "user", response: { type: "text", message: "Show me a flowchart" } },
    { role: "assistant", response: { type: "flowchart", title: requestedReply.title, message: requestedReply.message, mermaid: requestedReply.mermaid } },
  ];
  for (const message of ["What should I do next?", "Don't show a flowchart, just explain."]) {
    const responder = createAgentResponder({
      retrieve: async () => [],
      complete: async (_messages, options) => {
        assert.equal(options.flowchartRequested, false);
        return JSON.stringify(requestedReply);
      },
    });
    assert.deepEqual(await responder("declutter", message, history), { type: "text", message: requestedReply.message });
  }
});

test("ordinary text and grouped-thought responses keep their existing format", async () => {
  for (const output of [
    { action: "reply", message: "Which error appears?", clusters: [] },
    { action: "thought_clusters", message: "Two groups.", clusters: [{ label: "Work", items: ["Write report"] }] },
  ]) {
    const responder = createAgentResponder({
      retrieve: async () => [],
      complete: async (_messages, options) => {
        assert.equal(options.flowchartRequested, false);
        return JSON.stringify(output);
      },
    });
    const reply = await responder("declutter", "Help me organize this.");
    assert.deepEqual(reply, output.action === "reply"
      ? { type: "text", message: output.message }
      : { type: "thought_clusters", message: output.message, clusters: output.clusters });
  }
});

test("missing process can ask one clarification rather than fabricate a flowchart", async () => {
  const responder = createAgentResponder({
    retrieve: async () => [],
    complete: async () => JSON.stringify({ action: "reply", message: "Which process should I visualize?", clusters: [], title: "", mermaid: "" }),
  });
  assert.deepEqual(await responder("declutter", "Show me a flowchart"), { type: "text", message: "Which process should I visualize?" });
});

test("an explicitly requested diagram-only answer does not require a redundant introduction", async () => {
  const responder = createAgentResponder({
    retrieve: async () => [],
    complete: async () => JSON.stringify({ ...requestedReply, message: "" }),
  });
  const reply = await responder("declutter", "Show a flowchart without extra text");
  assert.equal(reply.type, "flowchart");
  if (reply.type === "flowchart") assert.equal(reply.message, "");
});
