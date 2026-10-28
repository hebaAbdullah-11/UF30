import { and, asc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  db,
  internalChatMessagesTable,
  internalChatConversationsTable,
  type AgentResponse,
} from "@workspace/db";
import {
  GetInternalChatParams,
  GetInternalChatResponse,
  SendInternalChatMessageBody,
  SendInternalChatMessageParams,
  SendInternalChatMessageResponse,
  StartNewInternalChatConversationBody,
  StartNewInternalChatConversationParams,
  StartNewInternalChatConversationResponse,
  UpdateInternalChatStepBody,
  UpdateInternalChatStepParams,
  UpdateInternalChatStepResponse,
} from "@workspace/api-zod";
import { getAgentResponse } from "../services/ai/agent-client.ts";
import { getSessionUserId } from "../lib/session";
import {
  advanceInteractiveFlow,
  readInteractiveState,
  shouldExtractActionableTasks,
  startInteractiveFlow,
  startNewOrganizeConversation,
} from "../services/ai/interactive-flow";
import { extractActionableTasks } from "../services/ai/semantic-task-extraction";
import { getSupabaseRequestAuth } from "../lib/supabase";
import { saveUserConversation } from "../services/ai/supabase-knowledge";
import { processChatExchange, RequestConflictError, type ChatMessage } from "../services/chat-exchange.ts";
import { chatStore, lockChat } from "../services/chat-store.ts";
import { conversationLanguage } from "../services/ai/conversation-context.ts";
import { loadChatImage, MediaError } from "../services/chat-media";
import { errorInfo } from "../lib/error-info";

const router: IRouter = Router();

function publicMessage(message: ChatMessage) {
  const response =
    message.response.type === "priority_list"
      ? {
          ...message.response,
          items: message.response.items.map(({ priorityScore: _score, ...item }) => item),
        }
      : message.response;
  return {
    id: message.id,
    role: message.role,
    response,
    createdAt: message.createdAt,
  };
}

router.get("/internal-chat/:section", async (req, res): Promise<void> => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication is required to continue." });
    return;
  }

  const params = GetInternalChatParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "That section is not available." });
    return;
  }

  const requestedLanguage = req.query.language === "en" ? "en" : "ar";
  const messages = await db.transaction(async (transaction) => {
    await lockChat(transaction, userId, params.data.section);
    const history = await transaction.select().from(internalChatMessagesTable)
      .where(and(eq(internalChatMessagesTable.userId, userId), eq(internalChatMessagesTable.section, params.data.section)))
      .orderBy(asc(internalChatMessagesTable.sequence));
    if (params.data.section === "organize_thoughts" && history.length === 0) {
      const started = startInteractiveFlow(requestedLanguage);
      const [conversation] = await transaction.insert(internalChatConversationsTable)
        .values({ userId, section: params.data.section, state: started.state, language: requestedLanguage })
        .onConflictDoNothing().returning();
      if (conversation) {
        const [greeting] = await transaction.insert(internalChatMessagesTable)
          .values({ userId, section: params.data.section, role: "assistant", response: started.response }).returning();
        if (greeting) return [greeting];
      }
    }
    return history;
  });
  res.json(GetInternalChatResponse.parse(messages.map(publicMessage)));
});

router.post("/internal-chat/:section/new-conversation", async (req, res): Promise<void> => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication is required to continue." });
    return;
  }

  const params = StartNewInternalChatConversationParams.safeParse(req.params);
  const body = StartNewInternalChatConversationBody.safeParse(req.body);
  if (!params.success || !body.success || params.data.section !== "organize_thoughts") {
    res.status(400).json({ error: "A new conversation is not available for that section." });
    return;
  }

  const started = startNewOrganizeConversation(body.data.language);
  const assistantMessage = await db.transaction(async (transaction) => {
    await lockChat(transaction, userId, params.data.section);
    const [conversation] = await transaction
      .select()
      .from(internalChatConversationsTable)
      .where(
        and(
          eq(internalChatConversationsTable.userId, userId),
          eq(internalChatConversationsTable.section, params.data.section),
        ),
      )
      .limit(1);

    if (conversation) {
      await transaction
        .update(internalChatConversationsTable)
        .set({ state: started.state, language: started.state.language, updatedAt: new Date() })
        .where(eq(internalChatConversationsTable.id, conversation.id));
    } else {
      await transaction.insert(internalChatConversationsTable).values({
        userId,
        section: params.data.section,
        state: started.state,
        language: started.state.language,
      });
    }

    const [created] = await transaction
      .insert(internalChatMessagesTable)
      .values({
        userId,
        section: params.data.section,
        role: "assistant",
        response: started.response,
      })
      .returning();
    if (!created) throw new Error("Unable to create the new conversation prompt.");
    return created;
  });

  res.status(201).json(StartNewInternalChatConversationResponse.parse(publicMessage(assistantMessage)));
});

