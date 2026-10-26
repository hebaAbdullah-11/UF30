/** Opt-in live REST syntax/RLS check. Anonymous reads only; never create users or change data. */
import assert from "node:assert/strict";
import { supabaseRest } from "../../lib/supabase";
import { logger } from "../../lib/logger";
import { createReferenceRetriever } from "./reference-retrieval";

async function main() {
  // Exercise the exact production query through the existing client, but deliberately
  // omit user credentials: the approved policy must not expose references anonymously.
  const retrieveAnonymously = createReferenceRetriever((path, init) => supabaseRest(path, init));
  for (const agent of ["declutter", "reflection"] as const) {
    const matches = await retrieveAnonymously(agent, "Synthetic reference check", "synthetic-query-builder-token");
    assert.equal(matches.length, 0);
    logger.info({ event: "reference_rest_smoke_pass", agent, visibleRows: 0 }, "Live reference REST query valid and anonymous reads blocked");
  }
}

main().catch((error: unknown) => {
  logger.error({ event: "reference_rest_smoke_failed", errorType: error instanceof Error ? error.name : "Unknown" }, "Live reference REST check failed");
  process.exitCode = 1;
});
