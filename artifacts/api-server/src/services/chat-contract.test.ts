import assert from "node:assert/strict";
import test from "node:test";
import { GetInternalChatResponse, SendInternalChatMessageBody, ReflectOnDailyAnswersBody, ReflectOnDailyAnswersResponse } from "../../../../lib/api-zod/src/generated/api.ts";

test("reflection accepts exactly three bounded answers and a supported UI language", () => {
  const input = { q1: "A busy week", q2: "Hopeful", q3: "Take a walk", language: "en" };
  assert.equal(ReflectOnDailyAnswersBody.safeParse(input).success, true);
  assert.equal(ReflectOnDailyAnswersBody.safeParse({ ...input, q2: "" }).success, false);
  assert.equal(ReflectOnDailyAnswersBody.safeParse({ ...input, q1: "x".repeat(201) }).success, false);
  assert.equal(ReflectOnDailyAnswersBody.safeParse({ ...input, language: "invalid" }).success, false);
  assert.equal(ReflectOnDailyAnswersBody.safeParse({ q1: "Only one", language: "ar" }).success, false);
});

test("reflection result requires an actual visible final answer", () => {
  assert.equal(ReflectOnDailyAnswersResponse.safeParse({ message: "What helped you feel hopeful?" }).success, true);
  assert.equal(ReflectOnDailyAnswersResponse.safeParse({ message: "" }).success, false);
  assert.equal(ReflectOnDailyAnswersResponse.safeParse({ notes: "Internal-only notes" }).success, false);
});

test("saved history with more than four task choices remains readable without dropping options", () => {
  const history = [{
    id: "existing-message",
    role: "assistant",
    response: {
      type: "interactive",
      message: "Which task would you like to edit?",
      options: Array.from({ length: 7 }, (_, index) => ({
        id: `task-${index}`, value: String(index), label: `Task ${index + 1}`,
      })),
      allowFreeText: true,
      nextAction: "ask",
    },
    createdAt: new Date().toISOString(),
  }];
  const parsed = GetInternalChatResponse.parse(history);
  assert.equal(parsed.length, 1);
  const response = parsed[0]!.response;
  assert.equal(response.type, "interactive");
  if ("options" in response) assert.equal(response.options.length, 7);
  assert.equal(history[0]!.response.options.length, 7);
});

test("request IDs are validated while older callers without a request ID remain compatible", () => {
  assert.equal(SendInternalChatMessageBody.safeParse({ message: "Hello" }).success, true);
  assert.equal(SendInternalChatMessageBody.safeParse({ message: "Hello", requestId: "not-a-uuid" }).success, false);
  assert.equal(SendInternalChatMessageBody.safeParse({ message: "Hello", requestId: "123e4567-e89b-42d3-a456-426614174000" }).success, true);
});

test("image-only submissions and persisted image messages retain private object metadata, not bytes", () => {
  const image = { objectPath: "/objects/chat/synthetic/image/00000000-0000-0000-0000-000000000000.png", contentType: "image/png" };
  assert.equal(SendInternalChatMessageBody.safeParse({ image }).success, true);
  assert.equal(SendInternalChatMessageBody.safeParse({ message: "What is shown?", image }).success, true);
  assert.equal(SendInternalChatMessageBody.safeParse({ image: { ...image, contentType: "image/svg+xml" } }).success, false);
  const parsed = GetInternalChatResponse.parse([{
    id: "synthetic-image", role: "user", createdAt: new Date().toISOString(),
    response: { type: "text", message: "", image },
  }]);
  assert.deepEqual(parsed[0]?.response, { type: "text", message: "", image });
});