router.post("/internal-chat/:section", async (req, res): Promise<void> => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication is required to continue." });
    return;
  }

  const params = SendInternalChatMessageParams.safeParse(req.params);
  const body = SendInternalChatMessageBody.safeParse(req.body);
  if (!params.success || !body.success || (!body.data.message?.trim() && !body.data.option && !body.data.image) || (body.data.image && body.data.option)) {
    res.status(400).json({ error: "Write a message before sending." });
    return;
  }

  const text = body.data.message?.trim() ?? body.data.option?.label ?? "";
  const supabaseAuth = await getSupabaseRequestAuth(req, res).catch(() => null);
  if (!supabaseAuth) {
    res.status(401).json({ error: "Sign in again to continue securely." });
    return;
  }
  try {
    const result = await processChatExchange({
      userId,
      section: params.data.section,
      requestId: body.data.requestId ?? randomUUID(),
      fingerprint: { message: text, option: body.data.option?.value ?? null, language: body.data.language ?? null, ...(body.data.image ? { image: body.data.image } : {}) },
      text,
      image: body.data.image,
      store: chatStore(userId, params.data.section),
      generate: async ({ history, state: persistedState }) => {
        const language = conversationLanguage(text, history, body.data.language);
        const state = params.data.section === "organize_thoughts"
          ? readInteractiveState(persistedState, language)
          : undefined;
        // Read private bytes server-side: the model receives actual image data,
        // never only a filename, inaccessible URL, or credential-bearing signed URL.
        const priorImage = !body.data.image && !body.data.option
          ? history.slice().reverse().find((entry) => entry.role === "user" && entry.response.type === "text" && entry.response.image)?.response
          : undefined;
        const image = body.data.image ?? (priorImage?.type === "text" ? priorImage.image : undefined);
        let imageBuffer: Buffer | undefined;
        let priorImageUnavailable = false;
        if (body.data.image) {
          imageBuffer = await loadChatImage(userId, body.data.image.objectPath);
        } else if (image) {
          try {
            imageBuffer = await loadChatImage(userId, image.objectPath);
          } catch {
            // An unavailable older attachment must not disable ordinary text chat.
            priorImageUnavailable = true;
            req.log.warn({ event: "prior_image_unavailable" }, "Earlier image unavailable for reinspection");
          }
        }
        // Clicks are explicit tool actions. Free text is understood conversationally first.
        const reply = body.data.option && state
          ? { type: "continue_flow" as const }
          : await getAgentResponse(params.data.section, text, history, {
              language,
              state,
              priorImageUnavailable,
              referenceAccessToken: supabaseAuth.accessToken,
              ...(imageBuffer ? { imageDataUrl: `data:image/jpeg;base64,${imageBuffer.toString("base64")}`, imageFromHistory: !body.data.image } : {}),
              onKnowledgeUnavailable: () => req.log.warn({ event: "knowledge_unavailable" }, "Supplemental knowledge unavailable"),
              onReferencesUnavailable: () => req.log.warn({ event: "reference_source_unavailable" }, "Supplemental reference source unavailable"),
              onReferencesRetrieved: (agent, count) => req.log.info({ event: "references_retrieved", agent, count }, "Supplemental references retrieved"),
              onAgentRouted: (agent) => req.log.info({ event: "agent_routed", agent }, "Chat routing selected"),
            });
        if (reply.type !== "continue_flow") return { response: reply };
        if (!state) throw new Error("Tool state is not available.");
        if (body.data.option) {
          // Reject obsolete/double clicks after another turn has advanced the tool.
          const lastTool = history.slice().reverse().find((entry) =>
            entry.role === "assistant" && (entry.response.type === "interactive" || entry.response.type === "priority_list"));
          const available = lastTool && "options" in lastTool.response ? lastTool.response.options : [];
          if (!available.some((option) => option.id === body.data.option!.id && option.value === body.data.option!.value)) {
            throw new RequestConflictError("That option is no longer active. Reload the conversation.");
          }
        }
        const extractedTasks = shouldExtractActionableTasks(state, {
          message: body.data.message,
          hasOption: Boolean(body.data.option),
        }) ? await extractActionableTasks(text) : undefined;
        const transition = advanceInteractiveFlow(
          state,
          { message: text, value: body.data.option?.value, optionId: body.data.option?.id, extractedTasks },
          language,
        );
        return { response: transition.response, state: transition.state };
      },
    });
    if (!result.replayed) {
      // Local history is authoritative. A failed supplemental mirror must not discard a
      // committed reply or turn a retry into another generation/save of the same exchange.
      await saveUserConversation(supabaseAuth.accessToken, supabaseAuth.user.id, text, result.exchange.assistantMessage.response)
        .catch(() => req.log.warn({ event: "conversation_mirror_failed" }, "Chat saved locally; supplemental mirror failed"));
    }
    res.status(201).json(SendInternalChatMessageResponse.parse({
      userMessage: publicMessage(result.exchange.userMessage),
      assistantMessage: publicMessage(result.exchange.assistantMessage),
    }));
  } catch (error) {
    if (error instanceof MediaError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof RequestConflictError) {
      res.status(409).json({ error: error.message });
      return;
    }
    req.log.error({ event: "chat_turn_failed", ...errorInfo(error) }, "Unable to complete chat turn");
    res.status(503).json({
      error: "Your companion needs a brief pause. Please try again.",
    });
  }
});

