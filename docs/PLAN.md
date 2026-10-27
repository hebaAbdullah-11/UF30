# Unbound Focus (التركيز غير المقيّد) — Daily Companion Plan

Status: **draft for approval**. No application code has been changed for this plan.

---

## 1. What exists today (findings from the repo)

| Area | What is there | Plan |
|---|---|---|
| Monorepo | pnpm workspaces: `artifacts/mindful-companion` (React 19 + Vite + Tailwind 4 + wouter + React Query), `artifacts/api-server` (Express 5, esbuild), `lib/db` (Drizzle + Postgres), `lib/api-spec` (OpenAPI → Orval → `lib/api-client-react` hooks + `lib/api-zod` schemas) | Extend as is. Every new endpoint is added to `openapi.yaml` first, then codegen. |
| Auth | Supabase Auth (email/password via REST) → linked to an internal `auth_users` row (text UUID) → signed `afta_session` cookie. The server derives `userId`; the browser never talks to Supabase directly. | **Keep unchanged.** |
| Database | Supabase Postgres (project `uf30`, **us-east-1**), accessed by the API through the transaction pooler as the database owner. RLS is on for all tables with no policies, which blocks Supabase's public API but does not restrict the server itself. | Add real per-user enforcement at database level (§6). |
| Existing planner | `/daily` + `planner_tasks` / `planner_ideas`: capture an idea → AI proposes tasks → user approves. Already "suggest, never decide". | Becomes the base of **My Day** and **Brain dump**; data migrated forward (additive, nothing deleted). |
| AI | `services/ai/*`: multi-agent chat (declutter / organize), OpenAI `gpt-5.4-mini` via `lib/integrations-openai-ai-server`, a pluggable `createPlannerSuggester`. | New `assistant` service behind one interface (§7). Existing chats are kept. |
| Organisations | `uf30_institutions`, `uf30_institution_members`, impact reports with averages only and **k ≥ 10 suppression**. | Reuse as `organizations` / `organization_members`; extend with cohorts and consent. |
| UF30 workspace | `/uf30/focus`, `/uf30/discover`, `/uf30/me`. **Device-local only** (localStorage): focus timer, discovery list. | The timer becomes `VisualTimer`; Discover moves into the server-side resource library. |
| Files | `objectStorage.ts` uses the **Replit sidecar**, which does not work on Vercel. | Replace with Supabase Storage (§8). |
| i18n | One `copy` dictionary in `src/lib/i18n.tsx` (ar/en) with a `LanguageProvider`. | Split into typed namespaces; Arabic first. |
| Theme | Two identities: AFTA (teal/sand, Cairo font) in `index.css`, and UF30 (`#2458a6`) in `pages/uf30.css`. Dark class and `prefers-reduced-motion` partly present. | New brand token layer for the app (§4). Marketing pages are left as they are for now. |
| Tests | `node:test` unit tests, a local-Postgres integration test pattern, and Playwright e2e. **No linter.** | Add ESLint (incl. `jsx-a11y`) and wire `pnpm lint`. |
| Hosting | Vercel (functions in US regions), Supabase us-east-1, OpenAI (US). | Needs your decision (§2, D1). |

---

## 2. Decisions I need from you before Phase 1

**D1. Where user data is stored (PDPL).** The Supabase project I created yesterday is in **us-east-1**, and Supabase's region list had no Saudi or Gulf option. Vercel functions and OpenAI also run outside the Kingdom. The database is still empty, so moving now costs nothing.
- (a) Stay on Supabase + Vercel for the pilot and record the cross-border transfer in a privacy notice / legal review. *(Fastest.)*
- (b) Move the Postgres database and file storage to a provider with a Saudi region before real participant data arrives. The app code stays the same; only the connection string and storage adapter change. You'd need to choose the provider and confirm its contract terms.
- I'd do (a) for development now and decide (b) before onboarding the first real cohort. I will not claim in-Kingdom hosting anywhere in the app until it is verified.

