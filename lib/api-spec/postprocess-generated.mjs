import { readFile, writeFile } from "node:fs/promises";

// Orval currently emits both a path-parameter Zod schema and a query-parameter
// TypeScript type with the same operation name when an operation has both.
// The generated API schema is the runtime validator used by the server; omit
// only the duplicate type barrel export while retaining the generated file.
const barrel = new URL("../api-zod/src/generated/types/index.ts", import.meta.url);
const source = await readFile(barrel, "utf8");
await writeFile(
  barrel,
  source.replace("export * from './getInternalChatParams';\n", ""),
);