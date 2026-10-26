import { completeAgentStage } from "./ai/model-completion.ts";
import { createPlannerSuggester } from "./planner-suggestions.ts";

export const suggestPlannerIdeas = createPlannerSuggester(async ({ text, language, instructions }) => {
  const raw = await completeAgentStage([
    { role: "system", content: instructions },
    { role: "user", content: JSON.stringify({ language, idea: text }) },
  ], {
    name: "planner_task_suggestions", strict: true,
    schema: {
      type: "object", additionalProperties: false, required: ["titles"],
      properties: { titles: { type: "array", minItems: 1, maxItems: 6, items: { type: "string" } } },
    },
  }, { maxTokens: 900, timeoutMs: 25_000 });
  return JSON.parse(raw).titles;
});
