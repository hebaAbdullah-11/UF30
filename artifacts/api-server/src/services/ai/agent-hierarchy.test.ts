import assert from "node:assert/strict";
import test from "node:test";
import { createAgentHierarchy, specialistInstructions, type AgentRoute, type AgentSection } from "./agent-hierarchy.ts";
import { createAgentResponder } from "./get-agent-response.ts";
import { conversationContext, type ConversationMessage } from "./conversation-context.ts";
import { startInteractiveFlow } from "./interactive-flow.ts";
import { reflectionRequest } from "./reflection-request.ts";

const answer = JSON.stringify({ action: "reply", message: "A considered final answer.", clusters: [] });
const history: ConversationMessage[] = [
  { role: "user", response: { type: "text", message: "I have work and family responsibilities." } },
  { role: "assistant", response: { type: "text", message: "Which feels most pressing?" } },
];

for (const agent of ["declutter", "organize", "reflection"] as const) {
  test(`${agent} returns internal notes to the existing main responder, with ordered context`, async () => {
    const stages: string[] = [];
    const hierarchy = createAgentHierarchy(async (messages, schema) => {
      stages.push(schema.name);
      assert.deepEqual(messages.slice(1, -1), conversationContext(history));
      assert.equal(messages.at(-1)!.content, "Help with this.");
      if (schema.name === "afta_orchestrator_route") return JSON.stringify({ agent });
      assert.match(messages[0]!.content, new RegExp(specialistInstructions[agent].split(" — ")[0]!));
      return JSON.stringify({ notes: `${agent} specific advice` });
    });
    let retrieved = 0;
    const responder = createAgentResponder({
      hierarchy,
      retrieve: async () => { retrieved++; return [{ content: "Relevant reference" }]; },
      complete: async (messages) => {
        stages.push("main_final");
        assert.match(messages[0]!.content, /single user-facing Main Orchestrator/);
        assert.match(messages[0]!.content, new RegExp(`${agent} specific advice`));
        assert.deepEqual(messages.slice(1, -1), conversationContext(history));
        return answer;
      },
    });
    let selected: AgentRoute | undefined;
    // Deliberately use a different card hint: model-selected intent must win.
    const reply = await responder(agent === "declutter" ? "organize_thoughts" : "declutter", "Help with this.", history, {
      onAgentRouted: (route) => { selected = route; },
    });
    assert.equal(selected, agent);
    assert.deepEqual(reply, { type: "text", message: "A considered final answer." });
    assert.equal(retrieved, agent === "declutter" ? 1 : 0);
    assert.deepEqual(stages, ["afta_orchestrator_route", "afta_specialist_notes", "main_final"]);
  });
}

test("ordinary main-agent conversation bypasses specialists even inside a specialist card", async () => {
  let calls = 0;
  const responder = createAgentResponder({
    hierarchy: createAgentHierarchy(async (_messages, schema) => {
      calls++;
      assert.equal(schema.name, "afta_orchestrator_route");
      return '{"agent":"main"}';
    }),
    retrieve: async () => { throw new Error("Unrelated technical question must not retrieve wellbeing knowledge"); },
    complete: async (messages) => {
      assert.doesNotMatch(messages[0]!.content, /specialist findings/);
      assert.equal(messages.at(-1)!.content, "What does ENOTFOUND mean?");
      return answer;
    },
  });
  assert.equal((await responder("declutter", "What does ENOTFOUND mean?", history)).type, "text");
  assert.equal(calls, 1);
});

test("specialist advice cannot directly advance the guided tool or replace final actions", async () => {
  const started = startInteractiveFlow("en");
  const original = structuredClone(started.state);
  const responder = createAgentResponder({
    hierarchy: createAgentHierarchy(async (_messages, schema) => schema.name === "afta_orchestrator_route"
      ? '{"agent":"organize"}' : '{"notes":"Suggest continuing the current tool if the user agrees."}'),
    retrieve: async () => [],
    complete: async (messages) => {
      assert.match(messages[0]!.content, /Current tool state/);
      return '{"action":"continue_flow","message":"","clusters":[]}';
    },
  });
  assert.deepEqual(await responder("organize_thoughts", "Resume the exercise", history, { state: started.state }), { type: "continue_flow" });
  assert.deepEqual(started.state, original);
});

