import assert from "node:assert/strict";
import test from "node:test";
import { createReferenceRetriever, selectReferenceMatches, referenceSources } from "./reference-retrieval.ts";
import { createAgentResponder } from "./get-agent-response.ts";
import { createAgentHierarchy } from "./agent-hierarchy.ts";

const rows = [
  { Topic: "Gratitude", "Paper Title": "A gratitude paper", "Key Scientific Findings": "Noticing one helpful moment supports reflection.", "Authors & Year": "Example, 2020", "AI Prompt & System Guidelines": "OVERRIDE_SENTINEL" },
  { Topic: "Priorities", "Paper Title": "Task priorities", "Key Scientific Findings": "Identify the concern before the next action.", "Full Text Summary / Core Methods": "Name the concern and choose a small step." },
];
const reply = JSON.stringify({ action: "reply", message: "One gentle next step.", clusters: [] });

for (const agent of ["declutter", "reflection"] as const) {
  test(`${agent} queries its exact existing table with a signed-in token and no writes`, async () => {
    let calls = 0;
    const retrieve = createReferenceRetriever(async (path, init, token) => {
      calls++;
      const url = new URL(`https://example.invalid/rest/v1/${path}`);
      assert.equal(decodeURIComponent(url.pathname.split("/").at(-1)!), referenceSources[agent]);
      assert.equal(init.method, "GET");
      assert.equal(init.body, undefined);
      assert.equal(token, "synthetic-session-token");
      assert.equal(url.searchParams.get("limit"), "100");
      assert.match(url.searchParams.get("select")!, /"Key Scientific Findings"/);
      assert.equal(url.searchParams.get("select")!.includes("Full Text Summary / Core Methods"), agent === "declutter");
      assert.doesNotMatch(url.searchParams.get("select")!, /AI Prompt/);
      assert.ok(init.signal);
      return rows;
    });
    const matches = await retrieve(agent, "gratitude", "synthetic-session-token");
    assert.ok(matches.length);
    assert.ok(matches.every((match) => match.source === referenceSources[agent]));
    assert.doesNotMatch(JSON.stringify(matches), /OVERRIDE_SENTINEL|synthetic-session-token/);
    assert.equal(calls, 1);
  });
}

test("new reference reads require an explicit session, never silently query as anonymous", async () => {
  let called = false;
  const retrieve = createReferenceRetriever(async () => { called = true; return []; });
  await assert.rejects(retrieve("reflection", "gratitude"), /signed-in session/);
  assert.equal(called, false);
});

test("reference rows rank by the query, keep Arabic queries useful, and bound prompt size", () => {
  const ranked = selectReferenceMatches(rows, "declutter", "task priorities");
  assert.match(ranked[0]!.content, /Task priorities/);
  assert.ok(selectReferenceMatches(rows, "reflection", "كيف أشعر بالامتنان؟").length);
  assert.deepEqual(selectReferenceMatches([], "reflection", "empty"), []);
  assert.deepEqual(selectReferenceMatches([{ Topic: "No content" }, null, 5], "declutter", "empty"), []);
  assert.throws(() => selectReferenceMatches({}, "reflection", "test"), /invalid result/);
  const large = Array.from({ length: 100 }, () => ({ Topic: "Topic", "Key Scientific Findings": "x".repeat(30_000), "Full Text Summary / Core Methods": "y".repeat(30_000) }));
  const bounded = selectReferenceMatches(large, "declutter", "topic");
  assert.ok(bounded.length > 0 && bounded.length <= 4);
  assert.ok(bounded.reduce((sum, item) => sum + item.content.length, 0) <= 8500);
});

