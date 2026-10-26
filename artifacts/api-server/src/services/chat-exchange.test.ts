import assert from "node:assert/strict";
import test from "node:test";
import { processChatExchange, RequestConflictError, type ChatStore, type ChatMessage, type TurnContext } from "./chat-exchange.ts";

// Isolated transaction double: no user accounts, real conversations, or database writes.
function memoryStore() {
  const messages: ChatMessage[] = [];
  const tails = new Map<string, Promise<unknown>>();
  let failSave = false;
  const store: ChatStore = {
    transaction: async (key, work) => {
      const previous = tails.get(key) ?? Promise.resolve();
      const run = previous.catch(() => {}).then(async () => {
        const pending: ChatMessage[] = [];
        const result = await work({
          findMessage: async (id) => messages.find((message) => message.id === id),
          readContext: async () => ({ history: [...messages], state: undefined }),
          save: async (ids, text, turn) => {
            if (failSave) throw new Error("Simulated database failure");
            const userMessage: ChatMessage = { id: ids.user, role: "user", response: { type: "text", message: text }, createdAt: new Date() };
            const assistantMessage: ChatMessage = { id: ids.assistant, role: "assistant", response: turn.response, createdAt: new Date() };
            pending.push(userMessage, assistantMessage);
            return { userMessage, assistantMessage };
          },
        });
        messages.push(...pending);
        return result;
      });
      tails.set(key, run);
      return run;
    },
  };
  return { store, messages, failSaves: (value: boolean) => { failSave = value; } };
}
function turn(store: ChatStore, requestId: string, text: string, generate = async (_context: TurnContext) => ({ response: { type: "text" as const, message: `Reply: ${text}` } })) {
  return processChatExchange({ userId: "isolated-user", section: "declutter", requestId, fingerprint: { text }, text, store, generate });
}

test("20 simultaneous retries generate and persist exactly one exchange", async () => {
  const { store, messages } = memoryStore();
  let generations = 0;
  const generate = async () => {
    generations++;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { response: { type: "text" as const, message: "One reply" } };
  };
  const results = await Promise.all(Array.from({ length: 20 }, () => turn(store, "same-request", "Hello", generate)));
  assert.equal(generations, 1);
  assert.equal(messages.length, 2);
  assert.equal(results.filter((result) => !result.replayed).length, 1);
  assert.equal(new Set(results.map((result) => result.exchange.assistantMessage.id)).size, 1);
});

test("rapid distinct submissions each receive one reply with all prior committed context", async () => {
  const { store, messages } = memoryStore();
  const seen: number[] = [];
  await Promise.all(["My login is not working.", "It says ENOTFOUND.", "What should I do next?"].map((text, index) =>
    turn(store, `request-${index}`, text, async ({ history }) => {
      seen.push(history.length);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { response: { type: "text", message: `Answer ${index}` } };
    })));
  assert.deepEqual(seen, [0, 2, 4]);
  assert.equal(messages.length, 6);
  assert.deepEqual(messages.map((message) => message.role), ["user", "assistant", "user", "assistant", "user", "assistant"]);
});

test("intentionally repeating text with a new request ID is allowed", async () => {
  const { store, messages } = memoryStore();
  await turn(store, "one", "Explain again");
  await turn(store, "two", "Explain again");
  assert.equal(messages.length, 4);
});

test("retry after a lost HTTP response replays saved messages without calling AI", async () => {
  const { store } = memoryStore();
  const first = await turn(store, "lost-response", "Hello");
  const replay = await turn(store, "lost-response", "Hello", async () => { throw new Error("Must not generate again"); });
  assert.deepEqual(first.exchange, replay.exchange);
  assert.equal(replay.replayed, true);
});

test("reusing a request ID for different content returns a conflict and preserves history", async () => {
  const { store, messages } = memoryStore();
  await turn(store, "same-id", "Original");
  await assert.rejects(turn(store, "same-id", "Changed"), RequestConflictError);
  assert.equal(messages.length, 2);
  assert.equal(messages[0]!.response.message, "Original");
});

test("generation/save failures preserve previous history and permit a clean retry", async () => {
  const fixture = memoryStore();
  await turn(fixture.store, "previous", "Keep this");
  const before = structuredClone(fixture.messages);
  await assert.rejects(turn(fixture.store, "fail-ai", "Hello", async () => { throw new Error("AI unavailable"); }));
  assert.deepEqual(fixture.messages, before);
  fixture.failSaves(true);
  await assert.rejects(turn(fixture.store, "fail-save", "Hello"));
  assert.deepEqual(fixture.messages, before);
  fixture.failSaves(false);
  const retried = await turn(fixture.store, "fail-save", "Hello");
  assert.equal(retried.replayed, false);
  assert.equal(fixture.messages.length, 4);
});