router.patch(
  "/internal-chat/:section/messages/:messageId/steps/:order",
  async (req, res): Promise<void> => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication is required to continue." });
      return;
    }

    const params = UpdateInternalChatStepParams.safeParse(req.params);
    const body = UpdateInternalChatStepBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "That task step is not valid." });
      return;
    }

    const updated = await db.transaction(async (transaction) => {
      await lockChat(transaction, userId, params.data.section);
      await transaction.execute(sql`
        select 1
        from ${internalChatMessagesTable}
        where ${internalChatMessagesTable.id} = ${params.data.messageId}
          and ${internalChatMessagesTable.userId} = ${userId}
          and ${internalChatMessagesTable.section} = ${params.data.section}
        for update
      `);

      const [message] = await transaction
        .select()
        .from(internalChatMessagesTable)
        .where(
          and(
            eq(internalChatMessagesTable.id, params.data.messageId),
            eq(internalChatMessagesTable.userId, userId),
            eq(internalChatMessagesTable.section, params.data.section),
          ),
        )
        .limit(1);

      if (!message) return { kind: "not_found" as const };
      if (message.response.type !== "task_sequence") {
        return { kind: "not_tasks" as const };
      }
      if (
        !message.response.steps.some(
          (step) => step.order === params.data.order,
        )
      ) {
        return { kind: "missing_step" as const };
      }

      const response: AgentResponse = {
        ...message.response,
        steps: message.response.steps.map((step) =>
          step.order === params.data.order
            ? { ...step, done: body.data.done }
            : step,
        ),
      };
      const [saved] = await transaction
        .update(internalChatMessagesTable)
        .set({ response })
        .where(eq(internalChatMessagesTable.id, message.id))
        .returning();
      return saved
        ? { kind: "updated" as const, message: saved }
        : { kind: "not_found" as const };
    });

    if (updated.kind === "not_found") {
      res.status(404).json({ error: "Message not found." });
      return;
    }
    if (updated.kind === "not_tasks") {
      res.status(400).json({ error: "This message does not contain tasks." });
      return;
    }
    if (updated.kind === "missing_step") {
      res.status(400).json({ error: "That task step does not exist." });
      return;
    }
    res.json(
      UpdateInternalChatStepResponse.parse(publicMessage(updated.message)),
    );
  },
);

export default router;