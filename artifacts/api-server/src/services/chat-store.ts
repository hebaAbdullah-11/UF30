import { and, desc, eq, sql } from "drizzle-orm";
import { db, internalChatMessagesTable, internalChatConversationsTable, internalChatTasksTable } from "@workspace/db";
import type { ChatStore } from "./chat-exchange.ts";

/** All chat writers use this same transaction-scoped lock, including across server instances. */
export async function lockChat(
  transaction: Pick<Parameters<Parameters<typeof db.transaction>[0]>[0], "execute">,
  userId: string,
  section: string,
) {
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([userId, section])}, 0))`);
}

export function chatStore(userId: string, section: string): ChatStore {
  const owner = and(eq(internalChatMessagesTable.userId, userId), eq(internalChatMessagesTable.section, section));
  const conversationOwner = and(eq(internalChatConversationsTable.userId, userId), eq(internalChatConversationsTable.section, section));
  return {
    transaction: async (_key, work) => db.transaction(async (transaction) => {
      await lockChat(transaction, userId, section);
      return work({
        findMessage: async (id) => (await transaction.select().from(internalChatMessagesTable)
          .where(and(owner, eq(internalChatMessagesTable.id, id))).limit(1))[0],
        readContext: async () => {
          const history = await transaction.select().from(internalChatMessagesTable).where(owner)
            .orderBy(desc(internalChatMessagesTable.sequence)).limit(40);
          const [conversation] = await transaction.select().from(internalChatConversationsTable).where(conversationOwner).limit(1);
          return { history: history.reverse(), state: conversation?.state };
        },
        save: async (ids, text, turn, image) => {
          if (turn.state) {
            const [conversation] = await transaction.insert(internalChatConversationsTable)
              .values({ userId, section, state: turn.state, language: turn.state.language })
              .onConflictDoUpdate({
                target: [internalChatConversationsTable.userId, internalChatConversationsTable.section],
                set: { state: turn.state, language: turn.state.language, updatedAt: new Date() },
              }).returning();
            if (!conversation) throw new Error("Unable to persist tool state.");
            // This is the existing derived task snapshot, not conversation history.
            await transaction.delete(internalChatTasksTable).where(eq(internalChatTasksTable.conversationId, conversation.id));
            if (turn.state.tasks.length) {
              await transaction.insert(internalChatTasksTable).values(turn.state.tasks.map((task, index) => ({
                conversationId: conversation.id,
                userId,
                task: task.task,
                deadline: task.deadline,
                importance: task.importance,
                impact: task.impact,
                priorityScore: task.priorityScore,
                priority: task.priority ?? index + 1,
                reason: task.reason ?? (turn.state!.language === "en" ? "Based on deadline, importance, and impact." : "بناءً على الموعد والأهمية والتأثير."),
                nextStep: task.nextStep ?? (turn.state!.language === "en" ? `Start with one small step on ${task.task}.` : `ابدأ بخطوة صغيرة واحدة في ${task.task}.`),
              })));
            }
          }
          // One transaction commits state and exactly one ordered user/assistant pair together.
          const [userMessage] = await transaction.insert(internalChatMessagesTable)
            .values({ id: ids.user, userId, section, role: "user", response: { type: "text", message: text, ...(image ? { image } : {}) } }).returning();
          const [assistantMessage] = await transaction.insert(internalChatMessagesTable)
            .values({ id: ids.assistant, userId, section, role: "assistant", response: turn.response }).returning();
          if (!userMessage || !assistantMessage) throw new Error("Unable to save the chat exchange.");
          return { userMessage, assistantMessage };
        },
      });
    }),
  };
}
