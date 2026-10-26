# AFTA internal agent hierarchy

The existing AgentX/AFTA responder remains the only user-facing agent. It keeps its existing conversational instructions, ordered history, response validation, opt-in Mermaid flowcharts, vision support, knowledge integration, and guided-tool action handling.

## Per-turn execution

1. The main orchestrator's routing stage selects `main`, `declutter`, `organize`, or `reflection` using the current request and bounded ordered history. The current feature is a hint, not a forced route: a technical question in the Declutter page still goes to the main agent.
2. For a specialty request, that specialist receives its own role instructions, the same bounded conversation context, and the current request. It returns short advisory notes privately to the orchestrator, never a chat message or database write. Current image bytes are passed to both the specialist and final responder when present.
3. The original main responder synthesizes the final answer using the specialist's notes as untrusted advisory data. Existing instructions, structured reply validation, flowchart opt-in and guided-tool safeguards still apply.
4. The existing chat route saves only the original user message and final response, using its existing ownership, locking and request-id handling. No specialist identities or intermediate notes are added to chat history.

The three specialties are:

- **Declutter — تفقد الأعباء:** mental burdens, overwhelming thoughts, concerns and clarifying what matters. The existing supplemental knowledge retrieval is used for this route, including when intent comes from another card.
- **Organize — ترتيب الأفكار:** grouping thoughts, manageable actions, tasks and priorities. Existing guided controls remain deterministic explicit actions; specialists do not mutate their saved state.
- **Reflection — أسئلة التأمل اليومية:** short supportive reflection and self-awareness prompts or feedback on daily answers.

Ordinary conversation stays with the main agent and skips specialist consultation. All stages share the already-configured OpenAI integration and the existing `gpt-5.4-mini` model. Routing adds one model request; specialized turns add a second internal request before final synthesis, so latency and usage can increase. No additional provider keys or agent framework are required.

## Existing feature cards

The Declutter and Organize cards retain their existing destinations and conversations. Their section is passed as routing context.

The Daily Questions card retains the same form, questions, saved answers and save API. After saving, **Reflect on my answers with AFTA** explicitly requests feedback. The new authenticated `POST /api/daily-reflection` passes those three answers to the same orchestrator with reflection context and returns its final text. It does not write, overwrite, or delete journal answers or conversations. Feedback is ephemeral and can be requested again after reloading; saved answers remain persistent. Changing user, date or language clears the ephemeral feedback.

## Privacy and failures

- Existing session authentication and all user data are unchanged. No database migration or account reset is needed.
- Agent calls receive only context already authorized for that request. There is no global conversation state shared across users.
- Routing logs include only an event and selected agent label. They do not log prompts, specialist notes, answers, passwords, or image bytes.
- Invalid routing, specialist output or provider failures fail explicitly instead of generating fabricated success. Existing chat failures do not commit half an exchange. Reflection failure leaves saved answers intact and offers retry.
- Only one reflection request per account can run at once per API instance. This is an in-process concurrency guard, not a cross-instance rate limiter.

## Verification

- `pnpm --filter @workspace/api-server test`: routing integration, main-only behavior, cross-feature intent, ordered context, vision propagation, knowledge outage, state preservation, requested diagrams, malformed results, quoted reflection data and concurrent isolation, plus existing regressions.
- `pnpm run typecheck`
- API and frontend production builds.
- Opt-in live-provider check: `src/services/ai/agent-hierarchy-smoke.ts`. Uses synthetic prompts for each specialist, ordinary technical conversation and Arabic cross-feature routing; does not create accounts or write application data. Its output logs route labels and result types only.

Run a bundled standalone smoke check with `NODE_ENV=production` so the application logger uses ordinary JSON output rather than development-only worker transports. The actual API build continues to use its existing logging-worker bundling plugin.