**D2. How "each user's data is private" is enforced in the database.** I recommend enforcing it inside Postgres **without changing auth**. For each request, the server runs its queries in a transaction as a restricted role `app_user` (no RLS bypass) with `app.user_id` set. RLS policies then only allow rows where `user_id = current_setting('app.user_id')`. A bug in route code can then no longer leak another user's rows. This works with the transaction pooler.
The alternative is having the browser call Supabase directly with RLS on `auth.uid()`. That is an auth change (user IDs differ), so I don't recommend it.

**D3. Live updates.** True Supabase Realtime needs the browser to hold a Supabase token, which would be an auth change, so I propose an equivalent that fits the current setup:
- Optimistic UI and sync between open tabs (`BroadcastChannel`).
- Refetch when the app regains focus or comes back online.
- A cheap `GET /api/day/changes?since=` poll every 20 s while visible, plus a midnight/Fajr rollover timer.

This gives "no reload ever" behaviour. Across devices, changes appear within about 20 s. True push-based realtime can come later if you approve exposing the Supabase token.

**D4. Free services I plan to add** (none are paid at pilot scale; tell me if any concern you):
- Supabase Storage for files. The free tier includes 1 GB; beyond that it is paid.
- Web Push with VAPID keys (free).
- Supabase `pg_cron` + `pg_net` to trigger the notification dispatcher every 5 minutes. Vercel Hobby cron can only run once a day.
- Open-source libraries: `adhan` (prayer times), `vite-plugin-pwa` / Workbox, `web-push`, `@fontsource/ibm-plex-sans-arabic` (self-hosted font so it works offline), ESLint.

**D5. The existing ADHD-subtype assessment.** `/onboarding` scores users as `inattentive` / `hyperactive_impulsive` / `combined` and stores the result. That is diagnosis-like, health-related data. It conflicts with "never ask for medical information or a diagnosis" and is sensitive under PDPL. I propose the new app **never reads it**. Should I also hide that flow? Deleting the stored results needs your explicit approval.

**D6. Prayer tracking.** Religious practice is sensitive data. I propose prayers appear as **time anchors only**: shown on the timeline and the Now card, but **not** logged and **not** counted in the commitment score. Tracking would be opt-in later if you want it.

---

## 3. Page structure

Mobile-first, full RTL. The bottom navigation becomes a side rail at ≥1024 px.

```
/welcome            Setup in < 3 min: city (or "use my location") → day start (midnight/Fajr)
                    → pick starter items (morning meditation, midday meditation, …) → done
/day                My Day — يومي
  ├ NowCard          only the current item + VisualTimer + Done / Snooze
  ├ DayProgressLine  "where am I in my day"
  ├ Timeline         prayers (anchors) + items + program readings, grouped by part of day
  ├ BeliefRotator    one affirmation at a time
  ├ CommitmentRing   today's score + 7-day bar chart; "welcome back" after a gap
  └ AddButton (+)    quick add sheet
/day/files          My files (upload, preview, download, attach to item)
/day/edit           Reorder / hide / edit items (drag + keyboard reorder)
/assistant          My Assistant — مساعدي
  ├ /assistant/know-me     3 questions (re-answerable) → schedule proposal (Apply / Edit / Dismiss)
  ├ /assistant/review      end-of-day: sort captures (Task/Idea/Worry) + 3 prompts
  ├ /assistant/weekly      weekly summary + one suggested change
  └ /assistant/resources   curated library + AI recommendations from it only
/settings           notifications, quiet hours, reminder frequency, city & method, day start,
                    theme, font size, export (JSON/CSV), organisation consent, delete account
/admin/*            role-based: cohorts & weekly content, resource library, aggregated reports
```

- **Global capture:** the centre slot of the bottom navigation is the brain-dump capture button (text or voice). It is on every page and avoids two floating buttons fighting on small screens. The "+" button appears only on My Day.
- **Existing tools** (declutter/organize chats, daily questions, dashboard) stay reachable from My Assistant under "More tools". `/daily` redirects to `/day` after its tasks are migrated.

