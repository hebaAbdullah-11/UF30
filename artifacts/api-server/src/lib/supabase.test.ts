import assert from "node:assert/strict";
import test from "node:test";
import { supabaseRest } from "./supabase.ts";

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