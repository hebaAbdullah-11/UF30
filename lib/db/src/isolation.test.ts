// Cross-user isolation, enforced by Postgres row-level security.
// Requires DATABASE_URL to a development database with migrations applied.
// Creates two throwaway users, then deletes them (cascading their rows).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { sql } from "drizzle-orm";
import { db, pool } from "./client";
import { withUser } from "./with-user";

const userA = `isolation-a-${randomUUID()}`;
const userB = `isolation-b-${randomUUID()}`;
const ids = { item: randomUUID(), log: randomUUID(), belief: randomUUID(), file: randomUUID() };

// Every personal table and a statement that inserts one row owned by the current user.
const personalTables: { table: string; insert: (owner: string) => ReturnType<typeof sql> }[] = [
  { table: "user_settings", insert: (owner) => sql`insert into user_settings (user_id) values (${owner})` },
  { table: "files", insert: (owner) => sql`insert into files (id, user_id, storage_key, name, mime_type, size_bytes) values (${ids.file + owner}, ${owner}, ${"k/" + owner}, 'a.pdf', 'application/pdf', 10)` },
  { table: "items", insert: (owner) => sql`insert into items (id, user_id, title, timing, recurrence) values (${ids.item + owner}, ${owner}, 'private', '{"kind":"anytime"}', '{"kind":"daily"}')` },
  { table: "item_logs", insert: (owner) => sql`insert into item_logs (id, user_id, day, entry_key, status) values (${ids.log + owner}, ${owner}, '2026-10-27', 'x', 'done')` },
  { table: "day_summaries", insert: (owner) => sql`insert into day_summaries (user_id, day, planned, done) values (${owner}, '2026-10-27', 3, 1)` },
  { table: "beliefs", insert: (owner) => sql`insert into beliefs (id, user_id, text) values (${ids.belief + owner}, ${owner}, 'private belief')` },
];

const count = async (tx: Parameters<Parameters<typeof withUser>[1]>[0], table: string, owner: string) => {
  const result = await tx.execute(sql`select count(*)::int as n from ${sql.identifier(table)} where user_id = ${owner}`);
  return (result.rows[0] as { n: number }).n;
};

before(async () => {
  for (const id of [userA, userB]) {
    await db.execute(sql`insert into auth_users (id, name, email, password_hash) values (${id}, 'Isolation test', ${id + "@example.invalid"}, 'x')`);
  }
  for (const { insert } of personalTables) {
    await withUser(userA, (tx) => tx.execute(insert(userA)));
    await withUser(userB, (tx) => tx.execute(insert(userB)));
  }
});

after(async () => {
  await db.execute(sql`delete from auth_users where id in (${userA}, ${userB})`);
  await pool.end();
});

for (const { table, insert } of personalTables) {
  test(`${table}: a user sees only their own rows`, async () => {
    await withUser(userB, async (tx) => {
      assert.equal(await count(tx, table, userA), 0, "B must not see A's rows");
      assert.equal(await count(tx, table, userB), 1, "B sees B's row");
      const all = await tx.execute(sql`select count(*)::int as n from ${sql.identifier(table)}`);
      assert.equal((all.rows[0] as { n: number }).n, 1, "an unfiltered query returns only B's row");
    });
  });

  test(`${table}: a user cannot change or delete another user's rows`, async () => {
    await withUser(userB, async (tx) => {
      const updated = await tx.execute(sql`update ${sql.identifier(table)} set user_id = user_id where user_id = ${userA}`);
      assert.equal(updated.rowCount, 0);
      const deleted = await tx.execute(sql`delete from ${sql.identifier(table)} where user_id = ${userA}`);
      assert.equal(deleted.rowCount, 0);
    });
    await withUser(userA, async (tx) => assert.equal(await count(tx, table, userA), 1, "A's row is untouched"));
  });

  test(`${table}: a user cannot create rows for another user`, async () => {
    await assert.rejects(
      withUser(userB, (tx) => tx.execute(insert(userA))),
      (error: Error & { cause?: { code?: string } }) => (error.cause?.code ?? (error as { code?: string }).code) === "42501",
    );
  });
}

test("a user cannot move their own row to another user", async () => {
  await assert.rejects(
    withUser(userB, (tx) => tx.execute(sql`update items set user_id = ${userA} where user_id = ${userB}`)),
    (error: Error & { cause?: { code?: string } }) => (error.cause?.code ?? (error as { code?: string }).code) === "42501",
  );
});

test("without a user id nothing personal is visible", async () => {
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local role app_user`);
    for (const { table } of personalTables) {
      const all = await tx.execute(sql`select count(*)::int as n from ${sql.identifier(table)}`);
      assert.equal((all.rows[0] as { n: number }).n, 0, table);
    }
  });
});

test("app_user cannot read the account table at all", async () => {
  await assert.rejects(withUser(userB, (tx) => tx.execute(sql`select email from auth_users`)));
});
