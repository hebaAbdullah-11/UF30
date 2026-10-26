import type { AgentResponse } from "@workspace/db";

export type ConversationMessage = {
  role: string;
  response: AgentResponse;
};

/** Bound the prompt without ever combining users, sections, or duplicating the current turn. */
export function conversationContext(history: ConversationMessage[]) {
  const recent: Array<{ role: "user" | "assistant"; content: string }> = [];
  let remaining = 28_000;
  for (const entry of history.slice(-40).reverse()) {
    if (entry.role !== "user" && entry.role !== "assistant") continue;
    const content = entry.response.type === "text"
      ? entry.response.message
      : JSON.stringify(entry.response);
    if (content.length > remaining) break;
    recent.push({ role: entry.role, content });
    remaining -= content.length;
  }
  return recent.reverse();
}

export function conversationLanguage(
  message: string,
  history: ConversationMessage[],
  preferred: "ar" | "en" = "ar",
): "ar" | "en" {
  // Error codes and numbers alone should not switch an Arabic conversation to English.
  const candidates = [message, ...history.filter((entry) => entry.role === "user").map((entry) => entry.response.message).reverse()];
  for (const text of candidates) {
    if (/[\u0600-\u06ff]/u.test(text)) return "ar";
    const words = text.replace(/\b[A-Z][A-Z0-9_]+\b/g, "").match(/[a-zA-Z]+/g);
    if (words && words.join("").length > 2) return "en";
  }
  return preferred;
}