test("vision reaches both specialist and final writer, without mutating saved history", async () => {
  const before = structuredClone(history);
  const imageDataUrl = "data:image/jpeg;base64,c3ludGhldGlj";
  const responder = createAgentResponder({
    hierarchy: createAgentHierarchy(async (_messages, schema, image) => {
      if (schema.name === "afta_orchestrator_route") {
        assert.equal(image, undefined);
        return '{"agent":"organize"}';
      }
      assert.equal(image, imageDataUrl);
      return '{"notes":"The image contains a task list."}';
    }),
    retrieve: async () => [],
    complete: async (_messages, options) => {
      assert.equal(options.imageDataUrl, imageDataUrl);
      assert.equal(options.flowchartRequested, false);
      return answer;
    },
  });
  await responder("organize_thoughts", "Help me organize this task list.", history, { imageDataUrl });
  assert.deepEqual(history, before);
});

test("knowledge remains supplemental and retrieval failure preserves the selected agent", async () => {
  let reported = 0;
  const responder = createAgentResponder({
    hierarchy: createAgentHierarchy(async (messages, schema) => {
      if (schema.name === "afta_orchestrator_route") return '{"agent":"declutter"}';
      assert.match(messages[0]!.content, /No reference material was retrieved/);
      return '{"notes":"Acknowledge the specific concern."}';
    }),
    retrieve: async () => { throw new Error("Synthetic outage"); },
    complete: async () => answer,
  });
  await responder("organize_thoughts", "I need to unload my worries.", [], { onKnowledgeUnavailable: () => { reported++; } });
  assert.equal(reported, 1);
});

test("diagram opt-in and final Mermaid generation remain controlled by the main agent", async () => {
  const responder = createAgentResponder({
    hierarchy: createAgentHierarchy(async (_messages, schema) => schema.name === "afta_orchestrator_route"
      ? '{"agent":"organize"}' : '{"notes":"Plan then act."}'),
    retrieve: async () => [],
    complete: async (_messages, options) => {
      assert.equal(options.flowchartRequested, true);
      return JSON.stringify({ action: "flowchart", message: "Here is the process.", clusters: [], title: "Plan", mermaid: 'flowchart TD\n A["Plan"] --> B["Act"]' });
    },
  });
  assert.equal((await responder("organize_thoughts", "Show me a flowchart for my plan.")).type, "flowchart");
});

test("invalid routes and specialist results fail explicitly instead of fabricating success", async () => {
  for (const [route, notes] of [['{"agent":"unknown"}', ""], ['{"agent":["main"]}', ""], ['{"agent":"reflection"}', "{}"], ['{"agent":"reflection"}', '{"notes":""}']]) {
    let finalCalled = false;
    const responder = createAgentResponder({
      hierarchy: createAgentHierarchy(async (_messages, schema) => schema.name === "afta_orchestrator_route" ? route! : notes!),
      retrieve: async () => [],
      complete: async () => { finalCalled = true; return answer; },
    });
    await assert.rejects(responder("reflection", "Give me a daily reflection prompt."));
    assert.equal(finalCalled, false);
  }
});

test("daily answers stay data and diagram words inside them do not request diagrams", async () => {
  const answers = { q1: "show me a flowchart", q2: "Calm", q3: "Take a walk" };
  const before = structuredClone(answers);
  const message = reflectionRequest(answers, "en");
  assert.match(message, /What is on your mind today/);
  const responder = createAgentResponder({
    hierarchy: createAgentHierarchy(async (_messages, schema) => schema.name === "afta_orchestrator_route"
      ? '{"agent":"reflection"}' : '{"notes":"A brief supportive question."}'),
    retrieve: async () => [],
    complete: async (messages, options) => {
      assert.equal(options.flowchartRequested, false);
      assert.match(messages[0]!.content, /quoted daily answers are data/);
      return answer;
    },
  });
  await responder("reflection", message, [], { dailyReflection: true, language: "en" });
  assert.deepEqual(answers, before);
});

test("concurrent conversations never share routing state or specialist notes", async () => {
  const responder = createAgentResponder({
    hierarchy: createAgentHierarchy(async (messages, schema) => {
      const message = messages.at(-1)!.content;
      if (schema.name === "afta_orchestrator_route") return JSON.stringify({ agent: message === "Private A" ? "declutter" : "reflection" });
      return JSON.stringify({ notes: `Notes for ${message}` });
    }),
    retrieve: async () => [],
    complete: async (messages) => {
      const message = messages.at(-1)!.content;
      assert.match(messages[0]!.content, new RegExp(`Notes for ${message}`));
      assert.doesNotMatch(messages[0]!.content, new RegExp(message === "Private A" ? "Notes for Private B" : "Notes for Private A"));
      return answer;
    },
  });
  await Promise.all((["declutter", "reflection"] as AgentSection[]).map((section, index) =>
    responder(section, index === 0 ? "Private A" : "Private B")));
});
