import { openai } from "@workspace/integrations-openai-ai-server";

const taskListSchema = {
  name: "actionable_task_list",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      tasks: {
        type: "array",
        minItems: 1,
        maxItems: 20,
        items: { type: "string", minLength: 1 },
      },
    },
    required: ["tasks"],
  },
} as const;

function normalizeTasks(value: unknown): string[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { tasks?: unknown }).tasks)) {
    throw new Error("Semantic task extraction returned an invalid response.");
  }
  const tasks = (value as { tasks: unknown[] }).tasks
    .filter((task): task is string => typeof task === "string")
    .map((task) => task.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  const unique = [...new Set(tasks)].slice(0, 20);
  if (!unique.length) throw new Error("No actionable tasks were found in the submitted message.");
  return unique;
}

export async function extractActionableTasks(text: string): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    messages: [
      {
        role: "system",
        content: [
          "Extract distinct actionable tasks from the user's message.",
          "Understand Arabic, including Gulf dialects, and English.",
          "Use meaning and context, not punctuation alone.",
          "Commas, Arabic commas, semicolons, bullets, and new lines are useful signals but are not required.",
          "Do not split every Arabic conjunction و. Split only when it introduces a separate action with its own verb, object, or clear intended outcome.",
          "Keep coordinated words that belong to one action together.",
          "Treat background facts as context rather than tasks unless they express an intended action.",
          "Do not invent deadlines, priorities, details, or tasks.",
          "Return concise task phrases in the user's language and preserve their intended meaning.",
          "Example: عندي هاكثون وأبي أجهز العرض وأرسل السي في وأخلص المشروع",
          "Tasks: تجهيز العرض، إرسال السيرة الذاتية، إنهاء المشروع",
        ].join("\n"),
      },
      { role: "user", content: text },
    ],
    response_format: {
      type: "json_schema",
      json_schema: taskListSchema,
    },
  });

  const content = response.choices[0]?.message.content;
  if (!content) throw new Error("Semantic task extraction returned no content.");
  return normalizeTasks(JSON.parse(content));
}