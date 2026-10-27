import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";

type SupabaseUser = { id: string };
type ConversationRow = {
  id: number | string;
  user_id: string;
  user_message: string;
};

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

function requireSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required for this release check.");
  }
  return { url: supabaseUrl, anonKey: supabaseAnonKey };
}

async function authenticatedSupabaseIdentity(
  request: APIRequestContext,
  accessToken: string,
) {
  const { url, anonKey } = requireSupabaseConfig();
  const response = await request.get(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as SupabaseUser;
}

async function findConversation(
  request: APIRequestContext,
  accessToken: string,
  marker: string,
) {
  const { url, anonKey } = requireSupabaseConfig();
  const response = await request.get(
    `${url}/rest/v1/user_conversations?select=id,user_id,user_message&user_message=eq.${encodeURIComponent(marker)}`,
    {
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
    },
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as ConversationRow[];
}

async function deleteConversation(
  request: APIRequestContext,
  accessToken: string,
  id: number | string,
) {
  const { url, anonKey } = requireSupabaseConfig();
  const response = await request.delete(
    `${url}/rest/v1/user_conversations?id=eq.${encodeURIComponent(String(id))}`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        Prefer: "return=minimal",
      },
    },
  );
  expect(response.ok()).toBeTruthy();
}

test("signup session and Declutter ownership survive the full auth lifecycle", async ({
  page,
  request,
  playwright,
}) => {
  test.skip(!supabaseUrl || !supabaseAnonKey, "Supabase integration is not configured.");

  const runId = randomUUID();
  const email = `e2e-${runId}@example.com`;
  const password = `Release-${runId}!`;
  const name = `Release ${runId.slice(0, 8)}`;
  const ownedMarker = `ownership-${runId}`;
  const anonymousMarker = `anonymous-${runId}`;
  let ownedConversationId: number | string | undefined;

  await page.goto("/sign-up");
  await page.locator('input[type="text"]').fill(name);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(email)).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(email)).toBeVisible();

  await page.goto("/declutter");
  await expect(page.getByTestId("list-declutter-history")).toBeVisible();

  const cookies = await page.context().cookies();
  const accessToken = cookies.find((cookie) => cookie.name === "afta_sb_access")?.value;
  expect(accessToken, "Supabase access cookie should be set after signup").toBeTruthy();

  const supabaseUser = await authenticatedSupabaseIdentity(request, accessToken!);

  const anonymous = await playwright.request.newContext({
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:80",
  });
  try {
    const anonymousWrite = await anonymous.post("/api/internal-chat/declutter", {
      data: { message: anonymousMarker, language: "en" },
    });
    expect(anonymousWrite.status()).toBe(401);

    const authenticatedWrite = await page.request.post("/api/internal-chat/declutter", {
      data: { message: ownedMarker, language: "en" },
      timeout: 90_000,
    });
    expect(authenticatedWrite.status()).toBe(201);

    const ownedRows = await findConversation(request, accessToken!, ownedMarker);
    expect(ownedRows).toHaveLength(1);
    expect(ownedRows[0]?.user_id).toBe(supabaseUser.id);
    ownedConversationId = ownedRows[0]?.id;

    const anonymousRows = await findConversation(request, accessToken!, anonymousMarker);
    expect(anonymousRows).toHaveLength(0);
  } finally {
    await anonymous.dispose();
    if (accessToken && ownedConversationId !== undefined) {
      await deleteConversation(request, accessToken, ownedConversationId);
    }
  }

  const signOut = await page.request.post("/api/auth/sign-out");
  expect(signOut.status()).toBe(204);
  await page.goto("/declutter");
  await expect(page).toHaveURL(/\/sign-in$/);

  const rejectedAfterSignOut = await page.request.post("/api/internal-chat/declutter", {
    data: { message: `signed-out-${runId}`, language: "en" },
  });
  expect(rejectedAfterSignOut.status()).toBe(401);
});