## 4. Design system and accessibility

- **Tokens** live in `src/styles/tokens.css` as CSS variables, mapped into Tailwind `@theme`:
  - `--uf-primary #2E4BFF`, `--uf-ink #14151C`, `--uf-bg #F5F6FA`, plus surface, muted, success, warning and focus tokens.
  - A dark-mode set with contrast checked to WCAG AA (AAA for body text where possible).
  - No colour literals in components.
- **Font:** IBM Plex Sans Arabic, self-hosted. Font size is controlled by a `--uf-font-scale` setting (90–130 %), applied at the root.
- **Theme:** light / dark / system, stored in user settings and mirrored to localStorage to avoid a flash on load.
- **Motion:** all animation (celebrations, timer sweep) is wrapped in a `useReducedMotion` guard. With reduced motion, a static check mark and text replace the animation.
- **Layout:** logical CSS properties only (`ms-`/`me-`, `inset-inline-*`), never left/right. Numbers and times use `Intl` for `ar-SA`, with Latin digits as a user option.
- **Focus and screen readers:** visible focus rings via a token. Every icon button has an Arabic `aria-label`. Timers announce through a polite `aria-live` region at most once a minute.
- **i18n:** `src/i18n/{ar,en}/<namespace>.ts` with typed keys and a `t('day.now.done')` API. English may be incomplete and falls back to Arabic. No hard-coded UI strings; ESLint will flag them.

## 5. Reusable components

| Component | Responsibility |
|---|---|
| `AppShell` / `BottomNav` | Layout, safe-area insets, navigation, global capture slot |
| `NowCard` | Renders the result of the pure `getNowItem()` selector; Done / Snooze (5/10/15/30 min) |
| `VisualTimer` | Circular depleting SVG timer; pause/resume; reduced-motion aware; accessible text fallback |
| `DayProgressLine` | Horizontal line from day start to day end with a "now" marker and prayer ticks |
| `ItemCard` | Title, type icon, time or prayer anchor label, duration, status; swipe and keyboard actions |
| `ProgressRing` | Commitment ring (also reused for weekly bars) |
| `AddButton` + `QuickAddSheet` | Title only is required; smart defaults (type `task`, next free slot, 25 min, today only) |
| `CaptureButton` + `CaptureSheet` | Text or voice (browser speech recognition where available, else server transcription), saved in one tap |
| `BeliefRotator` | Rotates one belief; manage list |
| `ProposalCard` | Shows an AI-proposed change with its reason and Apply / Edit / Dismiss. The only path for AI changes. |
| `FileTile` / `FilePreview` | PDF/image preview, download, attach |
| `EmptyState`, `WelcomeBack`, `Celebration` | No-shame copy and gentle states |

## 6. Data model

Conventions follow the existing schema: `text` UUID ids, `user_id → auth_users.id`, snake_case, `created_at` / `updated_at` (timestamptz), and `deleted_at` for soft delete where useful. All new migrations are **additive**.

