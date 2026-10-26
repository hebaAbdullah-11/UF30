import { supabaseRest } from "../../lib/supabase";
import { createMultilingualEmbedding } from "./multilingual-embedding";

export type KnowledgeMatch = {
  id: number;
  category: string | null;
  topic: string | null;
  content: string | null;
  source_type: string | null;
  source_title: string | null;
  publishing_entity: string | null;
  url: string | null;
  similarity: number;
};

export async function retrieveKnowledge(message: string) {
  const queryEmbedding = await createMultilingualEmbedding(message);
  return supabaseRest<KnowledgeMatch[]>("rpc/match_knowledge", {
    method: "POST",
    body: JSON.stringify({
      query_embedding: queryEmbedding,
      match_threshold: 0.2,
      match_count: 5,
    }),
  });
}

export async function saveUserConversation(
  accessToken: string,
  supabaseUserId: string,
  userMessage: string,
  botResponse: unknown,
) {
  await supabaseRest<unknown>("user_conversations", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      user_id: supabaseUserId,
      user_message: userMessage,
      bot_response: JSON.stringify(botResponse),
    }),
  }, accessToken);
}