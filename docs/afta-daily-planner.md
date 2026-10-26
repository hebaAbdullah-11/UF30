# AFTA daily planner

## Full feature integration

The public `/uf30/afta` feature center exposes all existing AFTA entry points:
the daily planner and idea inbox, declutter chat, organizing/prioritization chat,
daily questions and explicitly requested reflection, personal onboarding portal,
and account dashboard. Its catalog is also visible on the UF30 registration page
before registration; landing and UF30 workspace navigation link to the center.
The original routes, chat media, authentication, and saved data are reused without
copying or merging records. A shared navigation bar on AFTA pages provides a route
back to the center and UF30. The original `/afta` introductory page is retained.

The hub is public and does not load assessment, conversation, or reflection data.
Selecting a saved-data tool continues through the existing authentication guard.
UF30 registration is never made a prerequisite for AFTA tools.

```sh
pnpm --filter @workspace/mindful-companion run test:afta-features
```

The authenticated `/daily` page is part of AFTA. It is linked from the dashboard,
both existing chat tools, and the UF30 registration completion panel. Existing
chat tools still operate independently. The planner never loads assessment
results, old chat content, or daily reflection answers.

## Consent and persistence

- `/api/planner` derives ownership from the existing signed AFTA session.
- New storage is confined to `planner_tasks` and `planner_ideas`.
- Saving an idea saves its text only. AI generation saves proposals only.
- Only IDs explicitly submitted to the approval endpoint become tasks.
- Rejected and unselected proposals remain in the inbox. A rejected proposal may
  be approved later. Approved proposals cannot create another task on retry.
- Approval locks the account-owned idea row and saves tasks plus decisions in a
  single database transaction, including across concurrent server instances.
- The current day uses the browser's local calendar, not a UTC-truncated instant.
  Overdue pending tasks stay eligible; the visible queue is at most three ordinary
  items plus a stored program exercise if available. No program content is invented.
- "Not now" defaults to tomorrow, or a selected later day. The original reminder
  time is retained; an untimed item gets 09:00. Counts update after actions.
- Reminders are scheduled records, not closed-browser notifications. Durable
  notification delivery and approved program material are separately planned.

## AI boundary

`createPlannerSuggester` accepts a replaceable provider and instruction string.
The default adapter reuses AFTA's existing model-completion integration but does
not invoke its chat orchestrator, knowledge retrieval, history, or assessments.
The only user input sent to the provider is the newly captured idea and requested
language. Invalid outputs and provider failures return an explicit 503; the idea
remains saved and manual task creation remains available.

## Setup and checks

For an existing development database, the dedicated additive migration is:

```sh
pnpm --filter @workspace/db run migrate:planner
```

It creates only the planner tables and indexes. The existing post-merge Drizzle
schema push also discovers these new tables. Do not reset existing accounts or
databases when applying this change.

```sh
pnpm --filter @workspace/api-server run test:planner
pnpm --filter @workspace/api-server run test:planner:integration
pnpm run typecheck
pnpm run build
```

The integration check creates two unique **local-only development** account
fixtures, exercises the real router and database (including concurrent approvals,
negative ownership checks, both AI languages and provider failure), and removes
only its fixture rows in teardown. It does not create Supabase users.

`planner-browser-fixture.ts` can likewise create and clean local-only fixtures
for focused browser checks using `tsx` from the scripts workspace. It writes
short-lived signed fixture sessions only to the ignored `generated-artifacts`
directory with restrictive permissions. Run it with `--cleanup` after use. The
browser's unchanged `/api/auth/me` shell may be intercepted for these fixtures;
planner requests must remain real. This is not a test of Supabase sign-in.
