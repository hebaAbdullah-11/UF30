/** Read-only reference sources. Never use a service key or alter the legacy knowledge RPC. */
export const referenceSources = {
  declutter: "لم الشتات",
  reflection: "gratitude and meditation",
} as const;

type ReferenceAgent = keyof typeof referenceSources;
type ReferenceClient = (path: string, init: RequestInit, accessToken?: string) => Promise<unknown>;
type ReferenceRow = Record<string, unknown>;
export type ReferenceMatch = { content: string; source: string };

const commonColumns = ["Topic", "Paper Title", "Authors & Year", "Journal / Publisher", "Key Scientific Findings"];

function text(row: ReferenceRow, column: string) {
  return typeof row[column] === "string" ? row[column].trim().slice(0, 3500) : "";
}

function words(value: string) {
  return new Set(value.toLowerCase().normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/gu, "")
    .replace(/[أإآ]/gu, "ا")
    .match(/[\p{L}\p{N}]{2,}/gu) ?? []);
}

/** Rank bounded, current reference rows without new schemas, embeddings, or database functions. */
export function selectReferenceMatches(rows: unknown, agent: ReferenceAgent, query: string): ReferenceMatch[] {
  if (!Array.isArray(rows)) throw new Error("Reference data returned an invalid result.");
  const terms = words(query);
  const ranked = rows.filter((row): row is ReferenceRow => Boolean(row && typeof row === "object" && !Array.isArray(row)))
    .map((row, index) => {
      const findings = text(row, "Key Scientific Findings");
      const methods = agent === "declutter" ? text(row, "Full Text Summary / Core Methods") : "";
      // Instruction-like columns are intentionally not promoted to agent/system instructions.
      // Scientific findings and core methods are the reference material, not an agent replacement.
      if (!findings && !methods) return null;
      const topic = text(row, "Topic");
      const title = text(row, "Paper Title");
      const topicTerms = words(`${topic} ${title}`);
      const bodyTerms = words(`${findings} ${methods}`);
      let score = 0;
      for (const term of terms) score += (topicTerms.has(term) ? 3 : 0) + (bodyTerms.has(term) ? 1 : 0);
      return {
        score, index,
        match: {
          source: referenceSources[agent],
          content: JSON.stringify({
            source: referenceSources[agent], topic, title,
            authors: text(row, "Authors & Year"), publisher: text(row, "Journal / Publisher"),
            findings, ...(methods ? { methods } : {}),
          }),
        },
      };
    }).filter((entry) => entry !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  // These small, specialized collections are useful even for Arabic queries against English papers.
  // Lexical overlap ranks the rows; it is not an unreliable cross-language exclusion threshold.
  const result: ReferenceMatch[] = [];
  let remaining = 8500;
  for (const entry of ranked.slice(0, 4)) {
    if (entry.match.content.length > remaining) continue;
    result.push(entry.match);
    remaining -= entry.match.content.length;
  }
  return result;
}

export function createReferenceRetriever(client: ReferenceClient) {
  return async (agent: ReferenceAgent, query: string, accessToken?: string): Promise<ReferenceMatch[]> => {
    if (!accessToken?.trim()) throw new Error("A signed-in session is required for reference data.");
    const columns = agent === "declutter" ? [...commonColumns, "Full Text Summary / Core Methods"] : commonColumns;
    const params = new URLSearchParams({
      select: columns.map((column) => `"${column}"`).join(","),
      order: '"Topic".asc.nullslast,"Paper Title".asc.nullslast',
      limit: "100",
    });
    const rows = await client(`${encodeURIComponent(referenceSources[agent])}?${params}`, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    }, accessToken);
    return selectReferenceMatches(rows, agent, query);
  };
}
