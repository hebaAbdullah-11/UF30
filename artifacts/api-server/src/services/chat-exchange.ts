import { createHash } from "node:crypto";
import type { AgentResponse } from "@workspace/db";
import type { ConversationMessage } from "./ai/conversation-context.ts";
import type { InteractiveState } from "./ai/interactive-flow";

export type ChatMessage = ConversationMessage & { id: string; createdAt: Date };
export type Exchange = { userMessage: ChatMessage; assistantMessage: ChatMessage };
export type TurnContext = { history: ChatMessage[]; state: unknown };
export type GeneratedTurn = { response: AgentResponse; state?: InteractiveState };
export type ChatImage = { objectPath: string; contentType: string };
export interface ChatTransaction {
  findMessage(id: string): Promise<ChatMessage | undefined>;
  readContext(): Promise<TurnContext>;
  save(ids: { user: string; assistant: string }, text: string, turn: GeneratedTurn, image?: ChatImage): Promise<Exchange>;
}
export interface ChatStore {
  transaction<T>(key: string, work: (transaction: ChatTransaction) => Promise<T>): Promise<T>;
}
export class RequestConflictError extends Error {}

function digest(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

/** Stable primary keys supply durable idempotency without adding/changing database columns. */
export function turnIds(userId: string, section: string, requestId: string, input: unknown) {
  return {
    user: `turn-${digest([userId, section, requestId])}`,
    assistant: `reply-${digest([userId, section, requestId, input])}`,
  };
}

export async function processChatExchange(input: {
  userId: string;
  section: string;
  requestId: string;
  fingerprint: unknown;
  text: string;
  image?: ChatImage;
  store: ChatStore;
  generate(context: TurnContext): Promise<GeneratedTurn>;
}) {
  const ids = turnIds(input.userId, input.section, input.requestId, input.fingerprint);
  return input.store.transaction(JSON.stringify([input.userId, input.section]), async (transaction) => {
    const previous = await transaction.findMessage(ids.user);
    if (previous) {
      const assistant = await transaction.findMessage(ids.assistant);
      if (!assistant) throw new RequestConflictError("This request ID belongs to a different submission.");
      return { exchange: { userMessage: previous, assistantMessage: assistant }, replayed: true };
    }
    // Read AFTER taking the per-user/section database lock: rapid turns see committed prior replies.
    const context = await transaction.readContext();
    const turn = await input.generate(context);
    const exchange = await transaction.save(ids, input.text, turn, input.image);
    return { exchange, replayed: false };
  });
}