| Table | Key fields | Notes |
|---|---|---|
| `auth_users` (existing) | id, supabase_user_id, name, email | = **users** |
| `user_settings` | user_id PK, timezone (default `Asia/Riyadh`), city_name, lat, lng (rounded to 2 decimals), prayer_method (default `umm_al_qura`), prayer_adjust jsonb (± minutes per prayer or fixed override), day_start (`midnight`/`fajr`), theme, font_scale, digits, notifications_enabled, belief_frequency (`off`/`1h`/`2h`), quiet_start, quiet_end, org_share_consent_at | One row per user |
| `profile_answers` | id, user_id, question_key (`peak_focus`/`blockers`/`motivators`), answer jsonb, created_at | Append-only history; the latest row per key is current |
| `items` | id, user_id, title, type (`task`/`exercise`/`meditation`/`reading`/`habit`/`reminder`), source (`user`/`program`/`ai`), program_content_id?, timing (`fixed`/`prayer`/`anytime`), start_time?, anchor_prayer?, anchor_offset_min (default +10), duration_min, recurrence jsonb (`once` + date / `daily` / `weekly` + weekdays), sort_order, hidden, attachment_file_id?, timestamps, deleted_at | Prayer-anchored times are **computed at read time**, so they move automatically when prayer times change |
| `item_logs` | id, user_id, item_id? / program_content_id?, day (date), status (`done`/`snoozed`/`skipped`), snoozed_until?, at | Unique on (target, day) for `done` |
| `day_summaries` | user_id, day, planned, done, updated_at | Updated on every log change; powers the weekly chart; past days are never rewritten or reset |
| `beliefs` | id, user_id, text, active, sort_order, timestamps, deleted_at | |
| `captures` | id, user_id, text, input (`text`/`voice`), category? (`task`/`idea`/`worry`), suggested jsonb?, status (`inbox`/`sorted`/`scheduled`/`archived`), item_id?, created_at, reviewed_at | Supersedes `planner_ideas`, which is migrated in |
| `day_reviews` | user_id, day, finished, postponing, top_tomorrow | |
| `energy_checkins` | user_id, day, level (`high`/`medium`/`low`) | Optional, one per day |
| `ai_proposals` | id, user_id, kind (`schedule`/`capture_sort`/`weekly`), payload jsonb (changes + reasons), status (`pending`/`applied`/`edited`/`dismissed`), created_at, decided_at | Changes are applied **only** through `POST /proposals/:id/apply` |
| `files` | id, user_id, storage_key, name, mime, size_bytes, created_at, deleted_at | |
| `resources` | id, title, type (`podcast`/`article`/`video`/`exercise`), url, description, tags text[], language, published, created_by | Library is readable by signed-in users and editable by admins only |
| `organizations` / `organization_members` | = existing `uf30_institutions` / `uf30_institution_members` | Managers only |
| `cohorts` | id, organization_id?, name, starts_on, weeks | |
| `cohort_members` | cohort_id, user_id, joined_at | |
| `program_contents` | id, cohort_id, week, title, type, duration_min, default slot (time or prayer anchor), resource_id? / file_id?, publish_at | Shown in members' timelines at read time (no copying); a user's edits are stored as an `items` override row |
| `user_roles` | user_id, role (`admin`/`editor`) | Admin panel access |
| `push_subscriptions` | id, user_id, endpoint, p256dh, auth, created_at | |
| `prayer_times_cache` | key (lat,lng,method,month), times jsonb | Shared, non-personal |
| `ai_usage` | user_id, feature, window_start, count | Rate limiting that works across serverless instances |
| `ai_request_log` | id, feature, prompt_version, model, latency_ms, tokens, outcome, created_at | **No user id, no user text** |

**Database-level privacy (D2):**
- Every personal table gets RLS policies keyed on `current_setting('app.user_id', true)`, applied to the `app_user` role.
- All request handlers go through `withUser(userId, tx => …)`.
- Admin and organisation reporting go through `SECURITY DEFINER` SQL functions that only return aggregates, keep the existing **k ≥ 10** suppression, and include only users with `org_share_consent_at` set.
- **Isolation test:** two users. B cannot read, update or delete A's items, logs, beliefs, captures, files or proposals, both through the API (404) and directly in SQL as `app_user` with B's id set.

## 7. API and AI service boundaries

REST under `/api`, contract-first in `openapi.yaml`:

- **Day:**
  - `GET /day/today` returns the full computed timeline: prayers, items, program content, logs, summary and the current Now item.
  - `GET /day/changes?since=`
  - `POST /items`, `PATCH /items/:id`, `DELETE /items/:id`, `POST /items/reorder`
  - `POST /items/:id/done`, `POST /items/:id/snooze`
  - `GET /score/week`
