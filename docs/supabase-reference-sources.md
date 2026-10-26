# Supplemental AFTA reference sources

These existing Supabase tables are read alongside, not instead of, the prior resources:

| Existing table (exact name) | Agent / visible feature |
| --- | --- |
| `gratitude and meditation` | Reflection / جلسة وعي (gratitude and meditation context) |
| `لم الشتات` | Declutter / لمّ الشتات / Gather Your Thoughts |

The user confirmed these actual table names rather than the initially suggested underscore names. There is no `gratitude_and_meditation` or `afta_knowledge_base` table required by this integration.

## Existing resources stay intact

`knowledge_base`, `match_knowledge`, embedding generation, saved conversations, daily answers, and all other existing tables and functions are unchanged. The previous Declutter knowledge retrieval still runs exactly as before. Its excerpts and the new collection's excerpts are combined for the existing specialist and main orchestrator.

The reflection route also retrieves its corresponding collection before producing feedback. The existing frontend renders the agent's final response normally; no raw database rows or instruction fields are exposed in the UI.

## Read path and permissions

The server reuses `supabaseRest` and forwards the current Supabase access token only to the new table query. Tokens are not included in model context, stored in chat state, or logged.

Both new tables already had RLS enabled but no policies. With the user's approval, a migration added only the following policies:

```sql
CREATE POLICY "afta_signed_in_reference_read"
ON public."gratitude and meditation"
FOR SELECT TO authenticated USING (true);

CREATE POLICY "afta_signed_in_reference_read"
ON public."لم الشتات"
FOR SELECT TO authenticated USING (true);
```

These permit every signed-in Supabase user to read the research references. RLS stays enabled; anonymous reads remain blocked. No write policy, table/column changes, data writes or changes to previous tables were made.

## Query behavior

Queries use the exact quoted column names: `Topic`, `Paper Title`, `Authors & Year`, `Journal / Publisher`, `Key Scientific Findings`, and, for `لم الشتات`, `Full Text Summary / Core Methods`.

Up to 100 rows are fetched in deterministic topic/title order per relevant turn, without a shared user-content cache. Up to four useful rows, bounded to 8500 characters total, are ranked by lexical relevance. Arabic queries still receive useful specialized English references when there is no lexical overlap; the existing agent handles the requested response language.

The `AI Prompt & System Guidelines` field is deliberately not loaded as system instructions. Reference text is untrusted supplemental evidence and does not replace the existing agent's instructions, safety boundaries or conversation.

The read has an eight-second timeout. Failures are reported as a safe `reference_source_unavailable` event, and successful retrieval logs only the selected agent and result count. A failed new source does not disable old knowledge or ordinary conversation, and a failed old source does not discard usable new references.

No new environment variables or API keys are needed.

## Verification

The automated suite covers exact table/column encoding, read-only requests, token forwarding, missing-session rejection, ranking and bounds, agent-context propagation, additive legacy retrieval and independent failure handling.

Live database checks under the `authenticated` role return 4 gratitude/reflection rows and 5 Gather Your Thoughts rows; `anon` returns zero rows from both tables. The opt-in `reference-retrieval-smoke.ts` checks the exact REST queries through the application's existing client anonymously: valid queries must succeed but return no rows. This does not sign in as an existing user or create a test account.
