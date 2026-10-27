# UF30 — Unbound Focus (التركيز غير المقيّد)

Arabic-first, RTL, mobile-first daily companion for adults in the UF30 focus program,
plus the older AFTA tools (chats, planner, daily questions) and UF30 marketing pages.

## Stack and layout

pnpm workspace (Node 24 target, TypeScript 5.9):

| Path | What |
|---|---|
| `artifacts/mindful-companion` | React 19 + Vite + Tailwind 4 + wouter + React Query frontend |
| `artifacts/api-server` | Express 5 API, bundled with esbuild (`build.mjs`); also served on Vercel via `api/index.mjs` |
| `lib/db` | Drizzle ORM schema (`src/schema/*`), `withUser`, SQL migrations (`migrations/NNNN_*.sql`) |
| `lib/api-spec` | `openapi.yaml` — the API contract; Orval generates the two packages below |
| `lib/api-client-react` | Generated React Query hooks (do not edit `src/generated`) |
| `lib/api-zod` | Generated zod schemas used by the server to validate requests/responses |
| `lib/integrations-openai-ai-server` | OpenAI client (vendored) |

Hosting: Vercel (`vercel.json`) + Supabase Postgres (project `axwknospkhtarihidtif`, us-east-1).
Auth: Supabase Auth via REST → internal `auth_users` row → signed `afta_session` cookie. The server
derives the user id with `getSessionUserId(req)`; the browser never talks to Supabase directly.

## Commands

```sh
pnpm install
pnpm lint                      # ESLint (typescript-eslint, react-hooks, jsx-a11y)
pnpm run typecheck             # builds libs, then typechecks every package
pnpm --filter @workspace/api-spec run codegen      # after editing openapi.yaml
pnpm --filter @workspace/db run migrate            # apply new SQL migrations (needs DATABASE_URL)
pnpm --filter @workspace/api-server test           # API unit tests (node:test)
pnpm --filter @workspace/api-server run build && PORT=5000 node artifacts/api-server/dist/index.mjs
cd artifacts/mindful-companion && PORT=5173 BASE_PATH=/ npx vite   # frontend dev server
```

Local env for the API: `DATABASE_URL`, `SESSION_SECRET`, `AI_INTEGRATIONS_OPENAI_BASE_URL`,
`AI_INTEGRATIONS_OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (see `.env.example`).
In dev the frontend needs `/api` proxied to the API (Vercel/Replit do this in production).

## Conventions

**API is contract-first.** Add or change endpoints in `lib/api-spec/openapi.yaml`, run codegen, then
implement the route with the generated zod schemas and call it with the generated hooks.

**Database changes are SQL migrations.** Add `lib/db/migrations/NNNN_name.sql` (next number), mirror the
tables in `lib/db/src/schema/*.ts` for typed queries, run `migrate` locally. For Supabase, apply the same
SQL (and insert its name into `schema_migrations`). Never run `drizzle-kit push` against Supabase: it is
not aware of the RLS policies. Migrations are additive; dropping columns/tables or deleting data needs
explicit approval from the project owner.

**Privacy is enforced in Postgres.** Every personal table has `user_id text references auth_users(id)`,
RLS enabled, and a policy `user_id = app_user_id()` for role `app_user`, plus grants to `app_user`.
Route handlers access personal tables only through `withUser(userId, tx => …)` from `@workspace/db`.
Every new personal table gets a case in the cross-user isolation test.

**IDs and time.** Text UUID ids (`randomUUID`), `created_at`/`updated_at timestamptz`, `deleted_at` for
soft delete where useful. A user's "day" is a local date string (`YYYY-MM-DD`) in their timezone
(default `Asia/Riyadh`); day logic lives in pure, unit-tested functions.

**UI.**
- Colours, font and radius come from `src/styles/tokens.css` (`--uf-*`) through the semantic Tailwind
  tokens in `src/index.css` (`bg-primary`, `text-muted-foreground`, …). No colour literals in components.
- Brand: primary `#2E4BFF`, ink `#14151C`, background `#F5F6FA`, font IBM Plex Sans Arabic (self-hosted).
- RTL first: logical utilities only (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`, `text-start`), never left/right.
- Every UI string goes through i18n (Arabic required, English optional with Arabic fallback).
- Accessibility: visible focus, Arabic `aria-label` on icon buttons, respect `prefers-reduced-motion`,
  no horizontal scroll at 375 px, works in light and dark.
- Tone: warm, short, no blame or guilt; never reset or shame missed days.

**AI.** Server-side only, behind a provider interface. The AI suggests; nothing changes until the user
applies it. No diagnosis, medical or medication advice. Prompts carry no names/emails; logs carry no
user text. Recommendations may only reference items that exist in our own resource library.

**Commits.** Run `pnpm lint`, `pnpm run typecheck` and the relevant tests before committing.