- **Prayer times:** `GET /prayer-times?date=` (server computes the same as the client, for notifications)
- **Beliefs, captures, files:**
  - `/beliefs` (CRUD)
  - `/captures` (create / list), `/captures/review`
  - `/files` returns a signed upload URL; then `/files/:id/url`
- **Assistant:**
  - `/assistant/answers`, `/assistant/checkin`, `/assistant/day-review`
  - `/assistant/proposals` (create), `/assistant/proposals/:id/{apply|dismiss}`
  - `/assistant/weekly`, `/assistant/resources/recommended`
- **Settings:** `/settings`, `/push/subscribe`, `/me/export?format=json|csv`, `DELETE /me` (with confirmation step)
- **Admin:** `/admin/cohorts`, `/admin/program-contents`, `/admin/resources`, `/admin/reports` (aggregates only)
- **Cron:** `POST /cron/dispatch`, protected by `CRON_SECRET` and called by `pg_cron`. It sends due belief reminders and item reminders, respecting quiet hours.

**AI module** `artifacts/api-server/src/services/assistant/`:

```ts
interface AssistantProvider {
  proposeSchedule(input: ScheduleContext): Promise<ScheduleProposal>;   // changes + reason each
  sortCaptures(input: CaptureContext): Promise<CaptureSorting>;         // task/idea/worry + slot
  weeklyReview(input: WeeklyContext): Promise<WeeklyInsight>;           // summary + 1 change
  recommendResources(input: InterestContext, library: ResourceRef[]): Promise<string[]>; // ids only
}
```

- **Provider:** the default adapter uses the existing OpenAI integration. The model comes from an `AI_MODEL` environment variable. Swapping providers means writing one new adapter file.
- **Never called from the browser.** Inputs are built server-side from structured data with **no names or emails**.
- **Validated outputs:** every output is checked with zod. Resource recommendations are filtered to IDs that exist in the library, and URLs always come from the database, never from the model.
- **Suggest only:** proposals are stored as `pending`. Nothing is changed until the user applies them; an integration test asserts this.
- **Safety:** one shared system prompt sets a warm, short, neutral Saudi Arabic tone. It forbids blame, diagnosis, and medical or medication advice. A distress check (keywords plus model flag) returns a fixed, gentle message suggesting a qualified professional, using an admin-configurable support contact. I won't invent hotline numbers.
- **Rate limits and logging:** per user and feature per day, via `ai_usage`. Logging records metadata only (§6).

## 8. Time, prayer times, notifications, offline and files

- **Now selection:** a pure function `getNowItem(timeline, now)`:
  1. Items whose window contains `now` (snoozed items reappear at `snoozed_until`).
  2. Otherwise the next upcoming item ("starts in 12 min").
  3. Otherwise a calm "free time" state.

  It is unit-tested with fixed clocks, including edge cases: midnight, Fajr day start, overlapping items, DST-free Riyadh, and timezone changes.
- **Day boundary:** the current "day" is computed in the user's timezone. With `day_start = fajr`, anything before today's Fajr belongs to the previous day. The page rolls over automatically with a timer, without a reload.
- **Prayer times:**
  - Computed **locally** with the open-source `adhan` library using its `UmmAlQura` method (Isha = Maghrib + 90 min, 120 in Ramadan).
  - This works offline and sends the user's location to no third party.
  - Manual per-prayer adjustment or full override is stored in settings.
  - City search uses a bundled list of Saudi and Gulf cities; "use my location" uses browser geolocation with the result rounded.
  - A test checks Riyadh against published Umm al-Qura times for several dates (±1 min). Aladhan method 4 is used only as a cross-check in that test.
- **Notifications:**
  - Web Push with VAPID keys. Supports belief rotation (every 1 h / 2 h / off) and optional item reminders, and respects quiet hours.
  - The dispatcher is called every 5 minutes by `pg_cron`.
  - iOS only supports push for installed PWAs (16.4+); the app will explain that gently.