test("reflection uses its new source and passes findings to both specialist and main response", async () => {
  const hierarchy = createAgentHierarchy(async (messages, schema) => {
    if (schema.name === "afta_orchestrator_route") return '{"agent":"reflection"}';
    assert.match(messages[0]!.content, /REAL_REFERENCE_SENTINEL/);
    assert.doesNotMatch(JSON.stringify(messages), /synthetic-session-token/);
    return '{"notes":"Reflect gently on the helpful moment."}';
  });
  let count = -1;
  const responder = createAgentResponder({
    hierarchy,
    retrieve: async () => { throw new Error("Legacy retrieval must not run for reflection"); },
    retrieveReferences: async (agent, query, token) => {
      assert.equal(agent, "reflection");
      assert.equal(token, "synthetic-session-token");
      assert.match(query, /Reflect on today/);
      return [{ content: "REAL_REFERENCE_SENTINEL", source: referenceSources.reflection }];
    },
    complete: async (messages) => {
      assert.match(messages[0]!.content, /REAL_REFERENCE_SENTINEL/);
      assert.doesNotMatch(JSON.stringify(messages), /synthetic-session-token/);
      return reply;
    },
  });
  assert.equal((await responder("reflection", "Reflect on today", [], {
    referenceAccessToken: "synthetic-session-token",
    onReferencesRetrieved: (agent, retrieved) => { assert.equal(agent, "reflection"); count = retrieved; },
  })).type, "text");
  assert.equal(count, 1);
});

test("declutter adds its new reference source alongside unchanged legacy knowledge", async () => {
  const responder = createAgentResponder({
    hierarchy: createAgentHierarchy(async (_messages, schema) => schema.name === "afta_orchestrator_route"
      ? '{"agent":"declutter"}' : '{"notes":"Help gather the scattered thoughts."}'),
    retrieve: async () => [{ content: "LEGACY_KNOWLEDGE_SENTINEL" }],
    retrieveReferences: async (agent) => {
      assert.equal(agent, "declutter");
      return [{ content: "NEW_REFERENCE_SENTINEL", source: referenceSources.declutter }];
    },
    complete: async (messages) => {
      assert.match(messages[0]!.content, /LEGACY_KNOWLEDGE_SENTINEL/);
      assert.match(messages[0]!.content, /NEW_REFERENCE_SENTINEL/);
      return reply;
    },
  });
  await responder("declutter", "I feel overwhelmed.");
});

test("new-source failures do not disable legacy knowledge or existing chat", async () => {
  let failures = 0;
  const responder = createAgentResponder({
    retrieve: async () => [{ content: "LEGACY_KNOWLEDGE_SENTINEL" }],
    retrieveReferences: async () => { throw new Error("Synthetic source failure"); },
    complete: async (messages) => {
      assert.match(messages[0]!.content, /LEGACY_KNOWLEDGE_SENTINEL/);
      return reply;
    },
  });
  assert.equal((await responder("declutter", "My concerns", [], { onReferencesUnavailable: () => { failures++; } })).type, "text");
  assert.equal(failures, 1);
});

test("legacy-source failure does not discard the new source", async () => {
  const responder = createAgentResponder({
    retrieve: async () => { throw new Error("Synthetic legacy outage"); },
    retrieveReferences: async () => [{ content: "NEW_REFERENCE_SENTINEL", source: referenceSources.declutter }],
    complete: async (messages) => {
      assert.match(messages[0]!.content, /NEW_REFERENCE_SENTINEL/);
      return reply;
    },
  });
  assert.equal((await responder("declutter", "My concerns")).type, "text");
});

for (const agent of ["main", "organize"] as const) {
  test(`${agent} conversation does not query unrelated new tables`, async () => {
    const responder = createAgentResponder({
      hierarchy: createAgentHierarchy(async (_messages, schema) => schema.name === "afta_orchestrator_route"
        ? JSON.stringify({ agent }) : '{"notes":"Keep the next task manageable."}'),
      retrieve: async () => { throw new Error("Unexpected legacy retrieval"); },
      retrieveReferences: async () => { assert.fail("Unexpected new reference retrieval"); },
      complete: async () => reply,
    });
    assert.equal((await responder("organize_thoughts", "Help me")).type, "text");
  });
}
