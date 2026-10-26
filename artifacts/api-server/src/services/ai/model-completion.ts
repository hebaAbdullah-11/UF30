import { openai } from "@workspace/integrations-openai-ai-server";
import type { AgentMessage } from "./agent-hierarchy.ts";

/** All agents share the current model, provider, structured output and image handling. */
export async function completeAgentStage(
  messages: AgentMessage[],
  schema: { name: string; strict: true; schema: Record<string, unknown> },
  options: { maxTokens: number; timeoutMs: number; imageDataUrl?: string },
) {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    max_completion_tokens: options.maxTokens,
    messages: messages.map((message, index) => options.imageDataUrl && index === messages.length - 1
      ? { role: "user" as const, content: [
          { type: "text" as const, text: message.content || "Please describe this image." },
          { type: "image_url" as const, image_url: { url: options.imageDataUrl, detail: "auto" as const } },
        ] }
      : message),
    response_format: { type: "json_schema", json_schema: schema },
  }, { timeout: options.timeoutMs, maxRetries: 0 });
  const content = completion.choices[0]?.message.content;
  if (!content) throw new Error("The agent returned no content.");
  return content;
}