- **PWA and offline:**
  - `vite-plugin-pwa` precaches the app shell and the font.
  - `/day/today` is network-first with a cache fallback, and is also stored in IndexedDB.
  - Done / Snooze / Add / Capture work offline through an IndexedDB outbox that replays when back online.
- **Files:**
  - Stored in a **private** Supabase Storage bucket at `user/<userId>/<fileId>`.
  - Uploads go through server-issued signed URLs. Allowed types are PDF, PNG, JPG, WEBP and DOCX, at **10 MB** maximum, enforced both in the bucket configuration and on the server.
  - Downloads use 60-second signed URLs. The storage service key stays on the server only.
- **Export and delete:**
  - JSON/CSV export of all of the user's own rows.
  - Account deletion: a 2-step confirmation, then a hard delete of the user's rows, files and Supabase identity. Deleting data needs explicit user action; I will not run destructive migrations without your approval.

## 9. Privacy and PDPL checklist

- No medical, diagnosis or medication questions anywhere in the new flows (see D5).
- Data minimisation:
  - Location is rounded.
  - Prayers are not tracked (D6).
  - AI prompts contain no personal identifiers.
  - Logs contain no user content.
- Organisations see aggregates only, with consent (opt-in toggle in Settings, revocable) and k ≥ 10.
- A `docs/DATA-MAP.md` will list every store and its region: Postgres, Storage, Vercel, OpenAI, push services. This is the document for your legal review and for D1.

## 10. Phases

Each phase ends with: run the app, `pnpm lint`, `pnpm run typecheck`, unit + integration tests, a Playwright check (375 px with no horizontal scroll, light/dark, RTL), a summary, and a commit. The next phase starts only after you've seen the result.

**Phase 1 — My Day**
1. Foundations:
   - `CLAUDE.md` and ESLint
   - tokens, theme, font and i18n namespaces
   - `AppShell` and bottom navigation
   - `withUser` + RLS + **cross-user isolation test**
2. Schema: `user_settings`, `items`, `item_logs`, `day_summaries`, `beliefs`, `files`, `captures` (basic), plus migration of `planner_tasks` / `planner_ideas` into them.
3. Prayer times (`adhan`, settings, Riyadh verification test).
4. Timeline with `ItemCard`, edit/hide/reorder, `NowCard` + `VisualTimer` + Done/Snooze + celebration, `DayProgressLine`.
5. `AddButton` quick add, `BeliefRotator`, `CommitmentRing` + weekly chart + "welcome back".
6. Files (Supabase Storage).
7. Live updates (D3) and day rollover.
8. `/welcome` setup, timed by test at under 3 minutes.

**Phase 2 — Settings, notifications, PWA:** settings page, Web Push + dispatcher + quiet hours, PWA install and offline outbox, export, account deletion.

**Phase 3 — My Assistant:** know-me questions and history, energy check-in, AI schedule proposals (apply/edit/dismiss), global capture (text + voice) and end-of-day review, resource library and recommendations, weekly review, rate limits and safety.

**Phase 4 — Admin:** roles, cohorts and weekly program content, resource library management, aggregated anonymised reports with consent + k ≥ 10, development-only seed script.

## 11. Acceptance criteria → how each is verified

| Criterion | Verification |
|---|---|
| Set up a day in < 3 min | Playwright runs `/welcome` with defaults; step count ≤ 4, and timed with a person |
| Now card always correct | Table-driven unit tests of `getNowItem` + an e2e test with a mocked clock |
| Riyadh prayer times correct | Unit test against published Umm al-Qura times for ≥ 5 dates, including Ramadan |
| AI never applied without approval | Integration test: proposal creation changes no rows in `items`; only `apply` does |
| 375 px, light/dark, RTL | Playwright: `scrollWidth ≤ innerWidth` on every page, in both themes, with `dir="rtl"` |
| Users can't access others' data | API isolation test + direct SQL test as `app_user` |

## 12. Not in scope unless you ask

Native mobile apps, payments, calendar sync (Google/Outlook), and changing the marketing pages' visual identity.
