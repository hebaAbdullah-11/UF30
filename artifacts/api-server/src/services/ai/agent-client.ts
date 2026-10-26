import { retrieveKnowledge } from "./supabase-knowledge";
import { createAgentResponder, replySchema, flowchartReplySchema } from "./get-agent-response.ts";
import { createAgentHierarchy } from "./agent-hierarchy.ts";
import { completeAgentStage } from "./model-completion.ts";
import { supabaseRest } from "../../lib/supabase";
import { createReferenceRetriever } from "./reference-retrieval.ts";

// Reuse the existing integration and model for every stage; never create another auth/provider stack.
const hierarchy = createAgentHierarchy((messages, schema, imageDataUrl) =>
  completeAgentStage(messages, schema, {
    maxTokens: schema.name === "afta_orchestrator_route" ? 120 : 900,
    timeoutMs: 20_000,
    imageDataUrl,
  }));

export const getAgentResponse = createAgentResponder({
  hierarchy,
  retrieve: retrieveKnowledge,
  retrieveReferences: createReferenceRetriever(supabaseRest),
  complete: (messages, options) => completeAgentStage(
    messages, options.flowchartRequested ? flowchartReplySchema : replySchema,
    { maxTokens: 1800, timeoutMs: 45_000, imageDataUrl: options.imageDataUrl },
  ),
});
