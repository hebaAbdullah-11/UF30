import assert from "node:assert/strict";
import test from "node:test";
import { signUpWithSupabase, supabaseRest } from "./supabase.ts";

test("accepts successful Supabase writes with an empty response body", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalAnonKey = process.env.SUPABASE_ANON_KEY;

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalAnonKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = originalAnonKey;
  });

  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  globalThis.fetch = async () => new Response(null, { status: 201 });

  const result = await supabaseRest("user_conversations", {
    method: "POST",
    body: JSON.stringify({ user_id: "user-id" }),
  });

  assert.equal(result, undefined);
});
test("sign-up returns the user when Supabase requires email confirmation", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalAnonKey = process.env.SUPABASE_ANON_KEY;

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalAnonKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = originalAnonKey;
  });

  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";

  // With "Confirm email" on, Supabase answers with the user object itself and no session.
  globalThis.fetch = async () => Response.json({ id: "supabase-user-id", email: "a@example.com", confirmation_sent_at: "2026-10-28T11:53:58Z" });
  const pending = await signUpWithSupabase("a@example.com", "password123", "A");
  assert.equal(pending.user.id, "supabase-user-id");
  assert.equal("access_token" in pending && pending.access_token, null);

  // With confirmation off, Supabase answers with a session that contains the user.
  globalThis.fetch = async () => Response.json({ access_token: "at", refresh_token: "rt", expires_in: 3600, user: { id: "supabase-user-id" } });
  const session = await signUpWithSupabase("a@example.com", "password123", "A");
  assert.equal(session.user.id, "supabase-user-id");
  assert.equal("access_token" in session && session.access_token, "at");
});
